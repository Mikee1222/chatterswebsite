/**
 * Cache AI summary + rule-based flags on application responses.
 * Generate once (submit fire-and-forget OR first admin view).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { generateApplicationAiSummary } from "@/lib/application-ai-summary";
import {
  generateApplicationAutoFlags,
  parseAutoFlags,
  type ApplicationAutoFlag,
} from "@/lib/application-candidate-flags";
import type {
  ApplicationFormAnswer,
  ApplicationFormQuestion,
  ApplicationFormResponseWithAnswers,
  ApplicationQuestionType,
} from "@/lib/application-forms-types";
import { getApplicationFormById, getResponseDetail } from "@/services/application-forms";

const FREE_TEXT_TYPES: ReadonlySet<ApplicationQuestionType> = new Set([
  "short_text",
  "long_text",
]);

function textAnswerLengths(
  answers: ApplicationFormAnswer[],
  questions: ApplicationFormQuestion[],
): number[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const longText: number[] = [];
  const anyText: number[] = [];
  for (const a of answers) {
    const q = byId.get(a.question_id);
    if (!q || !FREE_TEXT_TYPES.has(q.question_type)) continue;
    const len = (a.answer_text ?? "").trim().length;
    if (len <= 0) continue;
    anyText.push(len);
    if (q.question_type === "long_text") longText.push(len);
  }
  return longText.length > 0 ? longText : anyText;
}

export function computeFlagsForResponse(
  response: ApplicationFormResponseWithAnswers,
  questions: ApplicationFormQuestion[],
  opts?: { typingExpected?: boolean },
): ApplicationAutoFlag[] {
  return generateApplicationAutoFlags({
    cognitivePercentile: response.cognitive?.percentile_at_time_of_completion,
    eqScore: response.eq?.overall_score,
    typingWpm: response.typing?.wpm,
    typingAccuracy: response.typing?.accuracy_percent,
    typingExpectedButMissing: Boolean(opts?.typingExpected && !response.typing),
    textAnswerLengths: textAnswerLengths(response.answers, questions),
  });
}

async function persistFlagsAndSummary(params: {
  responseId: string;
  flags: ApplicationAutoFlag[];
  aiSummary?: string | null;
  onlyIfSummaryNull?: boolean;
}): Promise<void> {
  const sb = getSupabaseServiceClient();
  const updates: Record<string, unknown> = {
    auto_flags: params.flags,
    updated_at: new Date().toISOString(),
  };
  if (params.aiSummary !== undefined && params.aiSummary !== null) {
    updates.ai_summary = params.aiSummary;
  }

  let q = sb.from("application_form_responses").update(updates).eq("id", params.responseId);
  if (params.onlyIfSummaryNull && params.aiSummary) {
    q = q.is("ai_summary", null);
  }
  const { error } = await q;
  if (error) throw new Error(error.message);
}

/**
 * Ensure flags are cached; generate AI summary if missing.
 * Safe to call repeatedly — AI is generated only when ai_summary is null.
 */
export async function ensureResponseEnrichment(
  responseId: string,
  opts?: { generateAi?: boolean },
): Promise<ApplicationFormResponseWithAnswers | null> {
  const detail = await getResponseDetail(responseId);
  if (!detail) return null;

  const form = await getApplicationFormById(detail.form_id);
  if (!form) return detail;

  const typingExpected = form.pipeline_config.some(
    (s) => s.step === "typing_speed_test" && s.enabled,
  );
  const flags = computeFlagsForResponse(detail, form.questions, { typingExpected });
  const flagsChanged =
    JSON.stringify(flags) !== JSON.stringify(parseAutoFlags(detail.auto_flags));

  let aiSummary = detail.ai_summary;
  const wantAi = opts?.generateAi !== false;
  if (wantAi && !aiSummary) {
    aiSummary = await generateApplicationAiSummary({
      response: detail,
      questions: form.questions,
    });
  }

  if (flagsChanged || (aiSummary && !detail.ai_summary)) {
    await persistFlagsAndSummary({
      responseId,
      flags,
      aiSummary: aiSummary && !detail.ai_summary ? aiSummary : undefined,
      onlyIfSummaryNull: true,
    }).catch((err) => console.error("[ensureResponseEnrichment] persist failed", err));
  }

  return {
    ...detail,
    auto_flags: flags,
    ai_summary: aiSummary ?? detail.ai_summary,
  };
}

/** Fire-and-forget after public submit — flags + AI when key present. */
export function scheduleResponseEnrichment(responseId: string): void {
  void ensureResponseEnrichment(responseId, { generateAi: true }).catch((err) =>
    console.error("[scheduleResponseEnrichment]", err),
  );
}

const ENRICHMENT_BATCH_CONCURRENCY = 2;

/**
 * Background enrichment for list rows missing cached AI summary or flags.
 * Never blocks the HTTP response — summaries appear on refresh/poll.
 */
export function scheduleResponsesEnrichment(responseIds: string[]): void {
  const unique = [...new Set(responseIds.filter(Boolean))];
  if (unique.length === 0) return;

  void (async () => {
    for (let i = 0; i < unique.length; i += ENRICHMENT_BATCH_CONCURRENCY) {
      const batch = unique.slice(i, i + ENRICHMENT_BATCH_CONCURRENCY);
      await Promise.all(
        batch.map((id) =>
          ensureResponseEnrichment(id, { generateAi: true }).catch((err) =>
            console.error("[scheduleResponsesEnrichment]", id, err),
          ),
        ),
      );
    }
  })();
}
