#!/usr/bin/env npx tsx
/**
 * Add `start_time` and `end_time` (dateTime, Europe/Athens) to Airtable `va_task_phases`.
 *
 * Usage:
 *   npx tsx scripts/add-phase-time-fields.ts
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (schema.bases:read + schema.bases:write)
 */

import "dotenv/config";

const datetimeAthens = {
  dateFormat: { name: "iso" as const },
  timeFormat: { name: "24hour" as const },
  timeZone: "Europe/Athens",
};

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
  const table = tables?.find((t) => t.name === "va_task_phases");
  if (!table) {
    console.error("va_task_phases not found");
    return;
  }

  const fieldNames = new Set((table.fields ?? []).map((f) => f.name));
  const fieldsUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${table.id}/fields`;

  for (const name of ["start_time", "end_time"] as const) {
    if (fieldNames.has(name)) {
      console.log(`${name}: already exists, skip`);
      continue;
    }
    const r = await fetch(fieldsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, type: "dateTime", options: datetimeAthens }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`${name}:`, r.status, body);
      continue;
    }
    console.log(`${name}:`, (body as { name?: string }).name ?? JSON.stringify(body));
  }
}

run().catch(console.error);
