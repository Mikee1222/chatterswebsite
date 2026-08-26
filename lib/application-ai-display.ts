/**
 * Client-safe display helpers for application AI fields.
 * Keep Node builtins / Anthropic calls out of this module.
 */

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

/** Human label for a stored translation language code. */
export function translationLangLabel(code: string | null | undefined): string {
  return langLabel(normalizeLangCode(code));
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
