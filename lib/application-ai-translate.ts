/**
 * Server-side Anthropic translation for application answer text.
 * Uses Haiku for mechanical translation; caches by text hash.
 */

import { createHash } from "node:crypto";
import { APPLICATION_AI_SUMMARY_MODEL } from "@/lib/application-ai-summary";
import { callAnthropic, extractJsonObject } from "@/lib/ai-assistant";
import {
  getAiFeatureCache,
  isAiCacheStale,
  upsertAiFeatureCache,
} from "@/services/ai-feature-cache";

export type ApplicationTranslationLang = "en" | "el";

export type ApplicationAnswerTranslationResult = {
  source_lang: string;
  source_lang_label: string;
  translation_lang: ApplicationTranslationLang;
  translated_text: string;
};

const FEATURE_KEY = "application_answer_translate";
const MONTH_MS = 32 * 24 * 60 * 60 * 1000;

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

function parseTranslation(raw: string): ApplicationAnswerTranslationResult | null {
  const parsed = extractJsonObject(raw);
  if (!parsed) return null;

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
}

/**
 * Translate one answer via Anthropic. Returns null if API key missing or call fails.
 */
export async function translateApplicationAnswerText(
  text: string,
): Promise<ApplicationAnswerTranslationResult | null> {
  const trimmed = text.trim().slice(0, 6000);
  if (!trimmed) return null;

  const cacheKey = createHash("sha256").update(trimmed).digest("hex").slice(0, 40);
  const cached = await getAiFeatureCache(FEATURE_KEY, cacheKey);
  if (cached && !isAiCacheStale(cached, MONTH_MS)) {
    const fromSnap = cached.context_snapshot as Partial<ApplicationAnswerTranslationResult>;
    if (fromSnap.translated_text && fromSnap.translation_lang) {
      return {
        source_lang: String(fromSnap.source_lang ?? "und"),
        source_lang_label: String(fromSnap.source_lang_label ?? langLabel(String(fromSnap.source_lang ?? "und"))),
        translation_lang: fromSnap.translation_lang as ApplicationTranslationLang,
        translated_text: fromSnap.translated_text,
      };
    }
    const parsedCached = parseTranslation(cached.content_text);
    if (parsedCached) return parsedCached;
  }

  const maxTokens = Math.min(1200, Math.max(300, Math.ceil(trimmed.length * 1.2)));
  const result = await callAnthropic({
    model: APPLICATION_AI_SUMMARY_MODEL,
    messages: [{ role: "user", content: buildPrompt(trimmed) }],
    maxTokens,
    temperature: 0.2,
    logLabel: "application-ai-translate",
  });
  if (!result) return null;

  const parsed = parseTranslation(result.text);
  if (!parsed) {
    console.error("[application-ai-translate] failed to parse JSON", result.text.slice(0, 200));
    return null;
  }

  await upsertAiFeatureCache({
    featureKey: FEATURE_KEY,
    cacheKey,
    contentText: result.text,
    contextSnapshot: parsed as unknown as Record<string, unknown>,
    model: result.model,
  }).catch(() => null);

  return parsed;
}

export function translationLangLabel(code: string | null | undefined): string {
  return langLabel(normalizeLangCode(code));
}
