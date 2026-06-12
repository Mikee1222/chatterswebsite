#!/usr/bin/env tsx
/**
 * Adds link_pages tracking/pixel fields and link_page_blocks.platform via Airtable Metadata API.
 * Idempotent: skips fields that already exist.
 *
 * Usage: npm run add:link-pages-fields
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createField, getBaseSchema, type AirtableTable } from "../lib/airtable-admin";
import type { FieldDef } from "../lib/airtable-schema";
import {
  LINK_PAGES_TABLE,
  LINK_PAGE_BLOCKS_TABLE,
  LINK_PAGE_ANALYTICS_TABLE,
  LINK_PAGE_BLOCK_STYLES,
  LINK_PAGE_BLOCK_STYLES_LEGACY,
} from "../lib/link-pages-schema";

loadEnv();
loadEnv({ path: ".env.local" });

const DATA_API = "https://api.airtable.com/v0";
const STYLE_FIELD_NAME = "style";

const CHECKBOX_DEF: FieldDef = {
  type: "checkbox",
  options: { icon: "check", color: "greenBright" },
};

const TEXT_DEF: FieldDef = { type: "singleLineText" };
const MULTILINE_DEF: FieldDef = { type: "multilineText" };

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

function findTable(schema: { tables: AirtableTable[] }, name: string): AirtableTable | null {
  return schema.tables.find((t) => t.name === name) ?? null;
}

type ChoiceRow = { id?: string; name: string; color?: string };

function preserveChoice(choice: ChoiceRow): ChoiceRow {
  const out: ChoiceRow = { name: choice.name };
  if (choice.id) out.id = choice.id;
  if (choice.color) out.color = choice.color;
  return out;
}

function choiceNamesSet(choices: ChoiceRow[]): Set<string> {
  return new Set(choices.map((c) => (c.name ?? "").trim().toLowerCase()).filter(Boolean));
}

async function patchSelectChoices(
  baseId: string,
  token: string,
  table: AirtableTable,
  fieldId: string,
  nextChoices: ChoiceRow[]
): Promise<boolean> {
  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${table.id}/fields/${fieldId}`;
  const res = await fetch(url, {
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
  if (res.ok) return true;
  if (res.status === 422) return false;
  const body = await res.text();
  throw new Error(`PATCH ${table.name}.${STYLE_FIELD_NAME} failed (${res.status}): ${body}`);
}

async function addStyleChoiceViaTypecast(
  token: string,
  baseId: string,
  choiceName: string
): Promise<void> {
  const probeSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createRes = await fetch(
    `${DATA_API}/${baseId}/${encodeURIComponent(LINK_PAGE_BLOCKS_TABLE)}`,
    {
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
              block_id: `schema-sync-probe-${probeSuffix}`,
              page_id: "schema-sync-probe",
              block_type: "link",
              sort_order: 0,
              is_visible: false,
              label: `Schema probe ${choiceName}`,
              [STYLE_FIELD_NAME]: choiceName,
            },
          },
        ],
      }),
    }
  );
  if (!createRes.ok) {
    throw new Error(
      `typecast create ${STYLE_FIELD_NAME}="${choiceName}" failed (${createRes.status}): ${await createRes.text()}`
    );
  }
  const created = (await createRes.json()) as { records?: Array<{ id: string }> };
  const probeId = created.records?.[0]?.id;
  if (!probeId) {
    throw new Error(`typecast create ${STYLE_FIELD_NAME}="${choiceName}" returned no record id`);
  }

  const deleteRes = await fetch(
    `${DATA_API}/${baseId}/${encodeURIComponent(LINK_PAGE_BLOCKS_TABLE)}/${probeId}`,
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

async function ensureSelectChoices(
  baseId: string,
  token: string,
  table: AirtableTable,
  fieldName: string,
  choiceNames: readonly string[]
): Promise<void> {
  const field = table.fields.find((f) => f.name === fieldName);
  if (!field?.id) {
    console.error(`Field ${table.name}.${fieldName} not found — cannot merge select choices.`);
    return;
  }
  if (field.type !== "singleSelect") {
    console.error(`Field ${table.name}.${fieldName} is not singleSelect (${field.type}).`);
    return;
  }

  const existingChoices = (field.options?.choices ?? []) as ChoiceRow[];
  const existingSet = choiceNamesSet(existingChoices);
  const missing = choiceNames.filter((name) => !existingSet.has(name.trim().toLowerCase()));
  if (missing.length === 0) {
    console.log(`Skip — ${table.name}.${fieldName} choices already include all requested options.`);
    return;
  }

  console.log(`Adding ${missing.length} missing ${table.name}.${fieldName} choice(s)...`);

  const nextChoices: ChoiceRow[] = [
    ...existingChoices.map(preserveChoice),
    ...missing.map((name) => ({ name })),
  ];

  const patched = await patchSelectChoices(baseId, token, table, field.id, nextChoices);
  if (patched) {
    console.log(`Added ${missing.length} choice(s) via Meta API PATCH: ${missing.join(", ")}`);
  } else {
    for (const choiceName of missing) {
      await addStyleChoiceViaTypecast(token, baseId, choiceName);
    }
  }

  const refreshed = await getBaseSchema(baseId, token);
  const refreshedTable = findTable(refreshed, table.name);
  const refreshedField = refreshedTable?.fields.find((f) => f.name === fieldName);
  const updatedSet = choiceNamesSet((refreshedField?.options?.choices ?? []) as ChoiceRow[]);
  const stillMissing = choiceNames.filter((name) => !updatedSet.has(name.trim().toLowerCase()));
  if (stillMissing.length > 0) {
    throw new Error(`After add, ${table.name}.${fieldName} still missing: ${stillMissing.join(", ")}`);
  }
  console.log(`Verified: all requested ${table.name}.${fieldName} choices present.`);
}

async function ensureField(
  baseId: string,
  token: string,
  table: AirtableTable,
  fieldName: string,
  def: FieldDef
): Promise<void> {
  const existing = table.fields.find((f) => f.name === fieldName);
  if (existing) {
    console.log(`Skip — ${table.name}.${fieldName} already exists (${existing.type}).`);
    return;
  }
  const result = await createField(baseId, token, table.id, fieldName, def, false);
  if (!result.created) {
    console.error(`Failed ${table.name}.${fieldName}: ${result.error ?? "unknown error"}`);
    process.exit(1);
  }
  console.log(`Created ${table.name}.${fieldName}.`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const schema = await getBaseSchema(baseId, token);

  const pagesTable = findTable(schema, LINK_PAGES_TABLE);
  if (!pagesTable) {
    console.error(`Table "${LINK_PAGES_TABLE}" not found. Run npm run setup:link-pages-tables first.`);
    process.exit(1);
  }

  const blocksTable = findTable(schema, LINK_PAGE_BLOCKS_TABLE);
  if (!blocksTable) {
    console.error(`Table "${LINK_PAGE_BLOCKS_TABLE}" not found. Run npm run setup:link-pages-tables first.`);
    process.exit(1);
  }

  await ensureField(baseId, token, pagesTable, "bio", MULTILINE_DEF);
  await ensureField(baseId, token, pagesTable, "show_powered_by", CHECKBOX_DEF);
  await ensureField(baseId, token, pagesTable, "verified", CHECKBOX_DEF);
  await ensureField(baseId, token, pagesTable, "meta_pixel_id", TEXT_DEF);
  await ensureField(baseId, token, pagesTable, "tiktok_pixel_id", TEXT_DEF);
  await ensureField(baseId, token, pagesTable, "cookie_notice_enabled", CHECKBOX_DEF);
  await ensureField(baseId, token, pagesTable, "cookie_notice_text", TEXT_DEF);
  await ensureField(baseId, token, pagesTable, "bio_color", TEXT_DEF);
  await ensureField(baseId, token, pagesTable, "name_color", TEXT_DEF);
  await ensureField(baseId, token, blocksTable, "platform", TEXT_DEF);
  await ensureField(baseId, token, blocksTable, "custom_button_color", TEXT_DEF);

  const styleChoices = [...LINK_PAGE_BLOCK_STYLES, ...LINK_PAGE_BLOCK_STYLES_LEGACY];
  await ensureSelectChoices(baseId, token, blocksTable, "style", styleChoices);

  const analyticsTable = findTable(schema, LINK_PAGE_ANALYTICS_TABLE);
  if (!analyticsTable) {
    console.error(`Table "${LINK_PAGE_ANALYTICS_TABLE}" not found. Run npm run setup:link-pages-tables first.`);
    process.exit(1);
  }

  await ensureField(baseId, token, analyticsTable, "visitor_id", TEXT_DEF);
  await ensureField(baseId, token, analyticsTable, "is_new_visitor", CHECKBOX_DEF);
  await ensureField(baseId, token, analyticsTable, "is_new_session", CHECKBOX_DEF);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
