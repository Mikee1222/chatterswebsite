#!/usr/bin/env tsx
/**
 * Fetches the live Airtable base schema (Metadata API) and compares it to tables,
 * fields, and single-select option sets that the repo expects.
 *
 * Usage:
 *   npx tsx scripts/audit-airtable-schema.ts 2>&1 | tee airtable-audit-report.txt
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (.env / .env.local or wrangler.jsonc for base id)
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBaseSchema, type AirtableTable, type AirtableField } from "../lib/airtable-admin";
import {
  CUSTOM_REQUEST_PRIORITY_OPTIONS,
  CUSTOM_REQUEST_STATUS_OPTIONS,
  CUSTOM_REQUEST_TYPE_OPTIONS,
  MODEL_LIVE_STREAM_PLATFORM_OPTIONS,
  MODEL_LIVE_STREAM_STATUS_OPTIONS,
  MODEL_TASK_TYPE_OPTIONS,
  TRANSACTION_CURRENCY_OPTIONS,
  TRANSACTION_TYPES,
  WHALE_STATUS_OPTIONS,
} from "../lib/airtable-options";
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_CATEGORIES } from "../lib/notifications-schema";

loadEnv({ path: ".env.local" });
loadEnv();
loadEnv({ path: ".env.local" });

function loadBaseIdFromWrangler(): string | null {
  const path = resolve(process.cwd(), "wrangler.jsonc");
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/"AIRTABLE_BASE_ID"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

function getCredentials(): { token: string; baseId: string } {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!token) {
    console.error("Missing AIRTABLE_TOKEN (set in .env / .env.local).");
    process.exit(1);
  }
  let baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!baseId) {
    baseId = loadBaseIdFromWrangler() ?? "";
    if (baseId) console.log("(Using AIRTABLE_BASE_ID from wrangler.jsonc)\n");
  }
  if (!baseId) {
    console.error("Missing AIRTABLE_BASE_ID.");
    process.exit(1);
  }
  return { token, baseId };
}

/** Normalize single-select option names for comparison (Airtable uses display names with spaces). */
function normChoice(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

function normFieldName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").trim();
}

function getChoiceNames(field: AirtableField): string[] {
  const opts = field.options as { choices?: { name?: string }[] } | undefined;
  const ch = opts?.choices;
  return Array.isArray(ch) ? ch.map((c) => (typeof c?.name === "string" ? c.name : "")).filter(Boolean) : [];
}

/** Tables referenced by sanitization / services / API routes (must exist for full app behavior). */
const REQUIRED_TABLES: string[] = [
  "feedback",
  "model_content_requests",
  "model_expense_requests",
  "model_personal_events",
  "notifications",
  "notification_preferences",
  "push_subscriptions",
  "activity_logs",
  "spin_wheel_prizes",
  "spin_wheel_spins",
  "challenges",
  "challenge_progress",
  "model_periods",
  "va_content_assignments",
  "custom_requests",
  "whale_transactions",
  "weekly_program",
  "weekly_program_va",
  "weekly_availability_requests",
  "weekly_availability_requests_va",
  "weekly_availability_requests_models",
  "shifts",
  "shift_models",
  "whales",
  "modelss",
  "users",
  "model_tasks",
  "model_live_streams",
  "model_time_off_requests",
  "va_tasks",
  "monthly_targets",
  "system_settings",
  "model_groups",
  "model_schedule",
  "chatter_points",
  "points_transactions",
  "staff_task_types",
];

const TABLE_CREATION_HINTS: Record<string, string> = {
  feedback: "npx tsx scripts/create-feedback-table.ts",
  model_content_requests: "npx tsx scripts/create-content-requests-table.ts",
  model_expense_requests: "npx tsx scripts/create-expense-requests-table.ts",
  model_personal_events: "npx tsx scripts/create-model-events-table.ts",
  model_time_off_requests: "npx tsx scripts/create-time-off-table.ts",
  model_periods: "npx tsx scripts/setup-period-tracking.ts",
  va_tasks: "npx tsx scripts/setup-va-tasks.ts",
  model_groups: "npm run create:model-groups-table",
  /** Broad setup scripts */
  users: "npx tsx scripts/setup-airtable.ts or setup-model-tables.ts",
  modelss: "npx tsx scripts/setup-model-tables.ts",
};

