#!/usr/bin/env npx tsx
/**
 * One-time setup: create SOP Library tables in Airtable via the Meta API.
 *
 * Tables (in dependency order):
 *   sop_departments → sop_roles (links users) → sop_functions (links roles + departments)
 *
 * Usage (from repo root):
 *   npx tsx scripts/setup-sop-tables.ts --dry-run
 *   npx tsx scripts/setup-sop-tables.ts
 *
 * Requires env:
 *   AIRTABLE_TOKEN — PAT with schema.bases:read + schema.bases:write
 *   AIRTABLE_BASE_ID — target base id
 */

import "dotenv/config";

const META_BASE = "https://api.airtable.com/v0/meta/bases";

/** IANA zone aligned with other setup scripts (UTC+3, no DST). */
const DATETIME_TZ = "Asia/Riyadh";

const datetimeOptions = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ,
};

const checkboxOptions = { icon: "check", color: "greenBright" as const };

const SOP_COLOR_CHOICES = [
  { name: "blue" },
  { name: "pink" },
  { name: "green" },
  { name: "orange" },
  { name: "purple" },
  { name: "gray" },
];

const AUTH_ROLE_CHOICES = [
  { name: "admin" },
  { name: "manager" },
  { name: "chatter" },
  { name: "virtual_assistant" },
  { name: "model" },
  { name: "client" },
];

const CADENCE_TYPE_CHOICES = [
  { name: "daily" },
  { name: "per_shift" },
  { name: "weekly" },
  { name: "biweekly" },
  { name: "monthly" },
  { name: "ad_hoc" },
  { name: "per_event" },
];

function log(msg: string) {
  console.log(`[setup-sop-tables] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[setup-sop-tables] ERROR: ${msg}`);
}

const DRY_RUN = process.argv.includes("--dry-run");

async function metaFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${META_BASE}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

type MetaTable = { id: string; name: string };

