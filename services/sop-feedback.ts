import {
  listAllRecords,
  createRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import { firstLinkedId, toLinkedRecordPayload } from "@/lib/airtable-linked";
import type { SopFeedback, SopFeedbackHelpful, SopFeedbackSummary } from "@/types";

export const SOP_FEEDBACK_TABLE = "sop_feedback";

const HELPFUL_VALUES: readonly SopFeedbackHelpful[] = ["yes", "no"];

type FeedbackFields = {
  feedback_id?: string;
  user?: string | string[];
  sop_function?: string | string[];
  sop_role?: string | string[];
  helpful?: string;
  comment?: string;
  created_at?: string;
};

function genFeedbackId(): string {
  return `sop_fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function coerceHelpful(v: unknown): SopFeedbackHelpful {
  const s = String(v ?? "").trim() as SopFeedbackHelpful;
  return HELPFUL_VALUES.includes(s) ? s : "no";
}

function mapFeedbackRecord(rec: AirtableRecord<FeedbackFields>): SopFeedback {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    feedback_id: String(f.feedback_id ?? ""),
    user_id: firstLinkedId(f.user) ?? "",
    sop_function_id: firstLinkedId(f.sop_function) ?? "",
    sop_role_id: firstLinkedId(f.sop_role) ?? "",
    helpful: coerceHelpful(f.helpful),
    comment: String(f.comment ?? "").trim(),
    created_at: f.created_at != null ? String(f.created_at) : undefined,
  };
}

function matchesUserFunctionRole(
  rec: AirtableRecord<FeedbackFields>,
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

export type CreateSopFeedbackInput = {
  user_id: string;
  sop_function_id: string;
  sop_role_id: string;
  helpful: SopFeedbackHelpful;
  comment?: string;
};

/** Create member feedback for a function (one row per user + function + role). */
export async function createSopFeedback(input: CreateSopFeedbackInput): Promise<SopFeedback> {
  if (isSupabaseBackend()) return (await import("./sop-feedback-supabase")).createSopFeedback(input);
  const userId = input.user_id.trim();
  const functionId = input.sop_function_id.trim();
  const roleId = input.sop_role_id.trim();
  if (!userId || !functionId || !roleId) {
    throw new Error("user, function, and role are required");
  }
  if (!HELPFUL_VALUES.includes(input.helpful)) {
    throw new Error("helpful must be yes or no");
  }

  const rows = await listAllRecords<FeedbackFields>(SOP_FEEDBACK_TABLE, {
    _caller: "createSopFeedback-dedupe",
  });
  const existing = rows.find((rec) =>
    matchesUserFunctionRole(rec, userId, functionId, roleId)
  );
  if (existing) {
    return mapFeedbackRecord(existing);
  }

  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    feedback_id: genFeedbackId(),
    user: toLinkedRecordPayload(userId),
    sop_function: toLinkedRecordPayload(functionId),
    sop_role: toLinkedRecordPayload(roleId),
    helpful: input.helpful,
    comment: (input.comment ?? "").trim(),
    created_at: now,
  };

  const rec = await createRecord<FeedbackFields>(SOP_FEEDBACK_TABLE, fields);
  return mapFeedbackRecord(rec);
}

/** All feedback rows for functions under a role (admin). */
export async function getFeedbackByRole(roleRecordId: string): Promise<SopFeedback[]> {
  if (isSupabaseBackend()) return (await import("./sop-feedback-supabase")).getFeedbackByRole(roleRecordId);
  const roleId = roleRecordId.trim();
  if (!roleId) return [];

  const rows = await listAllRecords<FeedbackFields>(SOP_FEEDBACK_TABLE, {
    _caller: "getFeedbackByRole",
  });

  return rows
    .filter((rec) => firstLinkedId(rec.fields?.sop_role) === roleId)
    .map(mapFeedbackRecord);
}

export function buildFeedbackSummaries(
  rows: SopFeedback[],
  functionIds: string[]
): SopFeedbackSummary[] {
  const byFunction = new Map<string, SopFeedback[]>();
  for (const row of rows) {
    if (!row.sop_function_id) continue;
    const list = byFunction.get(row.sop_function_id) ?? [];
    list.push(row);
    byFunction.set(row.sop_function_id, list);
  }

  return functionIds.map((functionId) => {
    const items = byFunction.get(functionId) ?? [];
    const helpful_yes = items.filter((r) => r.helpful === "yes").length;
    const total = items.length;
    const helpful_pct = total > 0 ? Math.round((helpful_yes / total) * 100) : 0;
    const comments = items
      .filter((r) => r.comment.trim())
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .map((r) => ({
        comment: r.comment,
        helpful: r.helpful,
        created_at: r.created_at ?? "",
      }));

    return {
      function_id: functionId,
      total,
      helpful_yes,
      helpful_pct,
      comments,
    };
  });
}

export async function countFeedbackByRole(roleRecordId: string): Promise<number> {
  if (isSupabaseBackend()) return (await import("./sop-feedback-supabase")).countFeedbackByRole(roleRecordId);
  const rows = await getFeedbackByRole(roleRecordId);
  return rows.length;
}

export async function countFeedbackByFunction(functionRecordId: string): Promise<number> {
  if (isSupabaseBackend()) return (await import("./sop-feedback-supabase")).countFeedbackByFunction(functionRecordId);
  const functionId = functionRecordId.trim();
  if (!functionId) return 0;
  const rows = await listAllRecords<FeedbackFields>(SOP_FEEDBACK_TABLE, {
    _caller: "countFeedbackByFunction",
  });
  return rows.filter((rec) => firstLinkedId(rec.fields?.sop_function) === functionId).length;
}

export async function deleteFeedbackByRole(roleRecordId: string): Promise<number> {
  if (isSupabaseBackend()) return (await import("./sop-feedback-supabase")).deleteFeedbackByRole(roleRecordId);
  const roleId = roleRecordId.trim();
  if (!roleId) return 0;
  const rows = await listAllRecords<FeedbackFields>(SOP_FEEDBACK_TABLE, {
    _caller: "deleteFeedbackByRole",
  });
  const matched = rows.filter((rec) => firstLinkedId(rec.fields?.sop_role) === roleId);
  for (const rec of matched) {
    await deleteRecord(SOP_FEEDBACK_TABLE, rec.id);
  }
  return matched.length;
}

export async function deleteFeedbackByFunction(functionRecordId: string): Promise<number> {
  if (isSupabaseBackend()) return (await import("./sop-feedback-supabase")).deleteFeedbackByFunction(functionRecordId);
  const functionId = functionRecordId.trim();
  if (!functionId) return 0;
  const rows = await listAllRecords<FeedbackFields>(SOP_FEEDBACK_TABLE, {
    _caller: "deleteFeedbackByFunction",
  });
  const matched = rows.filter((rec) => firstLinkedId(rec.fields?.sop_function) === functionId);
  for (const rec of matched) {
    await deleteRecord(SOP_FEEDBACK_TABLE, rec.id);
  }
  return matched.length;
}
