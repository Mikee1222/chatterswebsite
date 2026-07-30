import {
  listAllRecords,
  createRecord,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { listActiveUsers } from "@/services/users";

const TABLE = "creator_assignments";

/** Pipeline stages that route per-creator (each creator has one owner per role). */
export const CREATOR_ASSIGNED_ROLES = [
  "researcher",
  "creative",
  "filmer",
  "editor",
  "marketing-executive",
] as const;

/** Central roles: one person for ALL creators (not per-creator). Resolved by users.role. */
export const CENTRAL_ROLES = [
  "icloud-manager",
  "head-of-marketing",
  "supervisor",
] as const;

export type CreatorAssignedRole = (typeof CREATOR_ASSIGNED_ROLES)[number];
export type PipelineRole = CreatorAssignedRole | (typeof CENTRAL_ROLES)[number];

export function isCreatorAssignedRole(role: string): role is CreatorAssignedRole {
  return (CREATOR_ASSIGNED_ROLES as readonly string[]).includes(role);
}

type Fields = {
  assignment_id?: string;
  user_id?: string;
  user_name?: string;
  role?: string;
  creator_model_id?: string;
  creator_name?: string;
  is_active?: boolean;
  created_at?: string;
};

export type CreatorAssignment = {
  id: string;
  user_id: string;
  user_name: string;
  role: string;
  creator_model_id: string;
  creator_name: string;
  is_active: boolean;
};

function mapRecord(rec: AirtableRecord<Fields>): CreatorAssignment {
  const f = rec.fields;
  return {
    id: rec.id,
    user_id: (f.user_id ?? "").trim(),
    user_name: f.user_name ?? "",
    role: (f.role ?? "").trim(),
    creator_model_id: (f.creator_model_id ?? "").trim(),
    creator_name: f.creator_name ?? "",
    is_active: f.is_active ?? false,
  };
}

/** All assignment rows (active + inactive). Small table; filter in JS to avoid formula quirks. */
export async function listAllAssignments(): Promise<CreatorAssignment[]> {
  try {
    const records = await listAllRecords<Fields>(TABLE, {});
    return records.map(mapRecord);
  } catch {
    return [];
  }
}

export async function listActiveAssignments(): Promise<CreatorAssignment[]> {
  return (await listAllAssignments()).filter((a) => a.is_active);
}

/**
 * Resolve the owner of a pipeline stage for a given creator.
 * - Creator-assigned roles → the active `creator_assignments` row for (creator, role).
 * - Central roles → the single active user whose `users.role` matches.
 * Returns null when nobody is assigned (item should hold as ⚠️ unassigned).
 */
export async function resolveStageOwner(
  creatorModelId: string,
  role: PipelineRole
): Promise<{ user_id: string; user_name: string } | null> {
  if (isCreatorAssignedRole(role)) {
    const active = await listActiveAssignments();
    const match = active.find(
      (a) => a.role === role && a.creator_model_id === creatorModelId && a.user_id
    );
    return match ? { user_id: match.user_id, user_name: match.user_name } : null;
  }
  // Central role: a single person for all creators. Prefer explicit config
  // (system_settings `pipeline_central_<role>` = user record id) so a person can hold a
  // central pipeline role WITHOUT changing their users.role (e.g. Evi = iCloud manager + VA).
  const users = await listActiveUsers();
  const { getSystemSetting } = await import("@/services/system-settings");
  const configuredId = (await getSystemSetting(`pipeline_central_${role}`).catch(() => null))?.trim();
  if (configuredId) {
    const cu = users.find((u) => u.id === configuredId);
    if (cu) return { user_id: cu.id, user_name: cu.full_name };
  }
  const owner = users.find((u) => (u.role ?? "").trim().toLowerCase() === role);
  return owner ? { user_id: owner.id, user_name: owner.full_name } : null;
}

/**
 * Upsert the owner for a (creator, role) pair — enforces ONE active row per pair.
 * Pass empty userId to clear (unassign).
 */
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
  const fields: Fields = {
    user_id: input.user_id,
    user_name: input.user_name,
    role: input.role,
    creator_model_id: input.creator_model_id,
    creator_name: input.creator_name,
    is_active: Boolean(input.user_id),
  };
  if (existing) {
    await updateRecord<Fields>(TABLE, existing.id, fields);
  } else {
    await createRecord<Fields>(TABLE, {
      ...fields,
      assignment_id: `${input.role}__${input.creator_model_id}`,
      created_at: new Date().toISOString(),
    });
  }
}
