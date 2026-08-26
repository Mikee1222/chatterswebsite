import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getIntegrationHealthSnapshot } from "@/services/integration-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INTEGRATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const snapshot = await getIntegrationHealthSnapshot();
    return NextResponse.json(snapshot);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
