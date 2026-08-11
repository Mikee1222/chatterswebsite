"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { GunzoPartnershipData } from "@/types/client-portal";
import type { ClientPartnershipInflowwStats } from "@/services/client-partnership-infloww";
import { ClientGunzoPartnershipInflowwSection } from "@/components/client-portal/gunzo-partnership-infloww-section";
import { formatDateEuropean } from "@/lib/format";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatMoney = (n: number) => numberFormatter.format(Number(n) || 0);

type Props = {
  data: GunzoPartnershipData;
  inflowwStats: ClientPartnershipInflowwStats;
  selectedMonth: string;
  availableMonths2026: string[];
  clientName?: string;
};

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function ClientGunzoPartnershipView({
  data,
  inflowwStats,
  selectedMonth,
  availableMonths2026,
  clientName,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statsMode = (searchParams.get("view") as "weekly" | "monthly") || "weekly";

  const setView = (view: "weekly" | "monthly") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    if (!params.has("month")) params.set("month", selectedMonth);
    router.push(`?${params.toString()}`);
  };

  const setMonth = (month: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", month);
    if (!params.has("view")) params.set("view", statsMode);
    router.push(`?${params.toString()}`);
  };

  const monthsForDropdown =
    availableMonths2026.length > 0
      ? availableMonths2026
      : ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

  const glassCard = "glass-card rounded-2xl";
  const hasAnyData =
    data.weeks.some((w) => w.turnoverUsd > 0 || w.feeUsd > 0) ||
    data.monthlyTotals.turnoverUsd > 0 ||
    data.monthlyTotals.feeUsd > 0 ||
    data.monthlyTotals.crmUsd > 0;

  return (
    <div className="space-y-10">
      <ClientGunzoPartnershipInflowwSection
        initial={inflowwStats}
        accountLabel={clientName ?? inflowwStats.modelNames[0]}
      />

      <div className="border-t border-white/10 pt-8">
        <p className="text-xs uppercase tracking-[0.3em] text-pink-300/80">Partnership billing</p>
        <p className="mt-1 text-sm text-gray-400">
          Weekly and monthly fee summaries for your Gunzo partnership agreement.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-pink-300/80">Client dashboard</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Performance Overview</h2>
          <p className="mt-1 text-sm text-gray-400">Selected month: {formatMonthLabel(selectedMonth)}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="glass-card rounded-2xl p-2 ring-1 ring-white/5">
            <label className="block px-2 pb-1 text-[10px] uppercase tracking-[0.25em] text-gray-500">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setMonth(e.target.value)}
              className="min-w-[160px] cursor-pointer appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-white outline-none focus:ring-2 focus:ring-pink-400/40 [color-scheme:dark]"
              aria-label="Select month"
            >
              {monthsForDropdown.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 ring-1 ring-white/5">
            <button
              type="button"
              onClick={() => setView("weekly")}
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                statsMode === "weekly" ? "bg-white/15 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white/90"
              )}
            >
              Weekly stats
            </button>
            <button
              type="button"
              onClick={() => setView("monthly")}
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                statsMode === "monthly" ? "bg-white/15 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white/90"
              )}
            >
              Monthly stats
            </button>
          </div>
        </div>
      </div>

      {!hasAnyData ? (
        <div className={cn(glassCard, "p-10 text-center")}>
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
            <BarChart3 className="h-5 w-5" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">No Revenue Data for This Month</h3>
          <p className="text-sm text-gray-400">Select another month or check back when weekly data is available.</p>
        </div>
      ) : statsMode === "weekly" ? (
        <>
          <div className={cn(glassCard, "p-6")}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Weekly Model Tracking</h3>
            <div className="space-y-3">
              {data.weeks.map((w) => (
                <div
                  key={`${w.start}-${w.end}`}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="min-w-[200px] text-sm font-medium text-white">
                    {formatDateEuropean(w.start)} – {formatDateEuropean(w.end)}
                  </div>
                  <div className="text-sm text-white/80">{formatMoney(w.turnoverUsd)} USD turnover</div>
                  <div className="text-sm text-white/80">{formatMoney(w.feeUsd)} USD fee</div>
                  <div className="text-sm text-gray-400">Best model: {w.bestModelName ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={cn(glassCard, "p-6")}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Weekly Per-Model Stats</h3>
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
              <table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 text-right font-medium">Week 1</th>
                    <th className="px-3 py-2 text-right font-medium">Week 2</th>
                    <th className="px-3 py-2 text-right font-medium">Week 3</th>
                    <th className="px-3 py-2 text-right font-medium">Week 4</th>
                    <th className="px-3 py-2 text-right font-medium">Month turnover</th>
                    <th className="px-3 py-2 text-right font-medium">Month fee</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeklyPerModel.map((row) => (
                    <tr key={row.modelId} className="border-b border-white/5 text-gray-200">
                      <td className="px-3 py-2 font-medium text-white">{row.modelName}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.week1TurnoverUsd)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.week2TurnoverUsd)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.week3TurnoverUsd)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.week4TurnoverUsd)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.monthTotalTurnoverUsd)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.monthTotalFeeUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={cn(glassCard, "p-6")}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Monthly Totals</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Turnover total (USD)" value={formatMoney(data.monthlyTotals.turnoverUsd)} />
              <Stat label="Fee total (USD)" value={formatMoney(data.monthlyTotals.feeUsd)} />
              <Stat label="CRM fees total (USD)" value={formatMoney(data.monthlyTotals.crmUsd)} />
              <Stat label="Best model" value={data.bestModelOfMonthName ?? "—"} large />
            </div>
          </div>
          <div className={cn(glassCard, "p-6")}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Per-Model Monthly Stats</h3>
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 text-right font-medium">Turnover</th>
                    <th className="px-3 py-2 text-right font-medium">Fee</th>
                    <th className="px-3 py-2 font-medium">Best week</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyPerModel.map((row) => (
                    <tr key={row.modelId} className="border-b border-white/5 text-gray-200">
                      <td className="px-3 py-2 font-medium text-white">{row.modelName}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.turnoverTotalUsd)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.feeTotalUsd)}</td>
                      <td className="px-3 py-2">
                        {row.bestWeekStart && row.bestWeekEnd
                          ? `${formatDateEuropean(row.bestWeekStart)} – ${formatDateEuropean(row.bestWeekEnd)} (${formatMoney(row.bestWeekTurnoverUsd)})`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cn("mt-1 font-semibold text-white", large ? "text-lg" : "text-xl")}>{value}</p>
    </div>
  );
}
