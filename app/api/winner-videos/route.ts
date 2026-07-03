import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { coerceWinnerVideoContentType, WINNER_VIDEO_CONTENT_TYPES } from "@/lib/winner-videos-helpers";
import { createWinnerVideo, getWinnerVideosBySubmitter } from "@/services/winner-videos";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const videos = await getWinnerVideosBySubmitter(session.airtableUserId ?? session.id);
  return NextResponse.json({ videos });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const reference_model_id = String(body.reference_model_id ?? "").trim();
  const reference_model_name = String(body.reference_model_name ?? "").trim();
  const video_link = String(body.video_link ?? "").trim();
  const content_type = coerceWinnerVideoContentType(body.content_type);
  if (!reference_model_name) {
    return NextResponse.json({ error: "Reference model is required" }, { status: 400 });
  }
  if (!content_type) {
    return NextResponse.json(
      { error: `Content type is required (${WINNER_VIDEO_CONTENT_TYPES.join(" or ")})` },
      { status: 400 },
    );
  }

  const viewsRaw = body.views_at_submission;
  const views_at_submission =
    viewsRaw == null || viewsRaw === ""
      ? null
      : Number.isFinite(Number(viewsRaw))
        ? Math.round(Number(viewsRaw))
        : null;

  const video = await createWinnerVideo({
    reference_model_id: reference_model_id || undefined,
    reference_model_name,
    content_type,
    video_link: video_link || undefined,
    note: String(body.note ?? ""),
    views_at_submission,
    submitted_by_id: session.airtableUserId ?? session.id,
    submitted_by_name: (session.fullName || session.email || "").trim(),
  });

  return NextResponse.json({ video });
}
