import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  isAllowedWinnerVideoType,
  validateWinnerVideoFileSize,
  WINNER_VIDEO_MAX_FILE_BYTES,
} from "@/lib/winner-video-files";
import { transcribeVideoUrl } from "@/services/winner-videos";
import { getVideoTranscriptFileUrl } from "@/lib/video-transcripts-helpers";
import {
  createVideoTranscriptRecord,
  getVideoTranscriptById,
  getVideoTranscripts,
  updateVideoTranscriptResult,
  uploadVideoTranscriptFile,
} from "@/services/video-transcripts";

export const maxDuration = 300;

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VIDEO_TRANSCRIBE_ACCESS))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const date_from = url.searchParams.get("date_from")?.trim() || undefined;
  const date_to = url.searchParams.get("date_to")?.trim() || undefined;
  const userId = session.airtableUserId ?? session.id;

  const transcripts = await getVideoTranscripts({
    date_from,
    date_to,
    uploaded_by_id: userId,
  });

  return NextResponse.json({ transcripts });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VIDEO_TRANSCRIBE_ACCESS))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fd = await req.formData();
  const entry = fd.get("video_file");
  if (!(entry instanceof File) || entry.size <= 0) {
    return NextResponse.json({ error: "A video file is required" }, { status: 400 });
  }

  const name = entry.name || "video.mp4";
  const type = entry.type || "application/octet-stream";
  if (!isAllowedWinnerVideoType(type, name)) {
    return NextResponse.json({ error: "Invalid video file type" }, { status: 400 });
  }
  const sizeError = validateWinnerVideoFileSize(entry.size);
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 400 });
  }

  const label = (fd.get("label")?.toString() || name).trim() || name;
  const userId = session.airtableUserId ?? session.id;
  const userName = (session.fullName || session.email || "").trim();

  let record: Awaited<ReturnType<typeof createVideoTranscriptRecord>> | undefined;
  try {
    record = await createVideoTranscriptRecord({
      label,
      uploaded_by_id: userId,
      uploaded_by_name: userName,
    });

    await uploadVideoTranscriptFile(record.id, [
      {
        name,
        type,
        bytes: new Uint8Array(await entry.arrayBuffer()),
      },
    ]);

    const refreshed = await getVideoTranscriptById(record.id);
    const fileUrl = refreshed ? getVideoTranscriptFileUrl(refreshed) : null;
    if (!fileUrl) {
      const failed = await updateVideoTranscriptResult(record.id, { status: "Failed" });
      return NextResponse.json(
        { error: "Video upload succeeded but attachment URL is missing", transcript: failed },
        { status: 502 },
      );
    }

    const result = await transcribeVideoUrl(fileUrl);
    if (!result) {
      const failed = await updateVideoTranscriptResult(record.id, { status: "Failed" });
      return NextResponse.json(
        { error: "Transcription failed", transcript: failed },
        { status: 502 },
      );
    }

    const done = await updateVideoTranscriptResult(record.id, {
      status: "Done",
      transcript: result.transcript,
      language: result.language,
      duration_seconds: result.duration,
    });

    return NextResponse.json({
      transcript: done,
      language: result.language,
      duration: result.duration,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    if (record?.id) {
      try {
        const failed = await updateVideoTranscriptResult(record.id, { status: "Failed" });
        return NextResponse.json({ error: message, transcript: failed }, { status: 500 });
      } catch {
        // fall through
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
