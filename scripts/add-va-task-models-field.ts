#!/usr/bin/env npx tsx
/**
 * Add `assigned_model_ids` and `assigned_model_names` (singleLineText, comma-separated in app) to Airtable `va_tasks`.
 *
 * Usage:
 *   npx tsx scripts/add-va-task-models-field.ts
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (schema.bases:read + schema.bases:write)
 */

import "dotenv/config";

async function run() {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) {
    console.error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const tablesRes = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers });
  if (!tablesRes.ok) {
    console.error("tables:", tablesRes.status, await tablesRes.text());
    return;
  }
  const { tables } = (await tablesRes.json()) as { tables?: { id: string; name: string; fields?: { name: string }[] }[] };
  const table = tables?.find((t) => t.name === "va_tasks");
  if (!table) {
    console.error("va_tasks not found");
    return;
  }

  const fieldNames = new Set((table.fields ?? []).map((f) => f.name));
  const fieldsUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${table.id}/fields`;

  for (const name of ["assigned_model_ids", "assigned_model_names"] as const) {
    if (fieldNames.has(name)) {
      console.log(`${name}: already exists, skip`);
      continue;
    }
    const r = await fetch(fieldsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, type: "singleLineText" }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`${name}:`, r.status, body);
      continue;
    }
    console.log(`${name}:`, (body as { name?: string; error?: string }).name ?? (body as { error?: string }).error ?? JSON.stringify(body));
  }
}

run().catch(console.error);
