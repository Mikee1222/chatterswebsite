#!/usr/bin/env npx tsx
/**
 * One-time setup: create the `va_tasks` table in Airtable via the Meta API.
 *
 * Usage (from repo root):
 *   npx tsx scripts/setup-va-tasks.ts
 *
 * Requires env:
 *   AIRTABLE_TOKEN — PAT with schema.bases:read + schema.bases:write
 *   AIRTABLE_BASE_ID — target base id
 *
 * Loads `.env` from cwd when present (via dotenv).
 */

import "dotenv/config";

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const TABLE_NAME = "va_tasks";
/** IANA zone for UTC+3 (no DST). */
const DATETIME_TZ_GMT_PLUS_3 = "Asia/Riyadh";

type MetaTable = { id: string; name: string };

const datetimeOptionsGmtPlus3 = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ_GMT_PLUS_3,
};

const dateOptionsIso = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
};

function log(msg: string) {
  console.log(`[setup-va-tasks] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[setup-va-tasks] ERROR: ${msg}`);
}

async function metaFetch(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
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

async function listTables(baseId: string, token: string): Promise<MetaTable[]> {
  const res = await metaFetch(token, `/${baseId}/tables`, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET tables failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function findUsersTableId(tables: MetaTable[]): string | null {
  const lower = (n: string) => n.trim().toLowerCase();
  const hit = tables.find((t) => lower(t.name) === "users");
  return hit?.id ?? null;
}

function buildFieldsPayload(usersTableId: string): Array<Record<string, unknown>> {
  return [
    { name: "title", type: "singleLineText" },
    { name: "description", type: "multilineText" },
    {
      name: "assigned_to",
      type: "multipleRecordLinks",
      options: { linkedTableId: usersTableId },
    },
    {
      name: "assigned_by",
      type: "multipleRecordLinks",
      options: { linkedTableId: usersTableId },
    },
    {
      name: "status",
      type: "singleSelect",
      options: {
        choices: [
          { name: "pending" },
          { name: "in_progress" },
          { name: "done" },
          { name: "skipped" },
        ],
      },
    },
    {
      name: "priority",
      type: "singleSelect",
      options: {
        choices: [
          { name: "low" },
          { name: "normal" },
          { name: "high" },
          { name: "urgent" },
        ],
      },
    },
    {
      name: "due_date",
      type: "dateTime",
      options: { ...datetimeOptionsGmtPlus3 },
    },
    {
      name: "is_recurring",
      type: "checkbox",
      options: { icon: "check", color: "greenBright" },
    },
    {
      name: "recurrence_type",
      type: "singleSelect",
      options: {
        choices: [
          { name: "daily" },
          { name: "weekly" },
          { name: "monthly" },
          { name: "custom" },
        ],
      },
    },
    {
      name: "recurrence_days",
      type: "multipleSelects",
      options: {
        choices: [
          { name: "Monday" },
          { name: "Tuesday" },
          { name: "Wednesday" },
          { name: "Thursday" },
          { name: "Friday" },
          { name: "Saturday" },
          { name: "Sunday" },
        ],
      },
    },
    {
      name: "recurrence_interval",
      type: "number",
      options: { precision: 0 },
    },
    {
      name: "recurrence_end_date",
      type: "date",
      options: { ...dateOptionsIso },
    },
    {
      name: "reminder_minutes_before",
      type: "number",
      options: { precision: 0 },
    },
    {
      name: "completed_at",
      type: "dateTime",
      options: { ...datetimeOptionsGmtPlus3 },
    },
    { name: "completed_notes", type: "multilineText" },
    {
      name: "created_at",
      type: "dateTime",
      options: { ...datetimeOptionsGmtPlus3 },
    },
  ];
}

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();

  if (!token || !baseId) {
    logErr("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID (e.g. in .env at repo root).");
    process.exit(1);
  }

  try {
    log(`Using base id: ${baseId.slice(0, 6)}…`);
    const tables = await listTables(baseId, token);

    const existing = tables.find((t) => t.name === TABLE_NAME);
    if (existing) {
      log(`Table "${TABLE_NAME}" already exists (id: ${existing.id}). Nothing to do.`);
      log("Success (skipped).");
      return;
    }

    const usersTableId = findUsersTableId(tables);
    if (!usersTableId) {
      logErr(
        `No table named "users" (case-insensitive) found in this base. Found: ${tables.map((t) => t.name).join(", ") || "(none)"}`
      );
      process.exit(1);
    }
    log(`Linked fields will point to users table id: ${usersTableId}`);

    const fields = buildFieldsPayload(usersTableId);
    const body = {
      name: TABLE_NAME,
      description: "VA tasks (created by setup-va-tasks.ts)",
      fields,
    };

    log(`Creating table "${TABLE_NAME}" with ${fields.length} fields…`);
    const res = await metaFetch(token, `/${baseId}/tables`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logErr(`Create table failed (${res.status}): ${text}`);
      process.exit(1);
    }

    const created = (await res.json()) as { id?: string; name?: string };
    log(
      `Created table "${created.name ?? TABLE_NAME}" successfully (table id: ${created.id ?? "unknown"}).`
    );
    log(
      "Note: Airtable Meta API does not set a numeric default of 30 on create; in the UI, set field default for `reminder_minutes_before` to 30 if you want new rows prefilled."
    );
    log("Success.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logErr(msg);
    process.exit(1);
  }
}

main();