/**
 * Single-select / multi-select option sets the codebase can write or filter on.
 * Keys are Airtable field names (snake_case as in UI); values are allowed choice strings
 * (normalized comparison via normChoice).
 */
function buildCodeSelectExpectations(): Record<string, Record<string, readonly string[]>> {
  const userRoles = ["admin", "manager", "chatter", "virtual_assistant", "model"] as const;
  return {
    notifications: {
      event_type: NOTIFICATION_EVENT_TYPES,
      category: NOTIFICATION_CATEGORIES,
    },
    custom_requests: {
      /** Code paths use `admin_status` + `model_status` (not a single `status`). */
      admin_status: ["pending", "accepted", "rejected"],
      model_status: ["waiting_schedule", "scheduled", "in_progress", "completed", "uploaded", "declined"],
      custom_type: CUSTOM_REQUEST_TYPE_OPTIONS,
      priority: CUSTOM_REQUEST_PRIORITY_OPTIONS,
    },
    whales: {
      status: WHALE_STATUS_OPTIONS as unknown as readonly string[],
    },
    modelss: {
      platform: ["onlyfans", "fanvue", "other"],
      /** mapRecord accepts free|occupied; status may be active/inactive in base */
      current_status: ["free", "occupied"],
      priority: ["low", "medium", "high"],
    },
    users: {
      role: userRoles,
      va_type: ["chatting", "marketing", "both"],
    },
    feedback: {
      type: ["bug", "suggestion", "other"],
      status: ["new", "in_review", "resolved", "wont_fix"],
      user_role: ["chatter", "virtual_assistant", "model", "admin"],
    },
    model_content_requests: {
      type: ["script", "mass", "photo_set", "video", "other"],
      status: ["pending", "approved", "rejected", "in_progress", "completed"],
    },
    model_expense_requests: {
      type: ["airbnb", "other"],
      status: ["pending", "approved", "rejected"],
    },
    model_personal_events: {
      event_type: ["nails", "lashes", "hairdresser", "surgery", "fillers", "custom"],
    },
    model_live_streams: {
      platform: MODEL_LIVE_STREAM_PLATFORM_OPTIONS,
      status: MODEL_LIVE_STREAM_STATUS_OPTIONS,
    },
    /** Airtable column is `task_type`; service Fields still use `type` (see FIELD_ALIASES). */
    model_tasks: {
      task_type: MODEL_TASK_TYPE_OPTIONS,
    },
    shifts: {
      /** Display names may be "On break" — compared normalized. */
      status: ["active", "on_break", "completed", "cancelled"],
      staff_role: ["chatter", "virtual_assistant"],
      shift_type: ["chatting", "mistakes", "vault_cleaning", "other", "task"],
    },
    weekly_program: {
      day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      /** @see WEEKLY_PROGRAM_SHIFT_TYPES — not the same as shifts.shift_type */
      shift_type: ["Morning", "Night", "Custom"],
    },
    weekly_program_va: {
      day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      shift_type: ["Morning", "Night", "Custom"],
    },
    weekly_availability_requests: {
      day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      shift_type: ["Morning", "Night", "Custom"],
      entry_type: ["availability", "day_off"],
      status: ["submitted", "reviewed", "used", "rejected"],
    },
    weekly_availability_requests_va: {
      day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      shift_type: ["Morning", "Night", "Custom"],
      entry_type: ["availability", "day_off"],
      status: ["submitted", "reviewed", "used", "rejected"],
    },
    weekly_availability_requests_models: {
      day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      entry_type: ["availability", "day_off", "live_window", "custom_window"],
      /** Airtable may use used_in_schedule/approved — code maps them in parseStatus */
      status: ["submitted", "reviewed", "used", "rejected", "approved", "used_in_schedule"],
    },
    va_tasks: {
      status: ["pending", "in_progress", "done", "skipped"],
      priority: ["low", "normal", "high", "urgent"],
      recurrence_type: ["daily", "weekly", "monthly", "custom"],
      recurrence_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    },
    va_content_assignments: {
      status: ["pending", "scheduled", "completed", "cancelled"],
      priority: ["low", "normal", "high", "urgent"],
      content_type: ["PDF", "Video Script", "Photo Guide", "Other"],
    },
    whale_transactions: {
      type: TRANSACTION_TYPES,
      currency: TRANSACTION_CURRENCY_OPTIONS,
    },
    model_periods: {
      logged_by: ["model", "admin", "va"],
    },
    chatter_points: {
      level: ["Bronze", "Silver", "Gold", "Diamond"],
    },
    points_transactions: {
      category: ["shift", "whale", "custom", "streak", "challenge", "manual", "penalty", "spin"],
    },
    challenges: {
      target_metric: [
        "transactions",
        "whales_added",
        "shift_hours",
        "customs_completed",
        "whale_status_upgrades",
      ],
    },
    spin_wheel_prizes: {
      prize_type: ["cash", "extra_break", "double_points", "mystery", "points", "custom", "bonus", "break"],
    },
    model_schedule: {
      item_type: ["script", "mass_message", "live_stream", "custom", "content_shoot", "promo", "meeting", "rest", "time_off", "other"],
    },
  };
}

