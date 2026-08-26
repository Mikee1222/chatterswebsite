/**
 * Server-side Anthropic (Claude) AI mini-summary for application responses.
 * API key: ANTHROPIC_API_KEY (server-only). Model: claude-sonnet-4-6.
 */

import type {
  ApplicationFormAnswer,
  ApplicationFormQuestion,
  ApplicationFormResponseWithAnswers,
} from "@/lib/application-forms-types";

export const APPLICATION_AI_SUMMARY_MODEL = "claude-sonnet-4-6";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

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

type AnthropicContentBlock = { type?: string; text?: string };

type AnthropicMessagesResponse = {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
};

/**
 * Call Anthropic Messages API. Returns null if API key missing or call fails.
 */
export async function generateApplicationAiSummary(input: {
  response: ApplicationFormResponseWithAnswers;
  questions: ApplicationFormQuestion[];
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[application-ai-summary] ANTHROPIC_API_KEY not set — skipping");
    return null;
  }

  const prompt = buildPrompt(input.response, input.questions);

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: APPLICATION_AI_SUMMARY_MODEL,
        max_tokens: 500,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = (await res.json().catch(() => ({}))) as AnthropicMessagesResponse;
    if (!res.ok) {
      console.error(
        "[application-ai-summary] Anthropic error",
        res.status,
        data?.error?.message ?? data,
      );
      return null;
    }

    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text!.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    return text || null;
  } catch (err) {
    console.error("[application-ai-summary] fetch failed", err);
    return null;
  }
}

/** Short card blurb from full summary (first ~160 chars / first sentence). */
export function shortAiSummary(full: string | null | undefined, maxLen = 160): string | null {
  if (!full?.trim()) return null;
  const trimmed = full.trim();
  const sentenceEnd = trimmed.search(/[.!?](?:\s|$)/);
  if (sentenceEnd > 40 && sentenceEnd <= maxLen) {
    return trimmed.slice(0, sentenceEnd + 1).trim();
  }
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
