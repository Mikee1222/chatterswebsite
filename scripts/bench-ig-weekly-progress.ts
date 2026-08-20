/**
 * Benchmark Instagram Weekly Progress report load time.
 * Usage: npx tsx scripts/bench-ig-weekly-progress.ts [YYYY-MM]
 */
import { getInstagramWeeklyProgressReport } from "../services/instagram-weekly-progress";

async function main() {
  const monthArg = process.argv[2]?.trim();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthKey = monthArg && /^\d{4}-\d{2}$/.test(monthArg) ? monthArg : defaultMonth;
  const [yearS, monthS] = monthKey.split("-");
  const year = Number(yearS);
  const month = Number(monthS);

  const start = performance.now();
  const report = await getInstagramWeeklyProgressReport(year, month);
  const ms = Math.round(performance.now() - start);

  console.log(
    JSON.stringify(
      {
        monthKey,
        elapsedMs: ms,
        modelCount: report.models.length,
        weekCount: report.weeks.length,
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