/**
 * Codebase field name → one or more Airtable column names (normalized) treated as equivalent.
 * Use when the product UI name drifted from the physical column.
 */
const FIELD_ALIASES: Record<string, Record<string, string[]>> = {
  model_tasks: {
    type: ["task_type"],
    status: ["task_status"],
    required: ["is_required"],
    linked_schedule_item: ["schedule_item"],
  },
  feedback: {
    body: ["description"],
  },
};

/** Critical fields Code reads/writes (normalized names). Optional fields omitted where bases vary. */
const EXPECTED_FIELDS_BY_TABLE: Record<string, string[]> = {
  /** metadata is optional per notifications-schema comments */
  notifications: [
    "notification_id",
    "user_id",
    "category",
    "event_type",
    "priority",
    "title",
    "body",
    "entity_type",
    "entity_id",
    "read_at",
    "created_at",
  ],
  users: [
    "user_id",
    "full_name",
    "email",
    "role",
    "va_type",
    "status",
    "can_login",
    "notes",
    "password_hash",
    "linked_model",
    "language_preference",
    "created_at",
    "updated_at",
  ],
  modelss: [
    "model_id",
    "model_name",
    "platform",
    "status",
    "current_status",
    "current_chatter",
    "priority",
    "notes",
    "created_at",
    "updated_at",
    /** period UX */
    "avg_cycle_length",
    "avg_period_length",
    "period_notes",
    "period_tracking_enabled",
  ],
  shifts: [
    "shift_id",
    "chatter",
    "chatter_name",
    "week_start",
    "date",
    "scheduled_shift",
    "start_time",
    "end_time",
    "break_started_at",
    "break_reminder_at",
    "break_minutes",
    "total_minutes",
    "status",
    "models_count",
    "staff_role",
    "shift_type",
    "task_label",
    "total_hours_decimal",
    "notes",
    "created_at",
    "updated_at",
  ],
  shift_models: [
    "shift_model_id",
    "shift",
    "model",
    "model_name",
    "chatter",
    "chatter_name",
    "entered_at",
    "left_at",
    "status",
    "session_minutes",
    "notes",
    "created_at",
  ],
  weekly_availability_requests_models: [
    "request_id",
    "week_start",
    "model",
    "model_name",
    "day",
    "entry_type",
    "start_time",
    "end_time",
    "availability_windows",
    "notes",
    "status",
    "created_at",
  ],
  custom_requests: [
    "request_id",
    "fan_username",
    "requested_by_chatter",
    "assigned_model",
    "assigned_va",
    "request_title",
    "request_details",
    "price",
    "deadline_requested",
    "admin_status",
    "model_status",
    "model_scheduled_date",
    "linked_schedule_item",
    "created_at",
    "updated_at",
  ],
  feedback: [
    "feedback_id",
    "type",
    "status",
    "user_role",
    "title",
    "body",
    "created_at",
  ],
  model_tasks: [
    "task_id",
    "model",
    "title",
    "task_type",
    "task_status",
    "date",
    "schedule_item",
    "is_required",
    "created_at",
  ],
};

