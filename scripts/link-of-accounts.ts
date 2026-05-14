#!/usr/bin/env tsx
/**
 * Sets `of_user_id` on modelss rows where model_name matches known creators (case-insensitive).
 *
 * Rules:
 *   - model_name contains "frost" → of_user_id = 399109015
 *   - model_name contains "lydia" → of_user_id = 449136713
 * If both match (unlikely), Frost wins (checked first).
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (or wrangler.jsonc)
 *
 * Usage: npx tsx scripts/link-of-accounts.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

const TABLE_NAME = "modelss";
const DATA_BASE = "https://api.airtable.com/v0";

const MAPPINGS: { needle: string; of_user_id: string; label: string }[] = [
  { needle: "frost", of_user_id: "399109015", label: "Frost" },
  { needle: "lydia", of_user_id: "449136713", label: "Lydia" },
];

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
    console.error("Missing AIRTABLE_TOKEN.");
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

type ModelssFields = {
  model_name?: string;
  of_user_id?: string;
};

type DataRecord = { id: string; fields: ModelssFields };

async function listAllModelss(baseId: string, token: string): Promise<DataRecord[]> {
  const out: DataRecord[] = [];
  let offset: string | undefined;
  const tableEnc = encodeURIComponent(TABLE_NAME);
  for (;;) {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const url = `${DATA_BASE}/${baseId}/${tableEnc}?${qs}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`list ${TABLE_NAME} failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { records?: DataRecord[]; offset?: string };
    out.push(...(data.records ?? []));
    if (!data.offset) break;
    offset = data.offset;
  }
  return out;
}

function resolveOfUserId(modelName: string): string | null {
  const lower = modelName.toLowerCase();
  for (const m of MAPPINGS) {
    if (lower.includes(m.needle)) return m.of_user_id;
  }
  return null;
}

async function patchRecord(
  baseId: string,
  token: string,
  recordId: string,
  fields: Record<string, string>
): Promise<void> {
  const url = `${DATA_BASE}/${baseId}/${encodeURIComponent(TABLE_NAME)}/${recordId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`PATCH ${recordId} (${res.status}): ${await res.text()}`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const rows = await listAllModelss(baseId, token);

  const updated: string[] = [];
  const skipped: string[] = [];

  for (const r of rows) {
    const name = String(r.fields.model_name ?? "").trim();
    const current = String(r.fields.of_user_id ?? "").trim();
    const target = name ? resolveOfUserId(name) : null;

    if (!target) {
      skipped.push(`${r.id}\t${name || "(empty name)"}\t(no Frost/Lydia match)`);
      continue;
    }
    if (current === target) {
      skipped.push(`${r.id}\t${name}\talready of_user_id=${target}`);
      continue;
    }

    await patchRecord(baseId, token, r.id, { of_user_id: target });
    const rule = MAPPINGS.find((m) => target === m.of_user_id)?.label ?? target;
    updated.push(`${r.id}\t${name}\t→ of_user_id=${target} (${rule})`);
  }

  console.log("--- Updated ---");
  if (updated.length === 0) console.log("(none)");
  else updated.forEach((line) => console.log(line));

  console.log("\n--- Skipped ---");
  if (skipped.length === 0) console.log("(none)");
  else skipped.forEach((line) => console.log(line));

  console.log(`\nSummary: ${updated.length} updated, ${skipped.length} skipped.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
