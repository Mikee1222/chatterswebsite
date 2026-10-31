/**
 * Winner Breakdown — transcript + frames → structured viral-element analysis.
 * Stores transcript text, JSON and a small cover thumb. Never the video or frames.
 */

import "server-only";

import {
  AI_ASSISTANT_MODEL,
  callAnthropicVision,
  resolveBreakdownModel,
  type AnthropicImageSource,
} from "@/lib/ai-assistant";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { MAX_VIDEO_SAMPLE_FRAMES } from "@/lib/video-frame-sampling";
import {
  WINNER_BREAKDOWN_MAX_TOKENS,
  WINNER_BREAKDOWN_SYSTEM_PROMPT,
  WINNER_BREAKDOWN_TOOL,
  WINNER_BREAKDOWN_TOOL_NAME,
  segmentsToTimedText,
  type TranscriptSegment,
  type WinnerBreakdownJson,
} from "@/lib/winner-breakdown-schema";
import { assertCreativeRateLimit } from "@/services/creative-studio";

const TABLE = "creative_studio_winner_breakdowns";

export const BREAKDOWN_REFUSAL_MESSAGE =
  "This video could not be broken down. Try a different clip or add the caption / a short description and run again.";
/** API-level failure (no model answer at all) — distinct from a content refusal. */
export const BREAKDOWN_FAILED_MESSAGE =
  "The AI call failed — nothing wrong with the clip. Most likely the API key has no access to the configured model (AI_BREAKDOWN_MODEL) or the API errored. Tell the admin to check the server logs for \"creative_studio_breakdown\".";

export type WinnerBreakdownStatus = "success" | "refused" | "failed";

export type WinnerBreakdownRow = {
  id: string;
  model_id: string | null;
  winner_video_id: string | null;
  title: string;
  source_url: string;
  source_caption: string;
  notes: string;
  duration_sec: number | null;
  transcript: string;
  transcript_segments: TranscriptSegment[];
  transcript_language: string;
  stt_model: string;
  cover_thumbnail_base64: string | null;
  breakdown: WinnerBreakdownJson;
  breakdown_model: string;
  status: WinnerBreakdownStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WinnerBreakdownSummary = Pick<
  WinnerBreakdownRow,
  | "id"
  | "model_id"
  | "winner_video_id"
  | "title"
  | "source_url"
  | "duration_sec"
  | "cover_thumbnail_base64"
  | "status"
  | "created_by"
  | "created_at"
> & { summary: string; hook: string };

const LIST_COLUMNS =
  "id, model_id, winner_video_id, title, source_url, duration_sec, cover_thumbnail_base64, status, created_by, created_at, breakdown";

const FULL_COLUMNS =
  "id, model_id, winner_video_id, title, source_url, source_caption, notes, duration_sec, transcript, transcript_segments, transcript_language, stt_model, cover_thumbnail_base64, breakdown, breakdown_model, status, created_by, created_at, updated_at";

function asString(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}
function asNullableString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asNumberOrNull(v: unknown): number | null {
  const n = Number(v);
  return v != null && Number.isFinite(n) ? n : null;
}
function mapStatus(v: unknown): WinnerBreakdownStatus {
  return v === "refused" || v === "failed" ? v : "success";
}
function mapSegments(v: unknown): TranscriptSegment[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return {
        start: Number(o.start) || 0,
        end: Number(o.end) || 0,
        text: asString(o.text),
      };
    })
    .filter((s) => s.text.length > 0);
}
function mapBreakdown(v: unknown): WinnerBreakdownJson {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as WinnerBreakdownJson) : {};
}

export function mapWinnerBreakdownRow(row: Record<string, unknown>): WinnerBreakdownRow {
  return {
    id: asString(row.id),
    model_id: asNullableString(row.model_id),
    winner_video_id: asNullableString(row.winner_video_id),
    title: asString(row.title),
    source_url: asString(row.source_url),
    source_caption: asString(row.source_caption),
    notes: asString(row.notes),
    duration_sec: asNumberOrNull(row.duration_sec),
    transcript: asString(row.transcript),
    transcript_segments: mapSegments(row.transcript_segments),
    transcript_language: asString(row.transcript_language),
    stt_model: asString(row.stt_model),
    cover_thumbnail_base64: asNullableString(row.cover_thumbnail_base64),
    breakdown: mapBreakdown(row.breakdown),
    breakdown_model: asString(row.breakdown_model),
    status: mapStatus(row.status),
    created_by: asString(row.created_by),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  };
}