function printFullSchemaDump(tables: AirtableTable[]) {
  console.log("\n========== AIRTABLE SCHEMA DUMP ==========\n");
  for (const table of tables) {
    console.log(`\nTABLE: ${table.name}`);
    console.log("─".repeat(52));
    for (const field of table.fields) {
      let extra = "";
      if (field.type === "singleSelect" || field.type === "multipleSelects") {
        const names = getChoiceNames(field);
        extra = `\n     Options [${names.length}]: ${names.join(", ")}`;
      }
      if (field.type === "multipleRecordLinks") {
        const lt = field.options && typeof field.options === "object" && "linkedTableId" in field.options
          ? String((field.options as { linkedTableId?: string }).linkedTableId)
          : "?";
        extra = ` → linkedTableId: ${lt}`;
      }
      console.log(`  - ${field.name} (${field.type})${extra}`);
    }
  }
  console.log("\n========== END SCHEMA DUMP ==========\n");
}

function findField(table: AirtableTable | undefined, logicalName: string): AirtableField | undefined {
  if (!table) return undefined;
  const want = normFieldName(logicalName);
  return table.fields.find((f) => normFieldName(f.name) === want);
}

async function audit() {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);
  const tables = schema.tables ?? [];
  const tableByName = new Map<string, AirtableTable>(
    tables.map((t) => [t.name, t])
  );

  printFullSchemaDump(tables.sort((a, b) => a.name.localeCompare(b.name)));

  console.log("\n========== TABLE PRESENCE (code expects) ==========\n");
  const missingTables: string[] = [];
  for (const name of REQUIRED_TABLES.sort()) {
    const exists = tables.some((t) => t.name === name);
    console.log(`${exists ? "✅" : "❌"} ${name}`);
    if (!exists) missingTables.push(name);
  }

  const requiredSet = new Set(REQUIRED_TABLES);
  const extraTables = tables.map((t) => t.name).filter((n) => !requiredSet.has(n)).sort();

  console.log("\n========== TABLES IN BASE NOT IN REQUIRED LIST ==========\n");
  if (extraTables.length === 0) console.log("(none)");
  else for (const n of extraTables) console.log(`ℹ️  ${n} — not referenced in REQUIRED_TABLES; may be formulas/legacy/UI-only.`);

  const codeSelects = buildCodeSelectExpectations();
  console.log("\n========== SINGLE-SELECT OPTIONS (code ⊂ Airtable) ==========\n");
  const missingOptsReport: string[] = [];
  const extraOptsReport: string[] = [];

  for (const [tableName, fields] of Object.entries(codeSelects)) {
    const table = tableByName.get(tableName);
    if (!table) continue;

    for (const [fieldName, expectedList] of Object.entries(fields)) {
      const fld = findField(table, fieldName);
      if (!fld) {
        console.log(`❌ MISSING FIELD (for select audit): ${tableName}.${fieldName}`);
        missingOptsReport.push(`${tableName}.${fieldName} — field missing`);
        continue;
      }
      if (fld.type !== "singleSelect" && fld.type !== "multipleSelects") {
        console.log(`ℹ️  ${tableName}.${fieldName} — type=${fld.type} (skipping choice list compare)`);
        continue;
      }
      const airtableChoices = getChoiceNames(fld);
      const normAir = new Set(airtableChoices.map(normChoice));
      const missing = expectedList.filter((opt) => !normAir.has(normChoice(opt)));
      const extras = airtableChoices.filter((c) => !expectedList.some((e) => normChoice(e) === normChoice(c)));

      if (missing.length === 0) console.log(`✅ ${tableName}.${fieldName}: all codebase options present in Airtable`);
      else {
        const msg = `⚠️  ${tableName}.${fieldName}: Airtable missing choices used/named in code: ${missing.join(", ")}`;
        console.log(msg);
        missingOptsReport.push(msg);
      }
      if (extras.length > 0) {
        const msg = `ℹ️  ${tableName}.${fieldName}: Airtable has extra choices (not in audit list): ${extras.join(", ")}`;
        console.log(msg);
        extraOptsReport.push(msg);
      }
    }
  }

  console.log("\n========== MISSING FIELDS (high-signal checklist) ==========\n");
  const missingFieldsReport: string[] = [];
  for (const [tableName, expected] of Object.entries(EXPECTED_FIELDS_BY_TABLE)) {
    const table = tableByName.get(tableName);
    if (!table) {
      missingFieldsReport.push(`${tableName} — table missing, skip field audit`);
      continue;
    }
    const have = new Set(table.fields.map((f) => normFieldName(f.name)));
    const aliases = FIELD_ALIASES[tableName] ?? {};
    const miss = expected.filter((logical) => {
      const n = normFieldName(logical);
      if (have.has(n)) return false;
      const alt = aliases[logical];
      if (alt?.some((a) => have.has(normFieldName(a)))) return false;
      return true;
    });
    if (miss.length === 0) console.log(`✅ ${tableName}: expected fields present (incl. known aliases)`);
    else {
      const line = `❌ ${tableName}: missing fields → ${miss.join(", ")}`;
      console.log(line);
      missingFieldsReport.push(line);
    }
  }

  console.log("\nNOTE: Code links models via users.linked_model → modelss, not users.linked_model_id (text).\n");

  console.log("\n========== ACTION REQUIRED ==========\n");
  console.log("\nMISSING TABLES:\n");
  if (missingTables.length === 0) console.log("  (none)");
  else {
    for (const t of missingTables) {
      const hint = TABLE_CREATION_HINTS[t];
      console.log(`  ❌ ${t}${hint ? ` → try: ${hint}` : " → create in Airtable or add a creation script"}`);
    }
  }

  console.log("\nMISSING / MISMATCH SELECT OPTIONS (add choices in Airtable to match codebase):\n");
  if (missingOptsReport.length === 0) console.log("  (none flagged)");
  else for (const m of missingOptsReport) console.log(`  ${m}`);

  console.log("\nMISSING FIELDS:\n");
  if (missingFieldsReport.length === 0) console.log("  (none flagged for audited tables)");
  else for (const m of missingFieldsReport) console.log(`  ${m}`);

  const totalProblems =
    missingTables.length +
    missingOptsReport.length +
    missingFieldsReport.filter((l) => !l.includes("table missing")).length;

  console.log(`\n-------------------------------------`);
  console.log(`SUMMARY (strict counts above):`);
  console.log(`  Tables missing: ${missingTables.length}`);
  console.log(`  Select-option mismatches flagged: ${missingOptsReport.length}`);
  console.log(`  Field mismatches flagged: ${missingFieldsReport.filter((l) => !l.includes("table missing")).length}`);
  console.log(`  Loose total issues: ~${totalProblems}`);
  console.log(`=====================================`);
}

audit().catch((err) => {
  console.error(err);
  process.exit(1);
});
