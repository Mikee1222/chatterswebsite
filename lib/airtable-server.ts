/**
 * Server-only Airtable REST API client for reading/writing records.
 * Never import this from client components. Use in Server Components, Route Handlers, or Server Actions.
 */

import { sanitizePayloadForAirtable } from "@/lib/airtable-sanitize";

const AIRTABLE_API = "https://api.airtable.com/v0";
const AIRTABLE_META_API = "https://api.airtable.com/v0/meta";

/** Short-lived dedupe cache for identical listRecords GETs (reduces 429s from parallel refreshes). */
const LIST_RECORDS_CACHE_TTL_MS = 30_000;
type ListRecordsCacheEntry = {
  expiresAt: number;
  payload: { records: AirtableRecord<unknown>[]; offset?: string };
};
const listRecordsReadCache = new Map<string, ListRecordsCacheEntry>();

function pruneExpiredListRecordsCache() {
  const now = Date.now();
  for (const [key, entry] of listRecordsReadCache) {
    if (entry.expiresAt <= now) listRecordsReadCache.delete(key);
  }
}

/** Drop cached `listRecords` pages for a table so creates/updates/deletes are visible immediately. */
export function invalidateListRecordsReadCacheForTable(tableName: string): void {
  for (const key of [...listRecordsReadCache.keys()]) {
    try {
      const parsed = JSON.parse(key) as { t?: string };
      if (parsed.t === tableName) listRecordsReadCache.delete(key);
    } catch {
      listRecordsReadCache.delete(key);
    }
  }
}

function listRecordsCacheKey(tableName: string, params: ListParams): string {
  return JSON.stringify({
    t: tableName,
    pageSize: params.pageSize ?? null,
    offset: params.offset ?? null,
    filterByFormula: params.filterByFormula ?? null,
    sort: params.sort ?? null,
    fields: params.fields ?? null,
  });
}

function cloneListRecordsPayload<T>(
  data: { records: AirtableRecord<T>[]; offset?: string }
): { records: AirtableRecord<T>[]; offset?: string } {
  return {
    records: data.records.map((r) => ({
      id: r.id,
      createdTime: r.createdTime,
      fields: { ...(r.fields as object) } as T,
    })),
    offset: data.offset,
  };
}

function getConfig() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    throw new Error("AIRTABLE_TOKEN and AIRTABLE_BASE_ID must be set");
  }
  return { token, baseId };
}

/** Airtable base schema (tables and fields). Used to discover exact field names (case-sensitive). */
export type AirtableTableSchema = {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    options?: { choices?: Array<{ id?: string; name: string }> };
  }>;
};

export type AirtableBaseSchema = {
  tables: AirtableTableSchema[];
};

