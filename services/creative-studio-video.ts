/**
 * Video analysis — stores hashes + JSON + small cover thumb only.
 * Never stores video files or full frame sets long-term.
 * Refused/failed attempts are stored for admin pattern review but do NOT
 * participate in "already analysed" duplicate matching.
 */

import "server-only";

import {
  AI_FAST_MODEL,
  callAnthropicVision,
  type AnthropicImageSource,
} from "@/lib/ai-assistant";
import { hashSetSimilarity } from "@/lib/video-frame-hash";
import {
  analysisToIdeaContext,
  NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
  parseVideoAnalysisModelResponse,
} from "@/lib/video-analysis-refusal";

export { analysisToIdeaContext };
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { assertCreativeRateLimit } from "@/services/creative-studio";
import {
  getPersonaByModelId,
  isPersonaAdult,
} from "@/services/model-personas";
import { logAiUsage } from "@/services/ai-usage-log";
import type { VideoAnalysisJson } from "@/lib/creative-studio-types";

export type { VideoAnalysisJson };

const TABLE = "creative_studio_video_analyses";
const DUPLICATE_THRESHOLD = 72; // % similarity
export const MAX_VIDEO_ANALYSIS_FRAMES = 10;

export type VideoAnalysisStatus = "success" | "refused" | "failed";
export type VideoAnalysisUserFeedback = "ok" | "flag_wrong" | "wrong_refusal";

export type VideoAnalysisRow = {
  id: string;
  model_id: string;
  frame_hashes: string[];
  analysis: VideoAnalysisJson;
  cover_thumbnail_base64: string | null;
  status: VideoAnalysisStatus;
  created_by: string;
  created_at: string;
  user_feedback: VideoAnalysisUserFeedback | null;
};

