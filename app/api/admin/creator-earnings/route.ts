import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { previousPeriodRange } from "@/services/infloww-analytics";
import { buildAgencyCreatorAnalytics } from "@/services/infloww-creator-analytics";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import {
  compareTransactionPerfVsEmployeeSales,
  creatorTxRevenueAmount,
  listCreatorDailyStats,
  listCreatorRefunds,
  listCreatorTransactionTypeCounts,
  listCreatorTransactions,
  listLinkedCreatorModels,
  listMarketingLinks,
  listPriorityMassMessages,
} from "@/services/infloww-creator-earnings";
import { listAllModelss } from "@/services/modelss";

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
  const prev = previousPeriodRange(range.startYmd, range.endYmd);

  try {
    const [
      { linked },
      modelsAll,
      daily,
      transactions,
      analyticsTxs,
      refunds,
      marketingLinks,
      pmm,
      discrepancies,
      prevTxs,
      txTypeCounts,
    ] = await Promise.all([
      listLinkedCreatorModels(),
      listAllModelss(),
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
        limit: 2000,
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
        limit: 500,
      }),
      listMarketingLinks({ modelRecordId }),
      listPriorityMassMessages({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
        limit: 500,
      }),
      compareTransactionPerfVsEmployeeSales({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
      }),
      listCreatorTransactions({
        startYmd: prev.startYmd,
        endYmd: prev.endYmd,
        modelRecordId,
        fetchAll: true,
        revenueOnly: true,
      }),
      listCreatorTransactionTypeCounts({
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        modelRecordId,
      }),
    ]);

    const createdAtByRecord = new Map(
      modelsAll.map((m) => [m.id, m.created_at || null] as const)
    );

    const filteredLinked = modelRecordId
      ? linked.filter((l) => l.modelRecordId === modelRecordId)
      : linked;

    const previousGrossByCreator = new Map<string, number>();
    for (const t of prevTxs) {
      previousGrossByCreator.set(
        t.creator_infloww_id,
        (previousGrossByCreator.get(t.creator_infloww_id) ?? 0) + creatorTxRevenueAmount(t)
      );
    }

    const analytics = buildAgencyCreatorAnalytics({
      linked: filteredLinked.map((l) => ({
        creatorInflowwId: l.creatorInflowwId,
        modelRecordId: l.modelRecordId,
        modelName: l.modelName,
        createdAt: createdAtByRecord.get(l.modelRecordId) ?? null,
      })),
      daily,
      transactions: analyticsTxs,
      refunds,
      marketingLinks,
      priorityMassMessages: pmm,
      previousGrossByCreator,
    });

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
    const marketing = marketingLinks.map((l) => ({
      ...l,
      model_name: nameByRecord.get(l.model_id) ?? null,
    }));

    const latestByModel = new Map<string, (typeof daily)[number]>();
    for (const row of daily) {
      const key = row.model_record_id ?? row.creator_infloww_id;
      const prevRow = latestByModel.get(key);
      if (!prevRow || row.date >= prevRow.date) latestByModel.set(key, row);
    }

    return NextResponse.json({
      range,
      models,
      daily,
      transactions: txs,
      txTypeCounts,
      refunds,
      marketingLinks: marketing,
      priorityMassMessages: pmm,
      discrepancies,
      analytics,
      latestFanSnapshot: [...latestByModel.values()],
      unmatchedModels: linked.length ? undefined : undefined,
      linkedCount: linked.length,
    });
  } catch (err) {
    console.error("[admin/creator-earnings]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load earnings" },
      { status: 500 }
    );
  }
}
