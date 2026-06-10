"use server";

import {
  listRecords,
  listAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { DEFAULT_ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";
import type { RoleRecord, UserRole } from "@/types";

const TABLE = "roles";

type Fields = {
  role_id?: string;
  label?: string;
  description?: string;
  permissions?: string;
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
  return {
    id: rec.id,
    role_id: f.role_id ?? "",
    label: f.label ?? "",
    description: f.description ?? "",
    permissions: parsePermissionsJson(f.permissions),
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
    return records.map(mapRecord);
  } catch {
    return [];
  }
}

export type UpsertRoleInput = {
  role_id: string;
  label: string;
  description?: string;
  permissions: Permission[];
  is_system_role?: boolean;
  color?: string;
};

export async function upsertRole(
  input: UpsertRoleInput,
  existingRecordId?: string
): Promise<RoleRecord> {
  const now = new Date().toISOString();
  const fields: Fields = {
    role_id: input.role_id.trim().toLowerCase(),
    label: input.label.trim(),
    description: input.description?.trim() ?? "",
    permissions: JSON.stringify(input.permissions),
    is_system_role: input.is_system_role ?? false,
    color: input.color?.trim() ?? "",
    updated_at: now,
  };

  if (existingRecordId) {
    const rec = await updateRecord<Fields>(TABLE, existingRecordId, fields);
    return mapRecord(rec);
  }

  fields.created_at = now;
  const rec = await createRecord<Fields>(TABLE, fields);
  return mapRecord(rec);
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
  await deleteRecord(TABLE, recordId);
}