/** Fetch base schema from Airtable Meta API. Logs shifts table field names and status options. */
export async function getBaseSchema(): Promise<AirtableBaseSchema> {
  const { token, baseId } = getConfig();
  const url = `${AIRTABLE_META_API}/bases/${baseId}/tables`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable Meta API ${res.status}: ${text}`);
  }
  const data = (await res.json()) as AirtableBaseSchema;
  const shiftsTable = data.tables?.find((t) => t.name === "shifts" || t.name === "Shifts");
  if (shiftsTable && process.env.NODE_ENV !== "production") {
    const statusField = shiftsTable.fields.find((f) => f.name.toLowerCase() === "status");
    console.log("[getBaseSchema] shifts table discovered", {
      tableId: shiftsTable.id,
      tableName: shiftsTable.name,
      fieldNames: shiftsTable.fields.map((f) => f.name),
      statusFieldName: statusField?.name ?? null,
      statusFieldType: statusField?.type ?? null,
      statusOptions: statusField?.options?.choices?.map((c) => c.name) ?? null,
    });
  }
  return data;
}

/** Fetch one record from a table (no filter) to inspect actual field names and values. For debugging. */
export async function getSampleRecordFields(tableName: string): Promise<Record<string, unknown> | null> {
  const { records } = await listRecords(tableName, { pageSize: 1 });
  const rec = records[0];
  if (!rec?.fields) return null;
  const fieldNames = Object.keys(rec.fields);
  if (process.env.NODE_ENV !== "production") {
    console.log("[getSampleRecordFields]", {
      tableName,
      fieldNames,
      statusValue: (rec.fields as Record<string, unknown>).status ?? (rec.fields as Record<string, unknown>).Status,
      allFieldValues: rec.fields as Record<string, unknown>,
    });
  }
  return rec.fields as Record<string, unknown>;
}

export type AirtableRecord<T = Record<string, unknown>> = {
  id: string;
  createdTime?: string;
  fields: T;
};

export type ListParams = {
  pageSize?: number;
  offset?: string;
  sort?: { field: string; direction?: "asc" | "desc" }[];
  /** Airtable formula: use double quotes for string literals, e.g. {status} = "active" (not single quotes). */
  filterByFormula?: string;
  /** Optional caller id for debug logs when filterByFormula is used */
  _caller?: string;
  fields?: string[];
};

async function airtableFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { token } = getConfig();
  const res = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[airtableFetch] API error", { status: res.status, path, body: text });
    throw new Error(`Airtable API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** List records from a table. Table name must match base (e.g. modelss, whales). */
export async function listRecords<T = Record<string, unknown>>(
  tableName: string,
  params: ListParams = {}
): Promise<{ records: AirtableRecord<T>[]; offset?: string }> {
  const { baseId } = getConfig();
  const url = new URL(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}`);
  if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  if (params.offset) url.searchParams.set("offset", params.offset);
  if (params.filterByFormula) url.searchParams.set("filterByFormula", params.filterByFormula);
  if (params.fields?.length) {
    for (const fieldName of params.fields) {
      url.searchParams.append("fields[]", fieldName);
    }
  }
  if (params.sort?.length) {
    params.sort.forEach((s, i) => {
      url.searchParams.append(`sort[${i}][field]`, s.field);
      url.searchParams.append(`sort[${i}][direction]`, s.direction ?? "asc");
    });
  }
  if (params.filterByFormula) {
    const encodedFormula = url.searchParams.get("filterByFormula") ?? "(not set)";
    console.log("[listRecords] filterByFormula request", {
      tableName,
      caller: params._caller ?? "unknown",
      rawFormula: params.filterByFormula,
      encodedFormulaInUrl: encodedFormula,
      fullRequestUrl: url.toString(),
      queryString: url.searchParams.toString(),
    });
  }

  pruneExpiredListRecordsCache();
  const cacheKey = listRecordsCacheKey(tableName, params);
  const cached = listRecordsReadCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneListRecordsPayload<T>(cached.payload as { records: AirtableRecord<T>[]; offset?: string });
  }

  try {
    const data = await airtableFetch<{ records: AirtableRecord<T>[]; offset?: string }>(url.toString());
    const snapshot = cloneListRecordsPayload<T>(data);
    listRecordsReadCache.set(cacheKey, {
      expiresAt: Date.now() + LIST_RECORDS_CACHE_TTL_MS,
      payload: snapshot as { records: AirtableRecord<unknown>[]; offset?: string },
    });
    return snapshot;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("422") && msg.includes("INVALID_FILTER_BY_FORMULA") && params.filterByFormula) {
      console.error("[listRecords] INVALID_FILTER_BY_FORMULA – exact failing request", {
        tableName,
        filterByFormula: params.filterByFormula,
        caller: params._caller ?? "unknown",
      });
    }
    throw err;
  }
}

/** Get a single record by ID. */
export async function getRecord<T = Record<string, unknown>>(
  tableName: string,
  recordId: string
): Promise<AirtableRecord<T>> {
  const { baseId } = getConfig();
  const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;
  return airtableFetch<AirtableRecord<T>>(url);
}

/**
 * Create a record. Payload is sanitized (see lib/airtable-sanitize.ts) so computed/system
 * fields (e.g. created_at, updated_at, formula fields) are never sent. Add new tables or
 * non-writable fields there to avoid INVALID_VALUE_FOR_COLUMN across all pages.
 */
export async function createRecord<T = Record<string, unknown>>(
  tableName: string,
  fields: T
): Promise<AirtableRecord<T>> {
  const { baseId } = getConfig();
  const sanitized = sanitizePayloadForAirtable(tableName, fields as Record<string, unknown>, "create");
  if (process.env.NODE_ENV !== "production") {
    console.log("[airtable createRecord] outgoing payload", {
      table: tableName,
      fields: sanitized,
      fieldKeys: Object.keys(sanitized),
    });
  }
  const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}`;
  const data = await airtableFetch<{ id: string; createdTime: string; fields: T }>(url, {
    method: "POST",
    body: JSON.stringify({ fields: sanitized }),
  });
  invalidateListRecordsReadCacheForTable(tableName);
  return { id: data.id, createdTime: data.createdTime, fields: data.fields };
}

/** Batch create (max 10 records per Airtable request). Each row is sanitized like createRecord. */
export async function batchCreateRecords<T = Record<string, unknown>>(
  tableName: string,
  records: Record<string, unknown>[]
): Promise<AirtableRecord<T>[]> {
  if (records.length === 0) return [];
  const { baseId } = getConfig();
  const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}`;
  const out: AirtableRecord<T>[] = [];
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const data = await airtableFetch<{ records: AirtableRecord<T>[] }>(url, {
      method: "POST",
      body: JSON.stringify({
        records: chunk.map((fields) => ({
          fields: sanitizePayloadForAirtable(tableName, fields, "create"),
        })),
      }),
    });
    out.push(...(data.records ?? []));
  }
  invalidateListRecordsReadCacheForTable(tableName);
  return out;
}

/**
 * Update a record (partial fields). Payload is sanitized (see lib/airtable-sanitize.ts)
 * so computed/system fields are never sent.
 */
export async function updateRecord<T = Record<string, unknown>>(
  tableName: string,
  recordId: string,
  fields: Partial<T>
): Promise<AirtableRecord<T>> {
  const { baseId } = getConfig();
  const sanitized = sanitizePayloadForAirtable(tableName, fields as Record<string, unknown>, "update");
  if (process.env.NODE_ENV !== "production") {
    console.log("[airtable updateRecord] outgoing payload", {
      table: tableName,
      recordId,
      fields: sanitized,
      fieldKeys: Object.keys(sanitized),
    });
  }
  const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;
  const data = await airtableFetch<{ id: string; createdTime: string; fields: T }>(url, {
    method: "PATCH",
    body: JSON.stringify({ fields: sanitized }),
  });
  invalidateListRecordsReadCacheForTable(tableName);
  return { id: data.id, createdTime: data.createdTime, fields: data.fields };
}

/** Batch partial updates (max 10 records per Airtable request). Each payload is sanitized like updateRecord. */
export async function batchUpdateRecords(
  tableName: string,
  updates: { id: string; fields: Record<string, unknown> }[]
): Promise<void> {
  if (updates.length === 0) return;
  const { baseId } = getConfig();
  const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}`;
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    const records = chunk.map((u) => ({
      id: u.id,
      fields: sanitizePayloadForAirtable(tableName, u.fields, "update"),
    }));
    await airtableFetch<{ records: unknown[] }>(url, {
      method: "PATCH",
      body: JSON.stringify({ records }),
    });
    invalidateListRecordsReadCacheForTable(tableName);
  }
}

/** Delete a record. Airtable returns 200 with { deleted: true }. */
export async function deleteRecord(tableName: string, recordId: string): Promise<void> {
  const { baseId, token } = getConfig();
  const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable API ${res.status}: ${text}`);
  }
  invalidateListRecordsReadCacheForTable(tableName);
}

/** Fetch all pages of records. */
export async function listAllRecords<T = Record<string, unknown>>(
  tableName: string,
  params: Omit<ListParams, "offset"> = {}
): Promise<AirtableRecord<T>[]> {
  const all: AirtableRecord<T>[] = [];
  let offset: string | undefined;
  do {
    const page = await listRecords<T>(tableName, { ...params, offset });
    all.push(...page.records);
    offset = page.offset;
  } while (offset);
  return all;
}
