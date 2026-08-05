import { NextRequest, NextResponse } from "next/server";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import {
  listCreatorDailyStats,
  listCreatorTransactions,
  listMarketingLinks,
} from "@/services/infloww-creator-earnings";

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
  const creatorId = ctx.modelRecord.model_id?.trim();
  // Prefer model_record_id filter; creator id matching is handled at sync time.
  void creatorId;

  const sp = req.nextUrl.searchParams;
  const preset = (sp.get("preset") ?? "this_month") as InflowwStatsPreset;
  const range = resolveInflowwStatsRange(
    preset,
    sp.get("startYmd"),
    sp.get("endYmd")
  );

  try {
    const [daily, transactions, marketingLinks] = await Promise.all([
      listCreatorDailyStats({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
      }),
      listCreatorTransactions({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
        limit: 300,
      }),
      listMarketingLinks({ modelRecordId }),
    ]);

    const totals = {
      gross: transactions.reduce((s, t) => s + t.amount, 0),
      net: transactions.reduce((s, t) => s + t.net, 0),
      new_subscribers: daily.reduce((s, d) => s + d.new_subscribers, 0),
      renewals: daily.reduce((s, d) => s + d.renewals, 0),
      profile_visitors: daily.reduce((s, d) => s + d.profile_visitors, 0),
    };

    const latest = daily.length
      ? daily.reduce((a, b) => (a.date >= b.date ? a : b))
      : null;

    return NextResponse.json({
      range,
      modelName: ctx.modelRecord.model_name,
      daily,
      marketingLinks,
      totals,
      latest,
      // No raw transaction list for model UI — keep simple
    });
  } catch (err) {
    console.error("[model/earnings]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load earnings" },
      { status: 500 }
    );
  }
}
