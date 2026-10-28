/**
 * Draft briefs from a Winner Breakdown — forced tool-call schema + types.
 * The CD decides creator, content type (Editable / Creation) and flow; the model
 * writes the brief text in the house format. Nothing here publishes anything.
 * Client-safe module (no server-only imports).
 */

export const BRIEF_DRAFTS_TOOL_NAME = "submit_brief_drafts";
export const BRIEF_DRAFTS_MAX_TOKENS = 8000;

export const CONTENT_TYPE_VALUES = ["editable", "creation"] as const;
export type DraftContentType = (typeof CONTENT_TYPE_VALUES)[number];

export const FLOW_VALUES = ["batch", "urgent", "trend"] as const;
export type DraftFlow = (typeof FLOW_VALUES)[number];

export type DraftRecordingVariation = {
  name: string;
  script_shot_list: string;
  takes: number;
  notes: string;
};

export type DraftRecording = {
  title: string;
  concept_why: string;
  /** Wardrobe picks by number (0 = none / not in wardrobe). One each for the whole brief. */
  outfit_number: number;
  location_number: number;
  prop_numbers: number[];
  setup_camera: string;
  setup_framing: string;
  setup_location: string;
  setup_outfit: string;
  setup_light: string;
  setup_sound: string;
  setup_notes: string;
  how_to_talk: string;
  how_to_act: string;
  props: string;
  checklist_before_upload: string;
  variations: DraftRecordingVariation[];
};

export type DraftEditingVideo = {
  output_name: string;
  raw_take: string;
  special_instructions: string;
  text_on_screen: string;
};

export type DraftEditing = {
  title: string;
  concept: string;
  raw_files_takes: string;
  cut_rules: string;
  audio_voice: "keep_voice" | "mute_original" | "clean_up";
  audio_music: boolean;
  audio_notes: string;
  subtitles: boolean;
  do_not_add: string;
  final_check: string;
  videos: DraftEditingVideo[];
};

export type DraftPostingPost = {
  video_name: string;
  text_on_screen: string;
  caption: string;
  pinned_comment: string;
  notes: string;
};

export type DraftPosting = {
  title: string;
  instructions_notes: string;
  sound_name: string;
  sound_notes: string;
  text_style_notes: string;
  timing_notes: string;
  final_checklist: string[];
  posts: DraftPostingPost[];
};

export type BriefDraftsJson = {
  recording?: DraftRecording | null;
  editing: DraftEditing;
  posting: DraftPosting;
};

/** One generated set, stored on the breakdown row. */
export type BriefDraftSet = {
  id: string;
  model_id: string;
  model_name: string;
  content_type: DraftContentType;
  flow: DraftFlow;
  recording_brief_id: string | null;
  editing_brief_id: string | null;
  posting_brief_id: string | null;
  created_by: string;
  created_at: string;
};

const variationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "script_shot_list", "takes", "notes"],
  properties: {
    name: { type: "string", description: "e.g. 'V1 — The confession'. Keep V1..Vn numbering." },
    script_shot_list: {
      type: "string",
      description:
        "Full script and shot list the creator reads on her phone: what to say word for word (in her language), what to do, where the text on screen goes. Multi-line.",
    },
    takes: { type: "integer", minimum: 1, maximum: 5, description: "Usually 2." },
    notes: { type: "string", description: "Delivery notes for this variation ('' if none)." },
  },
} as const;