function mapSummary(row: Record<string, unknown>): WinnerBreakdownSummary {
  const b = mapBreakdown(row.breakdown);
  return {
    id: asString(row.id),
    model_id: asNullableString(row.model_id),
    winner_video_id: asNullableString(row.winner_video_id),
    title: asString(row.title),
    source_url: asString(row.source_url),
    duration_sec: asNumberOrNull(row.duration_sec),
    cover_thumbnail_base64: asNullableString(row.cover_thumbnail_base64),
    status: mapStatus(row.status),
    created_by: asString(row.created_by),
    created_at: asString(row.created_at),
    summary: asString(b.summary),
    hook: asString(b.hook?.text),
  };
}

/* ------------------------------------------------------------------ */
/* Validation of the model output                                      */
/* ------------------------------------------------------------------ */

function cleanStringArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => asString(x).trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Shape-check the tool output; return null when it is unusable. */
function sanitizeBreakdown(raw: unknown): WinnerBreakdownJson | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const summary = asString(r.summary).trim();
  const whyItWorks = asString(r.why_it_works).trim();
  if (!summary && !whyItWorks) return null;

  const hookRaw = (r.hook ?? {}) as Record<string, unknown>;
  const turnRaw = (r.turn ?? {}) as Record<string, unknown>;
  const soundRaw = (r.sound ?? {}) as Record<string, unknown>;

  const beats = Array.isArray(r.beats)
    ? (r.beats as unknown[])
        .map((b) => {
          const o = (b ?? {}) as Record<string, unknown>;
          return {
            t_start: Math.max(0, Number(o.t_start) || 0),
            t_end: Math.max(0, Number(o.t_end) || 0),
            what_happens: asString(o.what_happens).trim(),
            spoken: asString(o.spoken).trim(),
            on_screen_text: asString(o.on_screen_text).trim(),
            purpose: asString(o.purpose).trim(),
          };
        })
        .filter((b) => b.what_happens)
        .slice(0, 12)
    : [];

  const viral = Array.isArray(r.viral_elements)
    ? (r.viral_elements as unknown[])
        .map((v) => {
          const o = (v ?? {}) as Record<string, unknown>;
          return {
            element: asString(o.element).trim(),
            category: (asString(o.category).trim() || "other") as NonNullable<
              WinnerBreakdownJson["viral_elements"]
            >[number]["category"],
            why_it_works: asString(o.why_it_works).trim(),
            evidence: asString(o.evidence).trim(),
          };
        })
        .filter((v) => v.element)
        .slice(0, 8)
    : [];

  const angles = Array.isArray(r.variation_angles)
    ? (r.variation_angles as unknown[])
        .map((v) => {
          const o = (v ?? {}) as Record<string, unknown>;
          return {
            title: asString(o.title).trim(),
            premise: asString(o.premise).trim(),
            keeps: asString(o.keeps).trim(),
            changes: asString(o.changes).trim(),
          };
        })
        .filter((v) => v.title && v.premise)
        .slice(0, 6)
    : [];

  const confidenceRaw = asString(r.confidence);
  const confidence =
    confidenceRaw === "low" || confidenceRaw === "medium" || confidenceRaw === "high"
      ? confidenceRaw
      : "medium";

  return {
    summary,
    format: (asString(r.format) || "other") as WinnerBreakdownJson["format"],
    duration_sec: asNumberOrNull(r.duration_sec) ?? undefined,
    hook: {
      text: asString(hookRaw.text).trim(),
      type: (asString(hookRaw.type) || "other") as NonNullable<WinnerBreakdownJson["hook"]>["type"],
      why_it_stops_scroll: asString(hookRaw.why_it_stops_scroll).trim(),
    },
    beats,
    turn: {
      at_sec: Math.max(0, Number(turnRaw.at_sec) || 0),
      what: asString(turnRaw.what).trim(),
      why: asString(turnRaw.why).trim(),
    },
    viral_elements: viral,
    must_keep: cleanStringArray(r.must_keep),
    flexible: cleanStringArray(r.flexible),
    text_on_screen_role: (asString(r.text_on_screen_role) ||
      "none") as WinnerBreakdownJson["text_on_screen_role"],
    sound: {
      type: (asString(soundRaw.type) || "unknown") as NonNullable<WinnerBreakdownJson["sound"]>["type"],
      role: asString(soundRaw.role).trim(),
    },
    audience_trigger: asString(r.audience_trigger).trim(),
    share_driver: asString(r.share_driver).trim(),
    why_it_works: whyItWorks,
    variation_angles: angles,
    risks: cleanStringArray(r.risks, 8),
    confidence,
    missing_info: cleanStringArray(r.missing_info, 8),
  };
}

