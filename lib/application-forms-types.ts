/** Shared types for recruitment / application form builder. */

import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";
import type { ApplicationAutoFlag } from "@/lib/application-candidate-flags";

export const APPLICATION_FORM_STATUSES = ["draft", "published", "closed"] as const;
export type ApplicationFormStatus = (typeof APPLICATION_FORM_STATUSES)[number];

export const APPLICATION_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "rating",
  "yes_no",
  "date",
] as const;
export type ApplicationQuestionType = (typeof APPLICATION_QUESTION_TYPES)[number];

export const APPLICATION_RESPONSE_STATUSES = [
  "new",
  "reviewed",
  "shortlisted",
  "rejected",
  "hired",
] as const;
export type ApplicationResponseStatus = (typeof APPLICATION_RESPONSE_STATUSES)[number];

/** Pipeline step types — extensible for future steps. */
export const PIPELINE_STEP_TYPES = [
  "cognitive_screening",
  "eq_screening",
  "typing_speed_test",
  "application_form",
] as const;
export type PipelineStepType = (typeof PIPELINE_STEP_TYPES)[number];

export type PipelineStepConfig = {
  step: PipelineStepType;
  enabled: boolean;
  order: number;
};

export const PIPELINE_STEP_LABELS: Record<PipelineStepType, string> = {
  cognitive_screening: "Cognitive screening",
  eq_screening: "EQ screening",
  typing_speed_test: "Typing speed test",
  application_form: "Application form",
};

export const DEFAULT_PIPELINE_CONFIG: PipelineStepConfig[] = [
  { step: "cognitive_screening", enabled: false, order: 0 },
  { step: "eq_screening", enabled: false, order: 1 },
  { step: "typing_speed_test", enabled: false, order: 2 },
  { step: "application_form", enabled: true, order: 3 },
];

export const QUESTION_TYPE_LABELS: Record<ApplicationQuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  multiple_choice: "Multiple choice",
  checkboxes: "Checkboxes",
  dropdown: "Dropdown",
  rating: "Rating (1–5)",
  yes_no: "Yes / No",
  date: "Date",
};

export const FORM_STATUS_LABELS: Record<ApplicationFormStatus, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
};

export const RESPONSE_STATUS_LABELS: Record<ApplicationResponseStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
  hired: "Hired",
};

export const CHOICE_QUESTION_TYPES: ReadonlySet<ApplicationQuestionType> = new Set([
  "multiple_choice",
  "checkboxes",
  "dropdown",
]);

