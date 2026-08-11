import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import {
  CLIENT_PARTNERSHIP_STAT_INFO,
  getClientPartnershipInflowwStats,
} from "@/services/client-partnership-infloww";
import type { InflowwStatsPreset } from "@/services/infloww-performance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/client/partnership-stats
 * Infloww account performance for the authenticated client's linked model(s) only.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = getClientAirtableId(session);
  const sp = req.nextUrl.searchParams;
  const preset = (sp.get("preset") ?? "this_month") as InflowwStatsPreset;

  try {
    const stats = await getClientPartnershipInflowwStats(
      clientId,
      preset,
      sp.get("startYmd") ?? undefined,
      sp.get("endYmd") ?? undefined
    );

    return NextResponse.json({
      ...stats,
      tooltips: CLIENT_PARTNERSHIP_STAT_INFO,
    });
  } catch (err) {
    console.error("[client/partnership-stats]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load account stats" },
      { status: 500 }
    );
  }
}
