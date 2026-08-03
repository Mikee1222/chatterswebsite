import {
  listAllRecords,
  createRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import { firstLinkedId, toLinkedRecordPayload } from "@/lib/airtable-linked";
import type { SopSignoff } from "@/types";

export const SOP_SIGNOFFS_TABLE = "sop_signoffs";

export const DEFAULT_SIGNOFF_STATEMENT =
  "I confirm I have read, understood, and will follow the standards in this training.";

type SignoffFields = {
  signoff_id?: string;
  user?: string | string[];
  sop_role?: string | string[];
  signed_at?: string;
  statement?: string;
  created_at?: string;
};

function genSignoffId(): string {
  return `sop_sign_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapSignoffRecord(rec: AirtableRecord<SignoffFields>): SopSignoff {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    signoff_id: String(f.signoff_id ?? ""),
    user_id: firstLinkedId(f.user) ?? "",
    sop_role_id: firstLinkedId(f.sop_role) ?? "",
    signed_at: f.signed_at != null ? String(f.signed_at) : "",
    statement: String(f.statement ?? ""),
    created_at: f.created_at != null ? String(f.created_at) : undefined,
  };
}

/** All signoff rows for a role. */
export async function getSignoffsByRole(roleRecordId: string): Promise<SopSignoff[]> {
  if (isSupabaseBackend()) return (await import("./sop-signoff-supabase")).getSignoffsByRole(roleRecordId);
  const roleId = roleRecordId.trim();
  if (!roleId) return [];

  const rows = await listAllRecords<SignoffFields>(SOP_SIGNOFFS_TABLE, {
    _caller: "getSignoffsByRole",
  });

  return rows
    .filter((rec) => firstLinkedId(rec.fields?.sop_role) === roleId)
    .map(mapSignoffRecord);
}

export async function getSignoffForUserRole(
  userRecordId: string,
  roleRecordId: string
): Promise<SopSignoff | null> {
  if (isSupabaseBackend()) return (await import("./sop-signoff-supabase")).getSignoffForUserRole(userRecordId, roleRecordId);
  const userId = userRecordId.trim();
  const roleId = roleRecordId.trim();
  if (!userId || !roleId) return null;

  const rows = await getSignoffsByRole(roleId);
  return rows.find((r) => r.user_id === userId) ?? null;
}

/** Create signoff (idempotent — returns existing if already signed). */
export async function createSignoff(
  userRecordId: string,
  roleRecordId: string,
  statement: string
): Promise<SopSignoff> {
  if (isSupabaseBackend()) return (await import("./sop-signoff-supabase")).createSignoff(userRecordId, roleRecordId, statement);
  const userId = userRecordId.trim();
  const roleId = roleRecordId.trim();
  if (!userId || !roleId) {
    throw new Error("user and role are required");
  }

  const existing = await getSignoffForUserRole(userId, roleId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    signoff_id: genSignoffId(),
    user: toLinkedRecordPayload(userId),
    sop_role: toLinkedRecordPayload(roleId),
    signed_at: now,
    statement: (statement ?? DEFAULT_SIGNOFF_STATEMENT).trim() || DEFAULT_SIGNOFF_STATEMENT,
    created_at: now,
  };

  const rec = await createRecord<SignoffFields>(SOP_SIGNOFFS_TABLE, fields);
  return mapSignoffRecord(rec);
}

export async function countSignoffsByRole(roleRecordId: string): Promise<number> {
  if (isSupabaseBackend()) return (await import("./sop-signoff-supabase")).countSignoffsByRole(roleRecordId);
  const signoffs = await getSignoffsByRole(roleRecordId);
  return signoffs.length;
}

export async function deleteSignoffsByRole(roleRecordId: string): Promise<number> {
  if (isSupabaseBackend()) return (await import("./sop-signoff-supabase")).deleteSignoffsByRole(roleRecordId);
  const roleId = roleRecordId.trim();
  if (!roleId) return 0;
  const rows = await listAllRecords<SignoffFields>(SOP_SIGNOFFS_TABLE, {
    _caller: "deleteSignoffsByRole",
  });
  const matched = rows.filter((rec) => firstLinkedId(rec.fields?.sop_role) === roleId);
  for (const rec of matched) {
    await deleteRecord(SOP_SIGNOFFS_TABLE, rec.id);
  }
  return matched.length;
}
