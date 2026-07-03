import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  isAllowedWinnerVideoType,
  validateWinnerVideoFileSize,
  WINNER_VIDEO_MAX_FILE_BYTES,
} from "@/lib/winner-video-files";
import { getWinnerVideoById, uploadWinnerVideoFile } from "@/services/winner-videos";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await getWinnerVideoById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.submitted_by_id !== (session.airtableUserId ?? session.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fd = await req.formData();
  const files: Array<{ name: string; type: string; bytes: Uint8Array }> = [];
  for (const entry of fd.getAll("video_file")) {
    if (!(entry instanceof File) || entry.size <= 0) continue;
    const name = entry.name || "video.mp4";
    const type = entry.type || "application/octet-stream";
    if (!isAllowedWinnerVideoType(type, name)) {
      return NextResponse.json({ error: "Invalid video file type" }, { status: 400 });
    }
    const sizeError = validateWinnerVideoFileSize(entry.size);
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }
    files.push({
      name,
      type,
      bytes: new Uint8Array(await entry.arrayBuffer()),
    });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "No valid video file provided" }, { status: 400 });
  }
  if (files.length > 1) {
    return NextResponse.json(
      { error: `Only one video file allowed (max ${WINNER_VIDEO_MAX_FILE_BYTES / (1024 * 1024)} MB)` },
      { status: 400 },
    );
  }

  await uploadWinnerVideoFile(id, files);
  const video = await getWinnerVideoById(id);
  return NextResponse.json({ video });
}
