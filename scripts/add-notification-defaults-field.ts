#!/usr/bin/env npx tsx
/**
 * Idempotently add `notification_defaults` (long text JSON) to the roles table
 * and backfill system roles with built-in defaults.
 *
 * Usage: npx tsx scripts/add-notification-defaults-field.ts
 *
 * Requires: AIRTABLE_TOKEN (schema + data), AIRTABLE_BASE_ID
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_NOTIFICATION_DEFAULTS,
  NOTIFICATION_ROLE_DEFAULT_KEYS,
} from "../lib/notification-role-defaults";
import type { UserRole } from "../types";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_BASE = "https://api.airtable.com/v0";
const TABLE_NAME = "roles";
const FIELD_NAME = "notification_defaults";

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

async function dataFetch(
  token: string,
  baseId: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${DATA_BASE}/${baseId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function listTables(baseId: string, token: string): Promise<MetaTable[]> {
  const res = await metaFetch(token, `/${encodeURIComponent(baseId)}/tables`, { method: "GET" });
  if (!res.ok) throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function allTrueDefaultsJson(): string {
  const obj = Object.fromEntries(NOTIFICATION_ROLE_DEFAULT_KEYS.map((key) => [key, true]));
  return JSON.stringify(obj);
}

async function ensureField(baseId: string, token: string, tableId: string): Promise<void> {
  const res = await metaFetch(
    token,
    `/${encodeURIComponent(baseId)}/tables/${encodeURIComponent(tableId)}/fields`,
    {
      method: "POST",
      body: JSON.stringify({
        name: FIELD_NAME,
        type: "multilineText",
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Create field "${FIELD_NAME}" failed (${res.status}): ${await res.text()}`);
  }
  console.log(`OK Added "${TABLE_NAME}.${FIELD_NAME}" (multilineText).`);
}

async function backfillSystemRoles(baseId: string, token: string): Promise<void> {
  const roles = Object.keys(DEFAULT_NOTIFICATION_DEFAULTS) as UserRole[];
  const now = new Date().toISOString();

  for (const roleId of roles) {
    const listRes = await dataFetch(
      token,
      baseId,
      `/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(`{role_id}="${roleId}"`)}&maxRecords=1`,
      { method: "GET" }
    );
    if (!listRes.ok) {
      throw new Error(`List role ${roleId} failed (${listRes.status}): ${await listRes.text()}`);
    }
    const listData = (await listRes.json()) as {
      records?: Array<{ id: string; fields?: Record<string, unknown> }>;
    };
    const row = listData.records?.[0];
    if (!row?.id) {
      console.log(`Skip "${roleId}" — no roles row found.`);
      continue;
    }
    const existing = row.fields?.[FIELD_NAME];
    if (typeof existing === "string" && existing.trim()) {
      console.log(`OK "${roleId}" already has ${FIELD_NAME} — skip.`);
      continue;
    }

    const patchRes = await dataFetch(
      token,
      baseId,
      `/${encodeURIComponent(TABLE_NAME)}/${row.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          fields: {
            [FIELD_NAME]: JSON.stringify(DEFAULT_NOTIFICATION_DEFAULTS[roleId]),
            updated_at: now,
          },
        }),
      }
    );
    if (!patchRes.ok) {
      throw new Error(`Backfill ${roleId} failed (${patchRes.status}): ${await patchRes.text()}`);
    }
    console.log(`OK Backfilled "${roleId}" with system notification defaults.`);
  }
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const tables = await listTables(baseId, token);
  const table = tables.find((t) => t.name.trim().toLowerCase() === TABLE_NAME);
  if (!table?.id) {
    console.error(`Table "${TABLE_NAME}" not found. Run setup-rbac-roles-table.ts first.`);
    process.exit(1);
  }

  const existing = new Set((table.fields ?? []).map((f) => f.name.trim().toLowerCase()));
  if (!existing.has(FIELD_NAME)) {
    await ensureField(baseId, token, table.id);
  } else {
    console.log(`OK "${TABLE_NAME}.${FIELD_NAME}" already exists — skip create.`);
  }

  console.log(`Reference all-true JSON (for custom roles): ${allTrueDefaultsJson()}`);
  console.log("Backfilling system roles…");
  await backfillSystemRoles(baseId, token);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
