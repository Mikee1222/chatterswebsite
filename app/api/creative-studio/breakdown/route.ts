import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { MAX_VIDEO_SAMPLE_FRAMES } from "@/lib/video-frame-sampling";
import type { TranscriptSegment } from "@/lib/winner-breakdown-schema";
import {
  BREAKDOWN_REFUSAL_MESSAGE,
  createWinnerBreakdown,
  listWinnerBreakdowns,
} from "@/services/winner-breakdowns";

export const maxDuration = 120;

/** GET ?modelId= → recent successful breakdowns (selected model + unassigned). */
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const modelId = url.searchParams.get("modelId")?.trim() || null;
  const limit = Number(url.searchParams.get("limit") ?? 30);
  try {
    const items = await listWinnerBreakdowns({ modelId, limit });
    return Response.json({ items });
  } catch (err) {
    console.error("[creative-studio] list breakdowns failed", err);
    return Response.json({ error: "Could not load breakdowns" }, { status: 500 });
  }
}

/** POST JSON → run the breakdown and store it. */
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    modelId?: string | null;
    winnerVideoId?: string | null;
    title?: string;
    sourceUrl?: string;
    sourceCaption?: string;
    notes?: string;
    durationSec?: number | null;
    transcript?: string;
    transcriptSegments?: TranscriptSegment[];
    transcriptLanguage?: string;
    sttModel?: string;
    frames?: string[];
    frameHashes?: string[];
    coverThumbnailBase64?: string;
  };

  const transcript = (body.transcript ?? "").trim();
  const frames = Array.isArray(body.frames) ? body.frames.filter((f) => typeof f === "string") : [];
  if (!transcript && frames.length === 0) {
    return Response.json({ error: "transcript or frames required" }, { status: 400 });
  }
  if (frames.length > MAX_VIDEO_SAMPLE_FRAMES) {
    return Response.json({ error: `max ${MAX_VIDEO_SAMPLE_FRAMES} frames` }, { status: 400 });
  }
  const totalLen = frames.reduce((n, f) => n + f.length, 0);
  if (totalLen > 7_500_000) {
    return Response.json({ error: "frames too large" }, { status: 413 });
  }

  try {
    const result = await createWinnerBreakdown({
      userId: session.airtableUserId ?? session.id,
      modelId: body.modelId ?? null,
      winnerVideoId: body.winnerVideoId ?? null,
      title: body.title,
      sourceUrl: body.sourceUrl,
      sourceCaption: body.sourceCaption,
      notes: body.notes,
      durationSec: typeof body.durationSec === "number" ? body.durationSec : null,
      transcript,
      transcriptSegments: Array.isArray(body.transcriptSegments) ? body.transcriptSegments : [],
      transcriptLanguage: body.transcriptLanguage,
      sttModel: body.sttModel,
      frames,
      frameHashes: Array.isArray(body.frameHashes) ? body.frameHashes.map(String) : [],
      coverThumbnailBase64: body.coverThumbnailBase64,
    });
    return Response.json({
      id: result.id,
      breakdown: result.breakdown,
      status: result.status,
      model: result.model,
      refused: result.status !== "success",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Breakdown failed";
    const status = msg.includes("Rate limit") ? 429 : 500;
    return Response.json(
      {
        error: status === 429 ? msg : "Breakdown failed",
        refused: true,
        breakdown: { refusal: true, refusal_message: BREAKDOWN_REFUSAL_MESSAGE },
      },
      { status },
    );
  }
}
