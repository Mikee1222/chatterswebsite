#!/usr/bin/env npx tsx
/**
 * Idempotently add `event_overrides` (long text JSON) to notification_preferences.
 * Usage: npx tsx scripts/add-notification-event-overrides-field.ts
 */
import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const TABLE_NAME = "notification_preferences";
const FIELD_NAME = "event_overrides";

type MetaField = { id: string; name: string; type: string };
type MetaTable = { id: string; name: string; fields?: MetaField[] };

function loadBaseIdFromWrangler(): string | null {
  const path = resolve(process.cwd(), "wrangler.jsonc");
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/"AIRTABLE_BASE_ID"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
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
    if (baseId) console.log("(Using AIRTABLE_BASE_ID from wrangler.jsonc)");
  }
  if (!baseId) {
    console.error("Missing AIRTABLE_BASE_ID.");
    process.exit(1);
  }
  return { token, baseId };
}

async function metaFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${META_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const res = await metaFetch(token, `/${encodeURIComponent(baseId)}/tables`, { method: "GET" });
  if (!res.ok) throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { tables?: MetaTable[] };
  const table = (data.tables ?? []).find((t) => t.name.trim().toLowerCase() === TABLE_NAME);
  if (!table?.id) {
    console.error(`Table "${TABLE_NAME}" not found.`);
    process.exit(1);
  }
  const existing = (table.fields ?? []).some((f) => f.name.trim().toLowerCase() === FIELD_NAME);
  if (existing) {
    console.log(`OK "${TABLE_NAME}.${FIELD_NAME}" already exists - skip.`);
    return;
  }
  const createRes = await metaFetch(
    token,
    `/${encodeURIComponent(baseId)}/tables/${encodeURIComponent(table.id)}/fields`,
    {
      method: "POST",
      body: JSON.stringify({ name: FIELD_NAME, type: "multilineText" }),
    }
  );
  if (!createRes.ok) {
    throw new Error(`Create field failed (${createRes.status}): ${await createRes.text()}`);
  }
  console.log(`OK Added "${TABLE_NAME}.${FIELD_NAME}" (multilineText).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
