/**
 * Winner Breakdown — forced tool-call schema + types.
 * Takes a transcript (with timestamps) + sampled frames of a viral short video and
 * returns the structural reasons it worked: hook, beats, the turn, viral elements,
 * what MUST be kept vs what is flexible, and variation angles.
 * Client-safe module (no server-only imports).
 */

export const WINNER_BREAKDOWN_TOOL_NAME = "submit_winner_breakdown";

/** Max tokens sized for the forced schema payload (beats + variations can be long). */
export const WINNER_BREAKDOWN_MAX_TOKENS = 4000;

export const WINNER_FORMAT_VALUES = [
  "talking_head",
  "pov",
  "skit",
  "lip_sync",
  "text_over_broll",
  "grwm",
  "transition",
  "vlog_clip",
  "reaction",
  "tutorial",
  "other",
] as const;
export type WinnerFormat = (typeof WINNER_FORMAT_VALUES)[number];

export const HOOK_TYPE_VALUES = [
  "curiosity_gap",
  "relatable",
  "bold_claim",
  "question",
  "shock",
  "visual",
  "pattern_interrupt",
  "other",
] as const;
export type HookType = (typeof HOOK_TYPE_VALUES)[number];

export const VIRAL_ELEMENT_CATEGORIES = [
  "hook",
  "relatability",
  "humor",
  "curiosity",
  "tension_release",
  "innuendo",
  "sound",
  "visual",
  "format",
  "identity",
  "controversy",
  "other",
] as const;
export type ViralElementCategory = (typeof VIRAL_ELEMENT_CATEGORIES)[number];

export const TEXT_ON_SCREEN_ROLE_VALUES = [
  "none",
  "hook",
  "punchline",
  "subtitles",
  "context",
  "cta",
] as const;

export const SOUND_TYPE_VALUES = [
  "original_voice",
  "trending_audio",
  "music_only",
  "voice_plus_music",
  "silent",
  "unknown",
] as const;

export const CONFIDENCE_VALUES = ["low", "medium", "high"] as const;

export type WinnerBeat = {
  t_start: number;
  t_end: number;
  what_happens: string;
  spoken: string;
  on_screen_text: string;
  purpose: string;
};

export type ViralElement = {
  element: string;
  category: ViralElementCategory;
  why_it_works: string;
  evidence: string;
};

export type VariationAngle = {
  title: string;
  premise: string;
  keeps: string;
  changes: string;
};

