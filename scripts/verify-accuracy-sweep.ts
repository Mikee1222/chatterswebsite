/**
 * Comprehensive accuracy sweep — compare shared-calculation metrics across all
 * Infloww + Instagram display surfaces using real Supabase data.
 *
 * Usage: npx tsx scripts/verify-accuracy-sweep.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import "./_polyfill-websocket";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import {
  aggregateIgDailyByDate,
  buildModelComparisonRows,
  computeAgencyAvgEngagementRate,
  computeModelEngagementRate,
  computeModelEngagementTotals,
  coalesceIgMetric,
  summarizeIgDaily,
  toFiniteRate,
} from "@/lib/instagram-insights-stats";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";
import { getCrossPlatformAnalytics } from "@/services/cross-platform-analytics";
import { getInstagramWeeklyProgressReport } from "@/services/instagram-weekly-progress";
import { getClarioSuiteProfileSimulator } from "@/services/clariosuite-media-detail";
import {
  listLinkedClarioSuiteModels,
  queryClarioSuiteDailyInsights,
  queryClarioSuiteTopPosts,
} from "@/services/clariosuite-sync";
import { getAdminInflowwPerformanceReport } from "@/services/infloww-performance";
import { deriveModelCreatorAnalytics } from "@/services/infloww-creator-analytics";
import {
  listCreatorDailyStats,
  listCreatorRefunds,
  listCreatorTransactions,
} from "@/services/infloww-creator-earnings";
import { previousPeriodRange } from "@/services/infloww-analytics";

const TOLERANCE = 0.02; // % points for ER, absolute for counts

function near(a: number | null | undefined, b: number | null | undefined, tol = TOLERANCE): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol;
}

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

type SurfaceRow = {
  surface: string;
  model?: string;
  reach?: number | null;
  views?: number | null;
  er?: number | null;
  sales?: number | null;
  notes?: string;
  ok?: boolean;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const range = resolveInflowwStatsRange("this_month");
  const rows: SurfaceRow[] = [];
  const mismatches: string[] = [];

  const sb = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: fetch.bind(globalThis) },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  const linked = await listLinkedClarioSuiteModels();
  const allDaily = await queryClarioSuiteDailyInsights({
    startYmd: range.startYmd,
    endYmd: range.endYmd,
  });
  const allTopPostsNested = await Promise.all(
    linked.map(async (m) => {
      const posts: Awaited<ReturnType<typeof queryClarioSuiteTopPosts>> = [];
      for (const a of m.accounts) {
        posts.push(...(await queryClarioSuiteTopPosts({ igUserId: a.igUserId, limit: 25 })));
      }
      return { modelId: m.modelRecordId, modelName: m.modelName, posts };
    })
  );
  const postsByModel = new Map<string, (typeof allTopPostsNested)[0]["posts"]>();
  for (const row of allTopPostsNested) {
    postsByModel.set(row.modelId, row.posts);
  }

  const linkedForCompare = linked.map((l) => ({
    modelRecordId: l.modelRecordId,
    modelName: l.modelName,
    igUserId: l.igUserId,
    accountCount: l.accounts.length,
    allIgUserIds: l.accounts.map((a) => a.igUserId),
  }));
  const comparison = buildModelComparisonRows(
    linkedForCompare,
    allDaily,
    postsByModel,
    { startYmd: range.startYmd, endYmd: range.endYmd }
  );
  const agencyEr = computeAgencyAvgEngagementRate(
    comparison,
    allDaily,
    allTopPostsNested.flatMap((r) => r.posts),
    { startYmd: range.startYmd, endYmd: range.endYmd }
  );

  rows.push({
    surface: "Agency Overview avg ER",
    er: agencyEr,
    notes: `${comparison.filter((c) => (c.avg_engagement_rate ?? 0) > 0).length} models with ER`,
  });

  // Per-model IG surfaces
  for (const m of linked.slice(0, 6)) {
    const modelId = m.modelRecordId;
    const modelName = m.modelName;
    const dailyRaw = await queryClarioSuiteDailyInsights({
      modelRecordId: modelId,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    });
    const daily = aggregateIgDailyByDate(dailyRaw);
    const topPosts = postsByModel.get(modelId) ?? [];
    const rangeOpts = { startYmd: range.startYmd, endYmd: range.endYmd };

    const earningsTab = computeModelEngagementTotals(daily, topPosts, rangeOpts);
    const modelHomeEr = computeModelEngagementRate(daily, topPosts, rangeOpts);
    const cross = await getCrossPlatformAnalytics({
      modelRecordId: modelId,
      modelName,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    });
    const crossEr = computeModelEngagementRate(daily, topPosts, rangeOpts);
    const leaderboard = comparison.find((c) => c.modelId === modelId);
    const weekly = await getInstagramWeeklyProgressReport(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      { modelRecordId: modelId }
    );
    const activeWeek = weekly.models[0]?.weeks.find((w) => w.status === "in_progress" || w.status === "complete");
    const weeklyEr = activeWeek?.totals.avg_engagement_rate ?? null;
    const weeklyReach = activeWeek?.totals.reach ?? null;
    let weeklyErOk = true;
    if (activeWeek && weeklyEr != null) {
      const weekDaily = daily.filter(
        (d) => d.date >= activeWeek.startYmd && d.date <= activeWeek.endYmd
      );
      const weekTotals = computeModelEngagementTotals(weekDaily, topPosts, {
        startYmd: activeWeek.startYmd,
        endYmd: activeWeek.endYmd,
      });
      weeklyErOk = near(weeklyEr, weekTotals.avg_engagement_rate, 0.05);
      if (!weeklyErOk) {
        mismatches.push(
          `${modelName} weekly ER: report=${fmt(weeklyEr)} shared=${fmt(weekTotals.avg_engagement_rate)}`
        );
      }
    }

    let profileFollowers: number | null = null;
    try {
      const sim = await getClarioSuiteProfileSimulator(m.igUserId);
      profileFollowers = sim.profile.followersCount;
    } catch {
      profileFollowers = null;
    }

    const erOk =
      near(earningsTab.avg_engagement_rate, modelHomeEr) &&
      near(earningsTab.avg_engagement_rate, leaderboard?.avg_engagement_rate ?? null);

    if (!erOk) {
      mismatches.push(
        `${modelName} ER mismatch: earnings=${fmt(earningsTab.avg_engagement_rate)} home=${fmt(modelHomeEr)} lb=${fmt(leaderboard?.avg_engagement_rate)}`
      );
    }

    const reachOk = leaderboard ? earningsTab.reach === leaderboard.reach : true;
    if (!reachOk) {
      mismatches.push(`${modelName} reach mismatch: earnings=${earningsTab.reach} lb=${leaderboard?.reach}`);
    }

    rows.push({
      surface: "Model Earnings IG tab",
      model: modelName,
      reach: earningsTab.reach,
      views: earningsTab.views,
      er: earningsTab.avg_engagement_rate,
      ok: erOk && reachOk,
    });
    rows.push({
      surface: "Model Leaderboard",
      model: modelName,
      reach: leaderboard?.reach,
      views: leaderboard?.views,
      er: leaderboard?.avg_engagement_rate,
      ok: erOk && reachOk,
    });
    rows.push({
      surface: "Model Home IG snapshot",
      model: modelName,
      er: modelHomeEr,
      notes: `followers=${profileFollowers ?? "—"} delta=${fmt(summarizeIgDaily(daily).follower_delta, 0)}`,
      ok: near(modelHomeEr, earningsTab.avg_engagement_rate),
    });
    rows.push({
      surface: "Weekly Progress (active week)",
      model: modelName,
      reach: weeklyReach,
      er: weeklyEr,
      ok: weeklyErOk,
    });
    rows.push({
      surface: "Cross-Platform IG×OF",
      model: modelName,
      reach: cross.overlap_days,
      er: crossEr,
      sales: cross.conversion_estimate.rate_pct,
      notes: `status=${cross.status} of_days=${cross.of_days}`,
    });
    rows.push({
      surface: "Profile Simulator",
      model: modelName,
      notes: `followers=${profileFollowers} posts=${m.accounts.length} acct(s)`,
    });
  }

  // Infloww surfaces
  try {
    const adminReport = await getAdminInflowwPerformanceReport(range);
    rows.push({
      surface: "Admin Chatter Performance",
      sales: adminReport.team_totals.sales,
      notes: `chatters=${adminReport.chatters.length} msgs=${adminReport.team_totals.messages_sent}`,
    });
  } catch (err) {
    rows.push({
      surface: "Admin Chatter Performance",
      notes: `skipped: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const { data: creatorMeta } = await sb
    .from("infloww_creator_daily_stats")
    .select("model_record_id,model_name,creator_infloww_id")
    .not("model_record_id", "is", null);
  const creatorByModel = new Map<
    string,
    { modelName: string; creatorInflowwId: string }
  >();
  for (const r of creatorMeta ?? []) {
    const id = String(r.model_record_id);
    if (!id || creatorByModel.has(id)) continue;
    creatorByModel.set(id, {
      modelName: String(r.model_name ?? id.slice(0, 8)),
      creatorInflowwId: String(r.creator_infloww_id),
    });
  }
  for (const c of [...creatorByModel.entries()].slice(0, 4)) {
    const [modelRecordId, meta] = c;
    const prev = previousPeriodRange(range.startYmd, range.endYmd);
    const [daily, txs, refunds, prevTxs] = await Promise.all([
      listCreatorDailyStats({
        modelRecordId,
        startYmd: range.startYmd,
        endYmd: range.endYmd,
      }),
      listCreatorTransactions({
        modelRecordId,
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        limit: 5000,
      }),
      listCreatorRefunds({
        modelRecordId,
        startYmd: range.startYmd,
        endYmd: range.endYmd,
        limit: 5000,
      }),
      listCreatorTransactions({
        modelRecordId,
        startYmd: prev.startYmd,
        endYmd: prev.endYmd,
        limit: 5000,
      }),
    ]);
    const prevGross = prevTxs.reduce((s, t) => s + (t.amount ?? 0), 0);
    const analytics = deriveModelCreatorAnalytics({
      creatorInflowwId: meta.creatorInflowwId,
      modelRecordId,
      modelName: meta.modelName,
      daily,
      transactions: txs,
      refunds,
      previousGross: prevGross,
    });
    const cross = await getCrossPlatformAnalytics({
      modelRecordId,
      modelName: meta.modelName,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    });
    const crossRev = (cross.series ?? []).reduce((s, d) => s + d.of_revenue, 0);
    const gross = analytics.profit.gross;
    const revOk = near(crossRev, gross, Math.max(1, gross * 0.02));
    if (!revOk && cross.of_days > 0 && gross > 0) {
      mismatches.push(
        `${meta.modelName} OF revenue: earnings=${fmt(gross)} cross=${fmt(crossRev)}`
      );
    }
    rows.push({
      surface: "Creator Earnings",
      model: meta.modelName,
      sales: analytics.profit.gross,
      notes: `refund=${fmt(analytics.refund_rate.rate != null ? analytics.refund_rate.rate * 100 : null)}% churn=${analytics.churn.label}`,
      ok: revOk || cross.of_days === 0,
    });
    rows.push({
      surface: "Cross-Platform OF revenue",
      model: meta.modelName,
      sales: crossRev,
      ok: revOk || cross.of_days === 0,
    });
  }

  const tables = [
    "clariosuite_daily_insights",
    "clariosuite_top_posts",
    "infloww_daily_stats",
    "infloww_creator_daily_stats",
    "infloww_creator_transactions",
  ] as const;
  console.log(`\n=== Accuracy Sweep (${range.startYmd} → ${range.endYmd}) ===\n`);
  console.log("DB row counts:");
  for (const t of tables) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    const { data: span } = await sb.from(t).select("date").order("date", { ascending: true }).limit(1);
    const { data: spanEnd } = await sb.from(t).select("date").order("date", { ascending: false }).limit(1);
    const dateField = t.includes("transaction") ? null : "date";
    let spanStr = "";
    if (dateField && span?.[0] && spanEnd?.[0]) {
      spanStr = ` (${String(span[0].date).slice(0, 10)} → ${String(spanEnd[0].date).slice(0, 10)})`;
    }
    console.log(`  ${t}: ${count ?? "?"}${spanStr}`);
  }

  console.log("\nSurface values:");
  console.table(
    rows.map((r) => ({
      surface: r.surface,
      model: r.model ?? "",
      reach: r.reach ?? "",
      views: r.views ?? "",
      er: r.er != null ? fmt(r.er) : "",
      sales: r.sales != null ? fmt(r.sales, 0) : "",
      ok: r.ok == null ? "" : r.ok ? "✓" : "✗",
      notes: r.notes ?? "",
    }))
  );

  if (mismatches.length) {
    console.log("\n⚠ MISMATCHES:");
    for (const m of mismatches) console.log(`  - ${m}`);
    process.exitCode = 1;
  } else {
    console.log("\n✓ All cross-surface metrics consistent within tolerance.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
