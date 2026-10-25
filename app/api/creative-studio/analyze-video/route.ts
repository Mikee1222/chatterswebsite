import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { NEUTRAL_ANALYSIS_REFUSAL_MESSAGE } from "@/lib/video-analysis-refusal";
import {
  analyzeVideoFrames,
  analysisToIdeaContext,
  MAX_VIDEO_ANALYSIS_FRAMES,
} from "@/services/creative-studio-video";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    modelId?: string;
    frames?: string[];
    frameHashes?: string[];
    coverThumbnailBase64?: string;
    samplingMeta?: {
      duration_sec?: number;
      seek_timestamps_sec?: number[];
      frames_requested?: number;
      frames_analysed?: number;
      frame_byte_lengths?: number[];
      blank_frames_replaced?: number;
    };
  };

  const modelId = body.modelId?.trim();
  if (!modelId) return Response.json({ error: "modelId required" }, { status: 400 });
  if (!Array.isArray(body.frames) || body.frames.length === 0) {
    return Response.json({ error: "frames required" }, { status: 400 });
  }
  if (body.frames.length > MAX_VIDEO_ANALYSIS_FRAMES) {
    return Response.json(
      { error: `max ${MAX_VIDEO_ANALYSIS_FRAMES} frames` },
      { status: 400 },
    );
  }

  // Reject oversized payloads (approx > 7MB total base64 for up to 14 frames)
  const totalLen = body.frames.reduce((n, f) => n + (f?.length ?? 0), 0);
  if (totalLen > 7_500_000) {
    return Response.json({ error: "frames too large" }, { status: 413 });
  }

  try {
    const result = await analyzeVideoFrames({
      modelId,
      userId: session.airtableUserId ?? session.id,
      frames: body.frames,
      frameHashes: Array.isArray(body.frameHashes) ? body.frameHashes.map(String) : [],
      coverThumbnailBase64: body.coverThumbnailBase64,
      samplingMeta: body.samplingMeta ?? null,
    });

    const ideaContext = analysisToIdeaContext(result.analysis);
    // Never return raw model refusal text — analysis already sanitised server-side
    return Response.json({
      analysis: result.analysis,
      analysisId: result.analysisId,
      refused: result.refused,
      duplicate: result.duplicate,
      ideaContext,
      generationDisabledReason: result.generationDisabledReason,
      allowlistKeysUsed: result.allowlistKeysUsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    const status = msg.includes("Rate limit") ? 429 : 500;
    // Do not leak internal error text that might echo model refusals
    return Response.json(
      {
        error: status === 429 ? msg : "Analysis failed",
        refused: true,
        analysis: {
          refusal: true,
          refusal_message: NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
        },
        ideaContext: "",
      },
      { status },
    );
  }
}
