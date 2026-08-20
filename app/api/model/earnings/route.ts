import { NextRequest, NextResponse } from "next/server";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { previousPeriodRange } from "@/services/infloww-analytics";
import {
  CREATOR_EARNINGS_STAT_INFO,
  deriveModelCreatorAnalytics,
  computeAcquisitionEfficiency,
} from "@/services/infloww-creator-analytics";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import {
  listCreatorDailyStats,
  listCreatorRefunds,
  listCreatorTransactions,
  creatorTxRevenueAmount,
  listMarketingLinks,
} from "@/services/infloww-creator-earnings";
import {
  getCrossPlatformAnalytics,
  toModelCrossPlatformCard,
} from "@/services/cross-platform-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/model/earnings
 * Own linked model only — creator earnings from synced Supabase tables.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  const modelRecordId = ctx.linkedModelId;

  const sp = req.nextUrl.searchParams;
  const preset = (sp.get("preset") ?? "this_month") as InflowwStatsPreset;
  const range = resolveInflowwStatsRange(
    preset,
    sp.get("startYmd") ?? undefined,
    sp.get("endYmd") ?? undefined
  );
  const prev = previousPeriodRange(range.startYmd, range.endYmd);

  try {
    const [daily, transactions, refunds, marketingLinks, prevTxs] = await Promise.all([
      listCreatorDailyStats({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
      }),
      listCreatorTransactions({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
        fetchAll: true,
        revenueOnly: true,
      }),
      listCreatorRefunds({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
        limit: 200,
      }),
      // Models see Trial + Tracking only — Campaign links are admin-only.
      listMarketingLinks({ modelRecordId, excludeLinkTypes: ["CAMPAIGN"] }),
      listCreatorTransactions({
        startYmd: prev.startYmd,
        endYmd: prev.endYmd,
        modelRecordId,
        fetchAll: true,
        revenueOnly: true,
      }),
    ]);

    const creatorInflowwId =
      daily[0]?.creator_infloww_id ??
      transactions[0]?.creator_infloww_id ??
      "";

    const analytics = deriveModelCreatorAnalytics({
      creatorInflowwId: creatorInflowwId || "unlinked",
      modelRecordId,
      modelName: ctx.modelRecord.model_name || "Model",
      daily,
      transactions,
      refunds,
      previousGross: prevTxs.reduce((s, t) => s + creatorTxRevenueAmount(t), 0),
    });

    const acquisition = computeAcquisitionEfficiency(marketingLinks).slice(0, 12);

    const latest = daily.length
      ? daily.reduce((a, b) => (a.date >= b.date ? a : b))
      : null;

    let crossPlatformCard = null;
    try {
      const xp = await getCrossPlatformAnalytics({
        modelRecordId,
        modelName: ctx.modelRecord.model_name,
        startYmd: range.startYmd,
        endYmd: range.endYmd,
      });
      crossPlatformCard = toModelCrossPlatformCard(xp);
    } catch (xpErr) {
      console.warn("[model/earnings] cross-platform skipped", xpErr);
    }

    return NextResponse.json({
      range,
      modelName: ctx.modelRecord.model_name,
      linked: Boolean(creatorInflowwId) || daily.length > 0 || transactions.length > 0,
      daily,
      marketingLinks,
      analytics,
      acquisition,
      latest,
      tooltips: CREATOR_EARNINGS_STAT_INFO,
      crossPlatformCard,
    });
  } catch (err) {
    console.error("[model/earnings]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load earnings" },
      { status: 500 }
    );
  }
}
