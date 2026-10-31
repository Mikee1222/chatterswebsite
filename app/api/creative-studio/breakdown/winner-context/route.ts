import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getWinnerVideoById } from "@/services/winner-videos";

/**
 * GET ?winnerId= → the bits of a Fill Bunches winner the Winner Breakdown tab can prefill:
 * source link, research note, reference account, views, an uploaded video file (if any).
 */
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const winnerId = new URL(req.url).searchParams.get("winnerId")?.trim();
  if (!winnerId) return Response.json({ error: "winnerId required" }, { status: 400 });

  try {
    const v = await getWinnerVideoById(winnerId);
    if (!v) return Response.json({ error: "Not found" }, { status: 404 });
    const file = v.video_file?.find((a) => a.url) ?? null;
    return Response.json({
      winner: {
        id: v.id,
        video_id: v.video_id,
        video_link: v.video_link,
        note: v.note,
        reference_model_name: v.reference_model_name,
        views_at_submission: v.views_at_submission,
        status: v.status,
        video_file_url: file?.url ?? null,
        video_file_name: file?.filename ?? null,
        transcript: v.transcript ?? "",
      },
    });
  } catch {
    return Response.json({ error: "Could not load winner" }, { status: 500 });
  }
}