export type WinnerBreakdownJson = {
  summary?: string;
  format?: WinnerFormat;
  duration_sec?: number;
  hook?: {
    text: string;
    type: HookType;
    why_it_stops_scroll: string;
  };
  beats?: WinnerBeat[];
  turn?: {
    at_sec: number;
    what: string;
    why: string;
  };
  viral_elements?: ViralElement[];
  must_keep?: string[];
  flexible?: string[];
  text_on_screen_role?: (typeof TEXT_ON_SCREEN_ROLE_VALUES)[number];
  sound?: {
    type: (typeof SOUND_TYPE_VALUES)[number];
    role: string;
  };
  audience_trigger?: string;
  share_driver?: string;
  why_it_works?: string;
  variation_angles?: VariationAngle[];
  risks?: string[];
  confidence?: (typeof CONFIDENCE_VALUES)[number];
  missing_info?: string[];
  refusal?: boolean;
  refusal_message?: string;
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export const WINNER_BREAKDOWN_SYSTEM_PROMPT = [
  "You are a senior short-form content strategist breaking down a viral vertical video (Instagram Reel / TikTok) for a creative team.",
  "You receive: the spoken transcript with timestamps, evenly spaced frames from the video, and optionally the original caption/notes.",
  "Your job is to explain WHY this video worked structurally, so the team can recreate the mechanism with a different creator without copying the video.",
  "NEVER identify, name, or guess the identity of any person from faces or voice.",
  "Be concrete and specific. Quote the exact spoken or on-screen words when they matter. Timestamps in seconds.",
  "must_keep = the elements that carry the virality; changing them would kill the result (e.g. the exact hook structure, the timing of the turn, the innuendo mechanism).",
  "flexible = things that can be swapped freely (setting, outfit, specific names/references, props, order of minor details).",
  "variation_angles = 3 to 5 new premises that keep EVERY must_keep element and change only flexible ones. They are seeds for briefs, not full scripts.",
  "Keep everything platform-safe: innuendo and suggestion are fine, explicit sexual wording is not. Flag real platform risks in risks.",
  "If audio is missing or the transcript is empty, say so in missing_info and rely on frames + caption; lower confidence accordingly.",
  "Always respond with the submit_winner_breakdown tool. Write in English.",
].join(" ");

export const WINNER_BREAKDOWN_TOOL = {
  name: WINNER_BREAKDOWN_TOOL_NAME,
  description:
    "Submit the structured breakdown of a viral short video. Call exactly once with the full object.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "format",
      "hook",
      "beats",
      "turn",
      "viral_elements",
      "must_keep",
      "flexible",
      "text_on_screen_role",
      "sound",
      "audience_trigger",
      "share_driver",
      "why_it_works",
      "variation_angles",
      "risks",
      "confidence",
      "missing_info",
    ],
    properties: {
      summary: {
        type: "string",
        description: "1–2 sentences: what the video is, in plain words.",
      },
      format: { type: "string", enum: [...WINNER_FORMAT_VALUES] },
      hook: {
        type: "object",
        additionalProperties: false,
        required: ["text", "type", "why_it_stops_scroll"],
        properties: {
          text: {
            type: "string",
            description: "The exact hook — spoken and/or on-screen words in the first ~3 seconds.",
          },
          type: { type: "string", enum: [...HOOK_TYPE_VALUES] },
          why_it_stops_scroll: { type: "string" },
        },
      },
      beats: {
        type: "array",
        description: "The video's structure as 3–8 beats in order, with timestamps.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["t_start", "t_end", "what_happens", "spoken", "on_screen_text", "purpose"],
          properties: {
            t_start: { type: "number", minimum: 0 },
            t_end: { type: "number", minimum: 0 },
            what_happens: { type: "string" },
            spoken: { type: "string", description: "Spoken words in this beat ('' if none)." },
            on_screen_text: { type: "string", description: "On-screen text ('' if none)." },
            purpose: {
              type: "string",
              description: "What this beat does for retention (setup, tension, payoff, CTA…).",
            },
          },
        },
      },
      turn: {
        type: "object",
        additionalProperties: false,
        required: ["at_sec", "what", "why"],
        description: "The moment the video pays off / flips expectation.",
        properties: {
          at_sec: { type: "number", minimum: 0 },
          what: { type: "string" },
          why: { type: "string" },
        },
      },
      viral_elements: {
        type: "array",
        description: "2–6 specific mechanisms that made it spread, each with evidence from the video.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["element", "category", "why_it_works", "evidence"],
          properties: {
            element: { type: "string" },
            category: { type: "string", enum: [...VIRAL_ELEMENT_CATEGORIES] },
            why_it_works: { type: "string" },
            evidence: {
              type: "string",
              description: "Quote or timestamp from the transcript/frames that proves it.",
            },
          },
        },
      },
      must_keep: {
        type: "array",
        items: { type: "string" },
        description: "Elements a variation MUST preserve. Short, concrete bullets.",
      },
      flexible: {
        type: "array",
        items: { type: "string" },
        description: "Elements a variation can change freely.",
      },
      text_on_screen_role: { type: "string", enum: [...TEXT_ON_SCREEN_ROLE_VALUES] },
      sound: {
        type: "object",
        additionalProperties: false,
        required: ["type", "role"],
        properties: {
          type: { type: "string", enum: [...SOUND_TYPE_VALUES] },
          role: { type: "string", description: "What the sound does for the video." },
        },
      },
      audience_trigger: {
        type: "string",
        description: "The emotion / identity / situation the viewer recognises in themselves.",
      },
      share_driver: {
        type: "string",
        description: "Why someone sends this to a friend, tags someone, or comments.",
      },
      why_it_works: {
        type: "string",
        description: "One tight paragraph a creator can read before filming.",
      },
      variation_angles: {
        type: "array",
        description: "3–5 new premises that keep all must_keep elements.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "premise", "keeps", "changes"],
          properties: {
            title: { type: "string" },
            premise: { type: "string", description: "2–3 sentences: the new scenario." },
            keeps: { type: "string", description: "Which must_keep elements it preserves and how." },
            changes: { type: "string", description: "What flexible elements it swaps." },
          },
        },
      },
      risks: {
        type: "array",
        items: { type: "string" },
        description: "Platform-safety or brand risks to watch when recreating ('' array if none).",
      },
      confidence: { type: "string", enum: [...CONFIDENCE_VALUES] },
      missing_info: {
        type: "array",
        items: { type: "string" },
        description: "What was missing (no audio, no caption, frames too dark…). Empty if nothing.",
      },
    },
  },
} as const;

