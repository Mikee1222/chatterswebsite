import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getInflowwModels, InflowwApiError } from "@/lib/infloww-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

/**
 * GET /api/admin/infloww-creators
 * Live Infloww creator list for looking up creator ids when linking modelss.
 * Always bypasses the in-process /creators TTL cache so Refresh is truly live.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!(await hasPermission(session, PERMISSIONS.EARNINGS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  try {
    const creators = await getInflowwModels({ forceRefresh: true });
    return NextResponse.json(
      {
        creators,
        count: creators.length,
        source: "live",
        endpoint: "GET https://openapi.infloww.com/v1/creators",
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("[admin/infloww-creators]", err);
    if (err instanceof InflowwApiError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return NextResponse.json({ error: err.message }, { status, headers: NO_STORE });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Infloww creators" },
      { status: 500, headers: NO_STORE }
    );
  }
}
