import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { computeCategoryTimeStats } from "@/services/task-category-timer";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.VA_STATISTICS_VIEW))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const startYmd = url.searchParams.get("start") ?? undefined;
  const endYmd = url.searchParams.get("end") ?? undefined;
  const va_id = url.searchParams.get("va_id") ?? undefined;

  try {
    const stats = await computeCategoryTimeStats({ startYmd, endYmd, va_id });
    return Response.json({ stats });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
