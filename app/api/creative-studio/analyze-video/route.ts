import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  analyzeVideoFrames,
  analysisToIdeaContext,
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
  };

  const modelId = body.modelId?.trim();
  if (!modelId) return Response.json({ error: "modelId required" }, { status: 400 });
  if (!Array.isArray(body.frames) || body.frames.length === 0) {
    return Response.json({ error: "frames required" }, { status: 400 });
  }
  if (body.frames.length > 8) {
    return Response.json({ error: "max 8 frames" }, { status: 400 });
  }

  // Reject oversized payloads (approx > 4MB total base64)
  const totalLen = body.frames.reduce((n, f) => n + (f?.length ?? 0), 0);
  if (totalLen > 4_500_000) {
    return Response.json({ error: "frames too large" }, { status: 413 });
  }

  try {
    const result = await analyzeVideoFrames({
      modelId,
      userId: session.airtableUserId ?? session.id,
      frames: body.frames,
      frameHashes: Array.isArray(body.frameHashes) ? body.frameHashes.map(String) : [],
      coverThumbnailBase64: body.coverThumbnailBase64,
    });

    const ideaContext = analysisToIdeaContext(result.analysis);
    return Response.json({
      ...result,
      ideaContext,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    const status = msg.includes("Rate limit") ? 429 : 500;
    return Response.json(
      {
        error: msg,
        analysis: {
          refusal: true,
          refusal_message: "could not analyse, describe manually",
        },
      },
      { status },
    );
  }
}
