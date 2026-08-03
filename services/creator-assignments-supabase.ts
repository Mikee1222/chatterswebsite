/**
 * Supabase backend for services/creator-assignments.ts (CRUD tier)
 */
import {
  publicId,
  sbInsert,
  sbSelectAll,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import type { CreatorAssignedRole, CreatorAssignment } from "./creator-assignments";

const TABLE = "creator_assignments";

type Row = SbRow & {
  assignment_id?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  role?: string | null;
  creator_model_id?: string | null;
  creator_name?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

function mapRow(row: Row): CreatorAssignment {
  return {
    id: publicId(row),
    user_id: (row.user_id ?? "").trim(),
    user_name: row.user_name ?? "",
    role: (row.role ?? "").trim(),
    creator_model_id: (row.creator_model_id ?? "").trim(),
    creator_name: row.creator_name ?? "",
    is_active: row.is_active ?? false,
  };
}

export async function listAllAssignments(): Promise<CreatorAssignment[]> {
  try {
    const rows = await sbSelectAll<Row>(TABLE);
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export async function listActiveAssignments(): Promise<CreatorAssignment[]> {
  return (await listAllAssignments()).filter((a) => a.is_active);
}

export async function setAssignment(input: {
  creator_model_id: string;
  creator_name: string;
  role: CreatorAssignedRole;
  user_id: string;
  user_name: string;
}): Promise<void> {
  const all = await listAllAssignments();
  const existing = all.find(
    (a) => a.role === input.role && a.creator_model_id === input.creator_model_id
  );
  const patch: Record<string, unknown> = {
    user_id: input.user_id,
    user_name: input.user_name,
    role: input.role,
    creator_model_id: input.creator_model_id,
    creator_name: input.creator_name,
    is_active: Boolean(input.user_id),
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    await sbUpdateByPublicId<Row>(TABLE, existing.id, patch);
    return;
  }
  await sbInsert<Row>(TABLE, {
    ...patch,
    assignment_id: `${input.role}__${input.creator_model_id}`,
    created_at: new Date().toISOString(),
  });
}
