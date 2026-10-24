/**
 * Video analysis — stores hashes + JSON + small cover thumb only.
 * Never stores video files or full frame sets long-term.
 */

import "server-only";

import {
  AI_FAST_MODEL,
  callAnthropicVision,
  extractJsonObject,
  type AnthropicImageSource,
} from "@/lib/ai-assistant";
import { hashSetSimilarity } from "@/lib/video-frame-hash";
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

export type VideoAnalysisRow = {
  id: string;
  model_id: string;
  frame_hashes: string[];
  analysis: VideoAnalysisJson;
  cover_thumbnail_base64: string | null;
  created_by: string;
  created_at: string;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function findDuplicateAnalysis(
  modelId: string,
  hashes: string[],
): Promise<{ row: VideoAnalysisRow; similarity: number } | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("id, model_id, frame_hashes, analysis, cover_thumbnail_base64, created_by, created_at")
    .eq("model_id", modelId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(`findDuplicateAnalysis: ${error.message}`);

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
    created_by: asString(row.created_by),
    created_at: asString(row.created_at),
  };
}

export async function analyzeVideoFrames(input: {
  modelId: string;
  userId: string;
  /** JPEG base64 frames (no data: prefix), max ~8 */
  frames: string[];
  frameHashes: string[];
  coverThumbnailBase64?: string;
}): Promise<{
  analysis: VideoAnalysisJson;
  duplicate?: { date: string; similarity: number; analysisId: string };
  analysisId: string | null;
  generationDisabledReason?: string;
  allowlistKeysUsed: string[];
}> {
  await assertCreativeRateLimit(input.userId);

  const persona = await getPersonaByModelId(input.modelId);
  if (!persona || !isPersonaAdult(persona.personal_info)) {
    return {
      analysis: {
        refusal: true,
        refusal_message: "could not analyse, describe manually",
      },
      analysisId: null,
      generationDisabledReason:
        "AI generation disabled — birth date required and must be 18+",
      allowlistKeysUsed: [],
    };
  }

  const hashes = input.frameHashes.slice(0, 8);
  const dup = await findDuplicateAnalysis(input.modelId, hashes);

  const images: AnthropicImageSource[] = input.frames.slice(0, 8).map((b64) => ({
    mediaType: "image/jpeg" as const,
    base64: b64.replace(/^data:image\/\w+;base64,/, ""),
  }));

  if (!images.length) {
    return {
      analysis: {
        refusal: true,
        refusal_message: "could not analyse, describe manually",
      },
      analysisId: null,
      allowlistKeysUsed: [],
      duplicate: dup
        ? {
            date: dup.row.created_at,
            similarity: dup.similarity,
            analysisId: dup.row.id,
          }
        : undefined,
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
    "If frames are unusable, set refusal:true and refusal_message:\"could not analyse, describe manually\".",
  ].join(" ");

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

  let analysis: VideoAnalysisJson;
  if (!result?.text) {
    analysis = {
      refusal: true,
      refusal_message: "could not analyse, describe manually",
    };
  } else {
    const obj = extractJsonObject(result.text);
    if (!obj) {
      analysis = {
        refusal: true,
        refusal_message: "could not analyse, describe manually",
      };
    } else {
      analysis = obj as VideoAnalysisJson;
      if (analysis.refusal) {
        analysis.refusal_message =
          analysis.refusal_message || "could not analyse, describe manually";
      }
    }
  }

  // Persist hashes + JSON + small cover only (frames discarded by client)
  const sb = getSupabaseServiceClient();
  const cover = input.coverThumbnailBase64
    ?.replace(/^data:image\/\w+;base64,/, "")
    ?.slice(0, 120_000); // hard cap ~90KB ascii

  const { data, error } = await sb
    .from(TABLE)
    .insert({
      model_id: input.modelId,
      frame_hashes: hashes,
      analysis,
      cover_thumbnail_base64: cover || null,
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[creative-studio] video persist failed", error.message);
  }

  return {
    analysis,
    analysisId: data ? asString((data as { id?: unknown }).id) : null,
    allowlistKeysUsed: [],
    duplicate: dup
      ? {
          date: dup.row.created_at,
          similarity: dup.similarity,
          analysisId: dup.row.id,
        }
      : undefined,
  };
}

/** Format analysis into idea/context text for captions / TOS. */
export function analysisToIdeaContext(analysis: VideoAnalysisJson): string {
  if (analysis.refusal) {
    return analysis.refusal_message || "could not analyse, describe manually";
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