export type ApplicationFormRecord = {
  id: string;
  title: string;
  description: string;
  description_el: string;
  footer_text: string;
  footer_text_el: string;
  slug: string;
  status: ApplicationFormStatus;
  pipeline_config: PipelineStepConfig[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationFormQuestion = {
  id: string;
  form_id: string;
  question_text: string;
  question_text_el: string;
  question_type: ApplicationQuestionType;
  options: string[];
  options_el: string[];
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type ApplicationFormWithQuestions = ApplicationFormRecord & {
  questions: ApplicationFormQuestion[];
  response_count?: number;
};

export type ApplicationFormFunnel = Record<ApplicationResponseStatus, number>;

export type ApplicationFormListItem = ApplicationFormRecord & {
  response_count: number;
  funnel: ApplicationFormFunnel;
  /** Submissions in the last 7 days (inclusive of today). */
  responses_last_7d: number;
  /** Submissions in the 7 days before that (trend baseline). */
  responses_prev_7d: number;
};

export type ApplicationRecentActivityItem = {
  response_id: string;
  form_id: string;
  form_title: string;
  form_slug: string;
  status: ApplicationResponseStatus;
  submitted_at: string;
  candidate_label: string;
};

export type ApplicationFormsOverview = {
  total_candidates: number;
  awaiting_review: number;
  hired_this_month: number;
  hired_this_quarter: number;
  avg_cognitive_percentile: number | null;
  avg_eq_score: number | null;
  most_active_form: { id: string; title: string; response_count: number } | null;
  volume_by_day: { date: string; count: number }[];
  recent_activity: ApplicationRecentActivityItem[];
  published_count: number;
  draft_count: number;
  closed_count: number;
};

export function emptyFunnel(): ApplicationFormFunnel {
  return { new: 0, reviewed: 0, shortlisted: 0, rejected: 0, hired: 0 };
}

export type ApplicationFormAnswer = {
  id: string;
  response_id: string;
  question_id: string;
  answer_text: string | null;
  answer_options: string[];
  created_at: string;
};

export type ApplicationFormResponse = {
  id: string;
  form_id: string;
  submitted_at: string;
  respondent_ip: string | null;
  status: ApplicationResponseStatus;
  internal_notes: string | null;
  preferred_language: PipelineLanguage | null;
  /** Cached Anthropic mini-summary (null until generated). */
  ai_summary: string | null;
  /** Cached rule-based flags for badges / filters. */
  auto_flags: ApplicationAutoFlag[];
  /** Cosmetic hire username (email format). Never a real mailbox. */
  generated_username: string | null;
  /** True when an encrypted hire password is stored (never expose ciphertext to clients). */
  has_hire_password: boolean;
  hire_credentials_created_at: string | null;
  created_at: string;
  updated_at: string;
};

export type { ApplicationAutoFlag };

export type CognitiveResultSummary = {
  id: string;
  session_id: string;
  response_id: string | null;
  raw_score: number;
  total_questions: number;
  category_breakdown: Record<string, { correct: number; total: number }>;
  time_taken_seconds: number;
  percentile_at_time_of_completion: number | null;
  completed_at: string;
};

export type EqResultSummary = {
  id: string;
  session_id: string;
  response_id: string | null;
  overall_score: number;
  dimension_breakdown: Record<string, { points: number; max: number }>;
  time_taken_seconds: number;
  completed_at: string;
};

export type TypingResultSummary = {
  id: string;
  session_id: string;
  response_id: string | null;
  wpm: number;
  accuracy_percent: number;
  passage_language: PipelineLanguage;
  device_type: "desktop" | "mobile" | "tablet" | "unknown";
  completed_at: string;
};

export type ApplicationFormResponseWithAnswers = ApplicationFormResponse & {
  answers: ApplicationFormAnswer[];
  cognitive?: CognitiveResultSummary | null;
  eq?: EqResultSummary | null;
  typing?: TypingResultSummary | null;
  session_id?: string | null;
};

export type ApplicationFormAnalytics = {
  total: number;
  by_status: Record<ApplicationResponseStatus, number>;
  volume_by_day: { date: string; count: number }[];
  choice_distributions: {
    question_id: string;
    question_text: string;
    question_type: ApplicationQuestionType;
    buckets: { label: string; count: number }[];
  }[];
  cognitive_score_distribution: { bucket: string; count: number }[];
  eq_score_distribution: { bucket: string; count: number }[];
  avg_cognitive_percentile: number | null;
  avg_eq_score: number | null;
  avg_typing_wpm: number | null;
};

export function isApplicationFormStatus(v: unknown): v is ApplicationFormStatus {
  return typeof v === "string" && (APPLICATION_FORM_STATUSES as readonly string[]).includes(v);
}

export function isApplicationQuestionType(v: unknown): v is ApplicationQuestionType {
  return typeof v === "string" && (APPLICATION_QUESTION_TYPES as readonly string[]).includes(v);
}

export function isApplicationResponseStatus(v: unknown): v is ApplicationResponseStatus {
  return typeof v === "string" && (APPLICATION_RESPONSE_STATUSES as readonly string[]).includes(v);
}

export function isPipelineStepType(v: unknown): v is PipelineStepType {
  return typeof v === "string" && (PIPELINE_STEP_TYPES as readonly string[]).includes(v);
}

export function parsePipelineConfig(raw: unknown): PipelineStepConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PIPELINE_CONFIG.map((s) => ({ ...s }));
  }
  const parsed: PipelineStepConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const step = (item as { step?: unknown }).step;
    if (!isPipelineStepType(step)) continue;
    parsed.push({
      step,
      enabled: !!(item as { enabled?: unknown }).enabled,
      order: Number((item as { order?: unknown }).order) || 0,
    });
  }
  for (const def of DEFAULT_PIPELINE_CONFIG) {
    if (!parsed.some((p) => p.step === def.step)) {
      parsed.push({ ...def, order: parsed.length });
    }
  }
  const formStep = parsed.find((p) => p.step === "application_form");
  if (formStep) formStep.enabled = true;

  return parsed.sort((a, b) => a.order - b.order).map((p, i) => ({ ...p, order: i }));
}

/** Enabled steps in order for the candidate flow runner. */
export function getEnabledPipelineSteps(config: PipelineStepConfig[]): PipelineStepConfig[] {
  return parsePipelineConfig(config)
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);
}

export function slugifyFormTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "application";
}

export function parseOptionsJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => (typeof o === "string" ? o.trim() : String(o ?? "").trim()))
    .filter(Boolean);
}

/** Localized question text/options for candidate UI (English required; Greek optional). */
export function localizeQuestion(
  q: ApplicationFormQuestion,
  lang: PipelineLanguage,
): { question_text: string; options: string[] } {
  const question_text =
    lang === "el" && q.question_text_el.trim() ? q.question_text_el : q.question_text;
  const options =
    lang === "el" && q.options_el.length > 0
      ? q.options.map((en, i) => q.options_el[i]?.trim() || en)
      : q.options;
  return { question_text, options };
}
