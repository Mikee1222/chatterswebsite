#!/usr/bin/env npx tsx
/**
 * One-time: create Airtable tables for Marketing + VA Phases (Meta API).
 *
 * Usage (from repo root):
 *   npx tsx scripts/create-marketing-tables.ts
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (schema.bases:read + schema.bases:write)
 */

import "dotenv/config";

type MetaTable = { id: string; name: string };

const datetimeAthens = {
  dateFormat: { name: "iso" as const },
  timeFormat: { name: "24hour" as const },
  timeZone: "Europe/Athens",
};

const checkboxOpts = { icon: "check" as const, color: "greenBright" as const };

async function metaFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");
  return fetch(`https://api.airtable.com/v0/meta/bases/${baseId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function listTables(): Promise<MetaTable[]> {
  const res = await metaFetch("/tables");
  if (!res.ok) throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

async function createTableIfMissing(
  tables: MetaTable[],
  name: string,
  fields: Array<Record<string, unknown>>,
  description?: string
): Promise<void> {
  if (tables.some((t) => t.name === name)) {
    console.log(`[create-marketing-tables] Skip — table already exists: ${name}`);
    return;
  }

  const body: Record<string, unknown> = { name, fields };
  if (description) body.description = description;

  const res = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    console.error(`[create-marketing-tables] Failed ${name}:`, JSON.stringify(data, null, 2));
    throw new Error(`Create table ${name} failed (${res.status})`);
  }
  console.log(`[create-marketing-tables] Created: ${(data as { name?: string }).name ?? name}`);
}

async function main(): Promise<void> {
  let tables = await listTables();

  await createTableIfMissing(
    tables,
    "marketing_platforms",
    [
      { name: "platform_id", type: "singleLineText" },
      { name: "name", type: "singleLineText" },
      { name: "icon", type: "singleLineText" },
      { name: "color", type: "singleLineText" },
      { name: "active", type: "checkbox", options: checkboxOpts },
      { name: "sort_order", type: "number", options: { precision: 0 } },
      { name: "created_at", type: "dateTime", options: datetimeAthens },
    ],
    "Marketing platforms directory (seed with scripts/seed-marketing-platforms.ts)"
  );
  tables = await listTables();

  await createTableIfMissing(
    tables,
    "model_social_accounts",
    [
      { name: "account_id", type: "singleLineText" },
      { name: "model_id", type: "singleLineText" },
      { name: "model_name", type: "singleLineText" },
      {
        name: "platform",
        type: "singleSelect",
        options: {
          choices: [
            { name: "Instagram", color: "pinkLight2" },
            { name: "Facebook", color: "blueLight2" },
            { name: "TikTok", color: "purpleLight2" },
            { name: "Twitter", color: "cyanLight2" },
            { name: "YouTube", color: "redLight2" },
            { name: "Snapchat", color: "yellowLight2" },
            { name: "Other", color: "grayLight2" },
          ],
        },
      },
      { name: "account_link", type: "url" },
      { name: "username", type: "singleLineText" },
      {
        name: "account_type",
        type: "singleSelect",
        options: {
          choices: [
            { name: "main", color: "greenLight2" },
            { name: "secondary", color: "yellowLight2" },
          ],
        },
      },
      {
        name: "region",
        type: "singleSelect",
        options: {
          choices: [
            { name: "USA", color: "blueLight2" },
            { name: "Greek", color: "cyanLight2" },
            { name: "Global", color: "greenLight2" },
          ],
        },
      },
      { name: "assigned_va_id", type: "singleLineText" },
      { name: "assigned_va_name", type: "singleLineText" },
      { name: "notes", type: "multilineText" },
      { name: "active", type: "checkbox", options: checkboxOpts },
      { name: "last_updated", type: "dateTime", options: datetimeAthens },
      { name: "created_at", type: "dateTime", options: datetimeAthens },
    ],
    "Per-model social accounts"
  );
  tables = await listTables();

  await createTableIfMissing(
    tables,
    "model_funnel_links",
    [
      { name: "funnel_id", type: "singleLineText" },
      { name: "model_id", type: "singleLineText" },
      { name: "model_name", type: "singleLineText" },
      { name: "label", type: "singleLineText" },
      { name: "url", type: "url" },
      {
        name: "platform",
        type: "singleSelect",
        options: {
          choices: [
            { name: "OnlyFans", color: "blueLight2" },
            { name: "Fanvue", color: "purpleLight2" },
            { name: "Linktree", color: "greenLight2" },
            { name: "Bio Link", color: "yellowLight2" },
            { name: "Other", color: "grayLight2" },
          ],
        },
      },
      {
        name: "region",
        type: "singleSelect",
        options: {
          choices: [
            { name: "USA", color: "blueLight2" },
            { name: "Greek", color: "cyanLight2" },
            { name: "Global", color: "greenLight2" },
          ],
        },
      },
      { name: "active", type: "checkbox", options: checkboxOpts },
      { name: "created_at", type: "dateTime", options: datetimeAthens },
    ],
    "Funnel / bio links per model"
  );
  tables = await listTables();

  await createTableIfMissing(
    tables,
    "va_task_phases",
    [
      { name: "phase_id", type: "singleLineText" },
      { name: "task_id", type: "singleLineText" },
      { name: "task_title", type: "singleLineText" },
      { name: "phase_number", type: "number", options: { precision: 0 } },
      { name: "title", type: "singleLineText" },
      { name: "description", type: "multilineText" },
      { name: "scheduled_time", type: "dateTime", options: datetimeAthens },
      {
        name: "status",
        type: "singleSelect",
        options: {
          choices: [
            { name: "pending", color: "yellowLight2" },
            { name: "in_progress", color: "blueLight2" },
            { name: "completed", color: "greenLight2" },
            { name: "overdue", color: "redLight2" },
          ],
        },
      },
      { name: "assigned_va_id", type: "singleLineText" },
      { name: "assigned_va_name", type: "singleLineText" },
      { name: "assigned_model_id", type: "singleLineText" },
      { name: "assigned_model_name", type: "singleLineText" },
      {
        name: "region",
        type: "singleSelect",
        options: {
          choices: [
            { name: "USA", color: "blueLight2" },
            { name: "Greek", color: "cyanLight2" },
            { name: "Global", color: "greenLight2" },
          ],
        },
      },
      { name: "completed_at", type: "dateTime", options: datetimeAthens },
      { name: "created_at", type: "dateTime", options: datetimeAthens },
    ],
    "Phases belonging to a parent VA task"
  );
  tables = await listTables();

  await createTableIfMissing(
    tables,
    "va_task_phase_items",
    [
      { name: "item_id", type: "singleLineText" },
      { name: "phase_id", type: "singleLineText" },
      { name: "task_id", type: "singleLineText" },
      { name: "title", type: "singleLineText" },
      { name: "description", type: "multilineText" },
      { name: "requires_screenshot", type: "checkbox", options: checkboxOpts },
      { name: "screenshot", type: "multipleAttachments" },
      {
        name: "status",
        type: "singleSelect",
        options: {
          choices: [
            { name: "pending", color: "yellowLight2" },
            { name: "completed", color: "greenLight2" },
          ],
        },
      },
      { name: "completed_by_va_id", type: "singleLineText" },
      { name: "completed_by_va_name", type: "singleLineText" },
      { name: "completed_at", type: "dateTime", options: datetimeAthens },
      { name: "sort_order", type: "number", options: { precision: 0 } },
      { name: "created_at", type: "dateTime", options: datetimeAthens },
    ],
    "Checklist items within a VA task phase"
  );

  console.log("[create-marketing-tables] Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
