import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { fetchInflowwEmployees, InflowwApiError } from "@/lib/infloww-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/infloww-employees
 * Live Infloww Employee list for looking up employeeId when linking accounts.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INFLOWW_STATS_VIEW_ALL))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const employees = await fetchInflowwEmployees();
    return NextResponse.json({ employees, count: employees.length });
  } catch (err) {
    console.error("[admin/infloww-employees]", err);
    if (err instanceof InflowwApiError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Infloww employees" },
      { status: 500 }
    );
  }
}
