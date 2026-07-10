#!/usr/bin/env npx tsx
/**
 * Audit recurring va_tasks: real row counts per Athens date, dupes, premature future rows.
 * Run: npx tsx scripts/audit-recurring-over-spawn.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { ymdInAthens } from "@/lib/airtable-datetime";
import { getVaTasksViewTodayYmd } from "@/lib/va-task-date-filter";
import { shouldSpawnRecurring, vaTaskSeriesKey } from "@/lib/recurrence";
import { getAllVaTasks } from "@/services/va-tasks";
import type { VaTaskRecord } from "@/types";

const today = getVaTasksViewTodayYmd();

function isRealRecurring(t: VaTaskRecord): boolean {
  return t.is_recurring && !t.is_virtual_occurrence;
}

async function main() {
  console.log(`=== Recurring over-spawn audit ===`);
  console.log(`Athens today: ${today}\n`);

  const all = await getAllVaTasks();
  const realRecurring = all.filter(isRealRecurring);

  console.log(`Total va_tasks: ${all.length}`);
  console.log(`Real recurring rows: ${realRecurring.length}\n`);

  // Group by series key + assignee
  type SeriesBucket = {
    seriesKey: string;
    title: string;
    assignees: string[];
    rows: VaTaskRecord[];
  };
  const seriesMap = new Map<string, SeriesBucket>();

  for (const t of realRecurring) {
    const key = vaTaskSeriesKey(t);
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        seriesKey: key,
        title: t.title,
        assignees: [...t.assigned_to_ids],
        rows: [],
      });
    }
    seriesMap.get(key)!.rows.push(t);
  }

  console.log(`Active recurring series (real rows): ${seriesMap.size}\n`);

  // Per-series date breakdown
  type DateCounts = { past: number; today: number; future: number; byYmd: Map<string, VaTaskRecord[]> };

  const table: Array<{
    title: string;
    assignees: string;
    past: number;
    today: number;
    future: number;
    dupesToday: number;
    futureDates: string[];
    dupeGroups: Array<{ ymd: string; count: number; ids: string[] }>;
  }> = [];

  let totalFuturePremature = 0;
  let totalDupes = 0;

  for (const [, bucket] of seriesMap) {
    if (!bucket.rows.some((r) => shouldSpawnRecurring(r))) continue;

    const byYmd = new Map<string, VaTaskRecord[]>();
    for (const r of bucket.rows) {
      const ymd = r.due_date ? ymdInAthens(r.due_date) : "unknown";
      if (!byYmd.has(ymd)) byYmd.set(ymd, []);
      byYmd.get(ymd)!.push(r);
    }

    let past = 0;
    let todayCount = 0;
    let future = 0;
    const futureDates: string[] = [];
    const dupeGroups: Array<{ ymd: string; count: number; ids: string[] }> = [];

    for (const [ymd, rows] of byYmd) {
      if (ymd === "unknown") continue;
      if (ymd < today) past += rows.length;
      else if (ymd === today) todayCount += rows.length;
      else {
        future += rows.length;
        futureDates.push(ymd);
        totalFuturePremature += rows.length;
      }
      if (rows.length > 1) {
        dupeGroups.push({ ymd, count: rows.length, ids: rows.map((r) => r.id) });
        totalDupes += rows.length - 1;
      }
    }

    const dupesToday = dupeGroups.filter((g) => g.ymd === today).reduce((n, g) => n + g.count - 1, 0);

    table.push({
      title: bucket.title,
      assignees: bucket.assignees.join(",") || "(unassigned)",
      past,
      today: todayCount,
      future,
      dupesToday,
      futureDates: futureDates.sort(),
      dupeGroups: dupeGroups.sort((a, b) => a.ymd.localeCompare(b.ymd)),
    });
  }

  table.sort((a, b) => {
    if (b.future !== a.future) return b.future - a.future;
    if (b.dupesToday !== a.dupesToday) return b.dupesToday - a.dupesToday;
    return a.title.localeCompare(b.title);
  });

  console.log("=== Series summary (sorted by future rows) ===");
  console.log(
    "Title".padEnd(40),
    "Past".padStart(5),
    "Today".padStart(5),
    "Fut".padStart(5),
    "DupT".padStart(5),
    "Future dates",
  );
  console.log("-".repeat(100));

  for (const row of table) {
    console.log(
      row.title.slice(0, 40).padEnd(40),
      String(row.past).padStart(5),
      String(row.today).padStart(5),
      String(row.future).padStart(5),
      String(row.dupesToday).padStart(5),
      row.futureDates.join(", ") || "-",
    );
  }

  console.log(`\n=== Totals ===`);
  console.log(`Series with premature future real rows: ${table.filter((r) => r.future > 0).length}`);
  console.log(`Total premature future real rows: ${totalFuturePremature}`);
  console.log(`Total duplicate rows (same series+day): ${totalDupes}`);

  console.log(`\n=== Duplicate detail ===`);
  for (const row of table.filter((r) => r.dupeGroups.length > 0)) {
    console.log(`\n"${row.title}" (${row.assignees}):`);
    for (const g of row.dupeGroups) {
      const rows = g.ids.map((id) => {
        const t = realRecurring.find((r) => r.id === id)!;
        return `${id} due=${t.due_date} status=${t.status} created=${t.created_at ?? "?"}`;
      });
      console.log(`  ${g.ymd}: ${g.count} rows`);
      for (const line of rows) console.log(`    ${line}`);
    }
  }

  console.log(`\n=== Premature future rows (should be virtual) ===`);
  for (const row of table.filter((r) => r.future > 0)) {
    console.log(`\n"${row.title}":`);
    for (const ymd of row.futureDates) {
      const ids = realRecurring
        .filter((t) => vaTaskSeriesKey(t) === `${row.title}\0${row.assignees.split(",").sort().join(",")}` || vaTaskSeriesKey(t).startsWith(row.title))
        .filter((t) => ymdInAthens(t.due_date) === ymd);
      // simpler: from dupeGroups area
    }
  }

  // List all future row IDs
  const futureRows = realRecurring.filter((t) => {
    const ymd = t.due_date ? ymdInAthens(t.due_date) : null;
    return ymd && ymd > today && shouldSpawnRecurring(t);
  });

  console.log(`\n=== All premature future real row IDs (${futureRows.length}) ===`);
  for (const t of futureRows.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))) {
    console.log(
      `${t.id} | ${t.title.slice(0, 35)} | due=${t.due_date} (${ymdInAthens(t.due_date)}) | status=${t.status} | created=${t.created_at ?? "?"}`,
    );
  }

  // Daily Marketing Routine focus
  const dmr = table.filter((r) => r.title.toLowerCase().includes("daily marketing"));
  if (dmr.length) {
    console.log(`\n=== Daily Marketing Routine ===`);
    console.log(JSON.stringify(dmr, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
