/**
 * Supabase backend for services/sop-feedback.ts
 */
import {
  publicId, sbDeleteByPublicId, sbFirstLinkedAirtableId, sbInsert,
  sbSelectAll, sbUuidsForAirtableIds, type SbRow,
} from "@/lib/supabase-data";
import type { SopFeedback, SopFeedbackHelpful } from "@/types";
import type { CreateSopFeedbackInput } from "./sop-feedback";

const TABLE = "sop_feedback";
const HELPFUL_VALUES: readonly SopFeedbackHelpful[] = ["yes", "no"];

type Row = SbRow & {
  feedback_id?: string | null; user?: string[] | null; sop_function?: string[] | null;
  sop_role?: string[] | null; helpful?: string | null; comment?: string | null; created_at?: string | null;
};

function genId() { return `sop_fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }
function coerceHelpful(v: unknown): SopFeedbackHelpful {
  const s = String(v ?? "").trim() as SopFeedbackHelpful;
  return HELPFUL_VALUES.includes(s) ? s : "no";
}

async function mapRow(row: Row): Promise<SopFeedback> {
  return {
    id: publicId(row),
    feedback_id: String(row.feedback_id ?? ""),
    user_id: (await sbFirstLinkedAirtableId("users", row.user)) ?? "",
    sop_function_id: (await sbFirstLinkedAirtableId("sop_functions", row.sop_function)) ?? "",
    sop_role_id: (await sbFirstLinkedAirtableId("sop_roles", row.sop_role)) ?? "",
    helpful: coerceHelpful(row.helpful),
    comment: String(row.comment ?? "").trim(),
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

export async function createSopFeedback(input: CreateSopFeedbackInput): Promise<SopFeedback> {
  const userId = input.user_id.trim();
  const functionId = input.sop_function_id.trim();
  const roleId = input.sop_role_id.trim();
  if (!userId || !functionId || !roleId) throw new Error("user, function, and role are required");
  if (!HELPFUL_VALUES.includes(input.helpful)) throw new Error("helpful must be yes or no");
  const all = await sbSelectAll<Row>(TABLE);
  const mapped = await Promise.all(all.map(mapRow));
  const existing = mapped.find((r) => r.user_id === userId && r.sop_function_id === functionId && r.sop_role_id === roleId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const row = await sbInsert<Row>(TABLE, {
    feedback_id: genId(),
    user: await sbUuidsForAirtableIds("users", [userId]),
    sop_function: await sbUuidsForAirtableIds("sop_functions", [functionId]),
    sop_role: await sbUuidsForAirtableIds("sop_roles", [roleId]),
    helpful: input.helpful,
    comment: (input.comment ?? "").trim(),
    created_at: now,
  });
  return mapRow(row);
}

export async function getFeedbackByRole(roleRecordId: string): Promise<SopFeedback[]> {
  const roleId = roleRecordId.trim();
  if (!roleId) return [];
  const mapped = await Promise.all((await sbSelectAll<Row>(TABLE)).map(mapRow));
  return mapped.filter((r) => r.sop_role_id === roleId);
}

export async function countFeedbackByRole(roleRecordId: string): Promise<number> {
  return (await getFeedbackByRole(roleRecordId)).length;
}

export async function countFeedbackByFunction(functionRecordId: string): Promise<number> {
  const functionId = functionRecordId.trim();
  if (!functionId) return 0;
  const mapped = await Promise.all((await sbSelectAll<Row>(TABLE)).map(mapRow));
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
  const mapped = await Promise.all((await sbSelectAll<Row>(TABLE)).map(mapRow));
  const matched = mapped.filter((r) => r.sop_function_id === functionId);
  for (const r of matched) await sbDeleteByPublicId(TABLE, r.id);
  return matched.length;
}
