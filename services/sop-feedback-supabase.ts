/**
 * Supabase backend for services/sop-feedback.ts
 */
import {
  firstMappedLinkedId,
  publicId, sbDeleteByPublicId, sbInsert,
  sbResolveUuidToAirtableMap, sbSelectAll, requireSbUuids, type SbRow,
} from "@/lib/supabase-data";
import type { SopFeedback, SopFeedbackHelpful } from "@/types";
import type { CreateSopFeedbackInput } from "./sop-feedback";

const TABLE = "sop_feedback";
const HELPFUL_VALUES: readonly SopFeedbackHelpful[] = ["yes", "no"];

type Row = SbRow & {
  feedback_id?: string | null;
  /** Postgres column is user_ref (Airtable field "user" is reserved in PG). */
  user_ref?: string[] | null;
  sop_function?: string[] | null;
  sop_role?: string[] | null;
  helpful?: string | null;
  comment?: string | null;
  created_at?: string | null;
};

function genId() { return `sop_fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }
function coerceHelpful(v: unknown): SopFeedbackHelpful {
  const s = String(v ?? "").trim() as SopFeedbackHelpful;
  return HELPFUL_VALUES.includes(s) ? s : "no";
}

function mapRowSync(
  row: Row,
  userAt: Map<string, string>,
  fnAt: Map<string, string>,
  roleAt: Map<string, string>
): SopFeedback {
  return {
    id: publicId(row),
    feedback_id: String(row.feedback_id ?? ""),
    user_id: firstMappedLinkedId(row.user_ref, userAt),
    sop_function_id: firstMappedLinkedId(row.sop_function, fnAt),
    sop_role_id: firstMappedLinkedId(row.sop_role, roleAt),
    helpful: coerceHelpful(row.helpful),
    comment: String(row.comment ?? "").trim(),
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

async function mapRows(rows: Row[]): Promise<SopFeedback[]> {
  if (!rows.length) return [];
  const [userAt, fnAt, roleAt] = await Promise.all([
    sbResolveUuidToAirtableMap("users", rows.map((r) => r.user_ref)),
    sbResolveUuidToAirtableMap("sop_functions", rows.map((r) => r.sop_function)),
    sbResolveUuidToAirtableMap("sop_roles", rows.map((r) => r.sop_role)),
  ]);
  return rows.map((r) => mapRowSync(r, userAt, fnAt, roleAt));
}

async function mapRow(row: Row): Promise<SopFeedback> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function createSopFeedback(input: CreateSopFeedbackInput): Promise<SopFeedback> {
  const userId = input.user_id.trim();
  const functionId = input.sop_function_id.trim();
  const roleId = input.sop_role_id.trim();
  if (!userId || !functionId || !roleId) throw new Error("user, function, and role are required");
  if (!HELPFUL_VALUES.includes(input.helpful)) throw new Error("helpful must be yes or no");
  const all = await sbSelectAll<Row>(TABLE);
  const mapped = await mapRows(all);
  const existing = mapped.find((r) => r.user_id === userId && r.sop_function_id === functionId && r.sop_role_id === roleId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const [user_ref, sop_function, sop_role] = await Promise.all([
    requireSbUuids("users", [userId], "user"),
    requireSbUuids("sop_functions", [functionId], "sop_function"),
    requireSbUuids("sop_roles", [roleId], "sop_role"),
  ]);
  const row = await sbInsert<Row>(TABLE, {
    feedback_id: genId(),
    user_ref,
    sop_function,
    sop_role,
    helpful: input.helpful,
    comment: (input.comment ?? "").trim(),
    created_at: now,
  });
  return mapRow(row);
}

export async function getFeedbackByRole(roleRecordId: string): Promise<SopFeedback[]> {
  const roleId = roleRecordId.trim();
  if (!roleId) return [];
  const mapped = await mapRows(await sbSelectAll<Row>(TABLE));
  return mapped.filter((r) => r.sop_role_id === roleId);
}

export async function countFeedbackByRole(roleRecordId: string): Promise<number> {
  return (await getFeedbackByRole(roleRecordId)).length;
}

export async function countFeedbackByFunction(functionRecordId: string): Promise<number> {
  const functionId = functionRecordId.trim();
  if (!functionId) return 0;
  const mapped = await mapRows(await sbSelectAll<Row>(TABLE));
  return mapped.filter((r) => r.sop_function_id === functionId).length;
}

export async function deleteFeedbackByRole(roleRecordId: string): Promise<number> {
  const rows = await getFeedbackByRole(roleRecordId);
  for (const r of rows) await sbDeleteByPublicId(TABLE, r.id);
  return rows.length;
}

export async function deleteFeedbackByFunction(functionRecordId: string): Promise<number> {
  const functionId = functionRecordId.trim();
  if (!functionId) return 0;
  const mapped = await mapRows(await sbSelectAll<Row>(TABLE));
  const matched = mapped.filter((r) => r.sop_function_id === functionId);
  for (const r of matched) await sbDeleteByPublicId(TABLE, r.id);
  return matched.length;
}
