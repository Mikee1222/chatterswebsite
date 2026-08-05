import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  isAllowedWinnerVideoType,
  validateWinnerVideoFileSize,
} from "@/lib/winner-video-files";
import { transcribeVideoUrl } from "@/services/winner-videos";
import { getVideoTranscriptFileUrl } from "@/lib/video-transcripts-helpers";
import {
  createVideoTranscriptRecord,
  getVideoTranscriptById,
  getVideoTranscripts,
  setVideoTranscriptFileUrls,
  updateVideoTranscriptResult,
  uploadVideoTranscriptFile,
} from "@/services/video-transcripts";
import { readRequestFormData } from "@/lib/request-form-data";

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

  const formDataOrErr = await readRequestFormData(req);
  if (formDataOrErr instanceof NextResponse) return formDataOrErr;
  const fd = formDataOrErr;

  const videoFileUrl = String(fd.get("video_file_url") ?? "").trim();
  const entry = fd.get("video_file");
  const hasFile = entry instanceof File && entry.size > 0;

  if (!videoFileUrl && !hasFile) {
    return NextResponse.json({ error: "A video file is required" }, { status: 400 });
  }

  if (videoFileUrl && !isAllowedDirectUploadToken(videoFileUrl, "video-transcript")) {
    return NextResponse.json({ error: "Invalid video file reference" }, { status: 400 });
  }

  let name = "video.mp4";
  let type = "application/octet-stream";
  if (hasFile && entry instanceof File) {
    name = entry.name || "video.mp4";
    type = entry.type || "application/octet-stream";
    if (!isAllowedWinnerVideoType(type, name)) {
      return NextResponse.json({ error: "Invalid video file type" }, { status: 400 });
    }
    const sizeError = validateWinnerVideoFileSize(entry.size);
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }
  } else if (videoFileUrl) {
    name = videoFileUrl.split("/").pop()?.replace(/^[a-f0-9-]+_\d+_/, "") || "video.mp4";
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

    if (videoFileUrl) {
      await setVideoTranscriptFileUrls(record.id, [videoFileUrl]);
    } else if (hasFile && entry instanceof File) {
      await uploadVideoTranscriptFile(record.id, [
        {
          name,
          type,
          bytes: new Uint8Array(await entry.arrayBuffer()),
        },
      ]);
    }

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
