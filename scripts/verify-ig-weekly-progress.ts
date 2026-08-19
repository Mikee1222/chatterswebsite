/**
 * Verify Instagram Weekly Progress report with real Supabase data.
 * Usage: npx tsx scripts/verify-ig-weekly-progress.ts [YYYY-MM]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import "./_polyfill-websocket";
import { getInstagramWeeklyProgressReport } from "@/services/instagram-weekly-progress";

async function main() {
  const arg = process.argv[2];
  const now = new Date();
  const monthKey =
    arg && /^\d{4}-\d{2}$/.test(arg)
      ? arg
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearS, monthS] = monthKey.split("-");
  const year = Number(yearS);
  const month = Number(monthS);

  const report = await getInstagramWeeklyProgressReport(year, month);

  console.log(`\n=== IG Weekly Progress ${monthKey} ===`);
  console.log(`Models: ${report.models.length} · as of ${report.asOfYmd}`);
  console.log(
    `Team month: ${report.team_month_totals.reach.toLocaleString()} reach · ${report.team_month_totals.posts_in_week} posts`
  );

  const targets = ["lydia", "lina"];
  for (const needle of targets) {
    const model = report.models.find((m) => m.modelName.toLowerCase().includes(needle));
    if (!model) {
      console.log(`\n--- ${needle.toUpperCase()}: not found ---`);
      continue;
    }

    console.log(`\n=== ${model.modelName} (${monthKey}) ===`);
    for (const w of model.weeks) {
      if (w.status === "not_started") continue;
      console.log(`\nWeek ${w.week} (${w.displayLabel}):`);
      console.log({
        reach: w.totals.reach,
        views: w.totals.views,
        engagement: w.totals.avg_engagement_rate,
        follower_delta: w.totals.follower_delta,
        follower_growth_pct: w.totals.follower_growth_pct,
        posts: w.totals.posts_in_week,
        wow_reach_pct: w.wow.reach.pct_change,
        wow_reach_note: w.wow.reach.display_note,
        wow_reach_capped: w.wow.reach.pct_capped,
        wow_engagement_pct: w.wow.engagement_rate.pct_change,
        wow_engagement_note: w.wow.engagement_rate.display_note,
        wow_engagement_capped: w.wow.engagement_rate.pct_capped,
        tags: w.insights.map((t) => t.label),
        vs_historical: w.comparisons.vs_historical_reach_pct,
        vs_historical_note: w.comparisons.vs_historical_reach_note,
        vs_historical_capped: w.comparisons.vs_historical_reach_capped,
        vs_team: w.comparisons.vs_team_reach_pct,
        top_post: w.top_post
          ? `${w.top_post.content_label} · ${w.top_post.reach} reach`
          : null,
        cross_platform: w.cross_platform?.text ?? null,
      });
      console.log(`Talking Points: ${w.talking_points}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
