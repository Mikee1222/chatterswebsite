import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getInflowwModels, InflowwApiError } from "@/lib/infloww-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/infloww-creators
 * Live Infloww creator list for looking up creator ids when linking modelss.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.EARNINGS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const creators = await getInflowwModels();
    return NextResponse.json({ creators, count: creators.length });
  } catch (err) {
    console.error("[admin/infloww-creators]", err);
    if (err instanceof InflowwApiError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Infloww creators" },
      { status: 500 }
    );
  }
}