/* ------------------------------------------------------------------ */
/* Create                                                               */
/* ------------------------------------------------------------------ */

export type CreateWinnerBreakdownInput = {
  userId: string;
  modelId?: string | null;
  winnerVideoId?: string | null;
  title?: string;
  sourceUrl?: string;
  sourceCaption?: string;
  notes?: string;
  durationSec?: number | null;
  transcript: string;
  transcriptSegments?: TranscriptSegment[];
  transcriptLanguage?: string;
  sttModel?: string;
  /** JPEG base64 frames (no data: prefix), max MAX_VIDEO_SAMPLE_FRAMES */
  frames?: string[];
  frameHashes?: string[];
  coverThumbnailBase64?: string;
};

export type CreateWinnerBreakdownResult = {
  id: string | null;
  breakdown: WinnerBreakdownJson;
  status: WinnerBreakdownStatus;
  model: string;
};

function buildUserText(input: CreateWinnerBreakdownInput): string {
  const parts: string[] = [];
  const segs = input.transcriptSegments ?? [];
  const timed = segs.length ? segmentsToTimedText(segs) : "";
  const transcript = (timed || input.transcript || "").trim();

  if (input.durationSec) parts.push(`Video length: ${Math.round(input.durationSec)} seconds.`);
  if (input.transcriptLanguage) parts.push(`Transcript language: ${input.transcriptLanguage}.`);
  parts.push(
    transcript
      ? `TRANSCRIPT (timestamps in [m:ss]):\n${transcript.slice(0, 12_000)}`
      : "TRANSCRIPT: (no speech detected — rely on frames, caption and notes).",
  );
  if (input.sourceCaption?.trim()) {
    parts.push(`ORIGINAL CAPTION / POST TEXT:\n${input.sourceCaption.trim().slice(0, 2_000)}`);
  }
  if (input.notes?.trim()) {
    parts.push(`NOTES FROM THE CREATIVE DIRECTOR:\n${input.notes.trim().slice(0, 2_000)}`);
  }
  parts.push(
    `The attached images are ${input.frames?.length ?? 0} evenly spaced frames from the video, in order. Use them for on-screen text, setting, framing and visual beats.`,
  );
  parts.push(`Break this video down with ${WINNER_BREAKDOWN_TOOL_NAME}.`);
  return parts.join("\n\n");
}

