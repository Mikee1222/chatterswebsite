/**
 * Thin Supabase data helpers for dual-backend services.
 * Uses service-role client. Prefer airtable_id for dual-run identity
 * so return shapes keep Airtable-shaped `id` fields until cutover.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type SbRow = Record<string, unknown> & {
  id: string;
  airtable_id?: string | null;
};

/** Prefer airtable_id as the public `id` during dual-run. */
export function publicId(row: { id: string; airtable_id?: string | null }): string {
  return row.airtable_id || row.id;
}

/**
 * Require every public/Airtable id to resolve to a Postgres UUID.
 * Throws instead of inserting empty uuid[] link columns on map misses.
 */
export async function requireSbUuids(
  table: string,
  airtableIds: string[] | null | undefined,
  label?: string
): Promise<string[]> {
  const requested = [
    ...new Set((airtableIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
  ];
  if (!requested.length) {
    throw new Error(`requireSbUuids ${table}: missing ${label ?? "linked"} id(s)`);
  }
  const uuids = await sbUuidsForAirtableIds(table, requested);
  if (uuids.length < requested.length) {
    throw new Error(
      `requireSbUuids ${table}: unresolved ${label ?? "link"} id(s) among: ${requested.join(", ")}`
    );
  }
  return uuids;
}

export async function sbSelectAll<T extends SbRow>(
  table: string,
  columns = "*"
): Promise<T[]> {
  const sb = getSupabaseServiceClient();
  const pageSize = 1000;
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`sbSelectAll ${table}: ${error.message}`);
    if (!data?.length) break;
    out.push(...(data as unknown as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export async function sbSelectEq<T extends SbRow>(
  table: string,
  column: string,
  value: string | number | boolean,
  columns = "*",
  limit?: number
): Promise<T[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from(table).select(columns).eq(column, value);
  if (limit != null) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(`sbSelectEq ${table}.${column}: ${error.message}`);
  return (data as unknown as T[]) ?? [];
}

export async function sbSelectByPublicId<T extends SbRow>(
  table: string,
  publicOrUuid: string,
  columns = "*"
): Promise<T | null> {
  const sb = getSupabaseServiceClient();
  // Try airtable_id first (rec…), then uuid
  if (publicOrUuid.startsWith("rec")) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .eq("airtable_id", publicOrUuid)
      .maybeSingle();
    if (error) throw new Error(`sbSelectByPublicId: ${error.message}`);
    return (data as unknown as T) ?? null;
  }
  const { data, error } = await sb
    .from(table)
    .select(columns)
    .eq("id", publicOrUuid)
    .maybeSingle();
  if (error) throw new Error(`sbSelectByPublicId: ${error.message}`);
  return (data as unknown as T) ?? null;
}

export async function sbInsert<T extends SbRow>(
  table: string,
  row: Record<string, unknown>
): Promise<T> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(table).insert(row).select("*").single();
  if (error) throw new Error(`sbInsert ${table}: ${error.message}`);
  return data as T;
}

/** Bulk insert — one round-trip. Returns inserted rows in order. */
export async function sbInsertMany<T extends SbRow>(
  table: string,
  rows: Record<string, unknown>[]
): Promise<T[]> {
  if (!rows.length) return [];
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(table).insert(rows).select("*");
  if (error) throw new Error(`sbInsertMany ${table}: ${error.message}`);
  return (data as unknown as T[]) ?? [];
}

export async function sbUpdateByPublicId<T extends SbRow>(
  table: string,
  publicOrUuid: string,
  patch: Record<string, unknown>
): Promise<T> {
  const sb = getSupabaseServiceClient();
  const col = publicOrUuid.startsWith("rec") ? "airtable_id" : "id";
  const { data, error } = await sb
    .from(table)
    .update(patch)
    .eq(col, publicOrUuid)
    .select("*")
    .single();
  if (error) throw new Error(`sbUpdate ${table}: ${error.message}`);
  return data as T;
}

export async function sbDeleteByPublicId(table: string, publicOrUuid: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const col = publicOrUuid.startsWith("rec") ? "airtable_id" : "id";
  const { error } = await sb.from(table).delete().eq(col, publicOrUuid);
  if (error) throw new Error(`sbDelete ${table}: ${error.message}`);
}

export async function sbUpsertByAirtableId<T extends SbRow>(
  table: string,
  row: Record<string, unknown> & { airtable_id?: string }
): Promise<T> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(table)
    .upsert(row, { onConflict: "airtable_id" })
    .select("*")
    .single();
  if (error) throw new Error(`sbUpsert ${table}: ${error.message}`);
  return data as T;
}

/** PostgREST IN-list chunk size (URL/payload safety). */
const ID_LOOKUP_CHUNK = 80;
/** Max parallel chunk queries within one flush. */
const ID_LOOKUP_CONCURRENCY = 3;

type IdPair = { id: string; airtable_id: string | null };

/** Test double for ID lookups — avoids live DNS when simulating large batches. */
let idLookupFetchOverride:
  | ((table: string, column: "id" | "airtable_id", values: string[]) => Promise<IdPair[]>)
  | null = null;

/** @internal test helper */
export function __setSbIdLookupFetchForTests(
  fn: typeof idLookupFetchOverride
): void {
  idLookupFetchOverride = fn;
}

/** @internal test helper — query count since last reset */
export let __sbIdLookupQueryCount = 0;

/** @internal test helper */
export function __resetSbIdLookupStats(): void {
  __sbIdLookupQueryCount = 0;
}

async function fetchIdPairs(
  table: string,
  column: "id" | "airtable_id",
  values: string[]
): Promise<IdPair[]> {
  __sbIdLookupQueryCount += 1;
  if (idLookupFetchOverride) {
    return idLookupFetchOverride(table, column, values);
  }
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(table).select("id, airtable_id").in(column, values);
  if (error) {
    const detail = [error.message, error.code, error.details, error.hint]
      .filter(Boolean)
      .join(" | ");
    const label = column === "id" ? "sbAirtableIdsForUuids" : "sbUuidsForAirtableIds";
    throw new Error(`${label} ${table}: ${detail || "unknown error"}`);
  }
  return (data ?? []) as IdPair[];
}

async function runChunkedIdLookup(
  table: string,
  column: "id" | "airtable_id",
  values: string[]
): Promise<IdPair[]> {
  const unique = [...new Set(values.filter(Boolean))];
  if (!unique.length) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += ID_LOOKUP_CHUNK) {
    chunks.push(unique.slice(i, i + ID_LOOKUP_CHUNK));
  }

  const out: IdPair[] = [];
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= chunks.length) return;
      const rows = await fetchIdPairs(table, column, chunks[i]!);
      out.push(...rows);
    }
  }
  const n = Math.min(ID_LOOKUP_CONCURRENCY, chunks.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

type CoalesceWaiter = {
  requested: string[];
  resolve: (map: Map<string, string>) => void;
  reject: (err: unknown) => void;
};

type CoalesceBucket = {
  keys: Set<string>;
  waiters: CoalesceWaiter[];
  scheduled: boolean;
};

const uuidToAtBuckets = new Map<string, CoalesceBucket>();
const atToUuidBuckets = new Map<string, CoalesceBucket>();

function scheduleCoalesceFlush(
  buckets: Map<string, CoalesceBucket>,
  table: string,
  run: (keys: string[]) => Promise<Map<string, string>>
): void {
  const bucket = buckets.get(table);
  if (!bucket || bucket.scheduled) return;
  bucket.scheduled = true;
  queueMicrotask(() => {
    void (async () => {
      const current = buckets.get(table);
      if (!current) return;
      buckets.delete(table);
      try {
        const map = await run([...current.keys]);
        for (const w of current.waiters) w.resolve(map);
      } catch (err) {
        for (const w of current.waiters) w.reject(err);
      }
    })();
  });
}

function enqueueIdLookup(
  buckets: Map<string, CoalesceBucket>,
  table: string,
  requested: string[],
  run: (keys: string[]) => Promise<Map<string, string>>
): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    let bucket = buckets.get(table);
    if (!bucket) {
      bucket = { keys: new Set(), waiters: [], scheduled: false };
      buckets.set(table, bucket);
    }
    for (const id of requested) {
      if (id) bucket.keys.add(id);
    }
    bucket.waiters.push({ requested, resolve, reject });
    scheduleCoalesceFlush(buckets, table, run);
  });
}

