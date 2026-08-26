/**
 * Server-side Anthropic (Claude) AI mini-summary for application responses.
 * API key: ANTHROPIC_API_KEY (server-only). Fast model for mechanical Q&A summaries.
 * Client UI: use shortAiSummary from @/lib/application-ai-display — never import this module in client components.
 */

import "server-only";

import type {
  ApplicationFormAnswer,
  ApplicationFormQuestion,
  ApplicationFormResponseWithAnswers,
} from "@/lib/application-forms-types";
import { AI_FAST_MODEL, callAnthropic } from "@/lib/ai-assistant";

export const APPLICATION_AI_SUMMARY_MODEL = AI_FAST_MODEL;

function answerDisplay(
  q: ApplicationFormQuestion,
  a: ApplicationFormAnswer | undefined,
): string {
  if (!a) return "(no answer)";
  if (q.question_type === "checkboxes" && a.answer_options.length > 0) {
    return a.answer_options.join(", ");
  }
  const text = (a.answer_text ?? "").trim();
  if (text) return text;
  if (a.answer_options.length) return a.answer_options.join(", ");
  return "(empty)";
}

function buildPrompt(
  response: ApplicationFormResponseWithAnswers,
  questions: ApplicationFormQuestion[],
): string {
  const answersByQ = new Map(response.answers.map((a) => [a.question_id, a]));
  const qaLines = questions
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((q, i) => {
      const ans = answerDisplay(q, answersByQ.get(q.id));
      return `${i + 1}. Q: ${q.question_text}\n   A: ${ans}`;
    })
    .join("\n");

  const cog = response.cognitive;
  const eq = response.eq;
  const typing = response.typing;

  const screening: string[] = [];
  if (cog) {
    screening.push(
      `Cognitive: ${cog.raw_score}/${cog.total_questions}` +
        (cog.percentile_at_time_of_completion != null
          ? ` (${cog.percentile_at_time_of_completion}th percentile)`
          : "") +
        `; categories: ${JSON.stringify(cog.category_breakdown)}`,
    );
  } else {
    screening.push("Cognitive: not completed");
  }
  if (eq) {
    screening.push(
      `EQ overall: ${eq.overall_score}/100; dimensions: ${JSON.stringify(eq.dimension_breakdown)}`,
    );
  } else {
    screening.push("EQ: not completed");
  }
  if (typing) {
    screening.push(
      `Typing: ${typing.wpm} WPM, ${typing.accuracy_percent}% accuracy (${typing.passage_language}, ${typing.device_type})`,
    );
  } else {
    screening.push("Typing: not completed");
  }

  return `You are assisting a hiring team reviewing a job application. Write an honest, balanced, factual mini-summary of this candidate in 3–5 short sentences.

Rules:
- Base the summary ONLY on the form answers and screening numbers below.
- Do NOT invent experience, skills, motivations, or demographics that are not stated.
- If data is missing (e.g. screening not completed), say so briefly — do not speculate.
- Mention cognitive (score/percentile if present), EQ (score/dimensions if present), and typing (WPM/accuracy if present) when available.
- Neutral professional tone. No hype, no fluff, no recommendations to hire/reject.
- Plain prose only (no bullets, no markdown headings).

Preferred language of candidate: ${response.preferred_language ?? "unknown"}

Screening:
${screening.join("\n")}

Form Q&A:
${qaLines || "(no answers)"}`;
}

/**
 * Call Anthropic Messages API. Returns null if API key missing or call fails.
 */
export async function generateApplicationAiSummary(input: {
  response: ApplicationFormResponseWithAnswers;
  questions: ApplicationFormQuestion[];
}): Promise<string | null> {
  const prompt = buildPrompt(input.response, input.questions);
  const result = await callAnthropic({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 400,
    temperature: 0.2,
    logLabel: "application-ai-summary",
    model: APPLICATION_AI_SUMMARY_MODEL,
  });
  return result?.text ?? null;
}
