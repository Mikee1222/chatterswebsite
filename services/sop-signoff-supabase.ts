/**
 * Supabase backend for services/sop-signoff.ts
 */
import {
  publicId, sbDeleteByPublicId, sbFirstLinkedAirtableId, sbInsert,
  sbSelectAll, sbUuidsForAirtableIds, type SbRow,
} from "@/lib/supabase-data";
import type { SopSignoff } from "@/types";
import { DEFAULT_SIGNOFF_STATEMENT } from "./sop-signoff";

const TABLE = "sop_signoffs";
type Row = SbRow & {
  signoff_id?: string | null; user?: string[] | null; sop_role?: string[] | null;
  signed_at?: string | null; statement?: string | null; created_at?: string | null;
};

function genSignoffId(): string {
  return `sop_sign_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function mapRow(row: Row): Promise<SopSignoff> {
  return {
    id: publicId(row),
    signoff_id: String(row.signoff_id ?? ""),
    user_id: (await sbFirstLinkedAirtableId("users", row.user)) ?? "",
    sop_role_id: (await sbFirstLinkedAirtableId("sop_roles", row.sop_role)) ?? "",
    signed_at: row.signed_at != null ? String(row.signed_at) : "",
    statement: String(row.statement ?? ""),
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

export async function getSignoffsByRole(roleRecordId: string): Promise<SopSignoff[]> {
  const roleId = roleRecordId.trim();
  if (!roleId) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await Promise.all(rows.map(mapRow));
  return mapped.filter((r) => r.sop_role_id === roleId);
}

export async function getSignoffForUserRole(userRecordId: string, roleRecordId: string): Promise<SopSignoff | null> {
  const userId = userRecordId.trim();
  const roleId = roleRecordId.trim();
  if (!userId || !roleId) return null;
  const rows = await getSignoffsByRole(roleId);
  return rows.find((r) => r.user_id === userId) ?? null;
}

export async function createSignoff(userRecordId: string, roleRecordId: string, statement: string): Promise<SopSignoff> {
  const userId = userRecordId.trim();
  const roleId = roleRecordId.trim();
  if (!userId || !roleId) throw new Error("user and role are required");
  const existing = await getSignoffForUserRole(userId, roleId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const userUuids = await sbUuidsForAirtableIds("users", [userId]);
  const roleUuids = await sbUuidsForAirtableIds("sop_roles", [roleId]);
  const row = await sbInsert<Row>(TABLE, {
    signoff_id: genSignoffId(),
    user: userUuids,
    sop_role: roleUuids,
    signed_at: now,
    statement: (statement ?? DEFAULT_SIGNOFF_STATEMENT).trim() || DEFAULT_SIGNOFF_STATEMENT,
    created_at: now,
  });
  return mapRow(row);
}

export async function countSignoffsByRole(roleRecordId: string): Promise<number> {
  return (await getSignoffsByRole(roleRecordId)).length;
}

export async function deleteSignoffsByRole(roleRecordId: string): Promise<number> {
  const roleId = roleRecordId.trim();
  if (!roleId) return 0;
  const rows = await getSignoffsByRole(roleId);
  for (const r of rows) await sbDeleteByPublicId(TABLE, r.id);
  return rows.length;
}
