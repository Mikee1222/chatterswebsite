import {
  listAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, toLinkedRecordPayload } from "@/lib/airtable-linked";
import { isSupabaseBackend } from "@/lib/data-backend";
import type { SopFunction, SopProgress, SopProgressUserSummary } from "@/types";

export const SOP_PROGRESS_TABLE = "sop_progress";

type ProgressFields = {
  progress_id?: string;
  user?: string | string[];
  sop_function?: string | string[];
  sop_role?: string | string[];
  completed_at?: string;
  completed_version?: number | string;
  quiz_score?: number | string | null;
  created_at?: string;
};

function genProgressId(): string {
  return `sop_prog_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function coerceVersion(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

function coerceQuizScore(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
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
    completed_version: coerceVersion(f.completed_version),
    quiz_score: coerceQuizScore(f.quiz_score),
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

function isProgressCurrent(
  progress: SopProgress,
  functionById: Map<string, SopFunction>
): boolean {
  if (!progress.completed_at) return false;
  const fn = functionById.get(progress.sop_function_id);
  const requiredVersion = fn?.content_version ?? 1;
  return progress.completed_version >= requiredVersion;
}

/**
 * Completed function record ids for a user within a role (version-aware).
 */
export async function getProgressForUser(
  userRecordId: string,
  roleRecordId: string,
  functions?: SopFunction[]
): Promise<string[]> {
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).getProgressForUser(
      userRecordId,
      roleRecordId,
      functions
    );
  }
  const rows = await getProgressRowsForUser(userRecordId, roleRecordId, functions);
  return rows.map((r) => r.sop_function_id).filter(Boolean);
}

/** Full progress rows for a user within a role. */
export async function getProgressRowsForUser(
  userRecordId: string,
  roleRecordId: string,
  functions?: SopFunction[]
): Promise<SopProgress[]> {
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).getProgressRowsForUser(
      userRecordId,
      roleRecordId,
      functions
    );
  }
  const userId = userRecordId.trim();
  const roleId = roleRecordId.trim();
  if (!userId || !roleId) return [];

  const rows = await listAllRecords<ProgressFields>(SOP_PROGRESS_TABLE, {
    _caller: "getProgressRowsForUser",
  });

  const functionById = new Map((functions ?? []).map((f) => [f.id, f]));

  return rows
    .filter((rec) => matchesUserRole(rec, userId, roleId))
    .map(mapProgressRecord)
    .filter((p) => isProgressCurrent(p, functionById));
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

export type MarkFunctionCompleteOptions = {
  contentVersion: number;
  quizScore?: number | null;
};

/** Upsert completion for user + function + role (idempotent). */
export async function markFunctionComplete(
  userRecordId: string,
  functionRecordId: string,
  roleRecordId: string,
  opts: MarkFunctionCompleteOptions
): Promise<SopProgress> {
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).markFunctionComplete(
      userRecordId,
      functionRecordId,
      roleRecordId,
      opts
    );
  }
  const userId = userRecordId.trim();
  const functionId = functionRecordId.trim();
  const roleId = roleRecordId.trim();
  if (!userId || !functionId || !roleId) {
    throw new Error("user, function, and role are required");
  }

  const now = new Date().toISOString();
  const version = Math.max(1, Math.floor(opts.contentVersion));
  const existing = await findProgressRow(userId, functionId, roleId);

  const fields: Record<string, unknown> = {
    completed_at: now,
    completed_version: version,
  };
  if (opts.quizScore != null) {
    fields.quiz_score = opts.quizScore;
  }

  if (existing) {
    const rec = await updateRecord<ProgressFields>(SOP_PROGRESS_TABLE, existing.id, fields);
    return mapProgressRecord(rec);
  }

  const createFields: Record<string, unknown> = {
    progress_id: genProgressId(),
    user: toLinkedRecordPayload(userId),
    sop_function: toLinkedRecordPayload(functionId),
    sop_role: toLinkedRecordPayload(roleId),
    created_at: now,
    ...fields,
  };

  const rec = await createRecord<ProgressFields>(SOP_PROGRESS_TABLE, createFields);
  return mapProgressRecord(rec);
}

/** Remove completion row for reset / smoke cleanup. */
export async function unmarkFunctionComplete(
  userRecordId: string,
  functionRecordId: string,
  roleRecordId: string
): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).unmarkFunctionComplete(
      userRecordId,
      functionRecordId,
      roleRecordId
    );
  }
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
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).getProgressByRole(roleRecordId);
  }
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

export async function countProgressByRole(roleRecordId: string): Promise<number> {
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).countProgressByRole(roleRecordId);
  }
  const { rows } = await getProgressByRole(roleRecordId);
  return rows.length;
}

export async function countProgressByFunction(functionRecordId: string): Promise<number> {
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).countProgressByFunction(functionRecordId);
  }
  const functionId = functionRecordId.trim();
  if (!functionId) return 0;
  const rows = await listAllRecords<ProgressFields>(SOP_PROGRESS_TABLE, {
    _caller: "countProgressByFunction",
  });
  return rows.filter((rec) => firstLinkedId(rec.fields?.sop_function) === functionId).length;
}

export async function deleteProgressByRole(roleRecordId: string): Promise<number> {
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).deleteProgressByRole(roleRecordId);
  }
  const roleId = roleRecordId.trim();
  if (!roleId) return 0;
  const rows = await listAllRecords<ProgressFields>(SOP_PROGRESS_TABLE, {
    _caller: "deleteProgressByRole",
  });
  const matched = rows.filter((rec) => firstLinkedId(rec.fields?.sop_role) === roleId);
  for (const rec of matched) {
    await deleteRecord(SOP_PROGRESS_TABLE, rec.id);
  }
  return matched.length;
}

export async function deleteProgressByFunction(functionRecordId: string): Promise<number> {
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).deleteProgressByFunction(functionRecordId);
  }
  const functionId = functionRecordId.trim();
  if (!functionId) return 0;
  const rows = await listAllRecords<ProgressFields>(SOP_PROGRESS_TABLE, {
    _caller: "deleteProgressByFunction",
  });
  const matched = rows.filter((rec) => firstLinkedId(rec.fields?.sop_function) === functionId);
  for (const rec of matched) {
    await deleteRecord(SOP_PROGRESS_TABLE, rec.id);
  }
  return matched.length;
}

export function buildProgressUserSummaries(
  byUser: Map<string, SopProgress[]>,
  totalFunctions: number,
  userNames: Map<string, string>,
  functions: SopFunction[],
  signoffByUser: Map<string, string>
): SopProgressUserSummary[] {
  const functionById = new Map(functions.map((f) => [f.id, f]));
  const summaries: SopProgressUserSummary[] = [];

  for (const [userId, rows] of byUser) {
    const currentRows = rows.filter((r) => isProgressCurrent(r, functionById));
    const completedIds = [
      ...new Set(currentRows.map((r) => r.sop_function_id).filter(Boolean)),
    ];
    const completed_count = completedIds.length;
    const percent =
      totalFunctions > 0 ? Math.round((completed_count / totalFunctions) * 100) : 0;
    const last_completed_at =
      currentRows
        .map((r) => r.completed_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    const quiz_scores = currentRows
      .filter((r) => r.quiz_score != null)
      .map((r) => ({
        function_id: r.sop_function_id,
        score: r.quiz_score as number,
      }));

    summaries.push({
      user_id: userId,
      user_name: userNames.get(userId) ?? userId,
      completed_count,
      total_functions: totalFunctions,
      percent,
      last_completed_at,
      completed_function_ids: completedIds,
      signoff_at: signoffByUser.get(userId) ?? null,
      quiz_scores,
    });
  }

  return summaries.sort(
    (a, b) =>
      b.percent - a.percent ||
      b.completed_count - a.completed_count ||
      a.user_name.localeCompare(b.user_name)
  );
}

export type SopProgressState = {
  current_rows: SopProgress[];
  completed_function_ids: string[];
  stale_function_ids: string[];
};

/** Version-aware progress state for a user within a role. */
export async function getProgressStateForUser(
  userRecordId: string,
  roleRecordId: string,
  functions: SopFunction[]
): Promise<SopProgressState> {
  if (isSupabaseBackend()) {
    return (await import("./sop-progress-supabase")).getProgressStateForUser(
      userRecordId,
      roleRecordId,
      functions
    );
  }
  const userId = userRecordId.trim();
  const roleId = roleRecordId.trim();
  if (!userId || !roleId) {
    return { current_rows: [], completed_function_ids: [], stale_function_ids: [] };
  }

  const rows = await listAllRecords<ProgressFields>(SOP_PROGRESS_TABLE, {
    _caller: "getProgressStateForUser",
  });

  const functionById = new Map(functions.map((f) => [f.id, f]));
  const matched = rows
    .filter((rec) => matchesUserRole(rec, userId, roleId))
    .map(mapProgressRecord);

  const stale_function_ids = matched
    .filter((p) => {
      const fn = functionById.get(p.sop_function_id);
      if (!fn || !p.completed_at) return false;
      return p.completed_version < fn.content_version;
    })
    .map((p) => p.sop_function_id);

  const current_rows = matched.filter((p) => isProgressCurrent(p, functionById));
  const completed_function_ids = [
    ...new Set(current_rows.map((r) => r.sop_function_id).filter(Boolean)),
  ];

  return { current_rows, completed_function_ids, stale_function_ids };
}
