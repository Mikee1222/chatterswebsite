#!/usr/bin/env npx tsx
/**
 * Sync all RBAC role slugs into Airtable `users.role` single-select options (Meta API).
 *
 * Sources:
 *   - All `role_id` values from the `roles` table
 *   - System role keys from DEFAULT_ROLE_PERMISSIONS
 *
 * Usage (from repo root):
 *   npx tsx scripts/sync-airtable-role-options.ts
 *
 * Requires env:
 *   AIRTABLE_TOKEN — PAT with schema.bases:read + schema.bases:write + data.records:read
 *   AIRTABLE_BASE_ID — target base id
 */

import "dotenv/config";
import { DEFAULT_ROLE_PERMISSIONS } from "../lib/permissions";
import {
  resolveUsersRoleField,
  syncRoleOptionsToAirtable,
} from "../lib/airtable-role-field-sync";
import { listAllRecords } from "../lib/airtable-server";
import type { UserRole } from "../types";

const ROLES_TABLE = "roles";

type RoleFields = { role_id?: string };

function log(msg: string) {
  console.log(`[sync-airtable-role-options] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[sync-airtable-role-options] ERROR: ${msg}`);
}

async function collectRoleIds(): Promise<string[]> {
  const fromDefaults = Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[];
  const ids = new Set(fromDefaults.map((r) => r.trim().toLowerCase()));

  try {
    const records = await listAllRecords<RoleFields>(ROLES_TABLE, {});
    for (const rec of records) {
      const roleId = rec.fields.role_id?.trim().toLowerCase();
      if (roleId) ids.add(roleId);
    }
    log(`Collected ${ids.size} unique role slug(s) (${records.length} from roles table + defaults).`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logErr(`Could not list roles table (${msg}); using DEFAULT_ROLE_PERMISSIONS keys only.`);
  }

  return [...ids].sort();
}

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) {
    logErr("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID (e.g. in .env at repo root).");
    process.exit(1);
  }

  try {
    const ref = await resolveUsersRoleField();
    log(
      `Resolved users.role field — table id: ${ref.tableId}, field id: ${ref.fieldId} (${ref.field.options?.choices?.length ?? 0} existing option(s)).`
    );

    const roleIds = await collectRoleIds();
    const { added, skipped } = await syncRoleOptionsToAirtable(roleIds);

    if (added.length === 0) {
      log(`All ${skipped.length} role slug(s) already present on users.role. Nothing to do.`);
    } else {
      log(`Added ${added.length} option(s): ${added.join(", ")}`);
      if (skipped.length > 0) {
        log(`${skipped.length} already existed: ${skipped.join(", ")}`);
      }
    }
    log("Success.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logErr(msg);
    process.exit(1);
  }
}

main();
