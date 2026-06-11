import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getGlobalAnalytics } from "@/services/link-page-analytics";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Number.parseInt(url.searchParams.get("days") ?? "1", 10);
  const summary = await getGlobalAnalytics(Number.isFinite(days) && days > 0 ? days : 1);
  return NextResponse.json({ summary });
}
