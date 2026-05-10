#!/usr/bin/env npx tsx
/**
 * Patch Airtable `notifications`: add event_type + entity_type single-select options
 * for Marketing + VA Phases (Meta API).
 *
 * Usage:
 *   npx tsx scripts/add-phase-notification-options.ts
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (schema.bases:read + schema.bases:write)
 */

import "dotenv/config";

type ChoiceRow = { id?: string; name: string; color?: string };

type MetaField = { id: string; name: string; type: string; options?: { choices?: ChoiceRow[] } };

type MetaTable = { id: string; name: string; fields: MetaField[] };

function mergeChoices(existing: ChoiceRow[], additions: ChoiceRow[]): ChoiceRow[] {
  const seen = new Set(existing.map((c) => (c.name ?? "").trim().toLowerCase()));
  const merged = existing.map((c) => ({ ...c }));
  for (const c of additions) {
    const key = (c.name ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ name: c.name, ...(c.color ? { color: c.color } : {}) });
  }
  return merged;
}

async function patchSingleSelectField(
  baseId: string,
  token: string,
  tableId: string,
  field: MetaField,
  additions: ChoiceRow[],
  label: string
): Promise<void> {
  if (field.type !== "singleSelect") {
    console.error(`[add-phase-notification-options] ${label}: field is not singleSelect (${field.type})`);
    return;
  }
  const existing = (field.options?.choices ?? []) as ChoiceRow[];
  const merged = mergeChoices(existing, additions);
  if (merged.length === existing.length) {
    console.log(`[add-phase-notification-options] ${label}: no new choices to add`);
    return;
  }

  const nextOptions = { ...(field.options ?? {}), choices: merged };

  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(baseId)}/tables/${encodeURIComponent(tableId)}/fields/${encodeURIComponent(field.id)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "singleSelect",
        options: nextOptions,
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[add-phase-notification-options] ${label} PATCH failed`, res.status, JSON.stringify(data));
    console.warn(
      `[add-phase-notification-options] Add these ${label} options manually in Airtable → notifications → ${label} (single select):`
    );
    for (const a of additions) {
      if (!existing.some((e) => (e.name ?? "").trim().toLowerCase() === (a.name ?? "").trim().toLowerCase())) {
        console.warn(`  • ${a.name}`);
      }
    }
    console.warn(
      "(Some bases or PAT scopes reject Meta API updates to single-select `options`; description-only PATCH may still work.)"
    );
    return;
  }
  const added = merged.length - existing.length;
  console.log(`[add-phase-notification-options] ${label} updated (+${added} choice(s))`);
}

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) {
    console.error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID");
    process.exit(1);
  }

  const tablesRes = await fetch(`https://api.airtable.com/v0/meta/bases/${encodeURIComponent(baseId)}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!tablesRes.ok) {
    console.error("GET tables failed", tablesRes.status, await tablesRes.text());
    process.exit(1);
  }
  const { tables } = (await tablesRes.json()) as { tables?: MetaTable[] };
  const notifTable = (tables ?? []).find((t) => t.name === "notifications");
  if (!notifTable) {
    console.error('Table "notifications" not found');
    process.exit(1);
  }

  const eventTypeField = notifTable.fields.find((f) => f.name === "event_type");
  if (eventTypeField) {
    await patchSingleSelectField(baseId, token, notifTable.id, eventTypeField, [
      { name: "phase_task_completed", color: "greenLight2" },
      { name: "phase_completed", color: "tealLight2" },
      { name: "phase_overdue", color: "redLight2" },
      { name: "all_phases_completed", color: "greenLight2" },
    ], "event_type");
  } else {
    console.error("event_type field not found on notifications");
  }

  const entityTypeField = notifTable.fields.find((f) => f.name === "entity_type");
  if (entityTypeField) {
    if (entityTypeField.type === "singleSelect") {
      await patchSingleSelectField(baseId, token, notifTable.id, entityTypeField, [
        { name: "va_task_phase", color: "blueLight2" },
        { name: "va_task_phase_item", color: "purpleLight2" },
        { name: "social_account", color: "pinkLight2" },
      ], "entity_type");
    } else {
      console.warn(
        `[add-phase-notification-options] entity_type is "${entityTypeField.type}" (not singleSelect). ` +
          "Store values va_task_phase, va_task_phase_item, social_account as plain text, or convert the field to single select in Airtable and re-run this script."
      );
    }
  } else {
    console.error("entity_type field not found on notifications");
  }

  console.log("[add-phase-notification-options] Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
