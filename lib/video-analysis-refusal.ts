/**
 * Video Analyzer refusal detection + neutral user messaging.
 * Raw model text is never returned for user-facing display.
 */

import type { VideoAnalysisJson } from "@/lib/creative-studio-types";

export const NEUTRAL_ANALYSIS_REFUSAL_MESSAGE =
  "Automatic analysis wasn't possible for this clip. You can describe it yourself below and still get captions and text on screen.";

export type VideoAnalysisRefusalReason =
  | "success"
  | "empty"
  | "non_json"
  | "refusal_flag"
  | "refusal_text"
  | "all_frames_failed"
  | "partial_refusal";

export type ParsedVideoAnalysis = {
  refused: boolean;
  reason: VideoAnalysisRefusalReason;
  /** User-safe analysis. When refused, refusal_message is always the neutral copy. */
  analysis: VideoAnalysisJson;
  /** Full model text for admin review only — never put in user UI or persona logs. */
  rawModelResponse: string | null;
};

const REFUSAL_TEXT_RE =
  /\b(i\s+can'?t|i\s+cannot|i'?m\s+unable|unable\s+to|not\s+able\s+to|won'?t\s+be\s+able|cannot\s+analyse|cannot\s+analyze|could\s+not\s+analyse|could\s+not\s+analyze|refuse|refusal|against\s+(my|our)\s+guidelines|content\s+policy|safety\s+(policy|guidelines|system)|violat(e|es|ing)\s+(our|the)\s+policy|explicit|sexual\s+content|close-?up\s+body|please\s+resubmit|i\s+must\s+decline|i\s+have\s+to\s+decline)\b/i;

const SUCCESS_KEYS = [
  "setting",
  "outfit",
  "activity",
  "mood_vibe",
  "objects_props",
  "visible_text",
  "suggested_hooks",
  "suggested_caption_angles",
] as const;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => String(x)).filter(Boolean);
}

function looksLikeRefusalText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return REFUSAL_TEXT_RE.test(t);
}

function hasUsableAnalysisFields(obj: Record<string, unknown>): boolean {
  for (const key of SUCCESS_KEYS) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return true;
    if (Array.isArray(v) && v.length > 0) return true;
  }
  return false;
}

function sanitizeSuccessAnalysis(obj: Record<string, unknown>): VideoAnalysisJson {
  const q = obj.quality_flags;
  const quality_flags =
    q && typeof q === "object" && !Array.isArray(q)
      ? {
          blur: Boolean((q as Record<string, unknown>).blur),
          dark: Boolean((q as Record<string, unknown>).dark),
          wrong_orientation: Boolean((q as Record<string, unknown>).wrong_orientation),
          not_9_16: Boolean((q as Record<string, unknown>).not_9_16),
          watermark: Boolean((q as Record<string, unknown>).watermark),
        }
      : undefined;

  return {
    setting: asString(obj.setting) || undefined,
    outfit: asString(obj.outfit) || undefined,
    activity: asString(obj.activity) || undefined,
    mood_vibe: asString(obj.mood_vibe) || undefined,
    objects_props: asStringArray(obj.objects_props),
    visible_text: asStringArray(obj.visible_text),
    quality_flags,
    suggested_hooks: asStringArray(obj.suggested_hooks),
    suggested_caption_angles: asStringArray(obj.suggested_caption_angles),
  };
}

function refusedResult(
  reason: Exclude<VideoAnalysisRefusalReason, "success">,
  raw: string | null,
): ParsedVideoAnalysis {
  return {
    refused: true,
    reason,
    analysis: {
      refusal: true,
      refusal_message: NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
    },
    rawModelResponse: raw,
  };
}

function mergeFrameAnalyses(
  frames: unknown[],
): { usable: Record<string, unknown>[]; refusedCount: number } {
  const usable: Record<string, unknown>[] = [];
  let refusedCount = 0;
  for (const f of frames) {
    if (!f || typeof f !== "object" || Array.isArray(f)) {
      refusedCount += 1;
      continue;
    }
    const row = f as Record<string, unknown>;
    if (row.refusal === true || row.ok === false || row.refused === true) {
      refusedCount += 1;
      continue;
    }
    if (hasUsableAnalysisFields(row)) usable.push(row);
    else refusedCount += 1;
  }
  return { usable, refusedCount };
}

