#!/usr/bin/env tsx
/**
 * One-time ~90-day Infloww historical backfill into `infloww_daily_stats`.
 *
 * Usage (Production credentials):
 *   vercel env pull .env.production.local --environment production --yes
 *   npx tsx scripts/backfill-infloww-90d.ts
 *
 * Optional:
 *   LOOKBACK_DAYS=90 npx tsx scripts/backfill-infloww-90d.ts
 */

import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";

loadEnv({ path: ".env.production.local", override: true });
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const lookback = Math.max(
    1,
    Math.min(366, Number.parseInt(process.env.LOOKBACK_DAYS ?? "90", 10) || 90)
  );

  const { getTodayYmdAthens, addDaysAthensYmd } = await import("../lib/airtable-datetime");
  const {
    listUsersWithInflowwEmployeeId,
    queryInflowwDailyStats,
    syncInflowwDailyStats,
  } = await import("../services/infloww-daily-stats");
  const { EMPLOYEE_REPORT_MAX_DAYS, inflowwReportTodayYmd } = await import("../lib/infloww-api");

  const today = inflowwReportTodayYmd();
  const startYmd = addDaysAthensYmd(today, -(lookback - 1));

  const users = await listUsersWithInflowwEmployeeId();
  console.log("=== Infloww 90-day backfill ===");
  console.log(`range: ${startYmd} → ${today} (${lookback} days, capped to Infloww-safe today; Athens=${getTodayYmdAthens()})`);
  console.log(`linked chatters: ${users.length}`);
  for (const u of users) {
    console.log(`  - ${u.full_name || u.publicId} (emp ${u.infloww_employee_id})`);
  }

  // Expected API volume with 31-day chunking (sales + chat per chunk per employee).
  const chunks = Math.ceil(lookback / EMPLOYEE_REPORT_MAX_DAYS);
  const expectedReqs = users.length * chunks * 2;
  console.log(
    `expected API requests (chunked): ~${expectedReqs} ` +
      `(${users.length} employees × ${chunks} chunks × 2 endpoints); ` +
      `min interval ${process.env.INFLOWW_MIN_REQUEST_INTERVAL_MS ?? "200"}ms`
  );

  const before = await queryInflowwDailyStats({ startYmd, endYmd: today });
  console.log(`rows before: ${before.length}`);

  const result = await syncInflowwDailyStats({ startYmd, endYmd: today });
  console.log("sync result:", {
    startYmd: result.startYmd,
    endYmd: result.endYmd,
    usersTargeted: result.usersTargeted,
    rowsUpserted: result.rowsUpserted,
    errorCount: result.errors.length,
  });
  if (result.errors.length) {
    console.error(
      "errors:",
      result.errors.slice(0, 10).map((e) => `#${e.employeeId} ${e.message}`)
    );
  }

  const after = await queryInflowwDailyStats({ startYmd, endYmd: today });
  const byUser = new Map<string, { name: string; rows: number; days: Set<string> }>();
  const nameByUuid = new Map(users.map((u) => [u.uuid, u.full_name || u.publicId]));
  for (const r of after) {
    const cur = byUser.get(r.user_id) ?? {
      name: nameByUuid.get(r.user_id) ?? r.user_id.slice(0, 8),
      rows: 0,
      days: new Set<string>(),
    };
    cur.rows += 1;
    cur.days.add(r.date);
    byUser.set(r.user_id, cur);
  }

  console.log(`rows after: ${after.length}`);
  const unlockSum = after.reduce((s, r) => s + r.ppvs_unlocked, 0);
  const withRate = after.filter((r) => r.unlock_rate != null).length;
  const withGr = after.filter((r) => r.golden_ratio != null).length;
  const msgs = after.reduce((s, r) => s + r.messages_sent, 0);
  const ppvs = after.reduce((s, r) => s + r.ppvs_sent, 0);
  const computedGr = msgs > 0 ? ppvs / msgs : null;
  console.log(
    `unlock metrics: sum(ppvs_unlocked)=${unlockSum}, rows with unlock_rate=${withRate}/${after.length}`
  );
  console.log(
    `golden ratio: rows with golden_ratio=${withGr}/${after.length}` +
      (computedGr != null ? `, recomputed=${(computedGr * 100).toFixed(2)}%` : "")
  );
  console.log("per chatter:");
  for (const [, v] of byUser) {
    const days = [...v.days].sort();
    console.log(
      `  ${v.name}: ${v.rows} rows across ${v.days.size} days` +
        (days.length ? ` (${days[0]} → ${days[days.length - 1]})` : "")
    );
  }
  console.log(
    `span check: min=${after.reduce((m, r) => (!m || r.date < m ? r.date : m), "")} ` +
      `max=${after.reduce((m, r) => (!m || r.date > m ? r.date : m), "")}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
