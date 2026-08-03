/**
 * Supabase backend for services/sop-progress.ts
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbSelectAll,
  sbUpdateByPublicId,
  requireSbUuids,
  type SbRow,
} from "@/lib/supabase-data";
import type { SopFunction, SopProgress } from "@/types";

const TABLE = "sop_progress";

type Row = SbRow & {
  progress_id?: string | null;
  user?: string[] | null;
  sop_function?: string[] | null;
  sop_role?: string[] | null;
  completed_at?: string | null;
  completed_version?: number | string | null;
  quiz_score?: number | string | null;
  created_at?: string | null;
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

async function mapRow(row: Row): Promise<SopProgress> {
  return {
    id: publicId(row),
    progress_id: String(row.progress_id ?? ""),
    user_id: (await sbFirstLinkedAirtableId("users", row.user)) ?? "",
    sop_function_id: (await sbFirstLinkedAirtableId("sop_functions", row.sop_function)) ?? "",
    sop_role_id: (await sbFirstLinkedAirtableId("sop_roles", row.sop_role)) ?? "",
    completed_at: row.completed_at != null ? String(row.completed_at) : "",
    completed_version: coerceVersion(row.completed_version),
    quiz_score: coerceQuizScore(row.quiz_score),
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

function isCurrent(p: SopProgress, functionById: Map<string, SopFunction>): boolean {
  if (!p.completed_at) return false;
  const fn = functionById.get(p.sop_function_id);
  const requiredVersion = fn?.content_version ?? 1;
  return p.completed_version >= requiredVersion;
}

async function loadAll(): Promise<SopProgress[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return Promise.all(rows.map(mapRow));
}

export async function getProgressForUser(
  userRecordId: string,
  roleRecordId: string,
  functions?: SopFunction[]
): Promise<string[]> {
  const rows = await getProgressRowsForUser(userRecordId, roleRecordId, functions);
  return rows.map((r) => r.sop_function_id).filter(Boolean);
}

export async function getProgressRowsForUser(
  userRecordId: string,
  roleRecordId: string,
  functions?: SopFunction[]
): Promise<SopProgress[]> {
  const uid = userRecordId.trim();
  const rid = roleRecordId.trim();
  if (!uid || !rid) return [];
  const all = await loadAll();
  const fnById = new Map((functions ?? []).map((f) => [f.id, f]));
  return all
    .filter((r) => r.user_id === uid && r.sop_role_id === rid)
    .filter((r) => isCurrent(r, fnById));
}

async function findExisting(
  userId: string,
  functionId: string,
  roleId: string
): Promise<SopProgress | null> {
  const all = await loadAll();
  return (
    all.find(
      (r) => r.user_id === userId && r.sop_function_id === functionId && r.sop_role_id === roleId
    ) ?? null
  );
}

export type MarkFunctionCompleteOptions = {
  contentVersion: number;
  quizScore?: number | null;
};

export async function markFunctionComplete(
  userRecordId: string,
  functionRecordId: string,
  roleRecordId: string,
  opts: MarkFunctionCompleteOptions
): Promise<SopProgress> {
  const uid = userRecordId.trim();
  const fid = functionRecordId.trim();
  const rid = roleRecordId.trim();
  if (!uid || !fid || !rid) throw new Error("user, function, and role are required");

  const now = new Date().toISOString();
  const version = Math.max(1, Math.floor(opts.contentVersion));
  const existing = await findExisting(uid, fid, rid);

  const fields: Record<string, unknown> = {
    completed_at: now,
    completed_version: version,
    updated_at: now,
  };
  if (opts.quizScore != null) fields.quiz_score = opts.quizScore;

  if (existing) {
    const updated = await sbUpdateByPublicId<Row>(TABLE, existing.id, fields);
    return mapRow(updated);
  }
  const [userUuids, fnUuids, roleUuids] = await Promise.all([
    requireSbUuids("users", [uid], "user"),
    requireSbUuids("sop_functions", [fid], "sop_function"),
    requireSbUuids("sop_roles", [rid], "sop_role"),
  ]);
  const row = await sbInsert<Row>(TABLE, {
    progress_id: genProgressId(),
    user: userUuids,
    sop_function: fnUuids,
    sop_role: roleUuids,
    created_at: now,
    ...fields,
  });
  return mapRow(row);
}

export async function unmarkFunctionComplete(
  userRecordId: string,
  functionRecordId: string,
  roleRecordId: string
): Promise<void> {
  const existing = await findExisting(
    userRecordId.trim(),
    functionRecordId.trim(),
    roleRecordId.trim()
  );
  if (existing) await sbDeleteByPublicId(TABLE, existing.id);
}

export type SopProgressByRole = {
  by_user: Map<string, SopProgress[]>;
  rows: SopProgress[];
};

export async function getProgressByRole(roleRecordId: string): Promise<SopProgressByRole> {
  const rid = roleRecordId.trim();
  if (!rid) return { by_user: new Map(), rows: [] };
  const all = await loadAll();
  const rows = all.filter((r) => r.sop_role_id === rid);
  const by_user = new Map<string, SopProgress[]>();
  for (const row of rows) {
    if (!row.user_id) continue;
    const list = by_user.get(row.user_id) ?? [];
    list.push(row);
    by_user.set(row.user_id, list);
  }
  return { by_user, rows };
}

export async function countProgressByRole(roleRecordId: string): Promise<number> {
  return (await getProgressByRole(roleRecordId)).rows.length;
}

export async function countProgressByFunction(functionRecordId: string): Promise<number> {
  const fid = functionRecordId.trim();
  if (!fid) return 0;
  const all = await loadAll();
  return all.filter((r) => r.sop_function_id === fid).length;
}

export async function deleteProgressByRole(roleRecordId: string): Promise<number> {
  const rid = roleRecordId.trim();
  if (!rid) return 0;
  const all = await loadAll();
  const matched = all.filter((r) => r.sop_role_id === rid);
  for (const r of matched) await sbDeleteByPublicId(TABLE, r.id);
  return matched.length;
}

export async function deleteProgressByFunction(functionRecordId: string): Promise<number> {
  const fid = functionRecordId.trim();
  if (!fid) return 0;
  const all = await loadAll();
  const matched = all.filter((r) => r.sop_function_id === fid);
  for (const r of matched) await sbDeleteByPublicId(TABLE, r.id);
  return matched.length;
}

export type SopProgressState = {
  current_rows: SopProgress[];
  completed_function_ids: string[];
  stale_function_ids: string[];
};

export async function getProgressStateForUser(
  userRecordId: string,
  roleRecordId: string,
  functions: SopFunction[]
): Promise<SopProgressState> {
  const uid = userRecordId.trim();
  const rid = roleRecordId.trim();
  if (!uid || !rid) {
    return { current_rows: [], completed_function_ids: [], stale_function_ids: [] };
  }
  const all = await loadAll();
  const fnById = new Map(functions.map((f) => [f.id, f]));
  const matched = all.filter((r) => r.user_id === uid && r.sop_role_id === rid);
  const stale_function_ids = matched
    .filter((p) => {
      const fn = fnById.get(p.sop_function_id);
      if (!fn || !p.completed_at) return false;
      return p.completed_version < fn.content_version;
    })
    .map((p) => p.sop_function_id);
  const current_rows = matched.filter((p) => isCurrent(p, fnById));
  const completed_function_ids = [
    ...new Set(current_rows.map((r) => r.sop_function_id).filter(Boolean)),
  ];
  return { current_rows, completed_function_ids, stale_function_ids };
}
