/**
 * Candidate sessions + Cognitive / EQ / Typing screening results.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  scoreCognitive,
  scoreEq,
  COGNITIVE_QUESTIONS,
} from "@/lib/application-screening-banks";
import { computeTypingStats } from "@/lib/application-typing-passages";
import type {
  CognitiveResultSummary,
  EqResultSummary,
  TypingResultSummary,
} from "@/lib/application-forms-types";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";
import { isPipelineLanguage } from "@/lib/application-pipeline-i18n";

export type CandidateSession = {
  id: string;
  form_id: string;
  response_id: string | null;
  status: "in_progress" | "completed" | "abandoned";
  respondent_ip: string | null;
  preferred_language: PipelineLanguage | null;
  agreed_at: string | null;
  agreement_version: string | null;
  started_at: string;
  completed_at: string | null;
};

export async function createCandidateSession(input: {
  formId: string;
  respondentIp?: string | null;
  preferredLanguage?: PipelineLanguage | null;
}): Promise<CandidateSession> {
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("application_candidate_sessions")
    .insert({
      form_id: input.formId,
      respondent_ip: input.respondentIp ?? null,
      preferred_language:
        input.preferredLanguage && isPipelineLanguage(input.preferredLanguage)
          ? input.preferredLanguage
          : null,
      status: "in_progress",
      started_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSession(data);
}

export async function updateSessionLanguage(
  sessionId: string,
  preferredLanguage: PipelineLanguage,
): Promise<CandidateSession> {
  if (!isPipelineLanguage(preferredLanguage)) throw new Error("Invalid language");
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_candidate_sessions")
    .update({
      preferred_language: preferredLanguage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSession(data);
}

/** Record Legal Agreement consent on the candidate session (idempotent if same version). */
export async function recordSessionConsent(input: {
  sessionId: string;
  formId: string;
  agreementVersion: string;
}): Promise<CandidateSession> {
  const session = await getCandidateSession(input.sessionId);
  if (!session || session.form_id !== input.formId) {
    throw new Error("Invalid session");
  }
  if (
    session.agreed_at &&
    session.agreement_version === input.agreementVersion
  ) {
    return session;
  }
  const now = new Date().toISOString();
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_candidate_sessions")
    .update({
      agreed_at: now,
      agreement_version: input.agreementVersion,
      updated_at: now,
    })
    .eq("id", input.sessionId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSession(data);
}

export async function getCandidateSession(sessionId: string): Promise<CandidateSession | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_candidate_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSession(data) : null;
}

function mapSession(row: Record<string, unknown>): CandidateSession {
  return {
    id: String(row.id),
    form_id: String(row.form_id),
    response_id: row.response_id ? String(row.response_id) : null,
    status: (row.status as CandidateSession["status"]) || "in_progress",
    respondent_ip: row.respondent_ip ? String(row.respondent_ip) : null,
    preferred_language: isPipelineLanguage(row.preferred_language)
      ? row.preferred_language
      : null,
    agreed_at: row.agreed_at ? String(row.agreed_at) : null,
    agreement_version: row.agreement_version ? String(row.agreement_version) : null,
    started_at: String(row.started_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  };
}

function mapCognitive(row: Record<string, unknown>): CognitiveResultSummary {
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    response_id: row.response_id ? String(row.response_id) : null,
    raw_score: Number(row.raw_score) || 0,
    total_questions: Number(row.total_questions) || 0,
    category_breakdown: (row.category_breakdown as CognitiveResultSummary["category_breakdown"]) ?? {},
    time_taken_seconds: Number(row.time_taken_seconds) || 0,
    percentile_at_time_of_completion:
      row.percentile_at_time_of_completion != null
        ? Number(row.percentile_at_time_of_completion)
        : null,
    completed_at: String(row.completed_at),
  };
}

function mapEq(row: Record<string, unknown>): EqResultSummary {
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    response_id: row.response_id ? String(row.response_id) : null,
    overall_score: Number(row.overall_score) || 0,
    dimension_breakdown: (row.dimension_breakdown as EqResultSummary["dimension_breakdown"]) ?? {},
    time_taken_seconds: Number(row.time_taken_seconds) || 0,
    completed_at: String(row.completed_at),
  };
}

