/**
 * Shared helpers for Airtable → Supabase Phase 2 data migration.
 * Airtable is READ-ONLY. Supabase upserts are additive/idempotent via airtable_id.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PgColumnType =
  | "text"
  | "numeric"
  | "boolean"
  | "date"
  | "timestamptz"
  | "text[]"
  | "uuid[]"
  | "unknown";

export type PgColumn = {
  name: string;
  type: PgColumnType;
  quoted: boolean;
};

export type PgTable = {
  pgName: string;
  airtableName: string | null;
  columns: PgColumn[];
  linkColumns: string[];
};

export type FieldMapEntry = {
  airtableField: string;
  airtableType: string;
  pgColumn: string;
  pgType: PgColumnType;
  isLink: boolean;
  isAttachment: boolean;
};

export type TableMigrationPlan = {
  pgName: string;
  airtableName: string;
  fields: FieldMapEntry[];
  scalarFields: FieldMapEntry[];
  linkFields: FieldMapEntry[];
  attachmentFields: FieldMapEntry[];
};

const SKIP_AIRTABLE_TYPES = new Set([
  "formula",
  "rollup",
  "count",
  "multipleLookupValues",
  "lookup",
  "createdBy",
  "lastModifiedBy",
  "button",
  "externalSyncSource",
  "barcode",
]);

const TABLE_NAME_REPLACEMENTS: Record<string, string> = {
  αυτοαξιολογηση: "self_evaluations",
  "fines & bonuses": "fines_and_bonuses_legacy",
  "chatter complaints": "chatter_complaints",
  "chatter performance": "chatter_performance",
  "chatters apply form": "chatters_apply_form",
  "model content": "model_content_legacy",
  "paypal money received": "paypal_money_received",
  "whale tracker": "whale_tracker",
  feedbackcc: "feedback_cc",
};

const FIELD_NAME_REPLACEMENTS: Record<string, string> = {
  "fines & bonuses": "fines_and_bonuses_legacy",
  "whale tracker": "whale_tracker",
  "paypal money received": "paypal_money_received",
  αυτοαξιολογηση: "self_evaluations",
};

/** Match Phase 1 schema generator slugify (table + field names). */
export function slugifyName(name: string, kind: "table" | "field" = "field"): string {
  const trimmed = name.trim().toLowerCase();
  const replacements = kind === "table" ? TABLE_NAME_REPLACEMENTS : FIELD_NAME_REPLACEMENTS;
  if (replacements[trimmed]) return replacements[trimmed];
  const out = trimmed.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return out || "unnamed_field";
}

/** Postgres identifiers are capped at 63 bytes; CREATE TABLE silently truncates. */
export function pgIdent(name: string): string {
  return name.length <= 63 ? name : name.slice(0, 63);
}

