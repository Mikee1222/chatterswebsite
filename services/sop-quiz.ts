import {
  listAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  batchUpdateRecords,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, toLinkedRecordPayload } from "@/lib/airtable-linked";
import type { SopQuizCorrectOption, SopQuizQuestion } from "@/types";

export const SOP_QUIZ_QUESTIONS_TABLE = "sop_quiz_questions";

const CORRECT_OPTIONS: readonly SopQuizCorrectOption[] = ["a", "b", "c", "d"];
const SORT = [{ field: "sort_order", direction: "asc" as const }];

type QuestionFields = {
  question_id?: string;
  sop_function?: string | string[];
  question?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: string;
  sort_order?: number | string;
  is_active?: boolean;
  created_at?: string;
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

function mapQuestionRecord(rec: AirtableRecord<QuestionFields>): SopQuizQuestion {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    question_id: String(f.question_id ?? ""),
    sop_function_id: firstLinkedId(f.sop_function) ?? "",
    question: String(f.question ?? ""),
    option_a: String(f.option_a ?? ""),
    option_b: String(f.option_b ?? ""),
    option_c: String(f.option_c ?? ""),
    option_d: String(f.option_d ?? ""),
    correct_option: coerceCorrectOption(f.correct_option),
    sort_order: coerceSortOrder(f.sort_order),
    is_active: f.is_active !== false,
    created_at: f.created_at != null ? String(f.created_at) : undefined,
  };
}

/** Active quiz questions for a function (client-side linked filter). */
export async function getQuestionsByFunction(functionRecordId: string): Promise<SopQuizQuestion[]> {
  const functionId = functionRecordId.trim();
  if (!functionId) return [];

  const rows = await listAllRecords<QuestionFields>(SOP_QUIZ_QUESTIONS_TABLE, {
    filterByFormula: "{is_active}",
    sort: SORT,
    _caller: "getQuestionsByFunction",
  });

  return rows
    .filter((rec) => firstLinkedId(rec.fields?.sop_function) === functionId)
    .map(mapQuestionRecord);
}

/** All questions for admin (includes inactive). */
export async function getQuestionsByFunctionAdmin(
  functionRecordId: string
): Promise<SopQuizQuestion[]> {
  const functionId = functionRecordId.trim();
  if (!functionId) return [];

  const rows = await listAllRecords<QuestionFields>(SOP_QUIZ_QUESTIONS_TABLE, {
    sort: SORT,
    _caller: "getQuestionsByFunctionAdmin",
  });

  return rows
    .filter((rec) => firstLinkedId(rec.fields?.sop_function) === functionId)
    .map(mapQuestionRecord);
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

  const fields: Record<string, unknown> = {
    question_id: genQuestionId(),
    sop_function: toLinkedRecordPayload(data.sop_function_id),
    question: data.question,
    option_a: data.option_a,
    option_b: data.option_b,
    option_c: data.option_c,
    option_d: data.option_d,
    correct_option: data.correct_option,
    sort_order: data.sort_order ?? maxSort + 1,
    is_active: data.is_active ?? true,
    created_at: now,
  };

  const rec = await createRecord<QuestionFields>(SOP_QUIZ_QUESTIONS_TABLE, fields);
  return mapQuestionRecord(rec);
}

export async function updateQuizQuestion(
  id: string,
  data: Partial<QuizQuestionWrite>
): Promise<SopQuizQuestion> {
  const fields: Record<string, unknown> = {};
  if (data.question !== undefined) fields.question = data.question;
  if (data.option_a !== undefined) fields.option_a = data.option_a;
  if (data.option_b !== undefined) fields.option_b = data.option_b;
  if (data.option_c !== undefined) fields.option_c = data.option_c;
  if (data.option_d !== undefined) fields.option_d = data.option_d;
  if (data.correct_option !== undefined) fields.correct_option = data.correct_option;
  if (data.sort_order !== undefined) fields.sort_order = data.sort_order;
  if (data.is_active !== undefined) fields.is_active = data.is_active;
  if (data.sop_function_id !== undefined) {
    fields.sop_function = toLinkedRecordPayload(data.sop_function_id);
  }

  const rec = await updateRecord<QuestionFields>(SOP_QUIZ_QUESTIONS_TABLE, id, fields);
  return mapQuestionRecord(rec);
}

export async function deleteQuizQuestion(id: string): Promise<void> {
  await deleteRecord(SOP_QUIZ_QUESTIONS_TABLE, id);
}

export async function reorderQuizQuestions(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((recordId, index) => ({
    id: recordId,
    fields: { sort_order: index + 1 },
  }));
  await batchUpdateRecords(SOP_QUIZ_QUESTIONS_TABLE, updates);
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

/** Server-side answer validation against stored correct options. */
export async function validateQuizAnswers(
  functionRecordId: string,
  answers: QuizAnswerInput[]
): Promise<QuizValidationResult> {
  const questions = await getQuestionsByFunction(functionRecordId);
  const total = questions.length;

  if (total === 0) {
    return { passed: true, score: 100, total: 0, wrong_question_ids: [] };
  }

  const answerByQuestion = new Map(answers.map((a) => [a.question_id.trim(), a.selected_option]));
  const wrong_question_ids: string[] = [];
  let correct = 0;

  for (const q of questions) {
    const key = q.id;
    const selected = answerByQuestion.get(key);
    if (selected === q.correct_option) {
      correct += 1;
    } else {
      wrong_question_ids.push(key);
    }
  }

  const score = Math.round((correct / total) * 100);
  const passed = wrong_question_ids.length === 0 && answerByQuestion.size === total;

  return { passed, score, total, wrong_question_ids };
}
