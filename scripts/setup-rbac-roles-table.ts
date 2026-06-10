#!/usr/bin/env npx tsx
/**
 * One-time setup: create the `roles` table in Airtable and seed system roles.
 *
 * Usage (from repo root):
 *   npx tsx scripts/setup-rbac-roles-table.ts
 *
 * Requires env:
 *   AIRTABLE_TOKEN — PAT with schema.bases:read + schema.bases:write + data.records:read + data.records:write
 *   AIRTABLE_BASE_ID — target base id
 */

import "dotenv/config";
import { DEFAULT_ROLE_PERMISSIONS } from "../lib/permissions";
import type { UserRole } from "../types";

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_BASE = "https://api.airtable.com/v0";
const TABLE_NAME = "roles";
const DATETIME_TZ_GMT_PLUS_3 = "Asia/Riyadh";

type MetaTable = { id: string; name: string };

const datetimeOptionsGmtPlus3 = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ_GMT_PLUS_3,
};

const SYSTEM_ROLE_META: Record<
  UserRole,
  { label: string; description: string; color: string }
> = {
  admin: {
    label: "Administrator",
    description: "Full system access.",
    color: "#DC2626",
  },
  manager: {
    label: "Manager",
    description: "Operations lead with broad access; cannot manage roles, delete accounts, or change sensitive config.",
    color: "#EA580C",
  },
  chatter: {
    label: "Chatter",
    description: "Front-line chatting staff.",
    color: "#2563EB",
  },
  virtual_assistant: {
    label: "Virtual Assistant",
    description: "VA staff for tasks, content, and marketing support.",
    color: "#7C3AED",
  },
  model: {
    label: "Model",
    description: "Creator / model portal access.",
    color: "#DB2777",
  },
  client: {
    label: "Client",
    description: "Agency client portal access.",
    color: "#059669",
  },
};

function log(msg: string) {
  console.log(`[setup-rbac-roles] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[setup-rbac-roles] ERROR: ${msg}`);
}

async function metaFetch(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
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
  const res = await metaFetch(token, `/${baseId}/tables`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function buildFieldsPayload(): Array<Record<string, unknown>> {
  return [
    { name: "role_id", type: "singleLineText" },
    { name: "label", type: "singleLineText" },
    { name: "description", type: "multilineText" },
    { name: "permissions", type: "multilineText" },
    {
      name: "is_system_role",
      type: "checkbox",
      options: { icon: "check", color: "greenBright" },
    },
    { name: "color", type: "singleLineText" },
    {
      name: "created_at",
      type: "dateTime",
      options: { ...datetimeOptionsGmtPlus3 },
    },
    {
      name: "updated_at",
      type: "dateTime",
      options: { ...datetimeOptionsGmtPlus3 },
    },
  ];
}

async function seedSystemRoles(baseId: string, token: string): Promise<void> {
  const now = new Date().toISOString();
  const roles = Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[];

  for (const roleId of roles) {
    const meta = SYSTEM_ROLE_META[roleId];
    const permissions = JSON.stringify(DEFAULT_ROLE_PERMISSIONS[roleId]);

    const listRes = await dataFetch(
      token,
      baseId,
      `/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(`{role_id}="${roleId}"`)}&maxRecords=1`,
      { method: "GET" }
    );
    if (!listRes.ok) {
      throw new Error(`List roles failed (${listRes.status}): ${await listRes.text()}`);
    }
    const listData = (await listRes.json()) as { records?: Array<{ id: string }> };
    const existingId = listData.records?.[0]?.id;

    const fields = {
      role_id: roleId,
      label: meta.label,
      description: meta.description,
      permissions,
      is_system_role: true,
      color: meta.color,
      updated_at: now,
      ...(existingId ? {} : { created_at: now }),
    };

    if (existingId) {
      const patchRes = await dataFetch(token, baseId, `/${encodeURIComponent(TABLE_NAME)}/${existingId}`, {
        method: "PATCH",
        body: JSON.stringify({ fields }),
      });
      if (!patchRes.ok) {
        throw new Error(`Update role ${roleId} failed (${patchRes.status}): ${await patchRes.text()}`);
      }
      log(`Updated system role "${roleId}".`);
    } else {
      const createRes = await dataFetch(token, baseId, `/${encodeURIComponent(TABLE_NAME)}`, {
        method: "POST",
        body: JSON.stringify({ fields: { ...fields, created_at: now } }),
      });
      if (!createRes.ok) {
        throw new Error(`Create role ${roleId} failed (${createRes.status}): ${await createRes.text()}`);
      }
      log(`Seeded system role "${roleId}".`);
    }
  }
}

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();

  if (!token || !baseId) {
    logErr("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID (e.g. in .env at repo root).");
    process.exit(1);
  }

  try {
    log(`Using base id: ${baseId.slice(0, 6)}…`);
    const tables = await listTables(baseId, token);
    const existing = tables.find((t) => t.name === TABLE_NAME);

    if (!existing) {
      const fields = buildFieldsPayload();
      log(`Creating table "${TABLE_NAME}" with ${fields.length} fields…`);
      const res = await metaFetch(token, `/${baseId}/tables`, {
        method: "POST",
        body: JSON.stringify({
          name: TABLE_NAME,
          description: "RBAC roles and permission sets (created by setup-rbac-roles-table.ts)",
          fields,
        }),
      });
      if (!res.ok) {
        logErr(`Create table failed (${res.status}): ${await res.text()}`);
        process.exit(1);
      }
      const created = (await res.json()) as { id?: string; name?: string };
      log(`Created table "${created.name ?? TABLE_NAME}" (id: ${created.id ?? "unknown"}).`);
    } else {
      log(`Table "${TABLE_NAME}" already exists (id: ${existing.id}).`);
    }

    log("Seeding / updating system roles…");
    await seedSystemRoles(baseId, token);
    log("Success.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logErr(msg);
    process.exit(1);
  }
}

main();
