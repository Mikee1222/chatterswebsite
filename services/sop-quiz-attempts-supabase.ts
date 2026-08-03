/**
 * Supabase backend for services/sop-quiz-attempts.ts
 */
import {
  publicId, sbDeleteByPublicId, sbFirstLinkedAirtableId, sbInsert,
  sbSelectAll, requireSbUuids, type SbRow,
} from "@/lib/supabase-data";
import type { SopQuizAttempt } from "@/types";

const TABLE = "sop_quiz_attempts";
type Row = SbRow & {
  attempt_id?: string | null; user?: string[] | null; sop_function?: string[] | null;
  sop_role?: string[] | null; score?: number | null; passed?: boolean | null;
  wrong_count?: number | null; created_at?: string | null;
};

function genId() { return `sop_qatt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }
function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = Number.parseFloat(v); if (Number.isFinite(n)) return n; }
  return 0;
}

async function mapRow(row: Row): Promise<SopQuizAttempt> {
  return {
    id: publicId(row),
    attempt_id: String(row.attempt_id ?? ""),
    user_id: (await sbFirstLinkedAirtableId("users", row.user)) ?? "",
    sop_function_id: (await sbFirstLinkedAirtableId("sop_functions", row.sop_function)) ?? "",
    sop_role_id: (await sbFirstLinkedAirtableId("sop_roles", row.sop_role)) ?? "",
    score: num(row.score),
    passed: row.passed === true,
    wrong_count: num(row.wrong_count),
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

export async function recordQuizAttempt(
  userId: string, functionId: string, roleId: string, score: number, passed: boolean, wrongCount: number
): Promise<SopQuizAttempt> {
  const user = userId.trim(); const fnId = functionId.trim(); const role = roleId.trim();
  if (!user || !fnId || !role) throw new Error("user, function, and role are required");
  const now = new Date().toISOString();
  const [userUuids, fnUuids, roleUuids] = await Promise.all([
    requireSbUuids("users", [user], "user"),
    requireSbUuids("sop_functions", [fnId], "sop_function"),
    requireSbUuids("sop_roles", [role], "sop_role"),
  ]);
  const row = await sbInsert<Row>(TABLE, {
    attempt_id: genId(),
    user: userUuids,
    sop_function: fnUuids,
    sop_role: roleUuids,
    score: Math.max(0, Math.min(100, Math.round(score))),
    passed,
    wrong_count: Math.max(0, Math.floor(wrongCount)),
    created_at: now,
  });
  return mapRow(row);
}

export async function getAttemptsByFunction(functionRecordId: string): Promise<SopQuizAttempt[]> {
  const functionId = functionRecordId.trim();
  if (!functionId) return [];
  const mapped = await Promise.all((await sbSelectAll<Row>(TABLE)).map(mapRow));
  return mapped.filter((r) => r.sop_function_id === functionId)
    .sort((a,b) => String(b.created_at??"").localeCompare(String(a.created_at??"")));
}

export async function getAttemptsByRole(roleRecordId: string): Promise<SopQuizAttempt[]> {
  const roleId = roleRecordId.trim();
  if (!roleId) return [];
  const mapped = await Promise.all((await sbSelectAll<Row>(TABLE)).map(mapRow));
  return mapped.filter((r) => r.sop_role_id === roleId)
    .sort((a,b) => String(b.created_at??"").localeCompare(String(a.created_at??"")));
}

export async function deleteQuizAttempt(recordId: string): Promise<void> {
  const id = recordId.trim();
  if (!id) return;
  await sbDeleteByPublicId(TABLE, id);
}
