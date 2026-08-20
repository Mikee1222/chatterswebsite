/**
 * Benchmark Instagram Weekly Progress report load time.
 * Usage: npx tsx scripts/bench-ig-weekly-progress.ts [YYYY-MM] [--detail]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
process.env.DATA_BACKEND = process.env.DATA_BACKEND || "supabase";

import "./_polyfill-websocket";
import { getCustomWeekBoundaries } from "../lib/infloww-custom-weeks";
import {
  listLinkedClarioSuiteModels,
  queryClarioSuiteDailyInsights,
  queryClarioSuiteTopPostsForModels,
} from "../services/clariosuite-sync";
import {
  listCreatorDailyStats,
  listCreatorRevenueByAthensDay,
} from "../services/infloww-creator-earnings";
import { getInstagramWeeklyProgressReport } from "../services/instagram-weekly-progress";

async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

async function main() {
  const args = process.argv.slice(2);
  const detail = args.includes("--detail");
  const monthArg = args.find((a) => /^\d{4}-\d{2}$/.test(a));
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthKey = monthArg ?? defaultMonth;
  const [yearS, monthS] = monthKey.split("-");
  const year = Number(yearS);
  const month = Number(monthS);

  if (detail) {
    const boundaries = getCustomWeekBoundaries(year, month);
    const monthStart = boundaries[0]?.startYmd ?? `${monthKey}-01`;
    const monthEnd = boundaries[boundaries.length - 1]?.endYmd ?? monthStart;
    const { addDaysAthensYmd } = await import("../lib/airtable-datetime");
    const histStart = shiftMonth(year, month, -3);
    const histBoundaries = getCustomWeekBoundaries(histStart.year, histStart.month);
    const historicalStartYmd = histBoundaries[0]?.startYmd ?? monthStart;
    const ofLookbackStartYmd = addDaysAthensYmd(monthStart, -14);

    const linkedRes = await timed("listLinkedClarioSuiteModels", () => listLinkedClarioSuiteModels());
    const linked = linkedRes.value;
    const parallel = await Promise.all([
      timed("queryClarioSuiteDailyInsights", () =>
        queryClarioSuiteDailyInsights({
          startYmd: historicalStartYmd,
          endYmd: monthEnd,
        })
      ),
      timed("queryClarioSuiteTopPostsForModels", () =>
        queryClarioSuiteTopPostsForModels({
          modelRecordIds: linked.map((m) => m.modelRecordId),
          limitPerModel: 50,
        })
      ),
      timed("listCreatorDailyStats", () =>
        listCreatorDailyStats({ startYmd: ofLookbackStartYmd, endYmd: monthEnd })
      ),
      timed("listCreatorRevenueByAthensDay", () =>
        listCreatorRevenueByAthensDay({
          startYmd: ofLookbackStartYmd,
          endYmd: monthEnd,
        })
      ),
    ]);

    console.log(
      JSON.stringify(
        {
          monthKey,
          range: { historicalStartYmd, ofLookbackStartYmd, monthEnd },
          linkedModels: linked.length,
          steps: {
            listLinkedClarioSuiteModels: linkedRes.ms,
            queryClarioSuiteDailyInsights: {
              ms: parallel[0].ms,
              rows: parallel[0].value.length,
            },
            queryClarioSuiteTopPostsForModels: {
              ms: parallel[1].ms,
              models: parallel[1].value.size,
            },
            listCreatorDailyStats: {
              ms: parallel[2].ms,
              rows: parallel[2].value.length,
            },
            listCreatorRevenueByAthensDay: {
              ms: parallel[3].ms,
              rows: parallel[3].value.length,
            },
          },
        },
        null,
        2
      )
    );
  }

  const start = performance.now();
  const report = await getInstagramWeeklyProgressReport(year, month);
  const ms = Math.round(performance.now() - start);
  const payloadBytes = Buffer.byteLength(JSON.stringify(report), "utf8");

  console.log(
    JSON.stringify(
      {
        monthKey,
        elapsedMs: ms,
        modelCount: report.models.length,
        weekCount: report.weeks.length,
        crossPlatformSections: report.models.reduce(
          (s, m) => s + m.weeks.filter((w) => w.cross_platform_section).length,
          0
        ),
        payloadKb: Math.round(payloadBytes / 1024),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