export async function createWinnerBreakdown(
  input: CreateWinnerBreakdownInput,
): Promise<CreateWinnerBreakdownResult> {
  await assertCreativeRateLimit(input.userId);

  const images: AnthropicImageSource[] = (input.frames ?? [])
    .slice(0, MAX_VIDEO_SAMPLE_FRAMES)
    .map((b64) => ({
      mediaType: "image/jpeg" as const,
      base64: b64.replace(/^data:image\/\w+;base64,/, ""),
    }))
    .filter((img) => img.base64.length > 0);

  const model = resolveBreakdownModel();

  console.info("[creative-studio] winner-breakdown", {
    feature: "creative_studio_breakdown",
    frames: images.length,
    transcriptChars: input.transcript.length,
    model,
  });

  const result = await callAnthropicVision({
    text: buildUserText(input),
    images,
    system: WINNER_BREAKDOWN_SYSTEM_PROMPT,
    maxTokens: WINNER_BREAKDOWN_MAX_TOKENS,
    temperature: 0.3,
    model,
    // Owner decision: the breakdown runs on the configured model only. If the key
    // cannot use it we fail loudly instead of silently downgrading quality.
    // Set AI_BREAKDOWN_FALLBACK=sonnet to allow a one-time retry on Sonnet.
    fallbackModel: process.env.AI_BREAKDOWN_FALLBACK?.trim() === "sonnet" ? AI_ASSISTANT_MODEL : undefined,
    logLabel: "creative_studio_breakdown",
    tools: [WINNER_BREAKDOWN_TOOL as unknown as { name: string; description: string; input_schema: Record<string, unknown> }],
    toolChoice: { type: "tool", name: WINNER_BREAKDOWN_TOOL_NAME },
  });

  const usedModel = result?.model ?? model;
  const sanitized = result?.toolInput ? sanitizeBreakdown(result.toolInput) : null;

  const status: WinnerBreakdownStatus = sanitized ? "success" : result ? "refused" : "failed";
  const breakdown: WinnerBreakdownJson = sanitized ?? {
    refusal: true,
    refusal_message: status === "failed" ? BREAKDOWN_FAILED_MESSAGE : BREAKDOWN_REFUSAL_MESSAGE,
  };
  if (sanitized && input.durationSec && !sanitized.duration_sec) {
    sanitized.duration_sec = Math.round(input.durationSec);
  }

  const cover = input.coverThumbnailBase64
    ?.replace(/^data:image\/\w+;base64,/, "")
    ?.slice(0, 120_000);

  const title =
    input.title?.trim() ||
    (sanitized?.hook?.text ? sanitized.hook.text.slice(0, 80) : "") ||
    (sanitized?.summary ? sanitized.summary.slice(0, 80) : "") ||
    "Winner breakdown";

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      model_id: input.modelId?.trim() || null,
      winner_video_id: input.winnerVideoId?.trim() || null,
      title,
      source_url: input.sourceUrl?.trim() ?? "",
      source_caption: input.sourceCaption?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
      duration_sec: input.durationSec ?? null,
      transcript: input.transcript.slice(0, 20_000),
      transcript_segments: (input.transcriptSegments ?? []).slice(0, 400),
      transcript_language: input.transcriptLanguage ?? "",
      stt_model: input.sttModel ?? "",
      frame_hashes: (input.frameHashes ?? []).slice(0, MAX_VIDEO_SAMPLE_FRAMES),
      cover_thumbnail_base64: status === "success" ? cover || null : null,
      breakdown,
      breakdown_model: usedModel,
      status,
      raw_model_response: status === "success" ? null : result?.text?.slice(0, 8_000) ?? null,
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[creative-studio] winner-breakdown persist failed", error.message);
    return { id: null, breakdown, status, model: usedModel };
  }

  return { id: asString((data as { id?: unknown }).id), breakdown, status, model: usedModel };
}

/* ------------------------------------------------------------------ */
/* Read / update / delete                                               */
/* ------------------------------------------------------------------ */

export async function listWinnerBreakdowns(opts?: {
  modelId?: string | null;
  limit?: number;
}): Promise<WinnerBreakdownSummary[]> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from(TABLE)
    .select(LIST_COLUMNS)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, opts?.limit ?? 30)));
  if (opts?.modelId) {
    // Breakdowns are creator-agnostic; show the selected model's first, plus unassigned ones.
    q = q.or(`model_id.eq.${opts.modelId},model_id.is.null`);
  }
  const { data, error } = await q;
  if (error) throw new Error(`listWinnerBreakdowns: ${error.message}`);
  return (data ?? []).map((r) => mapSummary(r as Record<string, unknown>));
}

export async function getWinnerBreakdown(id: string): Promise<WinnerBreakdownRow | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(TABLE).select(FULL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getWinnerBreakdown: ${error.message}`);
  return data ? mapWinnerBreakdownRow(data as Record<string, unknown>) : null;
}

export async function updateWinnerBreakdownMeta(
  id: string,
  patch: { title?: string; sourceUrl?: string; notes?: string; modelId?: string | null },
): Promise<void> {
  const sb = getSupabaseServiceClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title != null) update.title = patch.title.trim().slice(0, 160);
  if (patch.sourceUrl != null) update.source_url = patch.sourceUrl.trim();
  if (patch.notes != null) update.notes = patch.notes.trim();
  if (patch.modelId !== undefined) update.model_id = patch.modelId?.trim() || null;
  const { error } = await sb.from(TABLE).update(update).eq("id", id);
  if (error) throw new Error(`updateWinnerBreakdownMeta: ${error.message}`);
}

export async function deleteWinnerBreakdown(id: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(`deleteWinnerBreakdown: ${error.message}`);
}
