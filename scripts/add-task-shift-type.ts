#!/usr/bin/env npx tsx
/**
 * Adds `task` to the Airtable `shifts` table `shift_type` single-select field (Metadata API).
 * Idempotent if the choice already exists.
 *
 * Requires: AIRTABLE_TOKEN with schema.bases:read + schema.bases:write, AIRTABLE_BASE_ID
 * (or AIRTABLE_BASE_ID in wrangler.jsonc).
 *
 * Usage: npx tsx scripts/add-task-shift-type.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_API = "https://api.airtable.com/v0";
const SHIFTS_TABLE = "shifts";
const FIELD_NAME = "shift_type";
const CHOICE_NAME = "task";

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

function resolveShiftTypeField(tables: MetaTable[]): {
  table: MetaTable;
  field: MetaField;
} {
  const table = tables.find((t) => t.name.toLowerCase() === SHIFTS_TABLE);
  if (!table) {
    throw new Error(`Table "${SHIFTS_TABLE}" not found in Airtable base`);
  }
  const field = table.fields.find(
    (f) => f.name.toLowerCase() === FIELD_NAME && f.type === "singleSelect",
  );
  if (!field) {
    throw new Error(
      `Field "${FIELD_NAME}" (singleSelect) not found on "${SHIFTS_TABLE}" table`,
    );
  }
  return { table, field };
}

/** Meta API PATCH for singleSelect choices. Returns false on 422 (use typecast fallback). */
async function patchShiftTypeChoices(
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
  throw new Error(`PATCH shifts.shift_type failed (${patch.status}): ${body}`);
}

/** Add one select option via typecast create + delete (when Meta API choice PATCH is rejected). */
async function addChoiceViaTypecast(token: string, baseId: string): Promise<void> {
  const now = new Date().toISOString();
  const createRes = await fetch(`${DATA_API}/${baseId}/${encodeURIComponent(SHIFTS_TABLE)}`, {
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
            shift_type: CHOICE_NAME,
            status: "active",
            start_time: now,
            staff_role: "virtual_assistant",
          },
        },
      ],
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `typecast create shift_type="${CHOICE_NAME}" failed (${createRes.status}): ${await createRes.text()}`,
    );
  }
  const created = (await createRes.json()) as { records?: Array<{ id: string }> };
  const probeId = created.records?.[0]?.id;
  if (!probeId) {
    throw new Error(`typecast create shift_type="${CHOICE_NAME}" returned no record id`);
  }

  const deleteRes = await fetch(
    `${DATA_API}/${baseId}/${encodeURIComponent(SHIFTS_TABLE)}/${probeId}`,
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
    `Added "${CHOICE_NAME}" via typecast probe (Meta API PATCH not supported on this base).`,
  );
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const tables = await fetchTables(token, baseId);
  const { table, field } = resolveShiftTypeField(tables);

  const rawChoices = field.options?.choices ?? [];
  const existingNames = rawChoices.map((c) => c.name);
  console.log(
    `Resolved shifts.shift_type — table id: ${table.id}, field id: ${field.id} (${rawChoices.length} existing choice(s): ${existingNames.join(", ") || "(none)"}).`,
  );

  const alreadyExists = rawChoices.some(
    (c) => c.name.trim().toLowerCase() === CHOICE_NAME.toLowerCase(),
  );
  if (alreadyExists) {
    console.log(`Choice "${CHOICE_NAME}" already exists on shifts.shift_type. Skipping.`);
    console.log("Success.");
    return;
  }

  const nextChoices: MetaChoice[] = [
    ...rawChoices.map(preserveChoice),
    { name: CHOICE_NAME, color: "grayLight2" },
  ];

  const patched = await patchShiftTypeChoices(
    token,
    baseId,
    table.id,
    field.id,
    nextChoices,
  );
  if (patched) {
    console.log(`Added "${CHOICE_NAME}" to shifts.shift_type via Meta API PATCH.`);
  } else {
    await addChoiceViaTypecast(token, baseId);
  }

  const refreshed = await fetchTables(token, baseId);
  const { field: updatedField } = resolveShiftTypeField(refreshed);
  const updatedNames = (updatedField.options?.choices ?? []).map((c) => c.name);
  if (!updatedNames.some((n) => n.trim().toLowerCase() === CHOICE_NAME.toLowerCase())) {
    throw new Error(`"${CHOICE_NAME}" not found in refreshed choices after add`);
  }
  console.log(`Verified: shifts.shift_type now includes "${CHOICE_NAME}".`);
  console.log("Success.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