function parseCreateTablesFromSql(
  sql: string,
  tables: Map<string, PgTable>,
  airtableByPg: Map<string, string>
): void {
  const createRe =
    /CREATE TABLE IF NOT EXISTS public\.("?[a-zA-Z0-9_]+"?)\s*\(([\s\S]*?)\);/g;
  let match: RegExpExecArray | null;
  while ((match = createRe.exec(sql)) !== null) {
    const rawName = match[1].replace(/"/g, "");
    if (rawName.startsWith("_") && rawName !== "_airtable_id_map") continue;
    if (
      [
        "va_task_assignees",
        "va_task_models",
        "va_content_assignment_vas",
        "client_model_assignments",
        "shift_model_links",
        "custom_request_assignees",
        "sop_role_users",
        "_airtable_id_map",
      ].includes(rawName)
    ) {
      // join / map tables handled separately
      continue;
    }

    const body = match[2];
    const columns: PgColumn[] = [];
    const linkColumns: string[] = [];
    for (const line of body.split("\n")) {
      const trimmed = line.trim().replace(/,$/, "");
      if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("PRIMARY KEY")) continue;
      const colMatch = trimmed.match(/^("?)([a-zA-Z0-9_]+)\1\s+(.+)$/);
      if (!colMatch) continue;
      const quoted = colMatch[1] === '"';
      const name = pgIdent(colMatch[2]);
      const typeRaw = colMatch[3].toLowerCase();
      let type: PgColumnType = "unknown";
      if (typeRaw.startsWith("uuid[]")) type = "uuid[]";
      else if (typeRaw.startsWith("text[]")) type = "text[]";
      else if (typeRaw.startsWith("uuid")) type = "unknown"; // pk
      else if (typeRaw.startsWith("text")) type = "text";
      else if (typeRaw.startsWith("numeric")) type = "numeric";
      else if (typeRaw.startsWith("boolean")) type = "boolean";
      else if (typeRaw.startsWith("date")) type = "date";
      else if (typeRaw.startsWith("timestamptz")) type = "timestamptz";
      if (name === "id" || name === "airtable_id") {
        columns.push({ name, type: name === "id" ? "unknown" : "text", quoted });
        continue;
      }
      columns.push({ name, type, quoted });
      if (type === "uuid[]") linkColumns.push(name);
    }

    tables.set(rawName, {
      pgName: rawName,
      airtableName: airtableByPg.get(rawName) ?? (rawName === "roles" || !airtableByPg.has(rawName) ? rawName : null),
      columns,
      linkColumns,
    });
  }
}

/** Merge ADD COLUMN IF NOT EXISTS clauses into already-parsed tables. */
function applyAlterColumnsFromSql(sql: string, tables: Map<string, PgTable>): void {
  const alterRe =
    /ALTER TABLE public\.([a-zA-Z0-9_]+)\s+([\s\S]*?);/gi;
  let match: RegExpExecArray | null;
  while ((match = alterRe.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const t = tables.get(tableName);
    if (!t) continue;
    const existing = new Set(t.columns.map((c) => c.name));
    for (const line of body.split("\n")) {
      const m = line
        .trim()
        .replace(/,$/, "")
        .match(/^ADD COLUMN IF NOT EXISTS\s+("?)([a-zA-Z0-9_]+)\1\s+(.+)$/i);
      if (!m) continue;
      const quoted = m[1] === '"';
      const name = pgIdent(m[2]);
      if (existing.has(name)) continue;
      const typeRaw = m[3].toLowerCase();
      let type: PgColumnType = "unknown";
      if (typeRaw.startsWith("uuid[]")) type = "uuid[]";
      else if (typeRaw.startsWith("text[]")) type = "text[]";
      else if (typeRaw.startsWith("text")) type = "text";
      else if (typeRaw.startsWith("numeric")) type = "numeric";
      else if (typeRaw.startsWith("boolean")) type = "boolean";
      else if (typeRaw.startsWith("date")) type = "date";
      else if (typeRaw.startsWith("timestamptz")) type = "timestamptz";
      t.columns.push({ name, type, quoted });
      existing.add(name);
      if (type === "uuid[]") t.linkColumns.push(name);
    }
  }
}

export function parseInitSchema(sqlPath?: string): Map<string, PgTable> {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const files = sqlPath
    ? [sqlPath]
    : [
        path.join(migrationsDir, "20260803000001_init_schema.sql"),
        path.join(migrationsDir, "20260803000004_new_app_tables.sql"),
      ].filter((f) => {
        try {
          readFileSync(f);
          return true;
        } catch {
          return false;
        }
      });

  const tables = new Map<string, PgTable>();
  const airtableByPg = new Map<string, string>();
  const headerRe =
    /--\s+([a-z0-9_]+)\s+\(Airtable:\s*'([^']*)'\)/gi;

  for (const file of files) {
    const sql = readFileSync(file, "utf8");
    for (const m of sql.matchAll(headerRe)) {
      airtableByPg.set(m[1], m[2]);
    }
    parseCreateTablesFromSql(sql, tables, airtableByPg);
    applyAlterColumnsFromSql(sql, tables);
  }

  // Ensure code-only tables that have no Airtable header still map name→name
  for (const [, t] of tables) {
    if (!t.airtableName) t.airtableName = t.pgName;
  }

  // Airtable renames since Phase 1 audit
  const renamed: Record<string, string> = {
    marketing_phones: "phones",
  };
  for (const [pgName, atName] of Object.entries(renamed)) {
    const t = tables.get(pgName);
    if (t) t.airtableName = atName;
  }

  return tables;
}

export function buildFieldMap(
  pgTable: PgTable,
  airtableFields: Array<{ name: string; type: string }>
): TableMigrationPlan {
  const dataCols = pgTable.columns.filter(
    (c) => !["id", "airtable_id", "created_time", "updated_at"].includes(c.name) || c.name === "updated_at"
  );
  // Prefer data columns excluding system ones for mapping
  const mappableCols = pgTable.columns.filter(
    (c) => !["id", "airtable_id", "created_time"].includes(c.name)
  );

  const usedPg = new Set<string>();
  const fields: FieldMapEntry[] = [];
  const fieldStarPool = mappableCols
    .filter((c) => /^field_\d+$/.test(c.name))
    .map((c) => c.name);

  const RESERVED = new Set([
    "user",
    "order",
    "group",
    "limit",
    "offset",
    "table",
    "check",
    "primary",
    "references",
  ]);
  const seen = new Set(["id", "airtable_id", "created_time"]);

  for (const f of airtableFields) {
    if (SKIP_AIRTABLE_TYPES.has(f.type)) continue;

    let col = slugifyName(f.name, "field");
    if (!col || col === "unnamed_field") {
      col = fieldStarPool.find((c) => !usedPg.has(c)) ?? "";
    }
    if (col === "number" && f.type === "autoNumber") col = "auto_number";
    if (seen.has(col)) col = `${col}_col`;
    if (RESERVED.has(col)) col = col === "user" ? "user_ref" : `${col}_value`;
    while (seen.has(col) || usedPg.has(col)) {
      if (/_2$/.test(col)) col = col.replace(/_2$/, "_3");
      else col = `${col}_2`;
    }

    col = pgIdent(col);
    // Prefer exact column present in schema
    let pgCol = mappableCols.find((c) => c.name === col || c.name === pgIdent(col));
    if (!pgCol && /^field_\d+$/.test(col) === false) {
      // try field_* pool for non-ascii that somehow got a slug
      const nextStar = fieldStarPool.find((c) => !usedPg.has(c));
      if (nextStar && (!col || col === "unnamed_field")) {
        pgCol = mappableCols.find((c) => c.name === nextStar);
        col = nextStar ?? col;
      }
    }
    if (!pgCol) {
      // column missing from schema (added to Airtable after Phase 1) — skip with note later
      continue;
    }

    usedPg.add(pgCol.name);
    seen.add(pgCol.name);

    const entry: FieldMapEntry = {
      airtableField: f.name,
      airtableType: f.type,
      pgColumn: pgCol.name,
      pgType: pgCol.type,
      isLink: f.type === "multipleRecordLinks" || pgCol.type === "uuid[]",
      isAttachment: f.type === "multipleAttachments",
    };
    fields.push(entry);
  }

  return {
    pgName: pgTable.pgName,
    airtableName: pgTable.airtableName ?? pgTable.pgName,
    fields,
    scalarFields: fields.filter((f) => !f.isLink),
    linkFields: fields.filter((f) => f.isLink),
    attachmentFields: fields.filter((f) => f.isAttachment),
  };
}

export function coerceValue(
  value: unknown,
  pgType: PgColumnType,
  airtableType: string
): unknown {
  if (value == null) return null;

  if (airtableType === "multipleAttachments" || pgType === "text[]") {
    if (airtableType === "multipleAttachments" && Array.isArray(value)) {
      // Placeholder URLs — attachment uploader rewrites later
      return value
        .map((a) => {
          if (typeof a === "string") return a;
          if (a && typeof a === "object" && "url" in a) return String((a as { url: string }).url);
          return null;
        })
        .filter((x): x is string => !!x);
    }
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === "string") return [value];
    return null;
  }

  if (pgType === "uuid[]") {
    // Pass 1 leaves links null; Pass 2 remaps
    return null;
  }

  if (pgType === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1) return true;
    if (value === "false" || value === 0) return false;
    return Boolean(value);
  }

  if (pgType === "numeric") {
    if (typeof value === "number") return value;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  if (pgType === "date") {
    const s = String(value);
    return s.slice(0, 10);
  }

  if (pgType === "timestamptz") {
    return String(value);
  }

  // text
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(String).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function remapLinks(
  airtableIds: unknown,
  idMap: Map<string, string>
): string[] | null {
  if (!Array.isArray(airtableIds) || airtableIds.length === 0) return null;
  const out: string[] = [];
  for (const id of airtableIds) {
    if (typeof id !== "string") continue;
    const uuid = idMap.get(id);
    if (uuid) out.push(uuid);
  }
  return out.length ? out : null;
}

export async function loadIdMap(
  sb: SupabaseClient,
  tableName?: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    let q = sb
      .from("_airtable_id_map")
      .select("airtable_id, supabase_id, table_name")
      .range(from, from + pageSize - 1);
    if (tableName) q = q.eq("table_name", tableName);
    const { data, error } = await q;
    if (error) throw new Error(`loadIdMap: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      map.set(row.airtable_id as string, row.supabase_id as string);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

export async function upsertBatch(
  sb: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  chunkSize = 200
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from(table).upsert(chunk, { onConflict: "airtable_id" });
    if (error) throw new Error(`upsert ${table} [${i}-${i + chunk.length}): ${error.message}`);
  }
}

export async function countTable(sb: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

export type AttachmentObj = {
  url: string;
  filename?: string;
  type?: string;
};

export async function migrateAttachmentsForRow(
  sb: SupabaseClient,
  opts: {
    bucket: string;
    table: string;
    airtableId: string;
    field: string;
    attachments: AttachmentObj[];
  }
): Promise<string[]> {
  const urls: string[] = [];
  const PUBLIC_BUCKETS = new Set(["link-page-assets"]);
  for (let i = 0; i < opts.attachments.length; i++) {
    const att = opts.attachments[i];
    if (!att?.url) continue;
    // Already migrated to this project's storage — keep as-is
    if (
      att.url.includes("/storage/v1/object/") &&
      !att.url.includes("airtableusercontent.com") &&
      !att.url.includes("dl.airtable.com")
    ) {
      urls.push(att.url);
      continue;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    let res: Response;
    try {
      res = await fetch(att.url, { signal: controller.signal });
    } catch (err) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  attachment download fail ${opts.table}.${opts.field}: ${msg}`);
      urls.push(att.url); // keep original as fallback
      continue;
    }
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`  attachment download fail ${opts.table}.${opts.field}: ${res.status}`);
      urls.push(att.url); // keep original as fallback
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (att.filename?.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "");
    const hash = createHash("sha1").update(att.url).digest("hex").slice(0, 12);
    const objectPath = `${opts.table}/${opts.airtableId}/${opts.field}/${hash}_${i}.${ext}`;
    const contentType = att.type || res.headers.get("content-type") || "application/octet-stream";
    const { error } = await sb.storage.from(opts.bucket).upload(objectPath, buf, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.warn(`  storage upload fail: ${error.message}`);
      urls.push(att.url);
      continue;
    }
    if (PUBLIC_BUCKETS.has(opts.bucket)) {
      const { data } = sb.storage.from(opts.bucket).getPublicUrl(objectPath);
      urls.push(data?.publicUrl || objectPath);
    } else {
      // Private bucket: store durable path token; dual-run readers mint signed URLs.
      urls.push(`sb://${opts.bucket}/${objectPath}`);
    }
  }
  return urls;
}

export function attachmentBucketFor(table: string, field: string): string {
  if (table === "payment_submissions" || field.includes("proof")) return "payment-proofs";
  if (table === "feedback" || field.includes("screenshot")) return "feedback-screenshots";
  if (table.startsWith("link_page") || table === "link_pages") return "link-page-assets";
  if (table.startsWith("sop_")) return "sop-files";
  if (table === "winner_videos") return "winner-videos";
  return "attachments";
}

export function newRowId(): string {
  return randomUUID();
}

/** Dependency-friendly migration order: lookups first, then hubs, then dependents. */
export const MIGRATION_ORDER: string[] = [
  // no-FK / lookup
  "system_settings",
  "roles",
  "earnings_config",
  "staff_task_types",
  "whale_tags",
  "spin_wheel_prizes",
  "model_tiers",
  "model_groups",
  "sop_departments",
  "marketing_platforms",
  "pdf_templates",
  "pricing_rows",
  "pricing_specials",
  "mass_lists",
  "challenges",
  "mistakes",
  "mistake_reasons",
  // core hubs
  "users",
  "modelss",
  "clients",
  "client_models",
  // mid
  "models",
  "chatters",
  // intentionally excluded (gone from Airtable): creators
  "whales",
  "shifts",
  "shift_models",
  "shift_queue",
  "va_tasks",
  "va_task_phases",
  "va_task_phase_items",
  "task_templates",
  "task_template_phases",
  "task_template_items",
  "va_content_assignments",
  "custom_requests",
  "notifications",
  "notification_preferences",
  "push_subscriptions",
  "activity_logs",
  "billing_cycles",
  "billing_cycle_revenues",
  "payment_methods",
  "payment_submissions",
  "invoices",
  "calendar_events",
  "challenge_progress",
  "chatter_points",
  "points_transactions",
  "spin_wheel_spins",
  "monthly_targets",
  "staff_hours_summary",
  "model_live_streams",
  "model_periods",
  "model_personal_events",
  "model_schedule",
  "model_tasks",
  "model_time_off_requests",
  "model_content_requests",
  "model_expense_requests",
  "model_social_accounts",
  "model_funnel_links",
  "weekly_availability_requests",
  "weekly_availability_requests_models",
  "weekly_availability_requests_va",
  "weekly_program",
  "weekly_program_va",
  "whale_activity",
  "whale_transactions",
  // intentionally excluded (gone from Airtable): whale_tracker
  "feedback",
  "fines_and_bonuses",
  // intentionally excluded (gone from Airtable): fines_and_bonuses_legacy
  "chatter_mistakes",
  "rebills",
  "tips",
  "of_subscribers",
  "link_pages",
  "link_page_blocks",
  "link_redirects",
  "link_ab_results",
  "link_page_analytics",
  "sop_roles",
  "sop_functions",
  "sop_progress",
  "sop_quiz_questions",
  "sop_quiz_attempts",
  "sop_signoffs",
  "sop_feedback",
  "marketing_phones", // Airtable table renamed to "phones"
  // intentionally excluded (gone; use model_funnel_links): marketing_funnels
  "marketing_daily_reviews",
  "marketing_spot_checks",
  "marketing_exec_audits",
  "shadowban_reports",
  "winner_videos",
  "video_transcripts",
  "pdf_documents",
  // legacy
  // intentionally excluded (gone from Airtable): chatter_complaints
  "chatter_performance",
  "chatters_apply_form",
  "feedback_cc",
  "mss",
  "model_content_legacy",
  "paypal_money_received",
  "self_evaluations",
];

/** Tables present in Postgres schema but removed from Airtable — do not migrate. */
export const GONE_AIRTABLE_TABLES = [
  "creators",
  "chatter_complaints",
  "whale_tracker",
  "fines_and_bonuses_legacy",
  "marketing_funnels",
] as const;

/** Join tables populated from already-migrated uuid[] link columns. */
export const JOIN_TABLE_SPECS: Array<{
  joinTable: string;
  sourceTable: string;
  leftSourceField: string;
  rightSourceField: string;
  leftCol: string;
  rightCol: string;
  /** When left comes from the source row's own id (not a link field). */
  leftIsRowId?: boolean;
}> = [
  {
    joinTable: "va_task_assignees",
    sourceTable: "va_tasks",
    leftSourceField: "id",
    rightSourceField: "assigned_to",
    leftCol: "task_id",
    rightCol: "user_id",
    leftIsRowId: true,
  },
  {
    joinTable: "va_content_assignment_vas",
    sourceTable: "va_content_assignments",
    leftSourceField: "id",
    rightSourceField: "va",
    leftCol: "assignment_id",
    rightCol: "user_id",
    leftIsRowId: true,
  },
  {
    joinTable: "client_model_assignments",
    sourceTable: "client_models",
    leftSourceField: "client",
    rightSourceField: "model",
    leftCol: "client_id",
    rightCol: "model_id",
  },
  {
    joinTable: "shift_model_links",
    sourceTable: "shift_models",
    leftSourceField: "shift",
    rightSourceField: "model",
    leftCol: "shift_id",
    rightCol: "model_id",
  },
  {
    joinTable: "custom_request_assignees",
    sourceTable: "custom_requests",
    leftSourceField: "id",
    rightSourceField: "chatter",
    leftCol: "request_id",
    rightCol: "user_id",
    leftIsRowId: true,
  },
  {
    joinTable: "sop_role_users",
    sourceTable: "sop_roles",
    leftSourceField: "id",
    rightSourceField: "assigned_users",
    leftCol: "sop_role_id",
    rightCol: "user_id",
    leftIsRowId: true,
  },
];
