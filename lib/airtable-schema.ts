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
  "multipleAttachments",
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

/** Airtable table name for cached OF subscribers (see `scripts/create-of-subscribers-table.ts`). */
export const OF_SUBSCRIBERS_TABLE = "of_subscribers" as const;

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
      { name: "mistake_alerts", def: { type: "checkbox" } },
      { name: "fine_bonus_alerts", def: { type: "checkbox" } },
      { name: "period_alerts", def: { type: "checkbox" } },
      { name: "marketing_alerts", def: { type: "checkbox" } },
      { name: "phase_alerts", def: { type: "checkbox" } },
      { name: "reward_alerts", def: { type: "checkbox" } },
      { name: "quiet_hours_start", def: { type: "singleLineText" } },
      { name: "quiet_hours_end", def: { type: "singleLineText" } },
      { name: "mute_all", def: { type: "checkbox" } },
      { name: "updated_at", def: { type: "lastModifiedTime" } },
    ],
  },
  {
    name: "earnings_config",
    fields: [
      { name: "model_id", def: { type: "singleLineText" } },
      { name: "agency_cut_percent", def: { type: "number" } },
    ],
  },
  {
    name: OF_SUBSCRIBERS_TABLE,
    fields: [
      { name: "of_user_id", def: { type: "number" } },
      { name: "of_account_id", def: { type: "singleLineText" } },
      { name: "model_name", def: { type: "singleLineText" } },
      { name: "display_name", def: { type: "singleLineText" } },
      { name: "username", def: { type: "singleLineText" } },
      { name: "subscribed_at", def: { type: "dateTime" } },
      { name: "expires_at", def: { type: "dateTime" } },
      { name: "last_synced_at", def: { type: "dateTime" } },
      { name: "total_spent", def: { type: "number" } },
      {
        name: "category",
        def: {
          type: "singleSelect",
          options: {
            choices: [
              { name: "whale" },
              { name: "vip" },
              { name: "high_spender" },
              { name: "medium" },
              { name: "freeloader" },
              { name: "new" },
            ],
          },
        },
      },
    ],
  },
];
