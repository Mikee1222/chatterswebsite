import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getAllShadowbanReports, getPendingShadowbanReports } from "@/services/marketing";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const pendingOnly = new URL(req.url).searchParams.get("pending") === "1";
  const reports = pendingOnly ? await getPendingShadowbanReports() : await getAllShadowbanReports();
  return NextResponse.json({ reports });
}
