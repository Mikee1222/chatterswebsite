import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isApplicationResponseStatus } from "@/lib/application-forms-types";
import { getFormAnalytics, listResponses } from "@/services/application-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/application-forms/[id]/responses?status=&sort=&search=&analytics=1 */
export async function GET(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: formId } = await ctx.params;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "all";
  const sortParam = url.searchParams.get("sort") ?? "newest";
  const sort =
    sortParam === "oldest" ||
    sortParam === "cognitive_desc" ||
    sortParam === "cognitive_asc" ||
    sortParam === "eq_desc" ||
    sortParam === "eq_asc" ||
    sortParam === "typing_desc" ||
    sortParam === "typing_asc"
      ? sortParam
      : "newest";
  const search = url.searchParams.get("search") ?? undefined;
  const includeAnalytics = url.searchParams.get("analytics") === "1";

  const status =
    statusParam === "all"
      ? "all"
      : isApplicationResponseStatus(statusParam)
        ? statusParam
        : "all";

  try {
    const responses = await listResponses(formId, { status, sort, search });
    if (!includeAnalytics) return NextResponse.json({ responses });
    const analytics = await getFormAnalytics(formId);
    return NextResponse.json({ responses, analytics });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load responses";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