/**
 * Resolve Postgres UUIDs → Airtable rec ids (for dual-run public APIs).
 * Concurrent callers for the same table are coalesced into chunked IN queries
 * (chunk 80, concurrency 3) so N+1 Promise.all mappers cannot open 1000+ sockets.
 */
export async function sbAirtableIdsForUuids(
  table: string,
  uuids: string[] | null | undefined
): Promise<string[]> {
  if (!uuids?.length) return [];
  const map = await enqueueIdLookup(uuidToAtBuckets, table, uuids.filter(Boolean), async (keys) => {
    const rows = await runChunkedIdLookup(table, "id", keys);
    const byId = new Map<string, string>();
    for (const r of rows) {
      byId.set(r.id, (r.airtable_id || "").trim() || r.id);
    }
    return byId;
  });
  // Prefer airtable_id; fall back to uuid for rows created natively in Supabase.
  return uuids.map((id) => map.get(id) || id).filter(Boolean);
}

/**
 * Resolve public link ids → Postgres UUIDs for uuid / uuid[] FK writes.
 * Accepts Airtable `rec…` ids (looked up via the target table's `airtable_id`)
 * or already-UUID values (passed through). Matches `_airtable_id_map` identity
 * for migrated rows (same airtable_id → supabase uuid).
 * Concurrent rec… lookups coalesce + chunk like sbAirtableIdsForUuids.
 */
