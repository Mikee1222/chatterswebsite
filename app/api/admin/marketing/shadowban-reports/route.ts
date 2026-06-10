import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getAllShadowbanReports, getPendingShadowbanReports } from "@/services/marketing";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const pendingOnly = new URL(req.url).searchParams.get("pending") === "1";
  const reports = pendingOnly ? await getPendingShadowbanReports() : await getAllShadowbanReports();
  return NextResponse.json({ reports });
}
