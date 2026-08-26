/**
 * Server-side Anthropic translation for application answer text.
 * Model: claude-sonnet-4-6 (same as AI summary).
 */

import { APPLICATION_AI_SUMMARY_MODEL } from "@/lib/application-ai-summary";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

export type ApplicationTranslationLang = "en" | "el";

export type ApplicationAnswerTranslationResult = {
  source_lang: string;
  source_lang_label: string;
  translation_lang: ApplicationTranslationLang;
  translated_text: string;
};

type AnthropicContentBlock = { type?: string; text?: string };
type AnthropicMessagesResponse = {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
};

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeLangCode(raw: unknown): string {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
  if (!s) return "und";
  if (s === "greek" || s.startsWith("el")) return "el";
  if (s === "english" || s.startsWith("en")) return "en";
  return s.slice(0, 12);
}

function langLabel(code: string): string {
  if (code === "el") return "Greek";
  if (code === "en") return "English";
  if (code === "und") return "Unknown";
  return code.toUpperCase();
}

function pickTarget(source: string): ApplicationTranslationLang {
  return source === "el" ? "en" : "el";
}

function buildPrompt(text: string): string {
  return `You translate job-application answers for a bilingual (Greek/English) hiring team.

Detect the language of the text below. Then:
- If the source is Greek → translate into natural, fluent English.
- Otherwise → translate into natural, fluent Greek (Modern Greek).

Rules:
- Preserve meaning, tone, and proper nouns; do not invent content.
- Keep line breaks when they matter.
- Output ONLY a single JSON object (no markdown) with keys:
  source_lang (short code: en, el, or other ISO-ish),
  source_lang_label (English name, e.g. "English"),
  translation_lang ("en" or "el"),
  translated_text (the translation only).

Text to translate:
"""
${text}
"""`;
}

/**
 * Translate one answer via Anthropic. Returns null if API key missing or call fails.
 */
export async function translateApplicationAnswerText(
  text: string,
): Promise<ApplicationAnswerTranslationResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[application-ai-translate] ANTHROPIC_API_KEY not set — skipping");
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) return null;

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
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{ role: "user", content: buildPrompt(trimmed) }],
      }),
    });

    const data = (await res.json().catch(() => ({}))) as AnthropicMessagesResponse;
    if (!res.ok) {
      console.error(
        "[application-ai-translate] Anthropic error",
        res.status,
        data?.error?.message ?? data,
      );
      return null;
    }

    const raw = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text!.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    const parsed = extractJsonObject(raw);
    if (!parsed) {
      console.error("[application-ai-translate] failed to parse JSON", raw.slice(0, 200));
      return null;
    }

    const source_lang = normalizeLangCode(parsed.source_lang);
    const translation_lang: ApplicationTranslationLang =
      normalizeLangCode(parsed.translation_lang) === "en" ||
      normalizeLangCode(parsed.translation_lang) === "el"
        ? (normalizeLangCode(parsed.translation_lang) as ApplicationTranslationLang)
        : pickTarget(source_lang);

    const translated_text = String(parsed.translated_text ?? "").trim();
    if (!translated_text) return null;

    const source_lang_label =
      String(parsed.source_lang_label ?? "").trim() || langLabel(source_lang);

    return {
      source_lang,
      source_lang_label,
      translation_lang,
      translated_text,
    };
  } catch (err) {
    console.error("[application-ai-translate] fetch failed", err);
    return null;
  }
}

export function translationLangLabel(code: string | null | undefined): string {
  return langLabel(normalizeLangCode(code));
}
