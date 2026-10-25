import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listVideoAnalysisAdminReview } from "@/services/creative-studio-video";

/** Admin-only: refusal / feedback rows including raw model response for pattern review. */
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.FEEDBACK_VIEW))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const rows = await listVideoAnalysisAdminReview(Number.isFinite(limit) ? limit : 50);
  return Response.json({ rows });
}