export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Plain-text transcript with [m:ss] markers — what the model receives and what the CD can edit. */
export function segmentsToTimedText(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => `[${formatSeconds(s.start)}] ${s.text.trim()}`)
    .filter((l) => l.length > 8)
    .join("\n");
}

function humanize(v: string | undefined): string {
  return (v ?? "").replace(/_/g, " ");
}

/** Markdown export of a breakdown — used for Copy and as context for captions / briefs. */
export function breakdownToMarkdown(b: WinnerBreakdownJson, opts?: { title?: string; sourceUrl?: string }): string {
  const lines: string[] = [];
  if (opts?.title) lines.push(`# ${opts.title}`);
  if (opts?.sourceUrl) lines.push(`Source: ${opts.sourceUrl}`);
  if (b.summary) lines.push("", `**What it is:** ${b.summary}`);
  const meta: string[] = [];
  if (b.format) meta.push(`Format: ${humanize(b.format)}`);
  if (b.duration_sec) meta.push(`Length: ${formatSeconds(b.duration_sec)}`);
  if (b.sound?.type) meta.push(`Sound: ${humanize(b.sound.type)}${b.sound.role ? ` — ${b.sound.role}` : ""}`);
  if (b.text_on_screen_role) meta.push(`Text on screen: ${humanize(b.text_on_screen_role)}`);
  if (meta.length) lines.push(meta.join(" · "));

  if (b.hook) {
    lines.push("", "## Hook", `"${b.hook.text}" (${humanize(b.hook.type)})`, b.hook.why_it_stops_scroll);
  }
  if (b.beats?.length) {
    lines.push("", "## Structure");
    for (const beat of b.beats) {
      const parts = [`${formatSeconds(beat.t_start)}–${formatSeconds(beat.t_end)} ${beat.what_happens}`];
      if (beat.spoken) parts.push(`Spoken: "${beat.spoken}"`);
      if (beat.on_screen_text) parts.push(`On screen: "${beat.on_screen_text}"`);
      parts.push(`→ ${beat.purpose}`);
      lines.push(`- ${parts.join(" · ")}`);
    }
  }
  if (b.turn) {
    lines.push("", "## The turn", `${formatSeconds(b.turn.at_sec)} — ${b.turn.what}`, b.turn.why);
  }
  if (b.viral_elements?.length) {
    lines.push("", "## Viral elements");
    for (const v of b.viral_elements) {
      lines.push(`- **${v.element}** (${humanize(v.category)}): ${v.why_it_works} _Evidence: ${v.evidence}_`);
    }
  }
  if (b.must_keep?.length) {
    lines.push("", "## MUST KEEP");
    for (const m of b.must_keep) lines.push(`- ${m}`);
  }
  if (b.flexible?.length) {
    lines.push("", "## Flexible");
    for (const f of b.flexible) lines.push(`- ${f}`);
  }
  if (b.audience_trigger) lines.push("", `**Audience trigger:** ${b.audience_trigger}`);
  if (b.share_driver) lines.push(`**Share driver:** ${b.share_driver}`);
  if (b.why_it_works) lines.push("", "## Why it works", b.why_it_works);
  if (b.variation_angles?.length) {
    lines.push("", "## Variation angles");
    b.variation_angles.forEach((v, i) => {
      lines.push(`${i + 1}. **${v.title}** — ${v.premise}`, `   Keeps: ${v.keeps}`, `   Changes: ${v.changes}`);
    });
  }
  if (b.risks?.length) {
    lines.push("", "## Risks");
    for (const r of b.risks) lines.push(`- ${r}`);
  }
  if (b.confidence) {
    lines.push("", `Confidence: ${b.confidence}${b.missing_info?.length ? ` · Missing: ${b.missing_info.join("; ")}` : ""}`);
  }
  return lines.join("\n").trim();
}

/** Short context string for the Captions / Text-on-screen generators. */
export function breakdownToIdeaContext(b: WinnerBreakdownJson): string {
  const parts: string[] = [];
  if (b.summary) parts.push(b.summary);
  if (b.hook?.text) parts.push(`Hook: "${b.hook.text}"`);
  if (b.audience_trigger) parts.push(`Audience trigger: ${b.audience_trigger}`);
  if (b.must_keep?.length) parts.push(`Keep: ${b.must_keep.slice(0, 4).join("; ")}`);
  if (b.why_it_works) parts.push(b.why_it_works);
  return parts.join(" ").slice(0, 1200);
}