export type PriorAttemptMatch = {
  date: string;
  similarity: number;
  analysisId: string;
  /** Analysed = successful prior run. could_not_analyse = prior refuse/fail. */
  kind: "analysed" | "could_not_analyse";
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function mapStatus(v: unknown): VideoAnalysisStatus {
  if (v === "refused" || v === "failed" || v === "success") return v;
  return "success";
}

function mapFeedback(v: unknown): VideoAnalysisUserFeedback | null {
  if (v === "ok" || v === "flag_wrong" || v === "wrong_refusal") return v;
  return null;
}

function mapRow(row: Record<string, unknown>): VideoAnalysisRow {
  const hashes = Array.isArray(row.frame_hashes)
    ? (row.frame_hashes as unknown[]).map((h) => String(h))
    : [];
  return {
    id: asString(row.id),
    model_id: asString(row.model_id),
    frame_hashes: hashes,
    analysis:
      row.analysis && typeof row.analysis === "object"
        ? (row.analysis as VideoAnalysisJson)
        : {},
    cover_thumbnail_base64:
      typeof row.cover_thumbnail_base64 === "string" ? row.cover_thumbnail_base64 : null,
    status: mapStatus(row.status),
    created_by: asString(row.created_by),
    created_at: asString(row.created_at),
    user_feedback: mapFeedback(row.user_feedback),
  };
}

async function findBestHashMatch(
  modelId: string,
  hashes: string[],
  statuses: VideoAnalysisStatus[],
): Promise<{ row: VideoAnalysisRow; similarity: number } | null> {
  if (!hashes.length) return null;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(
      "id, model_id, frame_hashes, analysis, cover_thumbnail_base64, status, created_by, created_at, user_feedback",
    )
    .eq("model_id", modelId)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(`findBestHashMatch: ${error.message}`);

  let best: { row: VideoAnalysisRow; similarity: number } | null = null;
  for (const raw of data ?? []) {
    const row = mapRow(raw as Record<string, unknown>);
    const sim = hashSetSimilarity(hashes, row.frame_hashes);
    if (sim >= DUPLICATE_THRESHOLD && (!best || sim > best.similarity)) {
      best = { row, similarity: sim };
    }
  }
  return best;
}

/** Successful analyses only — used for "already analysed" duplicate banner. */
export async function findDuplicateAnalysis(
  modelId: string,
  hashes: string[],
): Promise<{ row: VideoAnalysisRow; similarity: number } | null> {
  return findBestHashMatch(modelId, hashes, ["success"]);
}

/** Prior refused/failed attempt with matching hashes. */
export async function findPriorFailedAttempt(
  modelId: string,
  hashes: string[],
): Promise<{ row: VideoAnalysisRow; similarity: number } | null> {
  return findBestHashMatch(modelId, hashes, ["refused", "failed"]);
}

export async function analyzeVideoFrames(input: {
  modelId: string;
  userId: string;
  /** JPEG base64 frames (no data: prefix), max ~10 */
  frames: string[];
  frameHashes: string[];
  coverThumbnailBase64?: string;
}): Promise<{
  analysis: VideoAnalysisJson;
  duplicate?: PriorAttemptMatch;
  analysisId: string | null;
  generationDisabledReason?: string;
  allowlistKeysUsed: string[];
  refused: boolean;
}> {
  await assertCreativeRateLimit(input.userId);

  const persona = await getPersonaByModelId(input.modelId);
  if (!persona || !isPersonaAdult(persona.personal_info)) {
    return {
      analysis: {
        refusal: true,
        refusal_message: NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
      },
      analysisId: null,
      refused: true,
      generationDisabledReason:
        "AI generation disabled — birth date required and must be 18+",
      allowlistKeysUsed: [],
    };
  }

  const hashes = input.frameHashes.slice(0, MAX_VIDEO_ANALYSIS_FRAMES);

  const successDup = await findDuplicateAnalysis(input.modelId, hashes);
  const failedPrior = successDup
    ? null
    : await findPriorFailedAttempt(input.modelId, hashes);

  const priorMatch: PriorAttemptMatch | undefined = successDup
    ? {
        date: successDup.row.created_at,
        similarity: successDup.similarity,
        analysisId: successDup.row.id,
        kind: "analysed",
      }
    : failedPrior
      ? {
          date: failedPrior.row.created_at,
          similarity: failedPrior.similarity,
          analysisId: failedPrior.row.id,
          kind: "could_not_analyse",
        }
      : undefined;

  const images: AnthropicImageSource[] = input.frames
    .slice(0, MAX_VIDEO_ANALYSIS_FRAMES)
    .map((b64) => ({
      mediaType: "image/jpeg" as const,
      base64: b64.replace(/^data:image\/\w+;base64,/, ""),
    }))
    .filter((img) => img.base64.length > 0);

  if (!images.length) {
    const analysisId = await persistAttempt({
      modelId: input.modelId,
      userId: input.userId,
      hashes,
      analysis: {
        refusal: true,
        refusal_message: NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
      },
      status: "failed",
      rawModelResponse: null,
      coverThumbnailBase64: undefined,
    });
    return {
      analysis: {
        refusal: true,
        refusal_message: NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
      },
      analysisId,
      refused: true,
      allowlistKeysUsed: [],
      duplicate: priorMatch,
    };
  }

  const system = [
    "You analyse short social-video frame samples for a creative studio.",
    "NEVER identify, name, or guess the identity of any person from faces.",
    "Describe setting, outfit, activity, mood, props, visible text, and quality issues only.",
    "Return ONLY JSON with keys: setting, outfit, activity, mood_vibe, objects_props (array),",
    "visible_text (array), quality_flags {blur, dark, wrong_orientation, not_9_16, watermark},",
    "suggested_hooks (array of short strings), suggested_caption_angles (array).",
    "Keep descriptions platform-safe (no nudity/explicit sexual detail).",
    'If frames are unusable, set refusal:true and refusal_message:"could not analyse, describe manually".',
  ].join(" ");

  // Log counts only — never persona or model response content
  console.info("[creative-studio] video-analyze", {
    modelId: input.modelId,
    feature: "creative_studio_video",
    frameCount: images.length,
    hashCount: hashes.length,
  });

  const result = await callAnthropicVision({
    text: "Analyse these evenly spaced video frames. Do not identify people.",
    images,
    system,
    maxTokens: 900,
    temperature: 0.2,
    model: AI_FAST_MODEL,
    logLabel: "creative_studio_video",
  });

  void logAiUsage({
    featureKey: "creative_studio_video",
    model: result?.model ?? AI_FAST_MODEL,
    ok: Boolean(result?.text),
  });

  const parsed = parseVideoAnalysisModelResponse(result?.text ?? null, {
    allFramesFailed: false,
  });

  const status: VideoAnalysisStatus = parsed.refused ? "refused" : "success";
  const cover =
    status === "success"
      ? input.coverThumbnailBase64
          ?.replace(/^data:image\/\w+;base64,/, "")
          ?.slice(0, 120_000)
      : undefined;

  const analysisId = await persistAttempt({
    modelId: input.modelId,
    userId: input.userId,
    hashes,
    analysis: parsed.analysis,
    status,
    rawModelResponse: parsed.rawModelResponse,
    coverThumbnailBase64: cover,
  });

  return {
    analysis: parsed.analysis,
    analysisId,
    refused: parsed.refused,
    allowlistKeysUsed: [],
    duplicate: priorMatch,
  };
}

async function persistAttempt(input: {
  modelId: string;
  userId: string;
  hashes: string[];
  analysis: VideoAnalysisJson;
  status: VideoAnalysisStatus;
  rawModelResponse: string | null;
  coverThumbnailBase64?: string;
}): Promise<string | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      model_id: input.modelId,
      frame_hashes: input.hashes,
      analysis: input.analysis,
      cover_thumbnail_base64: input.coverThumbnailBase64 || null,
      created_by: input.userId,
      status: input.status,
      // Store raw only for refused/failed — admin pattern review. Never frames/video.
      raw_model_response:
        input.status === "success" ? null : input.rawModelResponse?.slice(0, 8_000) ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[creative-studio] video persist failed", error.message);
    return null;
  }
  return data ? asString((data as { id?: unknown }).id) : null;
}

