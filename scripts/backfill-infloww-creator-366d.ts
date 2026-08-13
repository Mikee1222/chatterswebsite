#!/usr/bin/env tsx
/**
 * Full Infloww creator-level historical backfill (≤366 days).
 *
 * Usage:
 *   vercel env pull .env.production.local --environment production --yes
 *   npx tsx scripts/backfill-infloww-creator-366d.ts
 *
 * Optional:
 *   LOOKBACK_DAYS=366 npx tsx scripts/backfill-infloww-creator-366d.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";

loadEnv({ path: ".env.production.local", override: true });
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const lookback = Math.max(
    1,
    Math.min(366, Number.parseInt(process.env.LOOKBACK_DAYS ?? "366", 10) || 366)
  );

  const { addDaysAthensYmd } = await import("../lib/airtable-datetime");
  const { inflowwReportTodayYmd } = await import("../lib/infloww-api");
  const {
    syncInflowwCreatorEarnings,
    listLinkedCreatorModels,
    listCreatorDailyStats,
    listCreatorTransactions,
  } = await import("../services/infloww-creator-earnings");

  const today = inflowwReportTodayYmd();
  const startYmd = addDaysAthensYmd(today, -(lookback - 1));

  const { linked, unmatchedCount } = await listLinkedCreatorModels();
  console.log("=== Infloww creator 366-day backfill ===");
  console.log(`range: ${startYmd} → ${today} (${lookback} days)`);
  console.log(`linked creators: ${linked.length} (unmatched models: ${unmatchedCount})`);
  for (const c of linked) {
    console.log(`  - ${c.modelName} (creator ${c.creatorInflowwId})`);
  }

  const beforeDaily = await listCreatorDailyStats({ startYmd, endYmd: today });
  const beforeTx = await listCreatorTransactions({ startYmd, endYmd: today, limit: 50000 });
  console.log(`rows before: daily=${beforeDaily.length} txs=${beforeTx.length}`);

  const result = await syncInflowwCreatorEarnings({ startYmd, endYmd: today });
  console.log("sync result:", {
    startYmd: result.startYmd,
    endYmd: result.endYmd,
    creatorsTargeted: result.creatorsTargeted,
    dailyStats: result.dailyStats.upserted,
    transactions: result.transactions.upserted,
    marketingLinks: result.marketingLinks.upserted,
    linkFans: result.linkFans.upserted,
    refunds: result.refunds.upserted,
    priorityMassMessages: result.priorityMassMessages.upserted,
    errors:
      result.dailyStats.errors.length +
      result.transactions.errors.length +
      result.refunds.errors.length,
  });

  const allErrors = [
    ...result.dailyStats.errors,
    ...result.transactions.errors,
    ...result.refunds.errors,
    ...result.marketingLinks.errors,
    ...result.priorityMassMessages.errors,
  ];
  if (allErrors.length) {
    console.error("errors (first 10):", allErrors.slice(0, 10));
  }

  const afterDaily = await listCreatorDailyStats({ startYmd, endYmd: today });
  const afterTx = await listCreatorTransactions({ startYmd, endYmd: today, limit: 50000 });
  console.log(`rows after: daily=${afterDaily.length} txs=${afterTx.length}`);

  const byModel = new Map<string, { name: string; days: Set<string>; txs: number }>();
  for (const r of afterDaily) {
    const id = r.model_record_id;
    if (!id) continue;
    const cur = byModel.get(id) ?? {
      name: r.model_name ?? id.slice(0, 8),
      days: new Set<string>(),
      txs: 0,
    };
    cur.days.add(r.date);
    byModel.set(id, cur);
  }
  for (const t of afterTx) {
    const id = t.model_record_id;
    if (!id) continue;
    const cur = byModel.get(id) ?? {
      name: t.model_name ?? id.slice(0, 8),
      days: new Set<string>(),
      txs: 0,
    };
    cur.txs += 1;
    byModel.set(id, cur);
  }
  console.log("per creator:");
  for (const [, v] of byModel) {
    const days = [...v.days].sort();
    console.log(
      `  ${v.name}: ${v.days.size} daily rows, ${v.txs} txs` +
        (days.length ? ` (${days[0]} → ${days[days.length - 1]})` : "")
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
