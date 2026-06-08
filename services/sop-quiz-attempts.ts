import {
  listAllRecords,
  createRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, toLinkedRecordPayload } from "@/lib/airtable-linked";
import type { SopFunction, SopQuizFunctionInsight, SopQuizAttempt } from "@/types";

export const SOP_QUIZ_ATTEMPTS_TABLE = "sop_quiz_attempts";

type AttemptFields = {
  attempt_id?: string;
  user?: string | string[];
  sop_function?: string | string[];
  sop_role?: string | string[];
  score?: number | string;
  passed?: boolean;
  wrong_count?: number | string;
  created_at?: string;
};

function genAttemptId(): string {
  return `sop_qatt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function coerceNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function mapAttemptRecord(rec: AirtableRecord<AttemptFields>): SopQuizAttempt {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    attempt_id: String(f.attempt_id ?? ""),
    user_id: firstLinkedId(f.user) ?? "",
    sop_function_id: firstLinkedId(f.sop_function) ?? "",
    sop_role_id: firstLinkedId(f.sop_role) ?? "",
    score: coerceNumber(f.score),
    passed: f.passed === true,
    wrong_count: coerceNumber(f.wrong_count),
    created_at: f.created_at != null ? String(f.created_at) : undefined,
  };
}

/** Record a quiz submission attempt (pass or fail). */
export async function recordQuizAttempt(
  userId: string,
  functionId: string,
  roleId: string,
  score: number,
  passed: boolean,
  wrongCount: number
): Promise<SopQuizAttempt> {
  const user = userId.trim();
  const fnId = functionId.trim();
  const role = roleId.trim();
  if (!user || !fnId || !role) {
    throw new Error("user, function, and role are required");
  }

  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    attempt_id: genAttemptId(),
    user: toLinkedRecordPayload(user),
    sop_function: toLinkedRecordPayload(fnId),
    sop_role: toLinkedRecordPayload(role),
    score: Math.max(0, Math.min(100, Math.round(score))),
    passed,
    wrong_count: Math.max(0, Math.floor(wrongCount)),
    created_at: now,
  };

  const rec = await createRecord<AttemptFields>(SOP_QUIZ_ATTEMPTS_TABLE, fields);
  return mapAttemptRecord(rec);
}

/** All attempts for a function (client-side linked filter). */
export async function getAttemptsByFunction(functionRecordId: string): Promise<SopQuizAttempt[]> {
  const functionId = functionRecordId.trim();
  if (!functionId) return [];

  const rows = await listAllRecords<AttemptFields>(SOP_QUIZ_ATTEMPTS_TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
    _caller: "getAttemptsByFunction",
  });

  return rows
    .filter((rec) => firstLinkedId(rec.fields?.sop_function) === functionId)
    .map(mapAttemptRecord);
}

/** All attempts for a role (client-side linked filter). */
export async function getAttemptsByRole(roleRecordId: string): Promise<SopQuizAttempt[]> {
  const roleId = roleRecordId.trim();
  if (!roleId) return [];

  const rows = await listAllRecords<AttemptFields>(SOP_QUIZ_ATTEMPTS_TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
    _caller: "getAttemptsByRole",
  });

  return rows
    .filter((rec) => firstLinkedId(rec.fields?.sop_role) === roleId)
    .map(mapAttemptRecord);
}

export async function deleteQuizAttempt(recordId: string): Promise<void> {
  const id = recordId.trim();
  if (!id) return;
  await deleteRecord(SOP_QUIZ_ATTEMPTS_TABLE, id);
}

const DIFFICULT_PASS_RATE_THRESHOLD = 70;
const DIFFICULT_MULTI_ATTEMPT_THRESHOLD = 2;

/** Per-function quiz analytics for admin (role-scoped attempts + active functions). */
export function buildQuizInsightsByFunction(
  attempts: SopQuizAttempt[],
  functions: SopFunction[]
): SopQuizFunctionInsight[] {
  const activeFns = [...functions]
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const byFunction = new Map<string, SopQuizAttempt[]>();
  for (const attempt of attempts) {
    const fnId = attempt.sop_function_id;
    if (!fnId) continue;
    const list = byFunction.get(fnId) ?? [];
    list.push(attempt);
    byFunction.set(fnId, list);
  }

  const insights: SopQuizFunctionInsight[] = activeFns.map((fn) => {
    const fnAttempts = byFunction.get(fn.id) ?? [];
    const total = fnAttempts.length;
    const avg_score =
      total > 0
        ? Math.round(fnAttempts.reduce((sum, a) => sum + a.score, 0) / total)
        : 0;
    const passedCount = fnAttempts.filter((a) => a.passed).length;
    const pass_rate = total > 0 ? Math.round((passedCount / total) * 100) : 0;

    const attemptsByUser = new Map<string, number>();
    for (const a of fnAttempts) {
      if (!a.user_id) continue;
      attemptsByUser.set(a.user_id, (attemptsByUser.get(a.user_id) ?? 0) + 1);
    }
    const members_multi_attempt = [...attemptsByUser.values()].filter((c) => c > 1).length;

    const is_difficult =
      (total > 0 && pass_rate < DIFFICULT_PASS_RATE_THRESHOLD) ||
      members_multi_attempt >= DIFFICULT_MULTI_ATTEMPT_THRESHOLD;

    return {
      function_id: fn.id,
      function_name: fn.name,
      total_attempts: total,
      avg_score,
      pass_rate,
      members_multi_attempt,
      is_difficult,
    };
  });

  return insights.sort(
    (a, b) =>
      Number(b.is_difficult) - Number(a.is_difficult) ||
      a.pass_rate - b.pass_rate ||
      b.total_attempts - a.total_attempts ||
      a.function_name.localeCompare(b.function_name)
  );
}
