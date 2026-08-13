/**
 * Verify Instagram Weekly Progress report with real Supabase data.
 * Usage: npx tsx scripts/verify-ig-weekly-progress.ts [YYYY-MM]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import {
  aggregateIgDailyByDate,
  computeModelEngagementTotals,
  postingFrequency,
  toFiniteRate,
} from "@/lib/instagram-insights-stats";
import { generateIgWeeklyInsights } from "@/lib/instagram-weekly-insights";
import {
  classifyCustomWeekProgress,
  formatCustomWeekDisplayLabel,
  getCustomWeekBoundaries,
} from "@/lib/infloww-custom-weeks";
import { computePctChange } from "@/services/infloww-analytics";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const arg = process.argv[2];
  const now = new Date();
  const monthKey =
    arg && /^\d{4}-\d{2}$/.test(arg)
      ? arg
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearS, monthS] = monthKey.split("-");
  const year = Number(yearS);
  const month = Number(monthS);
  const boundaries = getCustomWeekBoundaries(year, month);
  const monthStart = boundaries[0]!.startYmd;
  const monthEnd = boundaries[boundaries.length - 1]!.endYmd;
  const asOfYmd = "2026-08-13";

  const sb = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: fetch.bind(globalThis) },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const [{ data: daily }, { data: posts }, { data: accounts }] = await Promise.all([
    sb
      .from("clariosuite_daily_insights")
      .select("date,reach,views,total_interactions,follower_count,engagement_rate,model_record_id,model_name,ig_user_id")
      .gte("date", monthStart)
      .lte("date", monthEnd),
    sb.from("clariosuite_top_posts").select("model_record_id,posted_at,engagement_score,media_type,media_product_type,reach"),
    sb.from("clariosuite_model_accounts").select("model_record_id,model_name"),
  ]);

  const modelNames = new Map<string, string>();
  for (const a of accounts ?? []) {
    if (a.model_record_id && a.model_name) {
      modelNames.set(String(a.model_record_id), String(a.model_name));
    }
  }
  for (const d of daily ?? []) {
    if (d.model_record_id && d.model_name) {
      modelNames.set(String(d.model_record_id), String(d.model_name));
    }
  }

  const targets = ["lydia", "lina"];
  for (const needle of targets) {
    const modelId = [...modelNames.entries()].find(([, name]) =>
      name.toLowerCase().includes(needle)
    )?.[0];
    if (!modelId) {
      console.log(`\n--- ${needle.toUpperCase()}: not found ---`);
      continue;
    }
    const modelName = modelNames.get(modelId)!;
    const modelDaily = aggregateIgDailyByDate(
      (daily ?? [])
        .filter((d) => String(d.model_record_id) === modelId)
        .map((d) => ({
          date: String(d.date).slice(0, 10),
          reach: Number(d.reach) || 0,
          views: Number(d.views) || 0,
          total_interactions: Number(d.total_interactions) || 0,
          follower_count: d.follower_count == null ? null : Number(d.follower_count),
          engagement_rate: toFiniteRate(d.engagement_rate),
        }))
    );
    const modelPosts = (posts ?? [])
      .filter((p) => String(p.model_record_id) === modelId)
      .map((p) => ({
        posted_at: p.posted_at != null ? String(p.posted_at) : null,
        engagement_score: p.engagement_score == null ? null : Number(p.engagement_score),
        media_type: p.media_type != null ? String(p.media_type) : null,
        media_product_type: p.media_product_type != null ? String(p.media_product_type) : null,
        reach: Number(p.reach) || 0,
      }));

    console.log(`\n=== ${modelName} (${monthKey}) ===`);
    let prevTotals: ReturnType<typeof computeModelEngagementTotals> | null = null;
    let prevProgress: ReturnType<typeof classifyCustomWeekProgress> | null = null;

    for (const boundary of boundaries) {
      const weekDaily = modelDaily.filter(
        (d) => d.date >= boundary.startYmd && d.date <= boundary.endYmd
      );
      const totals = computeModelEngagementTotals(weekDaily, modelPosts, {
        startYmd: boundary.startYmd,
        endYmd: boundary.endYmd,
      });
      const freq = postingFrequency(modelPosts, boundary.startYmd, boundary.endYmd);
      const activity = totals.reach > 0 || freq.posts_in_range > 0;
      const progress = classifyCustomWeekProgress(boundary, asOfYmd, activity);
      const wowComparable =
        progress.hasStarted && prevProgress != null && prevProgress.hasStarted && prevTotals != null;
      const wowReach =
        wowComparable && prevTotals
          ? computePctChange(
              progress.elapsedDays !== (prevProgress?.elapsedDays ?? 0)
                ? totals.reach / progress.elapsedDays
                : totals.reach,
              prevProgress!.elapsedDays > 0
                ? prevTotals.reach / prevProgress!.elapsedDays
                : prevTotals.reach
            )
          : null;

      const insights =
        progress.hasStarted
          ? generateIgWeeklyInsights({
              reach: totals.reach,
              avg_engagement_rate: toFiniteRate(totals.avg_engagement_rate),
              follower_delta: totals.follower_delta,
              posting_frequency: freq.posts_per_week,
              posts_in_week: freq.posts_in_range,
              reach_wow_pct: wowReach?.pct_change ?? null,
              engagement_wow_pct: null,
              follower_delta_wow_pct: null,
              posting_wow_pct: null,
              prior_follower_delta: prevTotals?.follower_delta ?? null,
              team_week_reach: [],
              team_median_posting: null,
              team_median_engagement: null,
              posting_reach_correlation: null,
            })
          : [];

      if (progress.status !== "not_started") {
        console.log(
          `Week ${boundary.week} (${formatCustomWeekDisplayLabel(boundary, progress)}):`,
          {
            reach: totals.reach,
            views: totals.views,
            engagement: toFiniteRate(totals.avg_engagement_rate),
            follower_delta: totals.follower_delta,
            posts: freq.posts_in_range,
            wow_reach_pct: wowReach?.pct_change,
            tags: insights.map((t) => t.label),
          }
        );
      }

      if (progress.hasStarted) {
        prevTotals = totals;
        prevProgress = progress;
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
