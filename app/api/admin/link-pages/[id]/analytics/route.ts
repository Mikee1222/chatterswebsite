import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getLinkPageById } from "@/services/link-pages";
import { getPageAnalytics } from "@/services/link-page-analytics";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const page = await getLinkPageById(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const days = Number.parseInt(url.searchParams.get("days") ?? "1", 10);
  const summary = await getPageAnalytics(page.page_id, Number.isFinite(days) && days > 0 ? days : 1);
  return NextResponse.json({ summary });
}
