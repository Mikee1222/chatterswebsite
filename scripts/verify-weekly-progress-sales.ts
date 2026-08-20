/**
 * Verify Chatter Performance Weekly Progress sales vs raw infloww_daily_stats.
 * Usage: npx tsx scripts/verify-weekly-progress-sales.ts [YYYY] [MM]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import "./_polyfill-websocket";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { customWeekIndexForYmd, getCustomWeekBoundaries } from "@/lib/infloww-custom-weeks";
import { getAdminWeeklyProgressReport } from "@/services/infloww-performance";

async function main() {
  const year = Number(process.argv[2] ?? 2026);
  const month = Number(process.argv[3] ?? 7);
  const boundaries = getCustomWeekBoundaries(year, month);
  const monthStart = boundaries[0]!.startYmd;
  const monthEnd = boundaries[boundaries.length - 1]!.endYmd;

  const report = await getAdminWeeklyProgressReport(year, month);
  const sb = getSupabaseServiceClient();

  const { data: users } = await sb
    .from("users")
    .select("id, full_name, infloww_employee_id")
    .not("infloww_employee_id", "is", null);

  const pick = (users ?? [])
    .filter((u) => ["Anastasis Haroupas", "Edgar", "George Akasmas"].includes(String(u.full_name)))
    .slice(0, 3);

  console.log(`\n=== Weekly Progress vs raw DB — ${year}-${String(month).padStart(2, "0")} ===\n`);

  for (const u of pick) {
    const { data: rows } = await sb
      .from("infloww_daily_stats")
      .select("date, sales, ppv_sales, tips")
      .eq("user_id", u.id)
      .gte("date", monthStart)
      .lte("date", monthEnd);

    const rawByWeek = new Map<number, { sales: number; ppv: number; tips: number }>();
    for (const r of rows ?? []) {
      const wi = customWeekIndexForYmd(String(r.date));
      if (wi == null) continue;
      const prev = rawByWeek.get(wi) ?? { sales: 0, ppv: 0, tips: 0 };
      prev.sales += Number(r.sales) || 0;
      prev.ppv += Number(r.ppv_sales) || 0;
      prev.tips += Number(r.tips) || 0;
      rawByWeek.set(wi, prev);
    }

    const chatter = report.chatters.find((c) => c.user_uuid === u.id);
    console.log(`--- ${u.full_name} (emp ${u.infloww_employee_id}) ---`);
    console.log(
      `Month  UI: ${chatter?.month_totals.sales.toFixed(2) ?? "—"} | Raw: ${[...rawByWeek.values()].reduce((a, w) => a + w.sales, 0).toFixed(2)}`
    );

    for (const b of boundaries) {
      const raw = rawByWeek.get(b.week) ?? { sales: 0, ppv: 0, tips: 0 };
      const ui = chatter?.weeks.find((w) => w.week === b.week);
      const uiSales = ui?.totals.sales ?? 0;
      const delta = Math.abs(uiSales - raw.sales);
      const ok = delta < 0.01 ? "OK" : "MISMATCH";
      console.log(
        `  W${b.week} ${b.startYmd}–${b.endYmd}: UI $${uiSales.toFixed(2)} | Raw $${raw.sales.toFixed(2)} (ppv ${raw.ppv.toFixed(2)}, tips ${raw.tips.toFixed(2)}) ${ok}`
      );
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
