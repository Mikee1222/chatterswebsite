#!/usr/bin/env npx tsx
/**
 * Sync built-in notification_defaults from code into Airtable system roles.
 *
 * Usage (from repo root):
 *   npx tsx scripts/sync-system-role-notification-defaults.ts
 *
 * Requires AIRTABLE_TOKEN and AIRTABLE_BASE_ID (same as other scripts).
 */

import "dotenv/config";
import { DEFAULT_NOTIFICATION_DEFAULTS } from "../lib/notification-role-defaults";
import { DEFAULT_ROLE_PERMISSIONS } from "../lib/permissions";
import { getRoles, upsertRole } from "../services/roles";
import type { UserRole } from "../types";

async function main(): Promise<void> {
  const roles = await getRoles();
  const systemRoleIds = Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[];

  for (const roleId of systemRoleIds) {
    const existing = roles.find((r) => r.role_id === roleId);
    if (!existing) {
      console.warn(`[skip] No Airtable row for system role "${roleId}"`);
      continue;
    }
    await upsertRole(
      {
        role_id: roleId,
        label: existing.label,
        description: existing.description,
        permissions: existing.permissions,
        notification_defaults: DEFAULT_NOTIFICATION_DEFAULTS[roleId],
        is_system_role: true,
        color: existing.color,
      },
      existing.id
    );
    console.log(`[ok] Synced notification_defaults for "${roleId}"`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
