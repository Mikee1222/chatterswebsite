/**
 * Airtable schema definitions for setup scripts.
 * TableDef / FieldDef and helpers for API-supported vs fallback types.
 */

export type FieldDef =
  | { type: "singleLineText"; options?: Record<string, unknown> }
  | { type: "multilineText"; options?: Record<string, unknown> }
  | { type: "number"; options?: Record<string, unknown> }
  | { type: "currency"; options?: Record<string, unknown> }
  | { type: "percent"; options?: Record<string, unknown> }
  | { type: "dateTime"; options?: Record<string, unknown> }
  | { type: "date"; options?: Record<string, unknown> }
  | { type: "checkbox"; options?: Record<string, unknown> }
  | { type: "singleSelect"; options?: Record<string, unknown> }
  | { type: "multipleRecordLinks"; options?: Record<string, unknown> }
  | { type: "formula"; options?: Record<string, unknown> }
  | { type: "createdTime"; options?: Record<string, unknown> }
  | { type: "lastModifiedTime"; options?: Record<string, unknown> }
  | { type: string; options?: Record<string, unknown> };

export type TableDef = {
  name: string;
  fields: { name: string; def: FieldDef }[];
};

const API_SUPPORTED = new Set([
  "singleLineText", "multilineText", "number", "currency", "percent",
  "dateTime", "date", "checkbox", "singleSelect", "multipleRecordLinks",
  "email", "url", "phoneNumber", "rating", "duration", "barcode", "button",
  "count", "multipleLookupValues", "rollup", "multipleSelect", "attachment",
  "autoNumber", "lastModifiedBy", "createdBy", "button", "externalSyncSource",
]);

/** Return API type to use and whether it's a fallback (e.g. formula → number). */
export function getApiFieldType(def: FieldDef): { type: string; isFallback: boolean } {
  const t = def.type;
  if (API_SUPPORTED.has(t)) return { type: t, isFallback: false };
  if (t === "formula" || t === "createdTime" || t === "lastModifiedTime" || t === "lastModifiedBy" || t === "createdBy") {
    return { type: "number", isFallback: true };
  }
  return { type: "singleLineText", isFallback: true };
}

/** Return the requested (logical) field type. */
export function getRequestedFieldType(def: FieldDef): string {
  return def.type;
}

/** Table definitions for sync script. Add your base tables here. */
export const AIRTABLE_TABLES: TableDef[] = [
  {
    name: "notification_preferences",
    fields: [
      { name: "preference_id", def: { type: "singleLineText" } },
      { name: "user_id", def: { type: "singleLineText" } },
      { name: "push_enabled", def: { type: "checkbox" } },
      { name: "in_app_enabled", def: { type: "checkbox" } },
      { name: "critical_only", def: { type: "checkbox" } },
      { name: "whale_alerts", def: { type: "checkbox" } },
      { name: "shift_alerts", def: { type: "checkbox" } },
      { name: "model_alerts", def: { type: "checkbox" } },
      { name: "system_alerts", def: { type: "checkbox" } },
      { name: "task_alerts", def: { type: "checkbox" } },
      { name: "quiet_hours_start", def: { type: "singleLineText" } },
      { name: "quiet_hours_end", def: { type: "singleLineText" } },
      { name: "mute_all", def: { type: "checkbox" } },
      { name: "updated_at", def: { type: "lastModifiedTime" } },
    ],
  },
];
