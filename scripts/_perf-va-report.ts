/**
 * Local timing for VA Statistics report (DATA_BACKEND=supabase).
 * Run: npx tsx scripts/_perf-va-report.ts
 */
import { config } from "dotenv";
import "./_polyfill-websocket";
config({ path: ".env.local" });
process.env.DATA_BACKEND = "supabase";

async function main() {
  const { computeVaStatisticsReport, resolveVaStatisticsRange } = await import("../services/va-statistics");
  for (const preset of ["this_week", "this_month"] as const) {
    const range = resolveVaStatisticsRange(preset);
    const t0 = performance.now();
    const report = await computeVaStatisticsReport(range);
    const ms = Math.round(performance.now() - t0);
    console.log(
      `computeVaStatisticsReport ${preset} (${range.startYmd}..${range.endYmd}): ${ms}ms; vas=${report.by_va.length}; tasks=${report.team.tasks.assigned}; shifts=${report.team.shifts.shifts}`
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