function mapTyping(row: Record<string, unknown>): TypingResultSummary {
  const device = String(row.device_type ?? "unknown");
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    response_id: row.response_id ? String(row.response_id) : null,
    wpm: Number(row.wpm) || 0,
    accuracy_percent: Number(row.accuracy_percent) || 0,
    passage_language: isPipelineLanguage(row.passage_language) ? row.passage_language : "en",
    device_type:
      device === "desktop" || device === "mobile" || device === "tablet" || device === "unknown"
        ? device
        : "unknown",
    completed_at: String(row.completed_at),
  };
}

/** Percentile: % of prior completers on same form with equal-or-lower raw score. */
async function computeCognitivePercentile(
  formId: string,
  rawScore: number,
): Promise<number> {
  const sb = getSupabaseServiceClient();
  const { data: sessions, error: sErr } = await sb
    .from("application_candidate_sessions")
    .select("id")
    .eq("form_id", formId);
  if (sErr) throw new Error(sErr.message);
  const sessionIds = (sessions ?? []).map((s) => (s as { id: string }).id);
  if (sessionIds.length === 0) return 50;

  const { data: scores, error } = await sb
    .from("application_cognitive_results")
    .select("raw_score")
    .in("session_id", sessionIds);
  if (error) throw new Error(error.message);

  const list = (scores ?? []).map((r) => Number((r as { raw_score: number }).raw_score) || 0);
  if (list.length === 0) return 50;
  const belowOrEqual = list.filter((s) => s <= rawScore).length;
  return Math.round((belowOrEqual / list.length) * 1000) / 10;
}

