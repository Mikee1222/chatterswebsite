import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import {
  compareTransactionPerfVsEmployeeSales,
  listCreatorDailyStats,
  listCreatorTransactions,
  listLinkedCreatorModels,
  listMarketingLinks,
} from "@/services/infloww-creator-earnings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/creator-earnings
 * Aggregated creator earnings dashboard payload from synced Supabase tables.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.EARNINGS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const preset = (sp.get("preset") ?? "this_month") as InflowwStatsPreset;
  const customStart = sp.get("startYmd") ?? undefined;
  const customEnd = sp.get("endYmd") ?? undefined;
  const modelRecordId = sp.get("modelId")?.trim() || undefined;
  const txType = sp.get("txType")?.trim() || undefined;
  const txStatus = sp.get("txStatus")?.trim() || undefined;
  const txSearch = sp.get("txSearch")?.trim() || undefined;

  const range = resolveInflowwStatsRange(preset, customStart, customEnd);

  try {
    const [{ linked }, daily, transactions, marketingLinks, discrepancies] = await Promise.all([
      listLinkedCreatorModels(),
      listCreatorDailyStats({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
      }),
      listCreatorTransactions({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
        type: txType,
        status: txStatus,
        search: txSearch,
        limit: 400,
      }),
      listMarketingLinks({ modelRecordId }),
      compareTransactionPerfVsEmployeeSales({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
      }),
    ]);

    const models = linked.map((l) => ({
      id: l.modelRecordId,
      name: l.modelName,
      creatorInflowwId: l.creatorInflowwId,
      stableId: l.modelStableId,
    }));

    const nameByRecord = new Map(models.map((m) => [m.id, m.name]));
    const txs = transactions.map((t) => ({
      ...t,
      model_name: t.model_record_id ? nameByRecord.get(t.model_record_id) ?? null : null,
    }));

    const totals = {
      gross: txs.reduce((s, t) => s + t.amount, 0),
      net: txs.reduce((s, t) => s + t.net, 0),
      fee: txs.reduce((s, t) => s + t.fee, 0),
      new_subscribers: daily.reduce((s, d) => s + d.new_subscribers, 0),
      renewals: daily.reduce((s, d) => s + d.renewals, 0),
      profile_visitors: daily.reduce((s, d) => s + d.profile_visitors, 0),
      messages_sent: daily.reduce((s, d) => s + d.messages_sent, 0),
    };

    const latestByModel = new Map<string, (typeof daily)[number]>();
    for (const row of daily) {
      const key = row.model_record_id ?? row.creator_infloww_id;
      const prev = latestByModel.get(key);
      if (!prev || row.date >= prev.date) latestByModel.set(key, row);
    }

    return NextResponse.json({
      range,
      models,
      daily,
      transactions: txs,
      marketingLinks,
      discrepancies,
      totals,
      latestFanSnapshot: [...latestByModel.values()],
    });
  } catch (err) {
    console.error("[admin/creator-earnings]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load earnings" },
      { status: 500 }
    );
  }
}
