import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getModelApiContext } from "@/lib/model-context-server";
import { getGetMySocialAnalyticsForModel } from "@/services/getmysocial-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/model/getmysocial/analytics
 * Simplified Link A/B analytics for the signed-in model (Earnings view).
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getModelApiContext();
  if (!ctx?.modelRecord) {
    return NextResponse.json({ error: "Model profile not linked", linked: false }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  try {
    const data = await getGetMySocialAnalyticsForModel(ctx.modelRecord.id, {
      timeframe: searchParams.get("timeframe")?.trim() || "thisMonth",
    });
    if (!data) {
      return NextResponse.json({
        data: null,
        message: "No GetMySocial link linked to this model yet.",
      });
    }
    return NextResponse.json({
      data: {
        lastSyncedAt: data.lastSyncedAt,
        totals: data.totals,
        linkA: {
          pageviews: data.linkA.pageviews,
          button_clicks: data.linkA.button_clicks,
          unique_visitors: data.linkA.unique_visitors,
          ctr_pct: data.linkA.ctr_pct,
          shortcode: data.linkA.link?.shortcode ?? null,
        },
        linkB: {
          pageviews: data.linkB.pageviews,
          button_clicks: data.linkB.button_clicks,
          unique_visitors: data.linkB.unique_visitors,
          ctr_pct: data.linkB.ctr_pct,
          shortcode: data.linkB.link?.shortcode ?? null,
        },
        topReferrers: data.referrers.slice(0, 8).map((r) => ({
          referrer: r.referrer,
          count: r.count,
        })),
        links: data.links.map((l) => ({
          label: l.link_label,
          shortcode: l.shortcode,
          link_role: l.link_role,
        })),
      },
    });
  } catch (err) {
    console.error("[model/getmysocial/analytics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load analytics" },
      { status: 500 }
    );
  }
}
