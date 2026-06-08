import {
  listAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, toLinkedRecordPayload } from "@/lib/airtable-linked";
import type { SopProgress, SopProgressUserSummary } from "@/types";

export const SOP_PROGRESS_TABLE = "sop_progress";

type ProgressFields = {
  progress_id?: string;
  user?: string | string[];
  sop_function?: string | string[];
  sop_role?: string | string[];
  completed_at?: string;
  created_at?: string;
};

function genProgressId(): string {
  return `sop_prog_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapProgressRecord(rec: AirtableRecord<ProgressFields>): SopProgress {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    progress_id: String(f.progress_id ?? ""),
    user_id: firstLinkedId(f.user) ?? "",
    sop_function_id: firstLinkedId(f.sop_function) ?? "",
    sop_role_id: firstLinkedId(f.sop_role) ?? "",
    completed_at: f.completed_at != null ? String(f.completed_at) : "",
    created_at: f.created_at != null ? String(f.created_at) : undefined,
  };
}

function matchesUserRole(
  rec: AirtableRecord<ProgressFields>,
  userRecordId: string,
  roleRecordId: string
): boolean {
  const f = rec.fields ?? {};
  return (
    firstLinkedId(f.user) === userRecordId && firstLinkedId(f.sop_role) === roleRecordId
  );
}

function matchesUserFunctionRole(
  rec: AirtableRecord<ProgressFields>,
  userRecordId: string,
  functionRecordId: string,
  roleRecordId: string
): boolean {
  const f = rec.fields ?? {};
  return (
    firstLinkedId(f.user) === userRecordId &&
    firstLinkedId(f.sop_function) === functionRecordId &&
    firstLinkedId(f.sop_role) === roleRecordId
  );
}

/**
 * Completed function record ids for a user within a role.
 * Client-side filter on linked fields (reliable vs filterByFormula on links).
 */
export async function getProgressForUser(
  userRecordId: string,
  roleRecordId: string
): Promise<string[]> {
  const userId = userRecordId.trim();
  const roleId = roleRecordId.trim();
  if (!userId || !roleId) return [];

  const rows = await listAllRecords<ProgressFields>(SOP_PROGRESS_TABLE, {
    _caller: "getProgressForUser",
  });

  return rows
    .filter((rec) => matchesUserRole(rec, userId, roleId))
    .map((rec) => firstLinkedId(rec.fields?.sop_function))
    .filter((id): id is string => Boolean(id));
}

async function findProgressRow(
  userRecordId: string,
  functionRecordId: string,
  roleRecordId: string
): Promise<AirtableRecord<ProgressFields> | null> {
  const rows = await listAllRecords<ProgressFields>(SOP_PROGRESS_TABLE, {
    _caller: "findProgressRow",
  });
  const hit = rows.find((rec) =>
    matchesUserFunctionRole(rec, userRecordId, functionRecordId, roleRecordId)
  );
  return hit ?? null;
}

/** Upsert completion for user + function + role (idempotent). */
export async function markFunctionComplete(
  userRecordId: string,
  functionRecordId: string,
  roleRecordId: string
): Promise<SopProgress> {
  const userId = userRecordId.trim();
  const functionId = functionRecordId.trim();
  const roleId = roleRecordId.trim();
  if (!userId || !functionId || !roleId) {
    throw new Error("user, function, and role are required");
  }

  const now = new Date().toISOString();
  const existing = await findProgressRow(userId, functionId, roleId);

  if (existing) {
    const rec = await updateRecord<ProgressFields>(SOP_PROGRESS_TABLE, existing.id, {
      completed_at: now,
    });
    return mapProgressRecord(rec);
  }

  const fields: Record<string, unknown> = {
    progress_id: genProgressId(),
    user: toLinkedRecordPayload(userId),
    sop_function: toLinkedRecordPayload(functionId),
    sop_role: toLinkedRecordPayload(roleId),
    completed_at: now,
    created_at: now,
  };

  const rec = await createRecord<ProgressFields>(SOP_PROGRESS_TABLE, fields);
  return mapProgressRecord(rec);
}

/** Remove completion row for reset / smoke cleanup. */
export async function unmarkFunctionComplete(
  userRecordId: string,
  functionRecordId: string,
  roleRecordId: string
): Promise<void> {
  const existing = await findProgressRow(
    userRecordId.trim(),
    functionRecordId.trim(),
    roleRecordId.trim()
  );
  if (existing) {
    await deleteRecord(SOP_PROGRESS_TABLE, existing.id);
  }
}

export type SopProgressByRole = {
  by_user: Map<string, SopProgress[]>;
  rows: SopProgress[];
};

/** All progress rows for a role, grouped by user id. */
export async function getProgressByRole(roleRecordId: string): Promise<SopProgressByRole> {
  const roleId = roleRecordId.trim();
  if (!roleId) return { by_user: new Map(), rows: [] };

  const rows = await listAllRecords<ProgressFields>(SOP_PROGRESS_TABLE, {
    _caller: "getProgressByRole",
  });

  const matched = rows
    .filter((rec) => firstLinkedId(rec.fields?.sop_role) === roleId)
    .map(mapProgressRecord);

  const by_user = new Map<string, SopProgress[]>();
  for (const row of matched) {
    if (!row.user_id) continue;
    const list = by_user.get(row.user_id) ?? [];
    list.push(row);
    by_user.set(row.user_id, list);
  }

  return { by_user, rows: matched };
}

export function buildProgressUserSummaries(
  byUser: Map<string, SopProgress[]>,
  totalFunctions: number,
  userNames: Map<string, string>
): SopProgressUserSummary[] {
  const summaries: SopProgressUserSummary[] = [];

  for (const [userId, rows] of byUser) {
    const completedIds = [
      ...new Set(rows.map((r) => r.sop_function_id).filter(Boolean)),
    ];
    const completed_count = completedIds.length;
    const percent =
      totalFunctions > 0 ? Math.round((completed_count / totalFunctions) * 100) : 0;
    const last_completed_at =
      rows
        .map((r) => r.completed_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    summaries.push({
      user_id: userId,
      user_name: userNames.get(userId) ?? userId,
      completed_count,
      total_functions: totalFunctions,
      percent,
      last_completed_at,
      completed_function_ids: completedIds,
    });
  }

  return summaries.sort(
    (a, b) =>
      b.percent - a.percent ||
      b.completed_count - a.completed_count ||
      a.user_name.localeCompare(b.user_name)
  );
}
