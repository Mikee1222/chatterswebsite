#!/usr/bin/env npx tsx
/**
 * Adds `fine_bonus` to the Airtable `notifications` table `entity_type` single-select field
 * (Metadata API). Idempotent if the choice already exists.
 *
 * Requires: AIRTABLE_TOKEN with schema.bases:read + schema.bases:write, AIRTABLE_BASE_ID
 * (or AIRTABLE_BASE_ID in wrangler.jsonc).
 *
 * Usage: npx tsx scripts/add-fine-bonus-notification-option.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NOTIFICATIONS_TABLE } from "../lib/notifications-schema";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const CHOICE_NAME = "fine_bonus";

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

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const res = await fetch(`${META_BASE}/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`getBaseSchema failed: ${res.status}`, await res.text());
    process.exit(1);
  }
  const payload = (await res.json()) as { tables?: MetaTable[] };
  const tables = payload.tables ?? [];
  const table = tables.find((t) => t.name === NOTIFICATIONS_TABLE);
  if (!table) {
    console.error(`Table "${NOTIFICATIONS_TABLE}" not found in base.`);
    process.exit(1);
  }
  const field = table.fields.find((f) => f.name === "entity_type" && f.type === "singleSelect");
  if (!field) {
    console.error(`Field "entity_type" (singleSelect) not found on ${NOTIFICATIONS_TABLE}.`);
    process.exit(1);
  }
  const rawChoices = field.options?.choices ?? [];
  if (rawChoices.some((c) => c.name === CHOICE_NAME)) {
    console.log(`Choice "${CHOICE_NAME}" already exists on entity_type. Skipping.`);
    return;
  }
  const preserved: MetaChoice[] = rawChoices.map((c) => {
    const out: MetaChoice = { name: c.name };
    if (c.id) out.id = c.id;
    if (c.color) out.color = c.color;
    return out;
  });
  const nextChoices: MetaChoice[] = [...preserved, { name: CHOICE_NAME, color: "tealLight2" }];

  const patch = await fetch(`${META_BASE}/${baseId}/tables/${table.id}/fields/${field.id}`, {
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
  if (!patch.ok) {
    console.error(`PATCH field failed: ${patch.status}`, await patch.text());
    process.exit(1);
  }
  console.log(`Added "${CHOICE_NAME}" to ${NOTIFICATIONS_TABLE}.entity_type.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
