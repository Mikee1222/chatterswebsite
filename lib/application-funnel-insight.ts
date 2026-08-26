/**
 * Anthropic (Claude) natural-language insights for application-link funnel analytics.
 * Same model/pattern as candidate ai_summary. Strictly grounded in provided numbers.
 * Client must call the analytics insights API — never import this module in client components.
 */

import "server-only";

import { APPLICATION_AI_SUMMARY_MODEL } from "@/lib/application-ai-summary";
import { callAnthropic } from "@/lib/ai-assistant";

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
${JSON.stringify(snapshot)}`;
}

/**
 * Generate funnel insight. Returns null if API key missing or call fails.
 */
export async function generateApplicationFunnelInsight(input: {
  formTitle: string;
  snapshot: Record<string, unknown>;
}): Promise<{ text: string; model: string } | null> {
  const result = await callAnthropic({
    model: APPLICATION_AI_SUMMARY_MODEL,
    messages: [{ role: "user", content: buildPrompt(input.snapshot, input.formTitle) }],
    maxTokens: 550,
    temperature: 0.2,
    logLabel: "application-funnel-insight",
  });
  if (!result) return null;
  return { text: result.text, model: result.model };
}
