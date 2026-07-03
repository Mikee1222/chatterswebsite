import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getWinnerVideoById,
  getWinnerVideoFileUrl,
  transcribeVideoUrl,
  updateWinnerVideoTranscript,
} from "@/services/winner-videos";

export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasAnyPermission(session, [PERMISSIONS.WINNER_VIDEOS_MANAGE]);
  const canSubmit = await hasAnyPermission(session, [PERMISSIONS.WINNER_VIDEOS_SUBMIT]);
  if (!canManage && !canSubmit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const winnerVideoId = String(body.winnerVideoId ?? "").trim();
  if (!winnerVideoId) {
    return NextResponse.json({ error: "winnerVideoId is required" }, { status: 400 });
  }

  const video = await getWinnerVideoById(winnerVideoId);
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManage) {
    const userId = session.airtableUserId ?? session.id;
    if (video.submitted_by_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const fileUrl = getWinnerVideoFileUrl(video);
  if (!fileUrl) {
    return NextResponse.json({ error: "No video file on this record" }, { status: 400 });
  }

  const result = await transcribeVideoUrl(fileUrl);
  if (!result) {
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }

  await updateWinnerVideoTranscript(winnerVideoId, result.transcript);

  return NextResponse.json({
    transcript: result.transcript,
    language: result.language,
    duration: result.duration,
  });
}
