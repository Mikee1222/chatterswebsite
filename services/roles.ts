"use server";

import {
  syncRoleOptionToAirtable as syncRoleOptionToAirtableImpl,
  type SyncRoleOptionResult,
} from "@/lib/airtable-role-field-sync";
import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import {
  getFallbackNotificationDefaults,
  normalizeNotificationDefaults,
  parseNotificationDefaultsJson,
  type NotificationRoleDefaults,
} from "@/lib/notification-role-defaults";
import { DEFAULT_ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";
import { clearRoleNotificationCache } from "@/lib/role-notification-cache";
import { listAllUsers } from "@/services/users";
import type { RoleRecord, UserRole } from "@/types";

const TABLE = "roles";

async function invalidateRbacCache(roleName?: string): Promise<void> {
  const { clearRbacCache } = await import("@/lib/rbac");
  clearRbacCache(roleName);
  clearRoleNotificationCache(roleName);
}

type Fields = {
  role_id?: string;
  label?: string;
  description?: string;
  permissions?: string;
  notification_defaults?: string;
  is_system_role?: boolean;
  color?: string;
  created_at?: string;
  updated_at?: string;
};

function parsePermissionsJson(raw: unknown): Permission[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is Permission => typeof p === "string");
  } catch {
    return [];
  }
}

function mapRecord(rec: AirtableRecord<Fields>): RoleRecord {
  const f = rec.fields;
  const roleId = f.role_id ?? "";
  const parsedDefaults = parseNotificationDefaultsJson(f.notification_defaults);
  return {
    id: rec.id,
    role_id: roleId,
    label: f.label ?? "",
    description: f.description ?? "",
    permissions: parsePermissionsJson(f.permissions),
    notification_defaults: parsedDefaults
      ? normalizeNotificationDefaults(parsedDefaults)
      : getFallbackNotificationDefaults(roleId),
    is_system_role: f.is_system_role ?? false,
    color: f.color ?? "",
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
  };
}

export async function getRolePermissions(roleName: string): Promise<Permission[]> {
  const key = roleName.trim().toLowerCase();
  if (!key) return [];

  try {
    const { records } = await listRecords<Fields>(TABLE, {
      filterByFormula: `{role_id} = "${key.replace(/"/g, '""')}"`,
      pageSize: 1,
    });
    const row = records[0];
    if (!row) {
      const fallback = DEFAULT_ROLE_PERMISSIONS[key as UserRole];
      return fallback ? [...fallback] : [];
    }
    const perms = parsePermissionsJson(row.fields.permissions);
    if (perms.length === 0) {
      const fallback = DEFAULT_ROLE_PERMISSIONS[key as UserRole];
      return fallback ? [...fallback] : [];
    }
    return perms;
  } catch {
    const fallback = DEFAULT_ROLE_PERMISSIONS[key as UserRole];
    return fallback ? [...fallback] : [];
  }
}

export async function getRoles(): Promise<RoleRecord[]> {
  try {
    const records = await listAllRecords<Fields>(TABLE, {});
    return records.map(mapRecord).sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}

export async function getRoleById(recordId: string): Promise<RoleRecord | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec);
  } catch {
    return null;
  }
}

/** Active users per `users.role` slug (lowercase). */
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

export type { SyncRoleOptionResult };

/** Ensure a role slug exists on Airtable users.role single-select (Meta API). Does not throw. */
export async function syncRoleOptionToAirtable(roleId: string): Promise<SyncRoleOptionResult> {
  return syncRoleOptionToAirtableImpl(roleId);
}

export async function getNotificationDefaultsForRole(roleName: string): Promise<NotificationRoleDefaults> {
  const key = roleName.trim().toLowerCase();
  if (!key) return getFallbackNotificationDefaults("");

  try {
    const { records } = await listRecords<Fields>(TABLE, {
      filterByFormula: `{role_id} = "${key.replace(/"/g, '""')}"`,
      pageSize: 1,
    });
    const row = records[0];
    if (!row) return getFallbackNotificationDefaults(key);
    const parsed = parseNotificationDefaultsJson(row.fields.notification_defaults);
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
  const fields: Fields = {
    role_id: roleId,
    label: input.label.trim(),
    description: input.description?.trim() ?? "",
    permissions: JSON.stringify(input.permissions),
    notification_defaults: JSON.stringify(notificationDefaults),
    is_system_role: input.is_system_role ?? false,
    color: input.color?.trim() ?? "",
    updated_at: now,
  };

  if (existingRecordId) {
    const rec = await updateRecord<Fields>(TABLE, existingRecordId, fields);
    const mapped = mapRecord(rec);
    await invalidateRbacCache(mapped.role_id);
    return mapped;
  }

  fields.created_at = now;
  const rec = await createRecord<Fields>(TABLE, fields);
  const mapped = mapRecord(rec);
  await syncRoleOptionToAirtable(mapped.role_id);
  await invalidateRbacCache(mapped.role_id);
  return mapped;
}

export async function deleteRole(recordId: string): Promise<void> {
  const rec = await listRecords<Fields>(TABLE, {
    filterByFormula: `RECORD_ID() = "${recordId.replace(/"/g, '""')}"`,
    pageSize: 1,
  });
  const row = rec.records[0];
  if (row?.fields.is_system_role) {
    throw new Error("System roles cannot be deleted.");
  }
  const roleId = row?.fields.role_id?.trim().toLowerCase();
  await deleteRecord(TABLE, recordId);
  if (roleId) await invalidateRbacCache(roleId);
}
