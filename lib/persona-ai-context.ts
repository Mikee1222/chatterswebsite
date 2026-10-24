/**
 * AI context allowlist builder for Model Personas.
 * Physique + Intimate Details NEVER included.
 * Religion/ideology/relationship/orientation only when flags are on.
 * Never log persona content — only keys.
 */

import {
  AI_PERSONA_ALLOWLIST_KEYS,
  type ModelPersona,
  type ModelPersonaLiveUpdate,
  type PersonaAiContextFlags,
} from "@/lib/persona-types";

export type PersonaAiContextBundle = {
  /** Allowlisted key paths included in this build (for logging / tests). */
  allowlistKeysUsed: string[];
  /** Structured context object for prompts (no sensitive sections). */
  context: Record<string, unknown>;
  /** Flat text block for system/user prompts. */
  contextText: string;
};

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (typeof v === "boolean") return false;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>).every(isEmptyValue);
  }
  return false;
}

const OPT_IN_PATHS: Record<string, keyof PersonaAiContextFlags> = {
  "personal_info.relationship_status": "relationship",
  "personal_info.orientation": "orientation",
  "personal_info.religious_beliefs": "religion",
  "personal_info.ideological_beliefs": "ideology",
};

/** Keys that must never appear in AI context. */
export const FORBIDDEN_AI_CONTEXT_KEYS = [
  "physique",
  "intimate_details",
  "chatting.explicitness_level",
  "socials.other_nsfw_platforms",
] as const;

/**
 * Build allowlisted AI context from a persona + active live updates.
 * Does NOT include chatting.explicitness_level (chatting-only).
 */
export function buildPersonaAiContext(
  persona: ModelPersona,
  liveUpdates: ModelPersonaLiveUpdate[] = [],
): PersonaAiContextBundle {
  const flags = persona.ai_context_flags;
  const allowlistKeysUsed: string[] = [];
  const context: Record<string, unknown> = {};

  for (const key of AI_PERSONA_ALLOWLIST_KEYS) {
    if (key === "live_updates") continue;
    if (key === "lifestyle") {
      if (!isEmptyValue(persona.lifestyle)) {
        context.lifestyle = persona.lifestyle;
        allowlistKeysUsed.push("lifestyle");
      }
      continue;
    }
    if (key === "bio") {
      if (persona.bio.trim()) {
        context.bio = persona.bio;
        allowlistKeysUsed.push("bio");
      }
      continue;
    }

    const optFlag = OPT_IN_PATHS[key];
    if (optFlag && !flags[optFlag]) continue;

    const value = getPath(persona, key);
    if (isEmptyValue(value)) continue;

    // Nest into context by path
    const parts = key.split(".");
    let cur = context;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]!;
      if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
      cur = cur[p] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]!] = value;
    allowlistKeysUsed.push(key);
  }

  const activeLive = liveUpdates.filter((u) => u.is_live && new Date(u.ends_at).getTime() > Date.now());
  if (activeLive.length) {
    context.live_updates = activeLive.map((u) => ({
      content: u.content,
      status: u.status,
      ends_at: u.ends_at,
    }));
    allowlistKeysUsed.push("live_updates");
  }

  // Safety: strip any forbidden keys if somehow present
  for (const blocked of FORBIDDEN_AI_CONTEXT_KEYS) {
    if (blocked.includes(".")) {
      const [a, b] = blocked.split(".");
      const nest = context[a!];
      if (nest && typeof nest === "object" && b) {
        delete (nest as Record<string, unknown>)[b];
      }
    } else {
      delete context[blocked];
    }
  }

  const contextText = formatContextText(context);
  return { allowlistKeysUsed, context, contextText };
}

function formatContextText(ctx: Record<string, unknown>, prefix = ""): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(ctx)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      lines.push(`${path}: ${String(v)}`);
    } else if (Array.isArray(v)) {
      lines.push(`${path}: ${JSON.stringify(v)}`);
    } else if (typeof v === "object") {
      lines.push(formatContextText(v as Record<string, unknown>, path));
    }
  }
  return lines.filter(Boolean).join("\n");
}

/** Platform-safe system rules for IG/TT/FB/Snap social outputs. */
export const PLATFORM_SAFE_SOCIAL_RULES = `
Platform-safe social output rules (Instagram / TikTok / Facebook / Snapchat):
- No explicit sexual language, no nudity descriptions, no graphic body talk.
- Suggestive tease is OK; never explicit.
- Persona chatting explicitness level must NOT raise output beyond platform-safe.
- Preserve emoji and line breaks exactly as natural for the voice.
- Never invent claims that contradict red lines or avoid topics.
`.trim();

/**
 * Programmatic filters: avoid-words + red-line topic keywords + platform-unsafe patterns.
 * Returns null if OK, or reason string if should drop.
 */
export function socialOutputViolationReason(
  text: string,
  avoidWords: string[] = [],
  redLines: string = "",
): string | null {
  const lower = text.toLowerCase();

  for (const w of avoidWords) {
    const term = w.trim().toLowerCase();
    if (term && lower.includes(term)) return `avoid-word:${term}`;
  }

  // Crude red-line topic match: split red lines into phrases ≥ 4 chars
  const redPhrases = redLines
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 4);
  for (const phrase of redPhrases) {
    if (lower.includes(phrase)) return `red-line:${phrase}`;
  }

  // Platform-unsafe explicit patterns (conservative)
  const explicitPatterns = [
    /\b(nude|naked|nsfw|onlyfans?\s*link|dick|cock|pussy|cum\b|orgasm|blowjob|handjob|anal\b|sex\s*tape)\b/i,
    /\b(explicit\s+nude|full\s+nude|show\s+my\s+body)\b/i,
  ];
  for (const re of explicitPatterns) {
    if (re.test(text)) return "platform-unsafe";
  }

  return null;
}

/** Filter a list of variations; returns kept + drop reasons (no content logged). */
export function filterSocialVariations(
  variations: string[],
  avoidWords: string[],
  redLines: string,
): { kept: string[]; droppedReasons: string[] } {
  const kept: string[] = [];
  const droppedReasons: string[] = [];
  for (const v of variations) {
    const reason = socialOutputViolationReason(v, avoidWords, redLines);
    if (reason) droppedReasons.push(reason);
    else kept.push(v);
  }
  return { kept, droppedReasons };
}