export async function submitVideoAnalysisFeedback(input: {
  analysisId: string;
  userId: string;
  feedback: VideoAnalysisUserFeedback;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseServiceClient();
  const { data: existing, error: readErr } = await sb
    .from(TABLE)
    .select("id, status")
    .eq("id", input.analysisId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: "not found" };

  const status = mapStatus((existing as { status?: unknown }).status);
  if (input.feedback === "wrong_refusal" && status === "success") {
    return { ok: false, error: "wrong_refusal only applies to refused analyses" };
  }
  if (
    (input.feedback === "ok" || input.feedback === "flag_wrong") &&
    status !== "success"
  ) {
    return { ok: false, error: "ok/flag_wrong only apply to successful analyses" };
  }

  const { error } = await sb
    .from(TABLE)
    .update({
      user_feedback: input.feedback,
      feedback_by: input.userId,
      feedback_at: new Date().toISOString(),
    })
    .eq("id", input.analysisId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Admin: list feedback / refusals for pattern review (includes raw response). */
export async function listVideoAnalysisAdminReview(limit = 50): Promise<
  Array<{
    id: string;
    model_id: string;
    status: VideoAnalysisStatus;
    user_feedback: VideoAnalysisUserFeedback | null;
    feedback_by: string;
    feedback_at: string | null;
    created_by: string;
    created_at: string;
    frame_hash_count: number;
    raw_model_response: string | null;
    analysis: VideoAnalysisJson;
  }>
> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(
      "id, model_id, status, user_feedback, feedback_by, feedback_at, created_by, created_at, frame_hashes, raw_model_response, analysis",
    )
    .or("user_feedback.not.is.null,status.eq.refused,status.eq.failed")
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(`listVideoAnalysisAdminReview: ${error.message}`);

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const hashes = Array.isArray(row.frame_hashes) ? row.frame_hashes : [];
    return {
      id: asString(row.id),
      model_id: asString(row.model_id),
      status: mapStatus(row.status),
      user_feedback: mapFeedback(row.user_feedback),
      feedback_by: asString(row.feedback_by),
      feedback_at: typeof row.feedback_at === "string" ? row.feedback_at : null,
      created_by: asString(row.created_by),
      created_at: asString(row.created_at),
      frame_hash_count: hashes.length,
      raw_model_response:
        typeof row.raw_model_response === "string" ? row.raw_model_response : null,
      analysis:
        row.analysis && typeof row.analysis === "object"
          ? (row.analysis as VideoAnalysisJson)
          : {},
    };
  });
}

