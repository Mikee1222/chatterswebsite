#!/usr/bin/env npx tsx
/**
 * Adds `_admin` notification event types to Airtable `notifications.event_type`
 * single-select (Metadata API). Idempotent if choices already exist.
 *
 * Requires: AIRTABLE_TOKEN with schema.bases:read + schema.bases:write, AIRTABLE_BASE_ID
 *
 * Usage: npx tsx scripts/add-admin-notification-event-types.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT } from "../lib/notification-admin-variants";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_API = "https://api.airtable.com/v0";
const TABLE_NAME = "notifications";
const FIELD_NAME = "event_type";

const CHOICES_TO_ADD = NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT.map((base) => `${base}_admin`);

type MetaChoice = { id?: string; name: string; color?: string };

type MetaField = {
  id: string;
  name: string;
  type: string;
  options?: { choices?: MetaChoice[] };
};

type MetaTable = { id: string; name: string; fields: MetaField[] };

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

function preserveChoice(choice: MetaChoice): MetaChoice {
  const out: MetaChoice = { name: choice.name };
  if (choice.id) out.id = choice.id;
  if (choice.color) out.color = choice.color;
  return out;
}

function choiceNamesSet(choices: MetaChoice[]): Set<string> {
  return new Set(choices.map((c) => c.name.trim().toLowerCase()).filter(Boolean));
}

async function fetchTables(token: string, baseId: string): Promise<MetaTable[]> {
  const res = await fetch(`${META_BASE}/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET meta tables failed (${res.status}): ${await res.text()}`);
  }
  const payload = (await res.json()) as { tables?: MetaTable[] };
  return payload.tables ?? [];
}

function resolveEventTypeField(tables: MetaTable[]): { table: MetaTable; field: MetaField } {
  const table = tables.find((t) => t.name.toLowerCase() === TABLE_NAME);
  if (!table) {
    throw new Error(`Table "${TABLE_NAME}" not found in Airtable base`);
  }
  const field = table.fields.find(
    (f) => f.name.toLowerCase() === FIELD_NAME && f.type === "singleSelect"
  );
  if (!field) {
    throw new Error(`Field "${FIELD_NAME}" (singleSelect) not found on "${TABLE_NAME}" table`);
  }
  return { table, field };
}

async function patchEventTypeChoices(
  token: string,
  baseId: string,
  tableId: string,
  fieldId: string,
  nextChoices: MetaChoice[]
): Promise<boolean> {
  const patch = await fetch(`${META_BASE}/${baseId}/tables/${tableId}/fields/${fieldId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "singleSelect",
      options: { choices: nextChoices },
    }),
  });
  if (patch.ok) return true;
  const body = await patch.text();
  if (patch.status === 422) return false;
  throw new Error(`PATCH notifications event_type failed (${patch.status}): ${body}`);
}

async function addChoiceViaTypecast(
  token: string,
  baseId: string,
  choiceName: string
): Promise<void> {
  const createRes = await fetch(`${DATA_API}/${baseId}/${encodeURIComponent(TABLE_NAME)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      typecast: true,
      records: [
        {
          fields: {
            [FIELD_NAME]: choiceName,
            user_id: "schema-sync-probe",
            category: "system",
            priority: "low",
            title: `Schema probe ${choiceName}`,
            body: `typecast probe for event_type=${choiceName}`,
            entity_type: "system",
            entity_id: "schema-sync-probe",
          },
        },
      ],
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `typecast create event_type="${choiceName}" failed (${createRes.status}): ${await createRes.text()}`
    );
  }
  const created = (await createRes.json()) as { records?: Array<{ id: string }> };
  const probeId = created.records?.[0]?.id;
  if (!probeId) {
    throw new Error(`typecast create event_type="${choiceName}" returned no record id`);
  }

  const deleteRes = await fetch(
    `${DATA_API}/${baseId}/${encodeURIComponent(TABLE_NAME)}/${probeId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!deleteRes.ok) {
    throw new Error(
      `Failed to delete typecast probe record ${probeId} (${deleteRes.status}): ${await deleteRes.text()}`
    );
  }
  console.log(`Added "${choiceName}" via typecast probe (Meta API PATCH not supported on this base).`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const tables = await fetchTables(token, baseId);
  const { table, field } = resolveEventTypeField(tables);

  const rawChoices = field.options?.choices ?? [];
  console.log(
    `Resolved ${TABLE_NAME}.${FIELD_NAME} — table id: ${table.id}, field id: ${field.id} (${rawChoices.length} existing choice(s)).`
  );
  console.log(`Admin variants to ensure: ${CHOICES_TO_ADD.length}`);

  const existingSet = choiceNamesSet(rawChoices);
  const missing = CHOICES_TO_ADD.filter((name) => !existingSet.has(name.toLowerCase()));

  if (missing.length === 0) {
    console.log(`All ${CHOICES_TO_ADD.length} _admin event types already exist. Skipping.`);
    console.log("Success.");
    return;
  }

  console.log(`Adding ${missing.length} missing choice(s)...`);

  const nextChoices: MetaChoice[] = [
    ...rawChoices.map(preserveChoice),
    ...missing.map((name) => ({ name, color: "grayLight2" as const })),
  ];

  const patched = await patchEventTypeChoices(token, baseId, table.id, field.id, nextChoices);

  if (patched) {
    console.log(`Added ${missing.length} _admin event type(s) via Meta API PATCH.`);
  } else {
    for (const choiceName of missing) {
      await addChoiceViaTypecast(token, baseId, choiceName);
    }
  }

  const refreshed = await fetchTables(token, baseId);
  const { field: updatedField } = resolveEventTypeField(refreshed);
  const updatedSet = choiceNamesSet(updatedField.options?.choices ?? []);
  const stillMissing = CHOICES_TO_ADD.filter((name) => !updatedSet.has(name.toLowerCase()));
  if (stillMissing.length > 0) {
    throw new Error(`After add, still missing: ${stillMissing.join(", ")}`);
  }
  console.log(`Verified: all ${CHOICES_TO_ADD.length} _admin event types present.`);
  console.log("Success.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
