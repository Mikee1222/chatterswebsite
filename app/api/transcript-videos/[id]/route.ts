import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteVideoTranscript, getVideoTranscriptById } from "@/services/video-transcripts";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VIDEO_TRANSCRIBE_ACCESS))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await getVideoTranscriptById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteVideoTranscript(id);
  return NextResponse.json({ ok: true });
}
