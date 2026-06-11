#!/usr/bin/env npx tsx
/**
 * Adds VA task-shift activity log action types to Airtable `activity_logs.action_type`
 * single-select (Metadata API). Idempotent if choices already exist.
 *
 * Code paths audited (app/actions/shifts.ts, app/api/va/task-shift/*):
 *   - startTaskShift / startVaTaskShiftAction → action_type: "task_shift_started"
 *   - endTaskShift / endVaTaskShiftAction     → action_type: "task_shift_ended"
 *
 * Requires: AIRTABLE_TOKEN with schema.bases:read + schema.bases:write, AIRTABLE_BASE_ID
 * (or AIRTABLE_BASE_ID in wrangler.jsonc).
 *
 * Usage: npx tsx scripts/add-task-shift-log-types.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_API = "https://api.airtable.com/v0";
const TABLE_NAME = "activity_logs";
/** Airtable column is `action_type`; some docs refer to it as event_type. */
const FIELD_CANDIDATES = ["action_type", "event_type"] as const;

/** All action_type values written by VA task-shift flows in the codebase. */
const CHOICES_TO_ADD = ["task_shift_started", "task_shift_ended"] as const;

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

function resolveActivityLogActionTypeField(tables: MetaTable[]): {
  table: MetaTable;
  field: MetaField;
  fieldName: string;
} {
  const table = tables.find((t) => t.name.toLowerCase() === TABLE_NAME);
  if (!table) {
    throw new Error(`Table "${TABLE_NAME}" not found in Airtable base`);
  }

  for (const candidate of FIELD_CANDIDATES) {
    const field = table.fields.find(
      (f) => f.name.toLowerCase() === candidate && f.type === "singleSelect",
    );
    if (field) {
      return { table, field, fieldName: field.name };
    }
  }

  throw new Error(
    `Field "${FIELD_CANDIDATES.join('" or "')}" (singleSelect) not found on "${TABLE_NAME}" table`,
  );
}

/** Meta API PATCH for singleSelect choices. Returns false on 422 (use typecast fallback). */
async function patchActionTypeChoices(
  token: string,
  baseId: string,
  tableId: string,
  fieldId: string,
  nextChoices: MetaChoice[],
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
  throw new Error(`PATCH activity_logs action_type failed (${patch.status}): ${body}`);
}

/** Add one select option via typecast create + delete (when Meta API choice PATCH is rejected). */
async function addChoiceViaTypecast(
  token: string,
  baseId: string,
  fieldName: string,
  choiceName: string,
): Promise<void> {
  const now = new Date().toISOString();
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
            [fieldName]: choiceName,
            actor_user_id: "schema-sync-probe",
            actor_name: "Schema sync probe",
            entity_type: "system",
            summary: `typecast probe for ${fieldName}=${choiceName}`,
            created_at: now,
          },
        },
      ],
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `typecast create ${fieldName}="${choiceName}" failed (${createRes.status}): ${await createRes.text()}`,
    );
  }
  const created = (await createRes.json()) as { records?: Array<{ id: string }> };
  const probeId = created.records?.[0]?.id;
  if (!probeId) {
    throw new Error(`typecast create ${fieldName}="${choiceName}" returned no record id`);
  }

  const deleteRes = await fetch(
    `${DATA_API}/${baseId}/${encodeURIComponent(TABLE_NAME)}/${probeId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!deleteRes.ok) {
    throw new Error(
      `Failed to delete typecast probe record ${probeId} (${deleteRes.status}): ${await deleteRes.text()}`,
    );
  }
  console.log(
    `Added "${choiceName}" via typecast probe (Meta API PATCH not supported on this base).`,
  );
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const tables = await fetchTables(token, baseId);
  const { table, field, fieldName } = resolveActivityLogActionTypeField(tables);

  const rawChoices = field.options?.choices ?? [];
  const existingNames = rawChoices.map((c) => c.name);
  console.log(
    `Resolved ${TABLE_NAME}.${fieldName} — table id: ${table.id}, field id: ${field.id} (${rawChoices.length} existing choice(s): ${existingNames.join(", ") || "(none)"}).`,
  );

  const existingSet = choiceNamesSet(rawChoices);
  const missing = CHOICES_TO_ADD.filter((name) => !existingSet.has(name.toLowerCase()));

  if (missing.length === 0) {
    console.log(
      `All task-shift log types already exist on ${TABLE_NAME}.${fieldName}: ${CHOICES_TO_ADD.join(", ")}. Skipping.`,
    );
    console.log("Success.");
    return;
  }

  console.log(`Adding missing choice(s): ${missing.join(", ")}`);

  const nextChoices: MetaChoice[] = [
    ...rawChoices.map(preserveChoice),
    ...missing.map((name) => ({ name, color: "grayLight2" as const })),
  ];

  const patched = await patchActionTypeChoices(
    token,
    baseId,
    table.id,
    field.id,
    nextChoices,
  );

  if (patched) {
    console.log(`Added ${missing.join(", ")} to ${TABLE_NAME}.${fieldName} via Meta API PATCH.`);
  } else {
    for (const choiceName of missing) {
      await addChoiceViaTypecast(token, baseId, fieldName, choiceName);
    }
  }

  const refreshed = await fetchTables(token, baseId);
  const { field: updatedField } = resolveActivityLogActionTypeField(refreshed);
  const updatedSet = choiceNamesSet(updatedField.options?.choices ?? []);
  const stillMissing = CHOICES_TO_ADD.filter((name) => !updatedSet.has(name.toLowerCase()));
  if (stillMissing.length > 0) {
    throw new Error(
      `After add, still missing on ${TABLE_NAME}.${fieldName}: ${stillMissing.join(", ")}`,
    );
  }
  console.log(`Verified: ${TABLE_NAME}.${fieldName} now includes ${CHOICES_TO_ADD.join(", ")}.`);
  console.log("Success.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