export const BRIEF_DRAFTS_TOOL = {
  name: BRIEF_DRAFTS_TOOL_NAME,
  description:
    "Submit draft Recording / Editing / Posting briefs built from a winner breakdown. Call exactly once.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["recording", "editing", "posting"],
    properties: {
      recording: {
        description:
          "Recording brief for the creator. Fill it ONLY when content_type is creation; otherwise pass null.",
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: [
              "title",
              "concept_why",
              "outfit_number",
              "location_number",
              "prop_numbers",
              "setup_camera",
              "setup_framing",
              "setup_location",
              "setup_outfit",
              "setup_light",
              "setup_sound",
              "setup_notes",
              "how_to_talk",
              "how_to_act",
              "props",
              "checklist_before_upload",
              "variations",
            ],
            properties: {
              title: { type: "string" },
              concept_why: {
                type: "string",
                description:
                  "THE CONCEPT & WHY IT WORKS: what the video is; why viewers love it (shares / tags / hook); why it works for THIS creator; the vibe and how to deliver it. Multi-line, plain words.",
              },
              outfit_number: {
                type: "integer",
                minimum: 0,
                description:
                  "Wardrobe outfit number chosen for the WHOLE brief (one outfit per bunch). 0 if no wardrobe was given.",
              },
              location_number: {
                type: "integer",
                minimum: 0,
                description: "Wardrobe location number chosen for the whole brief. 0 if none.",
              },
              prop_numbers: {
                type: "array",
                items: { type: "integer", minimum: 1 },
                description: "Wardrobe prop numbers used, if any.",
              },
              setup_camera: { type: "string" },
              setup_framing: { type: "string" },
              setup_location: {
                type: "string",
                description: "Describe the location + how to use it. If chosen from the wardrobe, start with '#<number> <name>'.",
              },
              setup_outfit: {
                type: "string",
                description: "Describe the outfit + styling (hair, accessories). If chosen from the wardrobe, start with '#<number> <name>'.",
              },
              setup_light: { type: "string" },
              setup_sound: { type: "string" },
              setup_notes: { type: "string" },
              how_to_talk: { type: "string", description: "Delivery rules, length, pace." },
              how_to_act: { type: "string" },
              props: { type: "string" },
              checklist_before_upload: {
                type: "string",
                description:
                  "Checklist lines: clip count, raw only (no music/text/filters), naming V1_take1…, orientation.",
              },
              variations: { type: "array", minItems: 1, items: variationSchema },
            },
          },
        ],
      },
      editing: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "concept",
          "raw_files_takes",
          "cut_rules",
          "audio_voice",
          "audio_music",
          "audio_notes",
          "subtitles",
          "do_not_add",
          "final_check",
          "videos",
        ],
        properties: {
          title: { type: "string" },
          concept: {
            type: "string",
            description: "What we are making and the viral element the edit must protect.",
          },
          raw_files_takes: {
            type: "string",
            description:
              "Which raw files / takes to use. For editable content describe what to look for in the creator's existing footage.",
          },
          cut_rules: {
            type: "string",
            description: "Cut rules: hook in first second, where the turn lands, pacing, length target.",
          },
          audio_voice: { type: "string", enum: ["keep_voice", "mute_original", "clean_up"] },
          audio_music: { type: "boolean" },
          audio_notes: { type: "string" },
          subtitles: { type: "boolean" },
          do_not_add: { type: "string", description: "What the editor must NOT add." },
          final_check: { type: "string", description: "Final check lines before delivery." },
          videos: {
            type: "array",
            minItems: 1,
            description: "One deliverable per variation, same V-numbering.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["output_name", "raw_take", "special_instructions", "text_on_screen"],
              properties: {
                output_name: { type: "string", description: "e.g. 'V1_final'." },
                raw_take: { type: "string", description: "Which take / file to use." },
                special_instructions: { type: "string" },
                text_on_screen: {
                  type: "string",
                  description: "Exact text on screen for this video ('' if none).",
                },
              },
            },
          },
        },
      },
      posting: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "instructions_notes",
          "sound_name",
          "sound_notes",
          "text_style_notes",
          "timing_notes",
          "final_checklist",
          "posts",
        ],
        properties: {
          title: { type: "string" },
          instructions_notes: {
            type: "string",
            description: "How this account works for the VA + what these posts are (trial, why).",
          },
          sound_name: { type: "string", description: "Sound to use ('' if original audio)." },
          sound_notes: { type: "string" },
          text_style_notes: { type: "string", description: "Font / placement / style of text on screen." },
          timing_notes: { type: "string" },
          final_checklist: { type: "array", items: { type: "string" } },
          posts: {
            type: "array",
            minItems: 1,
            description: "One post per variation, same V-numbering.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["video_name", "text_on_screen", "caption", "pinned_comment", "notes"],
              properties: {
                video_name: { type: "string", description: "Matches the editing output_name." },
                text_on_screen: { type: "string" },
                caption: { type: "string", description: "Caption in the creator's language, platform-safe." },
                pinned_comment: { type: "string", description: "'' if none." },
                notes: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const BRIEF_DRAFTS_SYSTEM_PROMPT = [
  "You write production briefs for a social-media content agency, from a breakdown of a viral video.",
  "You receive: the breakdown (hook, beats, must-keep elements, variation angles), the creator's persona, the content type and flow chosen by the Creative Director, and house rules.",
  "Every variation MUST preserve every must_keep element from the breakdown and may only change flexible ones. Say explicitly in concept_why which element is the viral one and that it is non-negotiable.",
  "Write for the person who will execute: the creator reads the recording brief on her phone before filming; the editor reads the editing brief; the VA reads the posting brief. Short lines, concrete, no fluff.",
  "Scripts, text on screen and captions are written in the creator's first language from the persona (default Greek) with references that are relatable to her audience's country; keep the brief instructions themselves in English.",
  "Innuendo and suggestion are fine; explicit sexual wording is not. Keep everything platform-safe for Instagram / TikTok.",
  "Editable content: there is NO recording — the editor works from existing footage, so recording must be null and raw_files_takes describes what footage to look for.",
  "Creation content: the creator films raw clips only (no music, no text, no filters). Text on screen and sound are added by the editor, so put them in the editing brief, not in the creator's checklist.",
  "Use consistent V1..Vn naming across recording variations, editing videos and posting posts.",
  "ONE bunch = ONE setup: all variations in a recording brief share the same outfit and the same location (variations differ in lines and action only). When a WARDROBE list is given, choose outfit_number and location_number from it, fitting the concept and respecting rotation (prefer items used longest ago / never) and the agency rules; mention small zero-cost variety only if useful (hair up/down, jacket on/off, different angle).",
  "Always respond with the submit_brief_drafts tool.",
].join(" ");
