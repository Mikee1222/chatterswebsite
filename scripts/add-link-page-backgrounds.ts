#!/usr/bin/env tsx
/**
 * Adds new background_type choices to link_pages.background_type single-select via Airtable Metadata API.
 * Falls back to typecast probe records when Meta API PATCH is rejected.
 * Idempotent: skips choices that already exist.
 *
 * Usage: npm run add:link-page-backgrounds
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LINK_PAGE_BACKGROUND_TYPES, LINK_PAGES_TABLE } from "../lib/link-pages-schema";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_API = "https://api.airtable.com/v0";
const FIELD_NAME = "background_type";

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

function resolveBackgroundTypeField(tables: MetaTable[]): { table: MetaTable; field: MetaField } {
  const table = tables.find((t) => t.name === LINK_PAGES_TABLE);
  if (!table) {
    throw new Error(`Table "${LINK_PAGES_TABLE}" not found. Run npm run setup:link-pages-tables first.`);
  }
  const field = table.fields.find((f) => f.name === FIELD_NAME && f.type === "singleSelect");
  if (!field) {
    throw new Error(`Field "${FIELD_NAME}" (singleSelect) not found on "${LINK_PAGES_TABLE}" table`);
  }
  return { table, field };
}

async function patchBackgroundTypeChoices(
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
  throw new Error(`PATCH ${LINK_PAGES_TABLE}.${FIELD_NAME} failed (${patch.status}): ${body}`);
}

async function addChoiceViaTypecast(token: string, baseId: string, choiceName: string): Promise<void> {
  const now = new Date().toISOString();
  const probeId = `schema_probe_${Date.now()}`;
  const createRes = await fetch(`${DATA_API}/${baseId}/${encodeURIComponent(LINK_PAGES_TABLE)}`, {
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
            page_id: probeId,
            slug: `schema-probe-${choiceName}-${Date.now()}`,
            title: `Schema probe ${choiceName}`,
            status: "draft",
            background_type: choiceName,
            created_at: now,
            updated_at: now,
          },
        },
      ],
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `typecast create background_type="${choiceName}" failed (${createRes.status}): ${await createRes.text()}`
    );
  }
  const created = (await createRes.json()) as { records?: Array<{ id: string }> };
  const recordId = created.records?.[0]?.id;
  if (!recordId) {
    throw new Error(`typecast create background_type="${choiceName}" returned no record id`);
  }

  const deleteRes = await fetch(
    `${DATA_API}/${baseId}/${encodeURIComponent(LINK_PAGES_TABLE)}/${recordId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!deleteRes.ok) {
    throw new Error(
      `Failed to delete typecast probe record ${recordId} (${deleteRes.status}): ${await deleteRes.text()}`
    );
  }
  console.log(`Added "${choiceName}" via typecast probe.`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const tables = await fetchTables(token, baseId);
  const { table, field } = resolveBackgroundTypeField(tables);

  const existing = field.options?.choices ?? [];
  const existingSet = choiceNamesSet(existing);
  const toAdd = LINK_PAGE_BACKGROUND_TYPES.filter((f) => !existingSet.has(f.toLowerCase()));

  if (toAdd.length === 0) {
    console.log(
      `All ${LINK_PAGE_BACKGROUND_TYPES.length} background_type choices already exist on ${LINK_PAGES_TABLE}.${FIELD_NAME}.`
    );
    return;
  }

  console.log(`Adding ${toAdd.length} background_type choice(s)...`);

  const nextChoices = [...existing.map(preserveChoice), ...toAdd.map((name) => ({ name }))];

  const patched = await patchBackgroundTypeChoices(token, baseId, table.id, field.id, nextChoices);
  if (patched) {
    console.log(`Added ${toAdd.length} background_type choice(s) via Meta API PATCH: ${toAdd.join(", ")}`);
  } else {
    console.log("Meta API PATCH not supported — using typecast probes.");
    for (const choiceName of toAdd) {
      await addChoiceViaTypecast(token, baseId, choiceName);
    }
  }

  const refreshed = await fetchTables(token, baseId);
  const { field: updatedField } = resolveBackgroundTypeField(refreshed);
  const updatedSet = choiceNamesSet(updatedField.options?.choices ?? []);
  const stillMissing = LINK_PAGE_BACKGROUND_TYPES.filter((f) => !updatedSet.has(f.toLowerCase()));
  if (stillMissing.length > 0) {
    throw new Error(`background_type choices still missing after sync: ${stillMissing.join(", ")}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
