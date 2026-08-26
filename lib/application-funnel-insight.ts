/**
 * Anthropic (Claude) natural-language insights for application-link funnel analytics.
 * Same model/pattern as candidate ai_summary. Strictly grounded in provided numbers.
 */

import { APPLICATION_AI_SUMMARY_MODEL } from "@/lib/application-ai-summary";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

type AnthropicContentBlock = { type?: string; text?: string };
type AnthropicMessagesResponse = {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
};

function buildPrompt(snapshot: Record<string, unknown>, formTitle: string): string {
  return `You are analyzing recruitment funnel analytics for an application form titled "${formTitle}".

Write a concise natural-language insight (4–7 short sentences) for hiring managers.

STRICT RULES:
- Use ONLY the numbers in the JSON snapshot below. Do not invent metrics, trends, causes, or demographics.
- If sample_note is "small_sample" (or views/started are very low), explicitly say the sample is small and insights are tentative / directional only.
- Call out the biggest drop-off step if most_lossy_step is present, using the provided counts and percentages.
- Mention completion rate and average time to complete when present (avg_time_to_complete_seconds may be null).
- Mention device mix briefly if devices array has data.
- Neutral professional tone. No hype. No markdown headings or bullet lists — plain prose paragraphs only.
- Do not recommend specific hiring decisions.

Funnel snapshot JSON:
${JSON.stringify(snapshot, null, 2)}`;
}

/**
 * Generate funnel insight. Returns null if API key missing or call fails.
 */
export async function generateApplicationFunnelInsight(input: {
  formTitle: string;
  snapshot: Record<string, unknown>;
}): Promise<{ text: string; model: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[application-funnel-insight] ANTHROPIC_API_KEY not set — skipping");
    return null;
  }

  const prompt = buildPrompt(input.snapshot, input.formTitle);

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
        max_tokens: 700,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = (await res.json().catch(() => ({}))) as AnthropicMessagesResponse;
    if (!res.ok) {
      console.error(
        "[application-funnel-insight] Anthropic error",
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

    if (!text) return null;
    return { text, model: APPLICATION_AI_SUMMARY_MODEL };
  } catch (err) {
    console.error("[application-funnel-insight] fetch failed", err);
    return null;
  }
}
