import { NextResponse } from "next/server";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { getSessionFromCookies } from "@/lib/auth";
import { getInflowwEarningsSnapshot, InflowwApiError } from "@/lib/infloww-api";
import { listEarningsAgencyCutConfig } from "@/services/earnings-config";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayYmdAthens();
  const agencyPct = await listEarningsAgencyCutConfig().catch(() => ({}));

  try {
    const snap = await getInflowwEarningsSnapshot({
      from: today,
      to: today,
      agencyCutPercentByModelId: agencyPct,
    });
    return NextResponse.json(
      {
        date: today,
        gross: snap.totals.gross,
        net: snap.totals.net,
        agency_cut: snap.totals.cut,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof InflowwApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
