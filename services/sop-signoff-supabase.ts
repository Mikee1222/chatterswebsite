/**
 * Supabase backend for services/sop-signoff.ts
 */
import {
  firstMappedLinkedId,
  publicId, sbDeleteByPublicId, sbInsert,
  sbResolveUuidToAirtableMap, sbSelectAll, requireSbUuids, type SbRow,
} from "@/lib/supabase-data";
import type { SopSignoff } from "@/types";
import { DEFAULT_SIGNOFF_STATEMENT } from "./sop-signoff";

const TABLE = "sop_signoffs";
type Row = SbRow & {
  signoff_id?: string | null;
  /** Postgres column is user_ref (Airtable field "user" is reserved in PG). */
  user_ref?: string[] | null;
  sop_role?: string[] | null;
  signed_at?: string | null;
  statement?: string | null;
  created_at?: string | null;
};

function genSignoffId(): string {
  return `sop_sign_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapRowSync(
  row: Row,
  userAt: Map<string, string>,
  roleAt: Map<string, string>
): SopSignoff {
  return {
    id: publicId(row),
    signoff_id: String(row.signoff_id ?? ""),
    user_id: firstMappedLinkedId(row.user_ref, userAt),
    sop_role_id: firstMappedLinkedId(row.sop_role, roleAt),
    signed_at: row.signed_at != null ? String(row.signed_at) : "",
    statement: String(row.statement ?? ""),
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

async function mapRows(rows: Row[]): Promise<SopSignoff[]> {
  if (!rows.length) return [];
  const [userAt, roleAt] = await Promise.all([
    sbResolveUuidToAirtableMap("users", rows.map((r) => r.user_ref)),
    sbResolveUuidToAirtableMap("sop_roles", rows.map((r) => r.sop_role)),
  ]);
  return rows.map((r) => mapRowSync(r, userAt, roleAt));
}

async function mapRow(row: Row): Promise<SopSignoff> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function getSignoffsByRole(roleRecordId: string): Promise<SopSignoff[]> {
  const roleId = roleRecordId.trim();
  if (!roleId) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await mapRows(rows);
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
  const [userUuids, roleUuids] = await Promise.all([
    requireSbUuids("users", [userId], "user"),
    requireSbUuids("sop_roles", [roleId], "sop_role"),
  ]);
  const row = await sbInsert<Row>(TABLE, {
    signoff_id: genSignoffId(),
    user_ref: userUuids,
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
