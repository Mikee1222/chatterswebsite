/**
 * Recruitment application forms — Supabase service-role data access.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  CHOICE_QUESTION_TYPES,
  isApplicationFormStatus,
  isApplicationQuestionType,
  isApplicationResponseStatus,
  parseOptionsJson,
  parsePipelineConfig,
  slugifyFormTitle,
  emptyFunnel,
  type ApplicationFormAnalytics,
  type ApplicationFormAnswer,
  type ApplicationFormFunnel,
  type ApplicationFormListItem,
  type ApplicationFormQuestion,
  type ApplicationFormRecord,
  type ApplicationFormResponse,
  type ApplicationFormResponseWithAnswers,
  type ApplicationFormsOverview,
  type ApplicationFormStatus,
  type ApplicationFormWithQuestions,
  type ApplicationQuestionType,
  type ApplicationRecentActivityItem,
  type ApplicationResponseStatus,
  type PipelineStepConfig,
} from "@/lib/application-forms-types";
import {
  getScreeningByResponseIds,
  linkSessionToResponse,
} from "@/services/application-screening";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";
import { isPipelineLanguage } from "@/lib/application-pipeline-i18n";
import { parseAutoFlags } from "@/lib/application-candidate-flags";

type FormRow = {
  id: string;
  title: string;
  description: string | null;
  description_el?: string | null;
  footer_text?: string | null;
  footer_text_el?: string | null;
  slug: string;
  status: string;
  pipeline_config?: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type QuestionRow = {
  id: string;
  form_id: string;
  question_text: string;
  question_text_el?: string | null;
  question_type: string;
  options: unknown;
  options_el?: unknown;
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type ResponseRow = {
  id: string;
  form_id: string;
  submitted_at: string;
  respondent_ip: string | null;
  status: string;
  internal_notes: string | null;
  preferred_language?: string | null;
  ai_summary?: string | null;
  auto_flags?: unknown;
  generated_username?: string | null;
  encrypted_hire_password?: string | null;
  hire_credentials_created_at?: string | null;
  created_at: string;
  updated_at: string;
};

type AnswerRow = {
  id: string;
  response_id: string;
  question_id: string;
  answer_text: string | null;
  answer_options: unknown;
  created_at: string;
};

function mapForm(row: FormRow): ApplicationFormRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    description_el: row.description_el ?? "",
    footer_text: row.footer_text ?? "",
    footer_text_el: row.footer_text_el ?? "",
    slug: row.slug,
    status: isApplicationFormStatus(row.status) ? row.status : "draft",
    pipeline_config: parsePipelineConfig(row.pipeline_config),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapQuestion(row: QuestionRow): ApplicationFormQuestion {
  return {
    id: row.id,
    form_id: row.form_id,
    question_text: row.question_text,
    question_text_el: row.question_text_el ?? "",
    question_type: isApplicationQuestionType(row.question_type)
      ? row.question_type
      : "short_text",
    options: parseOptionsJson(row.options),
    options_el: parseOptionsJson(row.options_el),
    is_required: !!row.is_required,
    display_order: row.display_order ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapResponse(row: ResponseRow): ApplicationFormResponse {
  return {
    id: row.id,
    form_id: row.form_id,
    submitted_at: row.submitted_at,
    respondent_ip: row.respondent_ip,
    status: isApplicationResponseStatus(row.status) ? row.status : "new",
    internal_notes: row.internal_notes,
    preferred_language: isPipelineLanguage(row.preferred_language)
      ? row.preferred_language
      : null,
    ai_summary: row.ai_summary?.trim() ? row.ai_summary.trim() : null,
    auto_flags: parseAutoFlags(row.auto_flags),
    generated_username: row.generated_username?.trim() || null,
    has_hire_password: Boolean(row.encrypted_hire_password?.trim()),
    hire_credentials_created_at: row.hire_credentials_created_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapAnswer(row: AnswerRow): ApplicationFormAnswer {
  return {
    id: row.id,
    response_id: row.response_id,
    question_id: row.question_id,
    answer_text: row.answer_text,
    answer_options: parseOptionsJson(row.answer_options),
    created_at: row.created_at,
  };
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  const sb = getSupabaseServiceClient();
  let candidate = base;
  let n = 0;
  for (;;) {
    let q = sb.from("application_forms").select("id").eq("slug", candidate).limit(1);
    if (excludeId) q = q.neq("id", excludeId);
    const { data, error } = await q.maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    if (!data) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysAgoUtc(n: number): Date {
  const d = startOfUtcDay(new Date());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export async function listApplicationForms(): Promise<ApplicationFormListItem[]> {
  const sb = getSupabaseServiceClient();
  const { data: forms, error } = await sb
    .from("application_forms")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const formRows = (forms ?? []) as FormRow[];
  if (formRows.length === 0) return [];

  const ids = formRows.map((f) => f.id);
  const { data: responses, error: rErr } = await sb
    .from("application_form_responses")
    .select("form_id, status, submitted_at")
    .in("form_id", ids);
  if (rErr) throw new Error(rErr.message);

  const last7Start = daysAgoUtc(6).toISOString();
  const prev7Start = daysAgoUtc(13).toISOString();
  const prev7End = daysAgoUtc(7).toISOString();

  type Agg = {
    count: number;
    funnel: ApplicationFormFunnel;
    last7: number;
    prev7: number;
  };
  const byForm = new Map<string, Agg>();
  for (const id of ids) {
    byForm.set(id, { count: 0, funnel: emptyFunnel(), last7: 0, prev7: 0 });
  }

  for (const raw of responses ?? []) {
    const r = raw as { form_id: string; status: string; submitted_at: string };
    const agg = byForm.get(r.form_id);
    if (!agg) continue;
    agg.count += 1;
    if (isApplicationResponseStatus(r.status)) {
      agg.funnel[r.status] += 1;
    }
    if (r.submitted_at >= last7Start) agg.last7 += 1;
    else if (r.submitted_at >= prev7Start && r.submitted_at < prev7End) agg.prev7 += 1;
  }

  return formRows.map((row) => {
    const agg = byForm.get(row.id)!;
    return {
      ...mapForm(row),
      response_count: agg.count,
      funnel: agg.funnel,
      responses_last_7d: agg.last7,
      responses_prev_7d: agg.prev7,
    };
  });
}

export async function getApplicationFormById(
  id: string,
): Promise<ApplicationFormWithQuestions | null> {
  const sb = getSupabaseServiceClient();
  const { data: form, error } = await sb
    .from("application_forms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!form) return null;

  const { data: questions, error: qErr } = await sb
    .from("application_form_questions")
    .select("*")
    .eq("form_id", id)
    .order("display_order", { ascending: true });
  if (qErr) throw new Error(qErr.message);

  const { count, error: cErr } = await sb
    .from("application_form_responses")
    .select("id", { count: "exact", head: true })
    .eq("form_id", id);
  if (cErr) throw new Error(cErr.message);

  return {
    ...mapForm(form as FormRow),
    questions: ((questions ?? []) as QuestionRow[]).map(mapQuestion),
    response_count: count ?? 0,
  };
}

export async function getPublishedFormBySlug(
  slug: string,
): Promise<ApplicationFormWithQuestions | null> {
  const sb = getSupabaseServiceClient();
  const { data: form, error } = await sb
    .from("application_forms")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!form) return null;

  const { data: questions, error: qErr } = await sb
    .from("application_form_questions")
    .select("*")
    .eq("form_id", (form as FormRow).id)
    .order("display_order", { ascending: true });
  if (qErr) throw new Error(qErr.message);

  return {
    ...mapForm(form as FormRow),
    questions: ((questions ?? []) as QuestionRow[]).map(mapQuestion),
  };
}

export async function getFormBySlugAnyStatus(
  slug: string,
): Promise<ApplicationFormRecord | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_forms")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapForm(data as FormRow) : null;
}

export async function createApplicationForm(input: {
  title: string;
  description?: string;
  description_el?: string;
  footer_text?: string;
  footer_text_el?: string;
  slug?: string;
  status?: ApplicationFormStatus;
  pipeline_config?: PipelineStepConfig[];
  created_by?: string | null;
}): Promise<ApplicationFormRecord> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const baseSlug = slugifyFormTitle(input.slug?.trim() || title);
  const slug = await ensureUniqueSlug(baseSlug);

  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("application_forms")
    .insert({
      title,
      description: (input.description ?? "").trim(),
      description_el: (input.description_el ?? "").trim(),
      footer_text: (input.footer_text ?? "").trim(),
      footer_text_el: (input.footer_text_el ?? "").trim(),
      slug,
      status: input.status && isApplicationFormStatus(input.status) ? input.status : "draft",
      pipeline_config: parsePipelineConfig(input.pipeline_config),
      created_by: input.created_by ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapForm(data as FormRow);
}

export async function updateApplicationForm(
  id: string,
  patch: {
    title?: string;
    description?: string;
    description_el?: string;
    footer_text?: string;
    footer_text_el?: string;
    slug?: string;
    status?: ApplicationFormStatus;
    pipeline_config?: PipelineStepConfig[];
  },
): Promise<ApplicationFormRecord> {
  const sb = getSupabaseServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new Error("Title is required");
    updates.title = title;
  }
  if (patch.description !== undefined) {
    updates.description = patch.description.trim();
  }
  if (patch.description_el !== undefined) {
    updates.description_el = patch.description_el.trim();
  }
  if (patch.footer_text !== undefined) {
    updates.footer_text = patch.footer_text.trim();
  }
  if (patch.footer_text_el !== undefined) {
    updates.footer_text_el = patch.footer_text_el.trim();
  }
  if (patch.status !== undefined) {
    if (!isApplicationFormStatus(patch.status)) throw new Error("Invalid status");
    updates.status = patch.status;
  }
  if (patch.slug !== undefined) {
    const base = slugifyFormTitle(patch.slug);
    updates.slug = await ensureUniqueSlug(base, id);
  }
  if (patch.pipeline_config !== undefined) {
    updates.pipeline_config = parsePipelineConfig(patch.pipeline_config);
  }

  const { data, error } = await sb
    .from("application_forms")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapForm(data as FormRow);
}

export async function deleteApplicationForm(id: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from("application_forms").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function duplicateApplicationForm(
  id: string,
  createdBy?: string | null,
): Promise<ApplicationFormWithQuestions> {
  const source = await getApplicationFormById(id);
  if (!source) throw new Error("Form not found");

  const copy = await createApplicationForm({
    title: `${source.title} (Copy)`,
    description: source.description,
    description_el: source.description_el,
    footer_text: source.footer_text,
    footer_text_el: source.footer_text_el,
    status: "draft",
    pipeline_config: source.pipeline_config,
    created_by: createdBy ?? null,
  });

  for (const q of source.questions) {
    await createQuestion(copy.id, {
      question_text: q.question_text,
      question_text_el: q.question_text_el,
      question_type: q.question_type,
      options: q.options,
      options_el: q.options_el,
      is_required: q.is_required,
    });
  }

  const full = await getApplicationFormById(copy.id);
  if (!full) throw new Error("Failed to load duplicated form");
  return full;
}

export async function getApplicationFormsOverview(): Promise<ApplicationFormsOverview> {
  const forms = await listApplicationForms();
  const sb = getSupabaseServiceClient();

  const total_candidates = forms.reduce((n, f) => n + f.response_count, 0);
  const awaiting_review = forms.reduce((n, f) => n + f.funnel.new, 0);
  const published_count = forms.filter((f) => f.status === "published").length;
  const draft_count = forms.filter((f) => f.status === "draft").length;
  const closed_count = forms.filter((f) => f.status === "closed").length;

  const most_active_form =
    forms.length === 0
      ? null
      : [...forms].sort((a, b) => b.response_count - a.response_count)[0]!;
  const mostActive =
    most_active_form && most_active_form.response_count > 0
      ? {
          id: most_active_form.id,
          title: most_active_form.title,
          response_count: most_active_form.response_count,
        }
      : null;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), quarterMonth, 1)).toISOString();

  const [{ count: hiredMonth }, { count: hiredQuarter }, cogRes, eqRes, recentRows] =
    await Promise.all([
      sb
        .from("application_form_responses")
        .select("id", { count: "exact", head: true })
        .eq("status", "hired")
        .gte("updated_at", monthStart),
      sb
        .from("application_form_responses")
        .select("id", { count: "exact", head: true })
        .eq("status", "hired")
        .gte("updated_at", quarterStart),
      sb
        .from("application_cognitive_results")
        .select("percentile_at_time_of_completion")
        .not("response_id", "is", null)
        .not("percentile_at_time_of_completion", "is", null),
      sb
        .from("application_eq_results")
        .select("overall_score")
        .not("response_id", "is", null),
      sb
        .from("application_form_responses")
        .select("id, form_id, status, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(5),
    ]);

  let cogSum = 0;
  let cogN = 0;
  for (const row of cogRes.data ?? []) {
    const p = (row as { percentile_at_time_of_completion: number | null })
      .percentile_at_time_of_completion;
    if (p == null) continue;
    cogSum += Number(p);
    cogN += 1;
  }

  let eqSum = 0;
  let eqN = 0;
  for (const row of eqRes.data ?? []) {
    const s = Number((row as { overall_score: number }).overall_score);
    if (!Number.isFinite(s)) continue;
    eqSum += s;
    eqN += 1;
  }

  const volumeStart = daysAgoUtc(29).toISOString().slice(0, 10);
  const { data: volumeRows, error: volErr } = await sb
    .from("application_form_responses")
    .select("submitted_at")
    .gte("submitted_at", `${volumeStart}T00:00:00.000Z`);
  if (volErr) throw new Error(volErr.message);

  const dayMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    dayMap.set(daysAgoUtc(i).toISOString().slice(0, 10), 0);
  }
  for (const row of volumeRows ?? []) {
    const day = String((row as { submitted_at: string }).submitted_at).slice(0, 10);
    if (dayMap.has(day)) dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const volume_by_day = [...dayMap.entries()].map(([date, count]) => ({ date, count }));

  const recent = (recentRows.data ?? []) as {
    id: string;
    form_id: string;
    status: string;
    submitted_at: string;
  }[];
  const formById = new Map(forms.map((f) => [f.id, f]));
  const recentIds = recent.map((r) => r.id);
  const labelByResponse = new Map<string, string>();
  if (recentIds.length > 0) {
    const { data: answers } = await sb
      .from("application_form_answers")
      .select("response_id, answer_text, created_at")
      .in("response_id", recentIds)
      .order("created_at", { ascending: true });
    for (const a of answers ?? []) {
      const row = a as { response_id: string; answer_text: string | null };
      if (labelByResponse.has(row.response_id)) continue;
      const text = (row.answer_text ?? "").trim();
      if (text) labelByResponse.set(row.response_id, text.slice(0, 80));
    }
  }

  const recent_activity: ApplicationRecentActivityItem[] = recent.map((r) => {
    const form = formById.get(r.form_id);
    return {
      response_id: r.id,
      form_id: r.form_id,
      form_title: form?.title ?? "Unknown form",
      form_slug: form?.slug ?? "",
      status: isApplicationResponseStatus(r.status) ? r.status : "new",
      submitted_at: r.submitted_at,
      candidate_label: labelByResponse.get(r.id) || "Candidate",
    };
  });

  return {
    total_candidates,
    awaiting_review,
    hired_this_month: hiredMonth ?? 0,
    hired_this_quarter: hiredQuarter ?? 0,
    avg_cognitive_percentile: cogN ? Math.round((cogSum / cogN) * 10) / 10 : null,
    avg_eq_score: eqN ? Math.round((eqSum / eqN) * 10) / 10 : null,
    most_active_form: mostActive,
    volume_by_day,
    recent_activity,
    published_count,
    draft_count,
    closed_count,
  };
}

export async function createQuestion(
  formId: string,
  input: {
    question_text: string;
    question_text_el?: string;
    question_type: ApplicationQuestionType;
    options?: string[];
    options_el?: string[];
    is_required?: boolean;
  },
): Promise<ApplicationFormQuestion> {
  const text = input.question_text.trim();
  if (!text) throw new Error("Question text is required");
  if (!isApplicationQuestionType(input.question_type)) throw new Error("Invalid question type");

  const sb = getSupabaseServiceClient();
  const { data: existing } = await sb
    .from("application_form_questions")
    .select("display_order")
    .eq("form_id", formId)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder =
    existing && existing.length > 0
      ? ((existing[0] as { display_order: number }).display_order ?? 0) + 1
      : 0;

  const options = CHOICE_QUESTION_TYPES.has(input.question_type)
    ? (input.options ?? []).map((o) => o.trim()).filter(Boolean)
    : [];
  const options_el = CHOICE_QUESTION_TYPES.has(input.question_type)
    ? (input.options_el ?? []).map((o) => o.trim())
    : [];

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("application_form_questions")
    .insert({
      form_id: formId,
      question_text: text,
      question_text_el: (input.question_text_el ?? "").trim(),
      question_type: input.question_type,
      options,
      options_el,
      is_required: !!input.is_required,
      display_order: nextOrder,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapQuestion(data as QuestionRow);
}

export async function updateQuestion(
  questionId: string,
  patch: {
    question_text?: string;
    question_text_el?: string;
    question_type?: ApplicationQuestionType;
    options?: string[];
    options_el?: string[];
    is_required?: boolean;
  },
): Promise<ApplicationFormQuestion> {
  const sb = getSupabaseServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.question_text !== undefined) {
    const text = patch.question_text.trim();
    if (!text) throw new Error("Question text is required");
    updates.question_text = text;
  }
  if (patch.question_text_el !== undefined) {
    updates.question_text_el = patch.question_text_el.trim();
  }
  if (patch.question_type !== undefined) {
    if (!isApplicationQuestionType(patch.question_type)) throw new Error("Invalid question type");
    updates.question_type = patch.question_type;
    if (!CHOICE_QUESTION_TYPES.has(patch.question_type) && patch.options === undefined) {
      updates.options = [];
      updates.options_el = [];
    }
  }
  if (patch.options !== undefined) {
    updates.options = patch.options.map((o) => o.trim()).filter(Boolean);
  }
  if (patch.options_el !== undefined) {
    updates.options_el = patch.options_el.map((o) => o.trim());
  }
  if (patch.is_required !== undefined) {
    updates.is_required = !!patch.is_required;
  }

  const { data, error } = await sb
    .from("application_form_questions")
    .update(updates)
    .eq("id", questionId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapQuestion(data as QuestionRow);
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from("application_form_questions").delete().eq("id", questionId);
  if (error) throw new Error(error.message);
}

export async function reorderQuestions(
  formId: string,
  orderedIds: string[],
): Promise<ApplicationFormQuestion[]> {
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  await Promise.all(
    orderedIds.map((id, index) =>
      sb
        .from("application_form_questions")
        .update({ display_order: index, updated_at: now })
        .eq("id", id)
        .eq("form_id", formId),
    ),
  );

  const { data, error } = await sb
    .from("application_form_questions")
    .select("*")
    .eq("form_id", formId)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as QuestionRow[]).map(mapQuestion);
}

export type SubmitAnswerInput = {
  question_id: string;
  answer_text?: string | null;
  answer_options?: string[];
};

export async function submitApplicationResponse(input: {
  formId: string;
  respondentIp?: string | null;
  answers: SubmitAnswerInput[];
  sessionId?: string | null;
  preferredLanguage?: PipelineLanguage | null;
}): Promise<ApplicationFormResponse> {
  const form = await getApplicationFormById(input.formId);
  if (!form) throw new Error("Form not found");
  if (form.status !== "published") throw new Error("Form is not open for submissions");

  const byId = new Map(form.questions.map((q) => [q.id, q]));
  for (const q of form.questions) {
    if (!q.is_required) continue;
    const ans = input.answers.find((a) => a.question_id === q.id);
    const text = (ans?.answer_text ?? "").trim();
    const opts = ans?.answer_options ?? [];
    if (q.question_type === "checkboxes") {
      if (opts.length === 0) throw new Error(`Required: ${q.question_text}`);
    } else if (
      CHOICE_QUESTION_TYPES.has(q.question_type) ||
      q.question_type === "yes_no" ||
      q.question_type === "rating" ||
      q.question_type === "date"
    ) {
      if (!text && opts.length === 0) throw new Error(`Required: ${q.question_text}`);
    } else if (!text) {
      throw new Error(`Required: ${q.question_text}`);
    }
  }

  let preferred: PipelineLanguage | null =
    input.preferredLanguage && isPipelineLanguage(input.preferredLanguage)
      ? input.preferredLanguage
      : null;
  if (!preferred && input.sessionId) {
    const { getCandidateSession } = await import("@/services/application-screening");
    const session = await getCandidateSession(input.sessionId);
    if (session?.preferred_language) preferred = session.preferred_language;
  }

  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { data: response, error } = await sb
    .from("application_form_responses")
    .insert({
      form_id: input.formId,
      submitted_at: now,
      respondent_ip: input.respondentIp ?? null,
      status: "new",
      preferred_language: preferred,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const responseId = (response as ResponseRow).id;
  const answerRows = input.answers
    .filter((a) => byId.has(a.question_id))
    .map((a) => {
      const q = byId.get(a.question_id)!;
      const opts = (a.answer_options ?? []).map((o) => o.trim()).filter(Boolean);
      let text = (a.answer_text ?? "").trim() || null;
      if (q.question_type === "checkboxes" && opts.length > 0) {
        text = opts.join(", ");
      } else if (CHOICE_QUESTION_TYPES.has(q.question_type) && opts.length === 1 && !text) {
        text = opts[0]!;
      }
      return {
        response_id: responseId,
        question_id: a.question_id,
        answer_text: text,
        answer_options: opts,
        created_at: now,
      };
    });

  if (answerRows.length > 0) {
    const { error: aErr } = await sb.from("application_form_answers").insert(answerRows);
    if (aErr) throw new Error(aErr.message);
  }

  if (input.sessionId) {
    await linkSessionToResponse(input.sessionId, responseId);
  }

  return mapResponse(response as ResponseRow);
}

export async function listResponses(
  formId: string,
  opts?: {
    status?: ApplicationResponseStatus | "all";
    sort?:
      | "newest"
      | "oldest"
      | "cognitive_desc"
      | "cognitive_asc"
      | "eq_desc"
      | "eq_asc"
      | "typing_desc"
      | "typing_asc";
    search?: string;
    flag?: string | null;
    preferredLanguage?: PipelineLanguage | "all" | null;
    cognitiveMin?: number | null;
    cognitiveMax?: number | null;
    eqMin?: number | null;
    eqMax?: number | null;
    wpmMin?: number | null;
    wpmMax?: number | null;
    submittedFrom?: string | null;
    submittedTo?: string | null;
  },
): Promise<ApplicationFormResponseWithAnswers[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from("application_form_responses").select("*").eq("form_id", formId);
  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }
  if (opts?.preferredLanguage && opts.preferredLanguage !== "all") {
    q = q.eq("preferred_language", opts.preferredLanguage);
  }
  if (opts?.submittedFrom) {
    q = q.gte("submitted_at", opts.submittedFrom);
  }
  if (opts?.submittedTo) {
    // Inclusive end-of-day if date-only YYYY-MM-DD
    const to = opts.submittedTo;
    const end =
      /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to;
    q = q.lte("submitted_at", end);
  }
  const dateAsc = opts?.sort === "oldest";
  q = q.order("submitted_at", { ascending: dateAsc });

  const { data: responses, error } = await q;
  if (error) throw new Error(error.message);
  const responseRows = (responses ?? []) as ResponseRow[];
  if (responseRows.length === 0) return [];

  const ids = responseRows.map((r) => r.id);
  const [{ data: answers, error: aErr }, screening] = await Promise.all([
    sb.from("application_form_answers").select("*").in("response_id", ids),
    getScreeningByResponseIds(ids),
  ]);
  if (aErr) throw new Error(aErr.message);

  const answersByResponse = new Map<string, ApplicationFormAnswer[]>();
  for (const row of (answers ?? []) as AnswerRow[]) {
    const mapped = mapAnswer(row);
    const list = answersByResponse.get(mapped.response_id) ?? [];
    list.push(mapped);
    answersByResponse.set(mapped.response_id, list);
  }

  let result: ApplicationFormResponseWithAnswers[] = responseRows.map((r) => ({
    ...mapResponse(r),
    answers: answersByResponse.get(r.id) ?? [],
    cognitive: screening.cognitiveByResponse.get(r.id) ?? null,
    eq: screening.eqByResponse.get(r.id) ?? null,
    typing: screening.typingByResponse.get(r.id) ?? null,
  }));

  // Backfill flags in-memory when not yet cached (so filters/badges work immediately)
  const formForFlags = await getApplicationFormById(formId).catch(() => null);
  if (formForFlags) {
    const { computeFlagsForResponse } = await import(
      "@/services/application-response-enrichment"
    );
    const typingExpected = formForFlags.pipeline_config.some(
      (s) => s.step === "typing_speed_test" && s.enabled,
    );
    result = result.map((r) => {
      if (r.auto_flags.length > 0) return r;
      return {
        ...r,
        auto_flags: computeFlagsForResponse(r, formForFlags.questions, { typingExpected }),
      };
    });
  }

  const search = opts?.search?.trim().toLowerCase();
  if (search) {
    result = result.filter(
      (r) =>
        r.answers.some(
          (a) =>
            (a.answer_text ?? "").toLowerCase().includes(search) ||
            a.answer_options.some((o) => o.toLowerCase().includes(search)),
        ) ||
        (r.internal_notes ?? "").toLowerCase().includes(search) ||
        (r.ai_summary ?? "").toLowerCase().includes(search) ||
        (r.generated_username ?? "").toLowerCase().includes(search),
    );
  }

  const flagFilter = opts?.flag?.trim();
  if (flagFilter) {
    result = result.filter((r) => r.auto_flags.some((f) => f.id === flagFilter));
  }

  const cogMin = opts?.cognitiveMin;
  const cogMax = opts?.cognitiveMax;
  if (cogMin != null || cogMax != null) {
    result = result.filter((r) => {
      const v = r.cognitive?.percentile_at_time_of_completion;
      if (v == null || !Number.isFinite(v)) return false;
      if (cogMin != null && v < cogMin) return false;
      if (cogMax != null && v > cogMax) return false;
      return true;
    });
  }

  const eqMin = opts?.eqMin;
  const eqMax = opts?.eqMax;
  if (eqMin != null || eqMax != null) {
    result = result.filter((r) => {
      const v = r.eq?.overall_score;
      if (v == null || !Number.isFinite(v)) return false;
      if (eqMin != null && v < eqMin) return false;
      if (eqMax != null && v > eqMax) return false;
      return true;
    });
  }

  const wpmMin = opts?.wpmMin;
  const wpmMax = opts?.wpmMax;
  if (wpmMin != null || wpmMax != null) {
    result = result.filter((r) => {
      const v = r.typing?.wpm;
      if (v == null || !Number.isFinite(v)) return false;
      if (wpmMin != null && v < wpmMin) return false;
      if (wpmMax != null && v > wpmMax) return false;
      return true;
    });
  }

  if (opts?.sort === "cognitive_desc" || opts?.sort === "cognitive_asc") {
    const dir = opts.sort === "cognitive_desc" ? -1 : 1;
    result = [...result].sort((a, b) => {
      const av = a.cognitive?.percentile_at_time_of_completion ?? -1;
      const bv = b.cognitive?.percentile_at_time_of_completion ?? -1;
      return (av - bv) * dir;
    });
  } else if (opts?.sort === "eq_desc" || opts?.sort === "eq_asc") {
    const dir = opts.sort === "eq_desc" ? -1 : 1;
    result = [...result].sort((a, b) => {
      const av = a.eq?.overall_score ?? -1;
      const bv = b.eq?.overall_score ?? -1;
      return (av - bv) * dir;
    });
  } else if (opts?.sort === "typing_desc" || opts?.sort === "typing_asc") {
    const dir = opts.sort === "typing_desc" ? -1 : 1;
    result = [...result].sort((a, b) => {
      const av = a.typing?.wpm ?? -1;
      const bv = b.typing?.wpm ?? -1;
      return (av - bv) * dir;
    });
  }

  return result;
}

export async function getResponseDetail(
  responseId: string,
): Promise<ApplicationFormResponseWithAnswers | null> {
  const sb = getSupabaseServiceClient();
  const { data: response, error } = await sb
    .from("application_form_responses")
    .select("*")
    .eq("id", responseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!response) return null;

  const { data: answers, error: aErr } = await sb
    .from("application_form_answers")
    .select("*")
    .eq("response_id", responseId);
  if (aErr) throw new Error(aErr.message);

  const screening = await getScreeningByResponseIds([responseId]);
  return {
    ...mapResponse(response as ResponseRow),
    answers: ((answers ?? []) as AnswerRow[]).map(mapAnswer),
    cognitive: screening.cognitiveByResponse.get(responseId) ?? null,
    eq: screening.eqByResponse.get(responseId) ?? null,
    typing: screening.typingByResponse.get(responseId) ?? null,
  };
}

export async function updateResponse(
  responseId: string,
  patch: {
    status?: ApplicationResponseStatus;
    internal_notes?: string | null;
  },
): Promise<ApplicationFormResponse> {
  const sb = getSupabaseServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) {
    if (!isApplicationResponseStatus(patch.status)) throw new Error("Invalid status");
    updates.status = patch.status;
  }
  if (patch.internal_notes !== undefined) {
    updates.internal_notes = patch.internal_notes;
  }

  const { data, error } = await sb
    .from("application_form_responses")
    .update(updates)
    .eq("id", responseId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapResponse(data as ResponseRow);
}

export async function getFormAnalytics(formId: string): Promise<ApplicationFormAnalytics> {
  const form = await getApplicationFormById(formId);
  if (!form) throw new Error("Form not found");

  const responses = await listResponses(formId);
  const by_status = {
    new: 0,
    reviewed: 0,
    shortlisted: 0,
    rejected: 0,
    hired: 0,
  } satisfies Record<ApplicationResponseStatus, number>;

  const dayMap = new Map<string, number>();
  for (const r of responses) {
    by_status[r.status] += 1;
    const day = r.submitted_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  const volume_by_day = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const choice_distributions = form.questions
    .filter(
      (q) =>
        CHOICE_QUESTION_TYPES.has(q.question_type) ||
        q.question_type === "yes_no" ||
        q.question_type === "rating",
    )
    .map((q) => {
      const counts = new Map<string, number>();
      if (q.question_type === "yes_no") {
        counts.set("Yes", 0);
        counts.set("No", 0);
      } else if (q.question_type === "rating") {
        for (let i = 1; i <= 5; i++) counts.set(String(i), 0);
      } else {
        for (const opt of q.options) counts.set(opt, 0);
      }

      for (const r of responses) {
        const ans = r.answers.find((a) => a.question_id === q.id);
        if (!ans) continue;
        if (q.question_type === "checkboxes") {
          for (const opt of ans.answer_options) {
            counts.set(opt, (counts.get(opt) ?? 0) + 1);
          }
        } else {
          const label = (ans.answer_text ?? ans.answer_options[0] ?? "").trim();
          if (!label) continue;
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
      }

      return {
        question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        buckets: [...counts.entries()].map(([label, count]) => ({ label, count })),
      };
    });

  const cogBuckets = new Map<string, number>([
    ["0–20%", 0],
    ["21–40%", 0],
    ["41–60%", 0],
    ["61–80%", 0],
    ["81–100%", 0],
  ]);
  const eqBuckets = new Map<string, number>([
    ["0–20", 0],
    ["21–40", 0],
    ["41–60", 0],
    ["61–80", 0],
    ["81–100", 0],
  ]);
  let cogPctSum = 0;
  let cogPctN = 0;
  let eqSum = 0;
  let eqN = 0;
  for (const r of responses) {
    if (r.cognitive?.percentile_at_time_of_completion != null) {
      const p = r.cognitive.percentile_at_time_of_completion;
      cogPctSum += p;
      cogPctN += 1;
      const key =
        p <= 20 ? "0–20%" : p <= 40 ? "21–40%" : p <= 60 ? "41–60%" : p <= 80 ? "61–80%" : "81–100%";
      cogBuckets.set(key, (cogBuckets.get(key) ?? 0) + 1);
    }
    if (r.eq) {
      const s = r.eq.overall_score;
      eqSum += s;
      eqN += 1;
      const key =
        s <= 20 ? "0–20" : s <= 40 ? "21–40" : s <= 60 ? "41–60" : s <= 80 ? "61–80" : "81–100";
      eqBuckets.set(key, (eqBuckets.get(key) ?? 0) + 1);
    }
  }

  let typingSum = 0;
  let typingN = 0;
  for (const r of responses) {
    if (r.typing) {
      typingSum += r.typing.wpm;
      typingN += 1;
    }
  }

  return {
    total: responses.length,
    by_status,
    volume_by_day,
    choice_distributions,
    cognitive_score_distribution: [...cogBuckets.entries()].map(([bucket, count]) => ({
      bucket,
      count,
    })),
    eq_score_distribution: [...eqBuckets.entries()].map(([bucket, count]) => ({
      bucket,
      count,
    })),
    avg_cognitive_percentile: cogPctN ? Math.round((cogPctSum / cogPctN) * 10) / 10 : null,
    avg_eq_score: eqN ? Math.round((eqSum / eqN) * 10) / 10 : null,
    avg_typing_wpm: typingN ? Math.round((typingSum / typingN) * 10) / 10 : null,
  };
}

export function responsesToCsv(
  form: ApplicationFormWithQuestions,
  responses: ApplicationFormResponseWithAnswers[],
): string {
  const headers = [
    "response_id",
    "submitted_at",
    "status",
    "preferred_language",
    "respondent_ip",
    "internal_notes",
    "cognitive_raw",
    "cognitive_total",
    "cognitive_percentile",
    "eq_score",
    "typing_wpm",
    "typing_accuracy",
    "typing_language",
    "typing_device",
    ...form.questions.map((q) => q.question_text),
  ];

  const escape = (v: unknown) => {
    const raw = v == null ? "" : String(v);
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const lines = [headers.map(escape).join(",")];
  for (const r of responses) {
    const byQ = new Map(r.answers.map((a) => [a.question_id, a]));
    const cells = [
      r.id,
      r.submitted_at,
      r.status,
      r.preferred_language ?? "",
      r.respondent_ip ?? "",
      r.internal_notes ?? "",
      r.cognitive?.raw_score ?? "",
      r.cognitive?.total_questions ?? "",
      r.cognitive?.percentile_at_time_of_completion ?? "",
      r.eq?.overall_score ?? "",
      r.typing?.wpm ?? "",
      r.typing?.accuracy_percent ?? "",
      r.typing?.passage_language ?? "",
      r.typing?.device_type ?? "",
      ...form.questions.map((q) => {
        const a = byQ.get(q.id);
        if (!a) return "";
        if (a.answer_options.length > 0 && q.question_type === "checkboxes") {
          return a.answer_options.join("; ");
        }
        return a.answer_text ?? a.answer_options.join("; ");
      }),
    ];
    lines.push(cells.map(escape).join(","));
  }
  return lines.join("\n");
}

// Re-export for convenience in callers that already import from services
export type { ApplicationFormStatus, ApplicationResponseStatus };
