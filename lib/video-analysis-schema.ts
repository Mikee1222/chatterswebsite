/**
 * Forced tool-call schema for Creative Studio video analysis.
 * Descriptive composition fields — mostly close-up is data, not an error.
 * Client-safe module (no server-only imports).
 */

export const VIDEO_ANALYSIS_TOOL_NAME = "submit_video_analysis";

export type VideoAnalysisToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const SHOT_TYPE_VALUES = [
  "close-up",
  "medium",
  "full-body",
  "wide",
  "other",
] as const;

export type ShotTypeValue = (typeof SHOT_TYPE_VALUES)[number];

export const FRAMING_VARIETY_VALUES = ["low", "medium", "high"] as const;
export type FramingVariety = (typeof FRAMING_VARIETY_VALUES)[number];

export const ANALYSIS_STATUS_VALUES = ["ok", "frames_unreadable"] as const;
export type AnalysisStatusValue = (typeof ANALYSIS_STATUS_VALUES)[number];

/** Max tokens sized for the forced schema payload. */
export const VIDEO_ANALYSIS_MAX_TOKENS = 1600;

export const VIDEO_ANALYSIS_SYSTEM_PROMPT = [
  "You analyse short social-video frame samples for a creative studio.",
  "NEVER identify, name, or guess the identity of any person from faces.",
  "Describe setting, outfit, activity, mood, props, visible text, quality, and shot composition only.",
  "Use the submit_video_analysis tool for every response.",
  "analysis_status must be \"ok\" whenever anything visible is in the frames.",
  "analysis_status \"frames_unreadable\" ONLY when frames are blank, corrupt, or too dark to see anything at all.",
  "Mostly close-up framing is normal data — report it in shot_types / framing_variety; do not treat close-ups as unreadable.",
  "platform_risk and attire are graded advisory fields only.",
  "Keep suggested_hooks and suggested_caption_angles platform-safe (no nudity or explicit sexual detail).",
].join(" ");

export const VIDEO_ANALYSIS_TOOL: VideoAnalysisToolDef = {
  name: VIDEO_ANALYSIS_TOOL_NAME,
  description:
    "Submit structured video-frame analysis. Call exactly once with the full analysis object.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "analysis_status",
      "shot_types",
      "framing_variety",
      "camera_movement",
      "number_of_distinct_scenes",
      "setting",
      "outfit",
      "activity",
      "mood_vibe",
      "objects_props",
      "visible_text",
      "quality_flags",
      "platform_risk",
      "attire",
      "suggested_hooks",
      "suggested_caption_angles",
    ],
    properties: {
      analysis_status: {
        type: "string",
        enum: [...ANALYSIS_STATUS_VALUES],
        description:
          "ok = anything visible; frames_unreadable = blank, corrupt, or too dark to see anything.",
      },
      shot_types: {
        type: "array",
        description: "Shot composition counts across the sample (close-up is data, not an error).",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "count"],
          properties: {
            type: { type: "string", enum: [...SHOT_TYPE_VALUES] },
            count: { type: "integer", minimum: 0 },
          },
        },
      },
      framing_variety: {
        type: "string",
        enum: [...FRAMING_VARIETY_VALUES],
      },
      camera_movement: {
        type: "string",
        description: "Brief note on camera movement (static, pan, handheld, etc.).",
      },
      number_of_distinct_scenes: {
        type: "integer",
        minimum: 0,
        description: "How many distinct scenes/locations appear across frames.",
      },
      setting: { type: "string" },
      outfit: { type: "string" },
      activity: { type: "string" },
      mood_vibe: { type: "string" },
      objects_props: { type: "array", items: { type: "string" } },
      visible_text: { type: "array", items: { type: "string" } },
      quality_flags: {
        type: "object",
        additionalProperties: false,
        required: ["blur", "dark", "wrong_orientation", "not_9_16", "watermark"],
        properties: {
          blur: { type: "boolean" },
          dark: { type: "boolean" },
          wrong_orientation: { type: "boolean" },
          not_9_16: { type: "boolean" },
          watermark: { type: "boolean" },
        },
      },
      platform_risk: {
        type: "object",
        additionalProperties: false,
        required: ["level", "notes"],
        properties: {
          level: { type: "string", enum: ["low", "medium", "high"] },
          notes: { type: "string" },
        },
        description: "Graded advisory only — not a refusal signal.",
      },
      attire: {
        type: "object",
        additionalProperties: false,
        required: ["coverage", "notes"],
        properties: {
          coverage: {
            type: "string",
            enum: ["fully_clothed", "swimwear", "lingerie", "minimal", "unclear"],
          },
          notes: { type: "string" },
        },
        description: "Graded advisory attire coverage — keep notes platform-safe.",
      },
      suggested_hooks: { type: "array", items: { type: "string" } },
      suggested_caption_angles: { type: "array", items: { type: "string" } },
    },
  },
};
