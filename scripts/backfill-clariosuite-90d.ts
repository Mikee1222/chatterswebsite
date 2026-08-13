#!/usr/bin/env tsx
/**
 * ClarioSuite full available-range backfill (90-day max per API request).
 * Syncs all linked models + every multi-account IG id.
 *
 * Usage:
 *   vercel env pull .env.production.local --environment production --yes
 *   npx tsx scripts/backfill-clariosuite-90d.ts
 *
 * Optional:
 *   RANGE_DAYS=90 npx tsx scripts/backfill-clariosuite-90d.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";

loadEnv({ path: ".env.production.local", override: true });
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const rangeDays = Math.max(
    7,
    Math.min(90, Number.parseInt(process.env.RANGE_DAYS ?? "90", 10) || 90)
  );

  const { CLARIOSUITE_MAX_INSIGHTS_RANGE } = await import("../lib/clariosuite-api");
  const {
    syncClarioSuiteInsights,
    listLinkedClarioSuiteModels,
    queryClarioSuiteDailyInsights,
  } = await import("../services/clariosuite-sync");
  const { getTodayYmdAthens, addDaysAthensYmd } = await import("../lib/airtable-datetime");

  const effectiveRange = Math.min(rangeDays, CLARIOSUITE_MAX_INSIGHTS_RANGE);
  const today = getTodayYmdAthens();
  const startYmd = addDaysAthensYmd(today, -(effectiveRange - 1));

  const linked = await listLinkedClarioSuiteModels();
  const accountCount = linked.reduce((s, m) => s + m.accounts.length, 0);
  console.log("=== ClarioSuite 90-day backfill ===");
  console.log(`range: ${effectiveRange} trailing days (${startYmd} → ${today})`);
  console.log(`linked models: ${linked.length}, IG accounts: ${accountCount}`);
  for (const m of linked) {
    console.log(
      `  - ${m.modelName}: ${m.accounts.map((a) => a.label || a.igUserId.slice(0, 8)).join(", ")}`
    );
  }

  const before = await queryClarioSuiteDailyInsights({ startYmd, endYmd: today });
  console.log(`daily rows before (in range): ${before.length}`);

  const result = await syncClarioSuiteInsights({ rangeDays: effectiveRange });
  console.log("sync result:", {
    skipped: result.skipped,
    skipReason: result.skipReason,
    modelsTargeted: result.modelsTargeted,
    dailyRowsUpserted: result.dailyRowsUpserted,
    audienceUpserted: result.audienceUpserted,
    topPostsUpserted: result.topPostsUpserted,
    errorCount: result.errors.length,
  });
  if (result.errors.length) {
    console.error("errors:", result.errors.slice(0, 10));
  }

  const after = await queryClarioSuiteDailyInsights({ startYmd, endYmd: today });
  console.log(`daily rows after (in range): ${after.length}`);

  const byIg = new Map<string, { model: string; days: Set<string> }>();
  for (const r of after) {
    const cur = byIg.get(r.ig_user_id) ?? {
      model: r.model_name ?? r.ig_user_id.slice(0, 8),
      days: new Set<string>(),
    };
    cur.days.add(r.date);
    byIg.set(r.ig_user_id, cur);
  }
  console.log("per IG account:");
  for (const [igId, v] of byIg) {
    const days = [...v.days].sort();
    console.log(
      `  ${v.model} (${igId.slice(0, 10)}…): ${v.days.size} days` +
        (days.length ? ` (${days[0]} → ${days[days.length - 1]})` : "")
    );
  }

  const rateLimitHits = result.errors.filter(
    (e) => /rate.?limit|429/i.test(e.message) || e.code === "rate_limit_exceeded"
  );
  if (rateLimitHits.length) {
    console.error(`⚠ ${rateLimitHits.length} rate-limit errors`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
