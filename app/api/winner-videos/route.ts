import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { runAfterResponse } from "@/lib/run-after-response";
import {
  createWinnerVideo,
  getWinnerVideosBySubmitter,
  transcribeAndSaveWinnerVideo,
} from "@/services/winner-videos";

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
  if (!reference_model_name || !video_link) {
    return NextResponse.json({ error: "Reference model and video link are required" }, { status: 400 });
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
    video_link,
    note: String(body.note ?? ""),
    views_at_submission,
    submitted_by_id: session.airtableUserId ?? session.id,
    submitted_by_name: (session.fullName || session.email || "").trim(),
  });

  runAfterResponse(() => transcribeAndSaveWinnerVideo(video.id, video.video_link));

  return NextResponse.json({ video });
}