async function listTables(baseId: string, token: string): Promise<MetaTable[]> {
  const res = await metaFetch(token, `/${baseId}/tables`, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET tables failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function findTableId(tables: MetaTable[], name: string): string | null {
  const hit = tables.find((t) => t.name === name);
  return hit?.id ?? null;
}

function findUsersTableId(tables: MetaTable[]): string | null {
  const lower = (n: string) => n.trim().toLowerCase();
  const hit = tables.find((t) => lower(t.name) === "users");
  return hit?.id ?? null;
}

function departmentsFields(): Array<Record<string, unknown>> {
  return [
    { name: "department_id", type: "singleLineText" },
    { name: "name", type: "singleLineText" },
    {
      name: "color",
      type: "singleSelect",
      options: { choices: SOP_COLOR_CHOICES },
    },
    { name: "sort_order", type: "number", options: { precision: 0 } },
    { name: "is_active", type: "checkbox", options: { ...checkboxOptions } },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

function rolesFields(
  usersTableId: string,
  departmentsTableId: string
): Array<Record<string, unknown>> {
  return [
    { name: "role_id", type: "singleLineText" },
    { name: "name", type: "singleLineText" },
    { name: "slug", type: "singleLineText" },
    { name: "description", type: "multilineText" },
    { name: "icon", type: "singleLineText" },
    {
      name: "color",
      type: "singleSelect",
      options: { choices: SOP_COLOR_CHOICES },
    },
    {
      name: "department",
      type: "multipleRecordLinks",
      options: { linkedTableId: departmentsTableId },
    },
    {
      name: "auth_roles",
      type: "multipleSelects",
      options: { choices: AUTH_ROLE_CHOICES },
    },
    {
      name: "assigned_users",
      type: "multipleRecordLinks",
      options: { linkedTableId: usersTableId },
    },
    { name: "academy_mode", type: "checkbox", options: { ...checkboxOptions } },
    { name: "sort_order", type: "number", options: { precision: 0 } },
    { name: "is_active", type: "checkbox", options: { ...checkboxOptions } },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

function progressFields(
  usersTableId: string,
  rolesTableId: string,
  functionsTableId: string
): Array<Record<string, unknown>> {
  return [
    { name: "progress_id", type: "singleLineText" },
    {
      name: "user",
      type: "multipleRecordLinks",
      options: { linkedTableId: usersTableId },
    },
    {
      name: "sop_function",
      type: "multipleRecordLinks",
      options: { linkedTableId: functionsTableId },
    },
    {
      name: "sop_role",
      type: "multipleRecordLinks",
      options: { linkedTableId: rolesTableId },
    },
    { name: "completed_at", type: "dateTime", options: { ...datetimeOptions } },
    { name: "completed_version", type: "number", options: { precision: 0 } },
    { name: "quiz_score", type: "number", options: { precision: 0 } },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

function quizFields(functionsTableId: string): Array<Record<string, unknown>> {
  return [
    { name: "question_id", type: "singleLineText" },
    {
      name: "sop_function",
      type: "multipleRecordLinks",
      options: { linkedTableId: functionsTableId },
    },
    { name: "question", type: "multilineText" },
    { name: "option_a", type: "singleLineText" },
    { name: "option_b", type: "singleLineText" },
    { name: "option_c", type: "singleLineText" },
    { name: "option_d", type: "singleLineText" },
    {
      name: "correct_option",
      type: "singleSelect",
      options: { choices: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }] },
    },
    { name: "sort_order", type: "number", options: { precision: 0 } },
    { name: "is_active", type: "checkbox", options: { ...checkboxOptions } },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

function signoffsFields(
  usersTableId: string,
  rolesTableId: string
): Array<Record<string, unknown>> {
  return [
    { name: "signoff_id", type: "singleLineText" },
    {
      name: "user",
      type: "multipleRecordLinks",
      options: { linkedTableId: usersTableId },
    },
    {
      name: "sop_role",
      type: "multipleRecordLinks",
      options: { linkedTableId: rolesTableId },
    },
    { name: "signed_at", type: "dateTime", options: { ...datetimeOptions } },
    { name: "statement", type: "multilineText" },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

function functionsFields(
  rolesTableId: string,
  departmentsTableId: string
): Array<Record<string, unknown>> {
  return [
    { name: "function_id", type: "singleLineText" },
    {
      name: "sop_role",
      type: "multipleRecordLinks",
      options: { linkedTableId: rolesTableId },
    },
    { name: "name", type: "singleLineText" },
    {
      name: "department",
      type: "multipleRecordLinks",
      options: { linkedTableId: departmentsTableId },
    },
    { name: "kpi", type: "multilineText" },
    {
      name: "standard_type",
      type: "singleSelect",
      options: { choices: [{ name: "text" }, { name: "file" }] },
    },
    { name: "sop_content", type: "multilineText" },
    { name: "sop_file_url", type: "url" },
    { name: "sop_file_name", type: "singleLineText" },
    { name: "loom_url", type: "url" },
    {
      name: "cadence_type",
      type: "singleSelect",
      options: { choices: CADENCE_TYPE_CHOICES },
    },
    { name: "cadence_note", type: "singleLineText" },
    { name: "sort_order", type: "number", options: { precision: 0 } },
    { name: "is_active", type: "checkbox", options: { ...checkboxOptions } },
    { name: "content_version", type: "number", options: { precision: 0 } },
    { name: "estimated_minutes", type: "number", options: { precision: 0 } },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

function quizAttemptsFields(
  usersTableId: string,
  rolesTableId: string,
  functionsTableId: string
): Array<Record<string, unknown>> {
  return [
    { name: "attempt_id", type: "singleLineText" },
    {
      name: "user",
      type: "multipleRecordLinks",
      options: { linkedTableId: usersTableId },
    },
    {
      name: "sop_function",
      type: "multipleRecordLinks",
      options: { linkedTableId: functionsTableId },
    },
    {
      name: "sop_role",
      type: "multipleRecordLinks",
      options: { linkedTableId: rolesTableId },
    },
    { name: "score", type: "number", options: { precision: 0 } },
    { name: "passed", type: "checkbox", options: { ...checkboxOptions } },
    { name: "wrong_count", type: "number", options: { precision: 0 } },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

function feedbackFields(
  usersTableId: string,
  rolesTableId: string,
  functionsTableId: string
): Array<Record<string, unknown>> {
  return [
    { name: "feedback_id", type: "singleLineText" },
    {
      name: "user",
      type: "multipleRecordLinks",
      options: { linkedTableId: usersTableId },
    },
    {
      name: "sop_function",
      type: "multipleRecordLinks",
      options: { linkedTableId: functionsTableId },
    },
    {
      name: "sop_role",
      type: "multipleRecordLinks",
      options: { linkedTableId: rolesTableId },
    },
    {
      name: "helpful",
      type: "singleSelect",
      options: { choices: [{ name: "yes" }, { name: "no" }] },
    },
    { name: "comment", type: "multilineText" },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

type TablePlan = {
  name: string;
  description: string;
  buildFields: (ctx: {
    usersId: string;
    rolesId: string;
    departmentsId: string;
    functionsId: string;
  }) => Array<Record<string, unknown>>;
  requires?: ("users" | "sop_departments" | "sop_roles" | "sop_functions")[];
};

const TABLE_PLANS: TablePlan[] = [
  {
    name: "sop_departments",
    description: "SOP departments (setup-sop-tables.ts)",
    buildFields: () => departmentsFields(),
  },
  {
    name: "sop_roles",
    description: "SOP roles (setup-sop-tables.ts)",
    requires: ["users", "sop_departments"],
    buildFields: ({ usersId, departmentsId }) => rolesFields(usersId, departmentsId),
  },
  {
    name: "sop_functions",
    description: "SOP functions per role (setup-sop-tables.ts)",
    requires: ["sop_departments", "sop_roles"],
    buildFields: ({ rolesId, departmentsId }) => functionsFields(rolesId, departmentsId),
  },
  {
    name: "sop_progress",
    description: "SOP academy per-user function completion (setup-sop-tables.ts)",
    requires: ["users", "sop_roles", "sop_functions"],
    buildFields: ({ usersId, rolesId, departmentsId: _d, functionsId }) =>
      progressFields(usersId, rolesId, functionsId),
  },
  {
    name: "sop_quiz_questions",
    description: "SOP academy quiz questions per function (setup-sop-tables.ts)",
    requires: ["sop_functions"],
    buildFields: ({ functionsId }) => quizFields(functionsId),
  },
  {
    name: "sop_signoffs",
    description: "SOP academy role training sign-offs (setup-sop-tables.ts)",
    requires: ["users", "sop_roles"],
    buildFields: ({ usersId, rolesId }) => signoffsFields(usersId, rolesId),
  },
  {
    name: "sop_feedback",
    description: "SOP academy member feedback per function (setup-sop-tables.ts)",
    requires: ["users", "sop_roles", "sop_functions"],
    buildFields: ({ usersId, rolesId, functionsId }) =>
      feedbackFields(usersId, rolesId, functionsId),
  },
  {
    name: "sop_quiz_attempts",
    description: "SOP academy quiz submission attempts (setup-sop-tables.ts)",
    requires: ["users", "sop_roles", "sop_functions"],
    buildFields: ({ usersId, rolesId, functionsId }) =>
      quizAttemptsFields(usersId, rolesId, functionsId),
  },
];

async function createTable(
  baseId: string,
  token: string,
  plan: TablePlan,
  ctx: { usersId: string; rolesId: string; departmentsId: string; functionsId: string }
): Promise<{ ok: boolean; tableId?: string; error?: string }> {
  const fields = plan.buildFields(ctx);
  const body = {
    name: plan.name,
    description: plan.description,
    fields,
  };

  if (DRY_RUN) {
    log(`Would create table "${plan.name}" (${fields.length} fields)`);
    return { ok: true, tableId: "(dry run)" };
  }

  const res = await metaFetch(token, `/${baseId}/tables`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `${res.status}: ${text}` };
  }

  const created = (await res.json()) as { id?: string; name?: string };
  return { ok: true, tableId: created.id };
}

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();

  if (!token || !baseId) {
    logErr("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID (e.g. in .env at repo root).");
    process.exit(1);
  }

  if (DRY_RUN) {
    log("Dry run: no tables will be created.");
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  try {
    log(`Using base id: ${baseId.slice(0, 8)}…`);
    let tables = await listTables(baseId, token);
    const byName = new Map(tables.map((t) => [t.name, t]));

    const usersId = findUsersTableId(tables);
    if (!usersId) {
      logErr(`No "users" table found. Found: ${tables.map((t) => t.name).join(", ") || "(none)"}`);
      process.exit(1);
    }
    log(`users table id: ${usersId}`);

    const ctx = {
      usersId,
      departmentsId: findTableId(tables, "sop_departments") ?? "",
      rolesId: findTableId(tables, "sop_roles") ?? "",
      functionsId: findTableId(tables, "sop_functions") ?? "",
    };

    for (const plan of TABLE_PLANS) {
      if (byName.has(plan.name)) {
        log(`Table "${plan.name}" already exists, skipping`);
        skipped.push(plan.name);
        if (plan.name === "sop_departments") ctx.departmentsId = byName.get(plan.name)!.id;
        if (plan.name === "sop_roles") ctx.rolesId = byName.get(plan.name)!.id;
        if (plan.name === "sop_functions") ctx.functionsId = byName.get(plan.name)!.id;
        continue;
      }

      if (plan.requires?.includes("users") && !usersId) {
        errors.push(`${plan.name}: users table required`);
        continue;
      }
      if (plan.requires?.includes("sop_departments") && !ctx.departmentsId) {
        errors.push(`${plan.name}: sop_departments must exist first`);
        continue;
      }
      if (plan.requires?.includes("sop_roles") && !ctx.rolesId) {
        errors.push(`${plan.name}: sop_roles must exist first`);
        continue;
      }
      if (plan.requires?.includes("sop_functions") && !ctx.functionsId) {
        errors.push(`${plan.name}: sop_functions must exist first`);
        continue;
      }

      log(`Creating table "${plan.name}"…`);
      const result = await createTable(baseId, token, plan, ctx);
      if (!result.ok) {
        errors.push(`${plan.name}: ${result.error ?? "unknown error"}`);
        logErr(`Create table "${plan.name}" failed: ${result.error}`);
        break;
      }

      created.push(plan.name);
      if (result.tableId && result.tableId !== "(dry run)") {
        byName.set(plan.name, { id: result.tableId, name: plan.name });
        if (plan.name === "sop_departments") ctx.departmentsId = result.tableId;
        if (plan.name === "sop_roles") ctx.rolesId = result.tableId;
        if (plan.name === "sop_functions") ctx.functionsId = result.tableId;
        log(`Created "${plan.name}" (id: ${result.tableId})`);
      }
    }

    log(`— Summary${DRY_RUN ? " (dry run)" : ""} —`);
    log(`${DRY_RUN ? "Would create" : "Created"} (${created.length}): ${created.length ? created.join(", ") : "(none)"}`);
    log(`Skipped (${skipped.length}): ${skipped.length ? skipped.join(", ") : "(none)"}`);
    if (errors.length) {
      log(`Errors (${errors.length}): ${errors.join("; ")}`);
      process.exit(1);
    }
    log(DRY_RUN ? "Dry run finished." : "Done.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logErr(msg);
    process.exit(1);
  }
}

main();
