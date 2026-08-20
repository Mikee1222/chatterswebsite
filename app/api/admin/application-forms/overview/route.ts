import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getApplicationFormsOverview } from "@/services/application-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/application-forms/overview */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const overview = await getApplicationFormsOverview();
    return NextResponse.json({ overview });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load overview";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
