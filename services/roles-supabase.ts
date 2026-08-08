"use server";

import {
  getFallbackNotificationDefaults,
  normalizeNotificationDefaults,
  parseNotificationDefaultsJson,
  type NotificationRoleDefaults,
} from "@/lib/notification-role-defaults";
import { DEFAULT_ROLE_PERMISSIONS, sanitizePermissions, type Permission } from "@/lib/permissions";
import { clearRoleNotificationCache } from "@/lib/role-notification-cache";
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectEq,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { listAllUsers } from "@/services/users";
import type { RoleRecord, UserRole } from "@/types";

const TABLE = "roles";

type Row = SbRow & {
  role_id?: string | null;
  label?: string | null;
  description?: string | null;
  permissions?: string | null;
  notification_defaults?: string | null;
  is_system_role?: boolean | null;
  color?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

async function invalidateRbacCache(roleName?: string): Promise<void> {
  const { clearRbacCache } = await import("@/lib/rbac");
  clearRbacCache(roleName);
  clearRoleNotificationCache(roleName);
}

/**
 * Best-effort mirror of role fields to Airtable after a Supabase write.
 * Production SoT is Supabase (`DATA_BACKEND=supabase`), but Airtable `roles`
 * can still drift when Roles UI saves only to Supabase — that stale JSON
 * confuses dual-backend debugging and any leftover Airtable read paths.
 */
async function mirrorRoleFieldsToAirtable(row: Row, mapped: RoleRecord): Promise<void> {
  const airtableId = row.airtable_id?.trim();
  if (!airtableId?.startsWith("rec")) return;
  try {
    const { invalidateListRecordsReadCacheForTable, updateRecord } = await import(
      "@/lib/airtable-server"
    );
    await updateRecord("roles", airtableId, {
      role_id: mapped.role_id,
      label: mapped.label,
      description: mapped.description,
      permissions: JSON.stringify(mapped.permissions),
      notification_defaults: JSON.stringify(mapped.notification_defaults),
      is_system_role: mapped.is_system_role,
      color: mapped.color,
      updated_at: mapped.updated_at || new Date().toISOString(),
    });
    invalidateListRecordsReadCacheForTable("roles");
  } catch (err) {
    console.warn(
      `[roles-supabase] Airtable mirror failed for ${mapped.role_id}:`,
      err instanceof Error ? err.message : err
    );
  }
}

function parsePermissionsJson(raw: unknown): Permission[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sanitizePermissions(parsed);
  } catch {
    return [];
  }
}

function mapRow(row: Row): RoleRecord {
  const roleId = row.role_id ?? "";
  const parsedDefaults = parseNotificationDefaultsJson(row.notification_defaults);
  return {
    id: publicId(row),
    role_id: roleId,
    label: row.label ?? "",
    description: row.description ?? "",
    permissions: parsePermissionsJson(row.permissions),
    notification_defaults: parsedDefaults
      ? normalizeNotificationDefaults(parsedDefaults)
      : getFallbackNotificationDefaults(roleId),
    is_system_role: row.is_system_role ?? false,
    color: row.color ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function resolveRolePermissions(roleId: string, stored: Permission[]): Permission[] {
  const defaults = DEFAULT_ROLE_PERMISSIONS[roleId as UserRole];
  if (!defaults) return stored;
  if (stored.length === 0) return [...defaults];
  const merged = new Set(stored);
  for (const p of defaults) merged.add(p);
  return [...merged];
}

export async function getRolePermissions(roleName: string): Promise<Permission[]> {
  const key = roleName.trim().toLowerCase();
  if (!key) return [];
  try {
    const rows = await sbSelectEq<Row>(TABLE, "role_id", key, "*", 1);
    const row = rows[0];
    if (!row) return resolveRolePermissions(key, []);
    return resolveRolePermissions(key, parsePermissionsJson(row.permissions));
  } catch {
    return resolveRolePermissions(key, []);
  }
}

export async function getRoles(): Promise<RoleRecord[]> {
  try {
    const rows = await sbSelectAll<Row>(TABLE);
    return rows.map(mapRow).sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}

export async function getRoleById(recordId: string): Promise<RoleRecord | null> {
  try {
    const row = await sbSelectByPublicId<Row>(TABLE, recordId);
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}

export async function getRoleUserCounts(): Promise<Record<string, number>> {
  try {
    const users = await listAllUsers();
    const counts: Record<string, number> = {};
    for (const u of users) {
      const key = String(u.role ?? "").trim().toLowerCase();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

export async function getNotificationDefaultsForRole(
  roleName: string
): Promise<NotificationRoleDefaults> {
  const key = roleName.trim().toLowerCase();
  if (!key) return getFallbackNotificationDefaults("");
  try {
    const rows = await sbSelectEq<Row>(TABLE, "role_id", key, "*", 1);
    const row = rows[0];
    if (!row) return getFallbackNotificationDefaults(key);
    const parsed = parseNotificationDefaultsJson(row.notification_defaults);
    if (parsed) return parsed;
    return getFallbackNotificationDefaults(key);
  } catch {
    return getFallbackNotificationDefaults(key);
  }
}

export type UpsertRoleInput = {
  role_id: string;
  label: string;
  description?: string;
  permissions: Permission[];
  notification_defaults?: NotificationRoleDefaults;
  is_system_role?: boolean;
  color?: string;
};

export async function upsertRole(
  input: UpsertRoleInput,
  existingRecordId?: string
): Promise<RoleRecord> {
  const now = new Date().toISOString();
  const roleId = input.role_id.trim().toLowerCase();
  const notificationDefaults = normalizeNotificationDefaults(
    input.notification_defaults ?? getFallbackNotificationDefaults(roleId)
  );
  const fields: Record<string, unknown> = {
    role_id: roleId,
    label: input.label.trim(),
    description: input.description?.trim() ?? "",
    permissions: JSON.stringify(sanitizePermissions(input.permissions)),
    notification_defaults: JSON.stringify(notificationDefaults),
    is_system_role: input.is_system_role ?? false,
    color: input.color?.trim() ?? "",
    updated_at: now,
  };

  if (existingRecordId) {
    const row = await sbUpdateByPublicId<Row>(TABLE, existingRecordId, fields);
    const mapped = mapRow(row);
    await invalidateRbacCache(mapped.role_id);
    await mirrorRoleFieldsToAirtable(row, mapped);
    return mapped;
  }

  fields.created_at = now;
  const row = await sbInsert<Row>(TABLE, fields);
  const mapped = mapRow(row);
  await invalidateRbacCache(mapped.role_id);
  await mirrorRoleFieldsToAirtable(row, mapped);
  return mapped;
}

export async function deleteRole(recordId: string): Promise<void> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (row?.is_system_role) {
    throw new Error("System roles cannot be deleted.");
  }
  const roleId = row?.role_id?.trim().toLowerCase();
  await sbDeleteByPublicId(TABLE, recordId);
  if (roleId) await invalidateRbacCache(roleId);
}
