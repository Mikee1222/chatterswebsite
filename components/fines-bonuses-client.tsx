"use client";

import * as React from "react";
import { DollarSign } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { formatDateTimeAthens, formatMonthYyyyMm } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { isSpinWheelFineBonus, type FineBonusRecord, type FineBonusType } from "@/services/fines-bonuses";

type Props = {
  initialEntries: FineBonusRecord[];
};

function monthBonusTotal(rows: FineBonusRecord[]): number {
  return rows.filter((e) => e.type === "bonus").reduce((s, e) => s + (e.amount || 0), 0);
}

function monthFineTotal(rows: FineBonusRecord[]): number {
  return rows.filter((e) => e.type === "fine").reduce((s, e) => s + (e.amount || 0), 0);
}

function currentMonthYyyyMm(): string {
  return getTodayYmdAthens().slice(0, 7);
}

function SpinWheelBadge() {
  return (
    <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
      Spin Wheel
    </span>
  );
}

function ManualBadge() {
  return (
    <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-medium text-white/50">
      Manual
    </span>
  );
}

type MonthGroup = {
  month: string;
  entries: FineBonusRecord[];
};

function groupByMonth(entries: FineBonusRecord[]): MonthGroup[] {
  const map = new Map<string, FineBonusRecord[]>();
  for (const e of entries) {
    const m = e.month || "unknown";
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(e);
  }
  return [...map.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((k) => ({
      month: k,
      entries: (map.get(k) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
}

export function FinesBonusesClient({ initialEntries }: Props) {
  const [entries] = React.useState(initialEntries);
  const [month, setMonth] = React.useState(() => currentMonthYyyyMm());
  const [typeFilter, setTypeFilter] = React.useState<"all" | FineBonusType>("all");

  const filtered = React.useMemo(() => {
    return entries
      .filter((e) => {
        if (e.month !== month) return false;
        if (typeFilter !== "all" && e.type !== typeFilter) return false;
        return true;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [entries, month, typeFilter]);

  const {
    page,
    setPage,
    totalPages,
    paginated: paginatedEntries,
    reset,
  } = usePagination(filtered, 20);

  React.useEffect(() => {
    reset();
  }, [month, typeFilter, reset]);

  const groupedPage = React.useMemo(() => groupByMonth(paginatedEntries), [paginatedEntries]);

  const summary = React.useMemo(() => {
    const bonuses = filtered.filter((e) => e.type === "bonus").reduce((s, e) => s + e.amount, 0);
    const fines = filtered.filter((e) => e.type === "fine").reduce((s, e) => s + e.amount, 0);
    return { bonuses, fines, net: bonuses - fines };
  }, [filtered]);

  const monthOptions = React.useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.month && /^\d{4}-\d{2}$/.test(e.month)) set.add(e.month);
    });
    const cur = currentMonthYyyyMm();
    set.add(cur);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const hasAnyEntries = entries.length > 0;
  const showEmpty = filtered.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Fines &amp; bonuses</h1>
        <p className="mt-1 text-sm text-white/50">Your issued bonuses and fines by month.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Month
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block min-h-11 w-44 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonthYyyyMm(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Type
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="mt-1 block min-h-11 w-36 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
          >
            <option value="all">All</option>
            <option value="bonus">Bonus</option>
            <option value="fine">Fine</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass-card border-green-500/20 bg-green-500/[0.06] p-4">
          <p className="text-xs text-white/50">Total bonuses</p>
          <p className="mt-1 text-xl font-bold text-green-400">+€{summary.bonuses.toFixed(2)}</p>
        </div>
        <div className="glass-card border-red-500/20 bg-red-500/[0.06] p-4">
          <p className="text-xs text-white/50">Total fines</p>
          <p className="mt-1 text-xl font-bold text-red-400">-€{summary.fines.toFixed(2)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-white/50">Net</p>
          <p className={`mt-1 text-xl font-bold ${summary.net >= 0 ? "text-green-400" : "text-red-400"}`}>
            {summary.net >= 0 ? "+" : ""}€{summary.net.toFixed(2)}
          </p>
        </div>
      </div>

      {showEmpty ? (
        <div className="py-16 text-center text-white/30">
          <p className="mb-2 text-3xl">
            <DollarSign className="mx-auto h-8 w-8 text-emerald-400" aria-hidden />
          </p>
          <p>{hasAnyEntries ? "No fines or bonuses for this filter." : "No fines or bonuses yet."}</p>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {groupedPage.map(({ month: groupMonth, entries: groupEntries }) => (
              <div key={groupMonth}>
                <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-center gap-3 bg-zinc-950/90 px-1 py-2 backdrop-blur-md">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-pink-300/80">
                    {groupMonth === "unknown" ? "Unknown month" : formatMonthYyyyMm(groupMonth)}
                  </h3>
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs font-medium text-green-400">+€{monthBonusTotal(groupEntries).toFixed(2)}</span>
                  <span className="text-xs font-medium text-red-400">-€{monthFineTotal(groupEntries).toFixed(2)}</span>
                </div>
                {groupEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`glass-card mb-2 flex items-start gap-4 p-4 transition hover:bg-white/[0.06] ${
                      entry.type === "bonus" ? "border-green-500/15" : "border-red-500/15"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        entry.type === "bonus" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      <DollarSign className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{entry.reason}</p>
                        {isSpinWheelFineBonus(entry) ? <SpinWheelBadge /> : <ManualBadge />}
                      </div>
                      {entry.notes ? <p className="mt-0.5 text-xs text-white/50">{entry.notes}</p> : null}
                      <p className="mt-1 text-xs text-white/30">
                        {formatDateTimeAthens(entry.created_at)} · by {entry.admin_name || "Admin"}
                      </p>
                    </div>
                    <div className={`shrink-0 text-right ${entry.type === "bonus" ? "text-green-400" : "text-red-400"}`}>
                      <p className="text-base font-bold">
                        {entry.type === "bonus" ? "+" : "-"}€{entry.amount.toFixed(2)}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs ${
                          entry.type === "bonus"
                            ? "border-green-500/25 bg-green-500/15 text-green-400"
                            : "border-red-500/25 bg-red-500/15 text-red-400"
                        }`}
                      >
                        {entry.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <PaginationControls page={page} totalPages={totalPages} onPage={setPage} totalItems={filtered.length} />
        </>
      )}
    </div>
  );
}
