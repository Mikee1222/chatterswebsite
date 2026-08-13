/**
 * Verify Model Leaderboard rows with real Supabase data.
 * Usage: npx tsx scripts/verify-ig-leaderboard.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import {
  buildModelComparisonRows,
  coalesceIgMetric,
  toFiniteRate,
} from "@/lib/instagram-insights-stats";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";

const TARGETS = ["Lina", "Frika", "Lydia"];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const range = resolveInflowwStatsRange("this_month");
  const sb = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: fetch.bind(globalThis) },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  const [{ data: daily }, { data: posts }, { data: accounts }] = await Promise.all([
    sb
      .from("clariosuite_daily_insights")
      .select(
        "date,reach,views,total_interactions,follower_count,engagement_rate,model_record_id,model_name,ig_user_id"
      )
      .gte("date", range.startYmd)
      .lte("date", range.endYmd),
    sb.from("clariosuite_top_posts").select("*"),
    sb.from("clariosuite_model_accounts").select("model_id,clariosuite_ig_user_id,account_label,is_primary"),
  ]);

  const modelMeta = new Map<
    string,
    { name: string; igIds: Set<string> }
  >();
  for (const d of daily ?? []) {
    const id = String(d.model_record_id ?? "");
    if (!id) continue;
    const hit = modelMeta.get(id) ?? { name: String(d.model_name ?? ""), igIds: new Set() };
    hit.igIds.add(String(d.ig_user_id));
    modelMeta.set(id, hit);
  }

  const linked = [...modelMeta.entries()].map(([modelRecordId, meta]) => {
    const igList = [...meta.igIds];
    const primary =
      accounts?.find((a) => a.model_id === modelRecordId && a.is_primary)?.clariosuite_ig_user_id ??
      igList[0] ??
      "";
    return {
      modelRecordId,
      modelName: meta.name,
      igUserId: String(primary),
      accountCount: igList.length,
      allIgUserIds: igList,
    };
  });

  const postsByModel = new Map<
    string,
    Array<{
      media_type?: string | null;
      media_product_type?: string | null;
      engagement_score: number | null;
      reach?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      saved?: number;
      views?: number;
      posted_at?: string | null;
    }>
  >();
  for (const p of posts ?? []) {
    const id = String(p.model_record_id ?? "");
    if (!id) continue;
    const list = postsByModel.get(id) ?? [];
    list.push({
      media_type: p.media_type,
      media_product_type: p.media_product_type,
      engagement_score: p.engagement_score == null ? null : Number(p.engagement_score),
      reach: coalesceIgMetric(p.reach),
      likes: coalesceIgMetric(p.likes),
      comments: coalesceIgMetric(p.comments),
      shares: coalesceIgMetric(p.shares),
      saved: coalesceIgMetric(p.saved),
      views: coalesceIgMetric(p.views),
      posted_at: p.posted_at != null ? String(p.posted_at) : null,
    });
    postsByModel.set(id, list);
  }

  const allDaily = (daily ?? []).map((d) => ({
    date: String(d.date).slice(0, 10),
    reach: coalesceIgMetric(d.reach),
    views: coalesceIgMetric(d.views),
    total_interactions: coalesceIgMetric(d.total_interactions),
    follower_count: d.follower_count == null ? null : coalesceIgMetric(d.follower_count),
    engagement_rate: toFiniteRate(d.engagement_rate),
    ig_user_id: String(d.ig_user_id),
    model_record_id: d.model_record_id != null ? String(d.model_record_id) : null,
  }));

  const rows = buildModelComparisonRows(
    linked,
    allDaily,
    postsByModel,
    { startYmd: range.startYmd, endYmd: range.endYmd }
  );

  console.log(`Range: ${range.startYmd} → ${range.endYmd}\n`);

  for (const name of TARGETS) {
    const row = rows.find((r) => r.modelName === name);
    if (!row) {
      console.log(`--- ${name}: not found ---\n`);
      continue;
    }
    console.log(`=== ${name} ===`);
    console.log({
      reach: row.reach,
      views: row.views,
      avg_engagement_rate: row.avg_engagement_rate?.toFixed(2) ?? null,
      follower_end: row.follower_end,
      follower_delta: row.follower_delta,
      growth_rate_pct: row.growth_rate_pct?.toFixed(2) ?? null,
      posting_frequency: row.posting_frequency?.toFixed(1) ?? null,
      consistency_score: row.consistency_score?.toFixed(0) ?? null,
      top_post_engagement: row.top_post_engagement?.toFixed(2) ?? null,
      days: row.days,
      accountCount: row.accountCount,
    });
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