export async function sbUuidsForAirtableIds(
  table: string,
  airtableIds: string[] | null | undefined
): Promise<string[]> {
  if (!airtableIds?.length) return [];
  const recIds = airtableIds.filter((id) => id.startsWith("rec"));
  if (!recIds.length) return airtableIds.filter(Boolean);

  const map = await enqueueIdLookup(atToUuidBuckets, table, recIds, async (keys) => {
    const rows = await runChunkedIdLookup(table, "airtable_id", keys);
    return new Map(rows.map((r) => [r.airtable_id as string, r.id]));
  });

  return airtableIds
    .map((id) => (id.startsWith("rec") ? map.get(id) || "" : id))
    .filter(Boolean);
}

/** First linked airtable id from a uuid[] column (dual-run). */
export async function sbFirstLinkedAirtableId(
  table: string,
  uuids: string[] | null | undefined
): Promise<string | null> {
  const ids = await sbAirtableIdsForUuids(table, uuids);
  return ids[0] ?? null;
}

/**
 * Build uuid → public/Airtable id map for many uuid[] columns in one lookup.
 * Use before mapping list rows so N rows don't each open separate ID queries.
 */
export async function sbResolveUuidToAirtableMap(
  table: string,
  uuidLists: (string[] | null | undefined)[]
): Promise<Map<string, string>> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const list of uuidLists) {
    for (const id of list ?? []) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
    }
  }
  if (!unique.length) return new Map();
  const resolved = await sbAirtableIdsForUuids(table, unique);
  const map = new Map<string, string>();
  for (let i = 0; i < unique.length; i++) {
    map.set(unique[i]!, resolved[i] || unique[i]!);
  }
  return map;
}

/** Map a uuid[] column through a prebuilt uuid→airtable map. */
export function mapLinkedIds(
  uuids: string[] | null | undefined,
  atByUuid: Map<string, string>
): string[] {
  return (uuids ?? []).map((id) => atByUuid.get(id) || id).filter(Boolean);
}

/** First linked id from a prebuilt map (sync). */
export function firstMappedLinkedId(
  uuids: string[] | null | undefined,
  atByUuid: Map<string, string>
): string {
  const id = uuids?.find(Boolean);
  if (!id) return "";
  return atByUuid.get(id) || id;
}

/**
 * Resolve link ids → UUIDs. Empty input → []. Non-empty with unresolved → throw.
 * Use for optional link arrays that must never write broken empty arrays on miss.
 */
export async function requireSbUuidsOrEmpty(
  table: string,
  airtableIds: string[] | null | undefined,
  label?: string
): Promise<string[]> {
  const requested = [
    ...new Set((airtableIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
  ];
  if (!requested.length) return [];
  return requireSbUuids(table, requested, label);
}