export async function submitCognitiveResult(input: {
  sessionId: string;
  formId: string;
  answers: { question_id: string; selected_index: number | null }[];
  timeTakenSeconds: number;
}): Promise<CognitiveResultSummary> {
  const session = await getCandidateSession(input.sessionId);
  if (!session || session.form_id !== input.formId) {
    throw new Error("Invalid session");
  }
  if (session.status === "completed") throw new Error("Session already completed");

  const existing = await getCognitiveBySession(input.sessionId);
  if (existing) return existing;

  const scored = scoreCognitive(input.answers);
  const percentile = await computeCognitivePercentile(input.formId, scored.raw_score);
  const now = new Date().toISOString();
  const sb = getSupabaseServiceClient();

  const { data, error } = await sb
    .from("application_cognitive_results")
    .insert({
      session_id: input.sessionId,
      raw_score: scored.raw_score,
      total_questions: scored.total_questions,
      category_breakdown: scored.category_breakdown,
      time_taken_seconds: Math.max(0, Math.min(input.timeTakenSeconds, 24 * 3600)),
      percentile_at_time_of_completion: percentile,
      answers: input.answers,
      completed_at: now,
      created_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCognitive(data as Record<string, unknown>);
}

export async function submitEqResult(input: {
  sessionId: string;
  formId: string;
  answers: { scenario_id: string; selected_index: number | null }[];
  timeTakenSeconds: number;
}): Promise<EqResultSummary> {
  const session = await getCandidateSession(input.sessionId);
  if (!session || session.form_id !== input.formId) {
    throw new Error("Invalid session");
  }
  if (session.status === "completed") throw new Error("Session already completed");

  const existing = await getEqBySession(input.sessionId);
  if (existing) return existing;

  const scored = scoreEq(input.answers);
  const now = new Date().toISOString();
  const sb = getSupabaseServiceClient();

  const { data, error } = await sb
    .from("application_eq_results")
    .insert({
      session_id: input.sessionId,
      overall_score: scored.overall_score,
      dimension_breakdown: scored.dimension_breakdown,
      time_taken_seconds: Math.max(0, Math.min(input.timeTakenSeconds, 24 * 3600)),
      answers: input.answers,
      completed_at: now,
      created_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapEq(data as Record<string, unknown>);
}

export async function getCognitiveBySession(
  sessionId: string,
): Promise<CognitiveResultSummary | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_cognitive_results")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapCognitive(data as Record<string, unknown>) : null;
}

export async function getEqBySession(sessionId: string): Promise<EqResultSummary | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_eq_results")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapEq(data as Record<string, unknown>) : null;
}

export async function linkSessionToResponse(
  sessionId: string,
  responseId: string,
): Promise<void> {
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { error: sErr } = await sb
    .from("application_candidate_sessions")
    .update({
      response_id: responseId,
      status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", sessionId);
  if (sErr) throw new Error(sErr.message);

  await Promise.all([
    sb
      .from("application_cognitive_results")
      .update({ response_id: responseId })
      .eq("session_id", sessionId),
    sb
      .from("application_eq_results")
      .update({ response_id: responseId })
      .eq("session_id", sessionId),
    sb
      .from("application_typing_results")
      .update({ response_id: responseId })
      .eq("session_id", sessionId),
  ]);
}

export async function submitTypingResult(input: {
  sessionId: string;
  formId: string;
  passage: string;
  typed: string;
  passageLanguage: PipelineLanguage;
  passageId?: string | null;
  deviceType: TypingResultSummary["device_type"];
  timeTakenSeconds: number;
}): Promise<TypingResultSummary> {
  const session = await getCandidateSession(input.sessionId);
  if (!session || session.form_id !== input.formId) {
    throw new Error("Invalid session");
  }
  if (session.status === "completed") throw new Error("Session already completed");

  const existing = await getTypingBySession(input.sessionId);
  if (existing) return existing;

  const elapsedMs = Math.max(0, input.timeTakenSeconds) * 1000;
  const stats = computeTypingStats({
    passage: input.passage,
    typed: input.typed,
    elapsedMs: Math.max(elapsedMs, 1000),
  });

  const now = new Date().toISOString();
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_typing_results")
    .insert({
      session_id: input.sessionId,
      wpm: stats.wpm,
      accuracy_percent: stats.accuracy_percent,
      passage_language: isPipelineLanguage(input.passageLanguage) ? input.passageLanguage : "en",
      device_type: input.deviceType,
      passage_id: input.passageId ?? null,
      time_taken_seconds: Math.max(0, Math.min(input.timeTakenSeconds, 24 * 3600)),
      completed_at: now,
      created_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTyping(data as Record<string, unknown>);
}

export async function getTypingBySession(
  sessionId: string,
): Promise<TypingResultSummary | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_typing_results")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTyping(data as Record<string, unknown>) : null;
}

export async function getScreeningByResponseIds(responseIds: string[]): Promise<{
  cognitiveByResponse: Map<string, CognitiveResultSummary>;
  eqByResponse: Map<string, EqResultSummary>;
  typingByResponse: Map<string, TypingResultSummary>;
}> {
  const cognitiveByResponse = new Map<string, CognitiveResultSummary>();
  const eqByResponse = new Map<string, EqResultSummary>();
  const typingByResponse = new Map<string, TypingResultSummary>();
  if (responseIds.length === 0) {
    return { cognitiveByResponse, eqByResponse, typingByResponse };
  }

  const sb = getSupabaseServiceClient();
  const [{ data: cog }, { data: eq }, { data: typing }] = await Promise.all([
    sb.from("application_cognitive_results").select("*").in("response_id", responseIds),
    sb.from("application_eq_results").select("*").in("response_id", responseIds),
    sb.from("application_typing_results").select("*").in("response_id", responseIds),
  ]);

  for (const row of cog ?? []) {
    const mapped = mapCognitive(row as Record<string, unknown>);
    if (mapped.response_id) cognitiveByResponse.set(mapped.response_id, mapped);
  }
  for (const row of eq ?? []) {
    const mapped = mapEq(row as Record<string, unknown>);
    if (mapped.response_id) eqByResponse.set(mapped.response_id, mapped);
  }
  for (const row of typing ?? []) {
    const mapped = mapTyping(row as Record<string, unknown>);
    if (mapped.response_id) typingByResponse.set(mapped.response_id, mapped);
  }
  return { cognitiveByResponse, eqByResponse, typingByResponse };
}

export function cognitiveQuestionCount(): number {
  return COGNITIVE_QUESTIONS.length;
}
