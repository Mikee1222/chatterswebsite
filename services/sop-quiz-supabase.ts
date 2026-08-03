/**
 * Supabase backend for services/sop-quiz.ts
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbSelectAll,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type { SopQuizCorrectOption, SopQuizQuestion } from "@/types";

const TABLE = "sop_quiz_questions";
const CORRECT_OPTIONS: readonly SopQuizCorrectOption[] = ["a", "b", "c", "d"];

type Row = SbRow & {
  question_id?: string | null;
  sop_function?: string[] | null;
  question?: string | null;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_option?: string | null;
  sort_order?: number | string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

function genQuestionId(): string {
  return `sop_quiz_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function coerceSortOrder(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function coerceCorrectOption(v: unknown): SopQuizCorrectOption {
  const s = String(v ?? "").trim().toLowerCase() as SopQuizCorrectOption;
  return CORRECT_OPTIONS.includes(s) ? s : "a";
}

async function mapRow(row: Row): Promise<SopQuizQuestion> {
  return {
    id: publicId(row),
    question_id: String(row.question_id ?? ""),
    sop_function_id: (await sbFirstLinkedAirtableId("sop_functions", row.sop_function)) ?? "",
    question: String(row.question ?? ""),
    option_a: String(row.option_a ?? ""),
    option_b: String(row.option_b ?? ""),
    option_c: String(row.option_c ?? ""),
    option_d: String(row.option_d ?? ""),
    correct_option: coerceCorrectOption(row.correct_option),
    sort_order: coerceSortOrder(row.sort_order),
    is_active: row.is_active !== false,
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

async function listAllByFunction(
  functionRecordId: string,
  onlyActive: boolean
): Promise<SopQuizQuestion[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await Promise.all(rows.map(mapRow));
  return mapped
    .filter((r) => (onlyActive ? r.is_active : true))
    .filter((r) => r.sop_function_id === functionRecordId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getQuestionsByFunction(functionRecordId: string): Promise<SopQuizQuestion[]> {
  const id = functionRecordId.trim();
  if (!id) return [];
  return listAllByFunction(id, true);
}

export async function getQuestionsByFunctionAdmin(
  functionRecordId: string
): Promise<SopQuizQuestion[]> {
  const id = functionRecordId.trim();
  if (!id) return [];
  return listAllByFunction(id, false);
}

export type QuizQuestionWrite = {
  sop_function_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: SopQuizCorrectOption;
  sort_order?: number;
  is_active?: boolean;
};

export async function createQuizQuestion(data: QuizQuestionWrite): Promise<SopQuizQuestion> {
  const existing = await getQuestionsByFunctionAdmin(data.sop_function_id);
  const maxSort = existing.reduce((m, q) => Math.max(m, q.sort_order), 0);
  const now = new Date().toISOString();
  const uuids = await sbUuidsForAirtableIds("sop_functions", [data.sop_function_id]);
  const row = await sbInsert<Row>(TABLE, {
    question_id: genQuestionId(),
    sop_function: uuids,
    question: data.question,
    option_a: data.option_a,
    option_b: data.option_b,
    option_c: data.option_c,
    option_d: data.option_d,
    correct_option: data.correct_option,
    sort_order: data.sort_order ?? maxSort + 1,
    is_active: data.is_active ?? true,
    created_at: now,
  });
  return mapRow(row);
}

export async function updateQuizQuestion(
  id: string,
  data: Partial<QuizQuestionWrite>
): Promise<SopQuizQuestion> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.question !== undefined) patch.question = data.question;
  if (data.option_a !== undefined) patch.option_a = data.option_a;
  if (data.option_b !== undefined) patch.option_b = data.option_b;
  if (data.option_c !== undefined) patch.option_c = data.option_c;
  if (data.option_d !== undefined) patch.option_d = data.option_d;
  if (data.correct_option !== undefined) patch.correct_option = data.correct_option;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  if (data.is_active !== undefined) patch.is_active = data.is_active;
  if (data.sop_function_id !== undefined) {
    patch.sop_function = await sbUuidsForAirtableIds("sop_functions", [data.sop_function_id]);
  }
  const updated = await sbUpdateByPublicId<Row>(TABLE, id, patch);
  return mapRow(updated);
}

export async function deleteQuizQuestion(id: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, id);
}

export async function countQuizQuestionsByFunction(functionRecordId: string): Promise<number> {
  return (await getQuestionsByFunctionAdmin(functionRecordId)).length;
}

export async function deleteQuizQuestionsByFunction(functionRecordId: string): Promise<number> {
  const rows = await getQuestionsByFunctionAdmin(functionRecordId);
  for (const q of rows) await sbDeleteByPublicId(TABLE, q.id);
  return rows.length;
}

export async function reorderQuizQuestions(orderedIds: string[]): Promise<void> {
  const sb = getSupabaseServiceClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const col = id.startsWith("rec") ? "airtable_id" : "id";
    await sb.from(TABLE).update({ sort_order: i + 1, updated_at: new Date().toISOString() }).eq(col, id);
  }
}

export type QuizAnswerInput = {
  question_id: string;
  selected_option: SopQuizCorrectOption;
};

export type QuizValidationResult = {
  passed: boolean;
  score: number;
  total: number;
  wrong_question_ids: string[];
};

export async function validateQuizAnswers(
  functionRecordId: string,
  answers: QuizAnswerInput[]
): Promise<QuizValidationResult> {
  const questions = await getQuestionsByFunction(functionRecordId);
  const total = questions.length;
  if (total === 0) {
    return { passed: true, score: 100, total: 0, wrong_question_ids: [] };
  }
  const answerByQuestion = new Map(
    answers.map((a) => [a.question_id.trim(), a.selected_option])
  );
  const wrong_question_ids: string[] = [];
  let correct = 0;
  for (const q of questions) {
    const selected = answerByQuestion.get(q.id);
    if (selected === q.correct_option) correct += 1;
    else wrong_question_ids.push(q.id);
  }
  const score = Math.round((correct / total) * 100);
  const passed = wrong_question_ids.length === 0 && answerByQuestion.size === total;
  return { passed, score, total, wrong_question_ids };
}