function mergeUsableFrames(frames: Record<string, unknown>[]): VideoAnalysisJson {
  const first = frames[0] ?? {};
  const base = sanitizeSuccessAnalysis(first);
  const props = new Set<string>(base.objects_props ?? []);
  const texts = new Set<string>(base.visible_text ?? []);
  const hooks = new Set<string>(base.suggested_hooks ?? []);
  const angles = new Set<string>(base.suggested_caption_angles ?? []);
  for (const f of frames.slice(1)) {
    const next = sanitizeSuccessAnalysis(f);
    if (!base.setting && next.setting) base.setting = next.setting;
    if (!base.outfit && next.outfit) base.outfit = next.outfit;
    if (!base.activity && next.activity) base.activity = next.activity;
    if (!base.mood_vibe && next.mood_vibe) base.mood_vibe = next.mood_vibe;
    for (const p of next.objects_props ?? []) props.add(p);
    for (const t of next.visible_text ?? []) texts.add(t);
    for (const h of next.suggested_hooks ?? []) hooks.add(h);
    for (const a of next.suggested_caption_angles ?? []) angles.add(a);
  }
  return {
    ...base,
    objects_props: props.size ? [...props] : undefined,
    visible_text: texts.size ? [...texts] : undefined,
    suggested_hooks: hooks.size ? [...hooks] : undefined,
    suggested_caption_angles: angles.size ? [...angles] : undefined,
  };
}

/**
 * Parse a mocked or live model response into a user-safe analysis.
 * Never exposes raw refusal/safety prose in `analysis.refusal_message`.
 */
export function parseVideoAnalysisModelResponse(
  raw: string | null | undefined,
  opts?: { allFramesFailed?: boolean },
): ParsedVideoAnalysis {
  if (opts?.allFramesFailed) {
    return refusedResult("all_frames_failed", typeof raw === "string" ? raw : null);
  }

  if (raw == null || !String(raw).trim()) {
    return refusedResult("empty", null);
  }

  const text = String(raw);
  const trimmed = text.trim();

  // Prefer JSON when present
  let obj: Record<string, unknown> | null = null;
  try {
    // Local extract to keep this module free of server-only imports for tests
    const { extractJsonObject } = requireJsonExtract();
    obj = extractJsonObject(trimmed);
  } catch {
    obj = null;
  }

  if (!obj) {
    // Non-JSON: always refuse; store raw for admin. Never surface model text.
    return refusedResult(
      looksLikeRefusalText(trimmed) ? "refusal_text" : "non_json",
      trimmed.slice(0, 8_000),
    );
  }

  // Optional per-frame payload (partial refusal support)
  const frameList = obj.frame_analyses ?? obj.frames;
  if (Array.isArray(frameList) && frameList.length > 0) {
    const { usable, refusedCount } = mergeFrameAnalyses(frameList);
    if (usable.length === 0) {
      return refusedResult("all_frames_failed", trimmed.slice(0, 8_000));
    }
    if (refusedCount > 0) {
      return {
        refused: false,
        reason: "partial_refusal",
        analysis: mergeUsableFrames(usable),
        rawModelResponse: trimmed.slice(0, 8_000),
      };
    }
    return {
      refused: false,
      reason: "success",
      analysis: mergeUsableFrames(usable),
      rawModelResponse: null,
    };
  }

  if (obj.refusal === true) {
    return refusedResult("refusal_flag", trimmed.slice(0, 8_000));
  }

  const refusalMsg = asString(obj.refusal_message);
  if (refusalMsg && looksLikeRefusalText(refusalMsg) && !hasUsableAnalysisFields(obj)) {
    return refusedResult("refusal_text", trimmed.slice(0, 8_000));
  }

  if (!hasUsableAnalysisFields(obj)) {
    // Empty JSON shell or safety-only prose stuffed into fields
    const blob = [
      asString(obj.setting),
      asString(obj.outfit),
      asString(obj.activity),
      asString(obj.mood_vibe),
      refusalMsg,
      trimmed,
    ].join(" ");
    if (looksLikeRefusalText(blob)) {
      return refusedResult("refusal_text", trimmed.slice(0, 8_000));
    }
    return refusedResult("non_json", trimmed.slice(0, 8_000));
  }

  // Successful structured analysis — still refuse if the whole payload is clearly a safety lecture
  const fieldBlob = [
    asString(obj.setting),
    asString(obj.outfit),
    asString(obj.activity),
    asString(obj.mood_vibe),
  ].join(" ");
  if (looksLikeRefusalText(fieldBlob) && !asString(obj.outfit) && !asString(obj.activity)) {
    return refusedResult("refusal_text", trimmed.slice(0, 8_000));
  }

  return {
    refused: false,
    reason: "success",
    analysis: sanitizeSuccessAnalysis(obj),
    rawModelResponse: null,
  };
}

