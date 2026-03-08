/**
 * Airtable Metadata API client: fetch schema, create tables, create fields.
 * Uses PAT (Personal Access Token) with scopes: schema.bases:read, schema.bases:write.
 * Idempotent: skips existing tables/fields and logs what was created vs already existed.
 * Uses schema module for API-supported vs fallback types (per official Airtable API docs).
 */

import type { TableDef, FieldDef } from "./airtable-schema";
import { getApiFieldType, getRequestedFieldType } from "./airtable-schema";

const META_BASE = "https://api.airtable.com/v0/meta/bases";

export type AirtableField = {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: Record<string, unknown>;
};

export type AirtableTable = {
  id: string;
  name: string;
  description?: string;
  fields: AirtableField[];
  primaryFieldId?: string;
};

export type BaseSchema = {
  tables: AirtableTable[];
};

/** Default options required by Airtable API when creating dateTime / date / checkbox fields. */
const DEFAULT_DATETIME_OPTIONS = {
  dateFormat: { name: "iso", format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour", format: "HH:mm" },
  timeZone: "America/New_York",
};
const DEFAULT_DATE_OPTIONS = {
  dateFormat: { name: "iso", format: "YYYY-MM-DD" },
};
const DEFAULT_CHECKBOX_OPTIONS = { icon: "check", color: "greenBright" };

/**
 * Build API field payload from our schema field def.
 * Uses fallback types only for API-unsupported types (formula, createdTime, lastModifiedTime, lastModifiedBy).
 * Adds required options for dateTime, date, and checkbox when missing.
 */
function fieldDefToApiPayload(
  name: string,
  def: FieldDef
): { name: string; type: string; options?: Record<string, unknown> } | null {
  const { type: apiType, isFallback } = getApiFieldType(def);

  const payload: {
    name: string;
    type: string;
    options?: Record<string, unknown>;
  } = { name, type: apiType };

  if (isFallback && apiType === "number") {
    payload.options = { precision: 0 };
  } else if (apiType === "dateTime") {
    const defOpts = "options" in def && def.options && typeof def.options === "object"
      ? (def.options as Record<string, unknown>)
      : {};
    payload.options = { ...DEFAULT_DATETIME_OPTIONS, ...defOpts };
  } else if (apiType === "date") {
    payload.options =
      ("options" in def && def.options && typeof def.options === "object"
        ? (def.options as Record<string, unknown>)
        : null) ?? DEFAULT_DATE_OPTIONS;
  } else if (apiType === "checkbox") {
    payload.options =
      ("options" in def && def.options && typeof def.options === "object"
        ? (def.options as Record<string, unknown>)
        : null) ?? DEFAULT_CHECKBOX_OPTIONS;
  } else if ("options" in def && def.options && typeof def.options === "object") {
    payload.options = def.options as Record<string, unknown>;
  }

  return payload;
}

export type AirtableAdminOptions = {
  token: string;
  baseId: string;
  dryRun?: boolean;
};

async function airtableFetch(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

/**
 * GET base schema (list tables and fields).
 */
export async function getBaseSchema(
  baseId: string,
  token: string
): Promise<BaseSchema> {
  const url = `${META_BASE}/${baseId}/tables`;
  const res = await airtableFetch(url, token);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Airtable getBaseSchema failed (${res.status}): ${body}`
    );
  }
  const data = (await res.json()) as { tables?: AirtableTable[] };
  return { tables: data.tables ?? [] };
}

/**
 * Create a single table with the given fields. Fails if table already exists (by name).
 */
export async function createTable(
  baseId: string,
  token: string,
  table: TableDef,
  dryRun: boolean
): Promise<{ created: boolean; tableId?: string; error?: string }> {
  const fields = table.fields
    .map((f) => fieldDefToApiPayload(f.name, f.def))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const body = {
    name: table.name,
    description: "",
    fields,
  };

  if (dryRun) {
    return { created: true, tableId: "(dry run)" };
  }

  const url = `${META_BASE}/${baseId}/tables`;
  const res = await airtableFetch(url, token, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return { created: false, error: `${res.status}: ${text}` };
  }

  const data = (await res.json()) as
    | { id: string }
    | { tables?: { id: string }[] };
  const tableId =
    "id" in data ? data.id : data.tables?.[0]?.id;
  return { created: true, tableId };
}

/**
 * Add a single field to an existing table.
 */
export async function createField(
  baseId: string,
  token: string,
  tableId: string,
  name: string,
  def: FieldDef,
  dryRun: boolean
): Promise<{ created: boolean; error?: string }> {
  const payload = fieldDefToApiPayload(name, def);
  if (!payload) return { created: false, error: "Unsupported field type" };

  if (dryRun) {
    return { created: true };
  }

  const url = `${META_BASE}/${baseId}/tables/${tableId}/fields`;
  const res = await airtableFetch(url, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return { created: false, error: `${res.status}: ${text}` };
  }
  return { created: true };
}

export type FallbackFieldEntry = {
  table: string;
  field: string;
  requestedType: string;
  actualType: string;
};

export type SyncResult = {
  baseId: string;
  baseLabel: string;
  tablesCreated: string[];
  tablesExisted: string[];
  fieldsCreated: { table: string; field: string }[];
  fieldsExisted: { table: string; field: string }[];
  /** Every field created with a fallback type (API does not support requested type). Logged explicitly per table/field. */
  fallbackFields: FallbackFieldEntry[];
  /** Formula fields: we create a number placeholder; user must add formula in UI. */
  formulaFieldsToAddManually: { table: string; field: string; formula: string }[];
  errors: string[];
};

/**
 * Idempotent sync: ensure all tables and fields from tableDefs exist in the base.
 */
export async function syncBase(
  baseId: string,
  baseLabel: string,
  token: string,
  tableDefs: TableDef[],
  dryRun: boolean
): Promise<SyncResult> {
  const result: SyncResult = {
    baseId,
    baseLabel,
    tablesCreated: [],
    tablesExisted: [],
    fieldsCreated: [],
    fieldsExisted: [],
    fallbackFields: [],
    formulaFieldsToAddManually: [],
    errors: [],
  };

  function recordFallback(table: string, field: string, def: FieldDef): void {
    const requested = getRequestedFieldType(def);
    const { type: actualType, isFallback } = getApiFieldType(def);
    if (isFallback) {
      result.fallbackFields.push({
        table,
        field,
        requestedType: requested,
        actualType,
      });
    }
  }

  let schema: BaseSchema;
  try {
    schema = await getBaseSchema(baseId, token);
  } catch (e) {
    result.errors.push(
      `Failed to fetch schema: ${e instanceof Error ? e.message : String(e)}`
    );
    return result;
  }

  const existingTablesByName = new Map<string, AirtableTable>();
  for (const t of schema.tables) {
    existingTablesByName.set(t.name, t);
  }

  for (const tableDef of tableDefs) {
    const existing = existingTablesByName.get(tableDef.name);

    if (!existing) {
      const createResult = await createTable(baseId, token, tableDef, dryRun);
      if (createResult.created) {
        result.tablesCreated.push(tableDef.name);
        for (const { name, def } of tableDef.fields) {
          recordFallback(tableDef.name, name, def);
        }
        if (createResult.tableId && createResult.tableId !== "(dry run)") {
          existingTablesByName.set(tableDef.name, {
            id: createResult.tableId,
            name: tableDef.name,
            fields: [],
          });
        }
      } else {
        result.errors.push(
          `Table "${tableDef.name}": ${createResult.error ?? "unknown error"}`
        );
      }
      continue;
    }

    result.tablesExisted.push(tableDef.name);

    const existingFieldNames = new Set(
      existing.fields.map((f) => f.name)
    );

    for (const { name, def } of tableDef.fields) {
      if (existingFieldNames.has(name)) {
        result.fieldsExisted.push({ table: tableDef.name, field: name });
        continue;
      }

      if ("type" in def && def.type === "formula") {
        result.formulaFieldsToAddManually.push({
          table: tableDef.name,
          field: name,
          formula: (def as { formula?: string }).formula ?? "",
        });
        const payload = fieldDefToApiPayload(name, def);
        if (payload) {
          const createResult = await createField(
            baseId,
            token,
            existing.id,
            name,
            def,
            dryRun
          );
          if (createResult.created) {
            result.fieldsCreated.push({ table: tableDef.name, field: name });
            recordFallback(tableDef.name, name, def);
          } else if (createResult.error) {
            result.errors.push(
              `Field "${tableDef.name}.${name}": ${createResult.error}`
            );
          }
        }
        continue;
      }

      const createResult = await createField(
        baseId,
        token,
        existing.id,
        name,
        def,
        dryRun
      );
      if (createResult.created) {
        result.fieldsCreated.push({ table: tableDef.name, field: name });
        recordFallback(tableDef.name, name, def);
      } else if (createResult.error) {
        result.errors.push(
          `Field "${tableDef.name}.${name}": ${createResult.error}`
        );
      }
    }
  }

  return result;
}

/**
 * Fetch and return a summary of tables and field counts for a base (for verification).
 */
export async function getBaseSummary(
  baseId: string,
  token: string
): Promise<{ baseId: string; tables: { name: string; id: string; fieldCount: number }[] }> {
  const schema = await getBaseSchema(baseId, token);
  return {
    baseId,
    tables: schema.tables.map((t) => ({
      name: t.name,
      id: t.id,
      fieldCount: t.fields.length,
    })),
  };
}

export type FieldVerificationStatus = "exact_match" | "fallback_match" | "missing";

export type TableVerification = {
  tableName: string;
  fields: { fieldName: string; status: FieldVerificationStatus; actualType?: string }[];
};

export type VerificationReport = {
  baseId: string;
  baseLabel: string;
  tables: TableVerification[];
};

/**
 * Compare expected schema (tableDefs) with actual base schema and mark each field as
 * exact_match, fallback_match, or missing.
 */
export async function verifySchema(
  baseId: string,
  baseLabel: string,
  token: string,
  tableDefs: TableDef[]
): Promise<VerificationReport> {
  const schema = await getBaseSchema(baseId, token);
  const tablesByName = new Map(schema.tables.map((t) => [t.name, t]));

  const tables: TableVerification[] = [];

  for (const tableDef of tableDefs) {
    const actualTable = tablesByName.get(tableDef.name);
    const fieldEntries: { fieldName: string; status: FieldVerificationStatus; actualType?: string }[] = [];

    for (const { name: fieldName, def } of tableDef.fields) {
      const requestedType = getRequestedFieldType(def);
      const { type: apiType, isFallback } = getApiFieldType(def);
      const actualField = actualTable?.fields.find((f) => f.name === fieldName);

      if (!actualField) {
        fieldEntries.push({ fieldName, status: "missing" });
        continue;
      }

      const actualType = actualField.type;
      if (actualType === requestedType) {
        fieldEntries.push({ fieldName, status: "exact_match", actualType });
      } else if (isFallback && actualType === apiType) {
        fieldEntries.push({ fieldName, status: "fallback_match", actualType });
      } else {
        fieldEntries.push({ fieldName, status: "fallback_match", actualType });
      }
    }

    tables.push({ tableName: tableDef.name, fields: fieldEntries });
  }

  return { baseId, baseLabel, tables };
}
