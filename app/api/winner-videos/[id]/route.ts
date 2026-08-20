import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteOwnPendingWinnerVideo, updateOwnPendingWinnerVideo } from "@/services/winner-videos";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canSubmit =
    (await hasPermission(session, PERMISSIONS.WINNER_SOURCING_SUBMIT)) ||
    (await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_SUBMIT));
  if (!canSubmit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  try {
    const video = await updateOwnPendingWinnerVideo(id, session.airtableUserId ?? session.id, {
      note: body.note !== undefined ? String(body.note) : undefined,
      video_link: body.video_link !== undefined ? String(body.video_link) : undefined,
      sourcing_video_type:
        body.sourcing_video_type !== undefined || body.video_type !== undefined
          ? String(body.sourcing_video_type ?? body.video_type ?? "")
          : undefined,
      video_type_other: body.video_type_other !== undefined ? String(body.video_type_other) : undefined,
      force_duplicate: Boolean(body.force_duplicate),
    });
    return NextResponse.json({ video });
  } catch (e) {
    const err = e as Error & { code?: string; duplicate_id?: string };
    if (err.code === "DUPLICATE_LINK") {
      return NextResponse.json(
        { error: err.message, duplicate: true, duplicate_id: err.duplicate_id },
        { status: 409 },
      );
    }
    const message = err.message || "Failed";
    return NextResponse.json(
      { error: message },
      { status: message.includes("own") || message.includes("pending") ? 403 : 400 },
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canSubmit =
    (await hasPermission(session, PERMISSIONS.WINNER_SOURCING_SUBMIT)) ||
    (await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_SUBMIT));
  if (!canSubmit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  try {
    await deleteOwnPendingWinnerVideo(id, session.airtableUserId ?? session.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json(
      { error: message },
      { status: message.includes("own") || message.includes("pending") ? 403 : 400 },
    );
  }
}