function requireJsonExtract(): {
  extractJsonObject: (raw: string) => Record<string, unknown> | null;
} {
  // Inline minimal extract so unit tests don't need the full ai-assistant module graph.
  // Mirrors lib/ai-assistant extractJsonObject behaviour.
  return {
    extractJsonObject(raw: string) {
      const candidate = stripFence(raw);
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
    },
  };
}

function stripFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const closed = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (closed?.[1] != null) return closed[1].trim();
  const openOnly = trimmed.match(/^```(?:json)?\s*([\s\S]*)$/i);
  if (openOnly?.[1] != null) return openOnly[1].replace(/\s*```\s*$/, "").trim();
  return trimmed;
}

/** Build idea/context text from a manual description form. */
export function manualDescriptionToIdeaContext(input: {
  whatHappens?: string;
  setting?: string;
  outfit?: string;
  mood?: string;
  props?: string;
  visibleText?: string;
}): string {
  const parts: string[] = ["[from your description]"];
  if (input.whatHappens?.trim()) parts.push(`What happens: ${input.whatHappens.trim()}`);
  if (input.setting?.trim()) parts.push(`Setting: ${input.setting.trim()}`);
  if (input.outfit?.trim()) parts.push(`Outfit: ${input.outfit.trim()}`);
  if (input.mood?.trim()) parts.push(`Mood: ${input.mood.trim()}`);
  if (input.props?.trim()) parts.push(`Props: ${input.props.trim()}`);
  if (input.visibleText?.trim()) parts.push(`Visible text: ${input.visibleText.trim()}`);
  return parts.length > 1 ? parts.join("\n") : "";
}

export function isNeutralRefusalMessage(msg: string | undefined | null): boolean {
  return (msg ?? "").trim() === NEUTRAL_ANALYSIS_REFUSAL_MESSAGE;
}

/** Format analysis into idea/context text for captions / TOS. */
export function analysisToIdeaContext(analysis: VideoAnalysisJson): string {
  if (analysis.refusal) {
    // Never pipe refusal copy into caption generators
    return "";
  }
  const parts: string[] = [];
  if (analysis.setting) parts.push(`Setting: ${analysis.setting}`);
  if (analysis.outfit) parts.push(`Outfit: ${analysis.outfit}`);
  if (analysis.activity) parts.push(`Activity: ${analysis.activity}`);
  if (analysis.mood_vibe) parts.push(`Mood: ${analysis.mood_vibe}`);
  if (analysis.objects_props?.length) {
    parts.push(`Props: ${analysis.objects_props.join(", ")}`);
  }
  if (analysis.visible_text?.length) {
    parts.push(`Visible text: ${analysis.visible_text.join(" | ")}`);
  }
  if (analysis.suggested_hooks?.length) {
    parts.push(`Hook ideas: ${analysis.suggested_hooks.join(" / ")}`);
  }
  if (analysis.suggested_caption_angles?.length) {
    parts.push(`Caption angles: ${analysis.suggested_caption_angles.join(" / ")}`);
  }
  const q = analysis.quality_flags;
  if (q) {
    const flags = Object.entries(q)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (flags.length) parts.push(`Quality flags: ${flags.join(", ")}`);
  }
  return parts.join("\n");
}
