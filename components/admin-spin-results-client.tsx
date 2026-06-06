"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Clock,
  DollarSign,
  Loader2,
  RotateCw,
  Search,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { markSpinClaimedAction } from "@/app/actions/spin-wheel";
import type { AdminSpinRow } from "@/services/spin-wheel";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDateTimeEuropean, formatRelativeTime } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | "points" | "cash" | "extra_break";
type StatusFilter = "all" | "pending" | "claimed" | "na";
type DatePreset = "week" | "month" | "all";

function isCashLike(row: AdminSpinRow): boolean {
  const t = row.prize_type.toLowerCase();
  return t === "cash" || t === "extra_break";
}

function isCashPrize(row: AdminSpinRow): boolean {
  return normalizeType(row.prize_type) === "cash";
}

function needsManualClaim(row: AdminSpinRow): boolean {
  return isCashPrize(row) && !row.claimed;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDateRange(preset: DatePreset): { from?: string; to?: string } {
  if (preset === "all") return {};
  const now = new Date();
  const today = toDateStr(now);
  if (preset === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return { from: toDateStr(start), to: today };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateStr(start), to: today };
}

function normalizeType(pt: string): string {
  return pt.trim().toLowerCase();
}

function filterRows(
  rows: AdminSpinRow[],
  opts: {
    search: string;
    typeFilter: TypeFilter;
    statusFilter: StatusFilter;
    datePreset: DatePreset;
  }
): AdminSpinRow[] {
  let list = [...rows];
  const q = opts.search.trim().toLowerCase();
  if (q) {
    list = list.filter((r) => r.chatter_name.toLowerCase().includes(q));
  }

  if (opts.typeFilter !== "all") {
    if (opts.typeFilter === "points") {
      list = list.filter((r) => {
        const t = normalizeType(r.prize_type);
        return t === "points" || t === "double_points";
      });
    } else {
      list = list.filter((r) => normalizeType(r.prize_type) === opts.typeFilter);
    }
  }

  if (opts.statusFilter === "pending") {
    list = list.filter((r) => isCashLike(r) && !r.claimed);
  } else if (opts.statusFilter === "claimed") {
    list = list.filter((r) => isCashLike(r) && r.claimed);
  } else if (opts.statusFilter === "na") {
    list = list.filter((r) => !isCashLike(r));
  }

  const { from, to } = getDateRange(opts.datePreset);
  if (from) {
    list = list.filter((r) => (r.created_at || "").slice(0, 10) >= from);
  }
  if (to) {
    list = list.filter((r) => {
      const d = (r.created_at || "").slice(0, 10);
      return d && d <= to;
    });
  }

  return list;
}

function RelativeDate({ iso }: { iso: string }) {
  const full = formatDateTimeEuropean(iso);
  return (
    <span className="text-xs text-white/50" title={full || undefined}>
      {formatRelativeTime(iso)}
    </span>
  );
}

function TypeBadge({ prizeType }: { prizeType: string }) {
  const t = normalizeType(prizeType);
  if (t === "cash") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <DollarSign className="h-3 w-3" aria-hidden />
        Cash
      </span>
    );
  }
  if (t === "extra_break") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/25 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-400">
        <Clock className="h-3 w-3" aria-hidden />
        Extra Break
      </span>
    );
  }
  if (t === "points" || t === "double_points") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
        <Star className="h-3 w-3" aria-hidden />
        Points
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium capitalize text-white/60">
      {prizeType.replace(/_/g, " ")}
    </span>
  );
}

function StatusBadge({ row }: { row: AdminSpinRow }) {
  const cashLike = isCashLike(row);
  if (!cashLike) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/40">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" aria-hidden />
        —
      </span>
    );
  }
  if (row.claimed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
        Claimed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-400">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" aria-hidden />
      Pending
    </span>
  );
}

function AmountCell({ row }: { row: AdminSpinRow }) {
  const t = normalizeType(row.prize_type);
  const amt = Math.max(0, Number.parseFloat(row.prize_value) || 0);
  if (t === "cash") {
    return (
      <span className="block text-right font-bold tabular-nums text-emerald-400">{formatMoney(amt)}</span>
    );
  }
  if (t === "extra_break") {
    const mins = row.prize_value.trim();
    return (
      <span className="block text-right font-medium tabular-nums text-purple-300">
        {mins ? `${mins} min` : "—"}
      </span>
    );
  }
  return <span className="block text-right text-white/35">—</span>;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  gradient,
  iconClass,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <div className={cn("glass-card relative overflow-hidden p-5", gradient)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">{label}</p>
          <p className={cn("mt-2 text-3xl font-bold tabular-nums leading-tight", valueClass ?? "text-white")}>
            {value}
          </p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", iconClass)}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition",
            value === opt.key
              ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
              : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function AdminSpinResultsClient({
  rows,
  stats,
}: {
  rows: AdminSpinRow[];
  stats: {
    totalSpins: number;
    mostCommonPrize: string | null;
    totalCashAwarded: number;
    pendingCashPayout: number;
  };
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [datePreset, setDatePreset] = React.useState<DatePreset>("all");

  const hasFilters =
    search.trim() !== "" || typeFilter !== "all" || statusFilter !== "all" || datePreset !== "all";

  const filtered = React.useMemo(
    () => filterRows(rows, { search, typeFilter, statusFilter, datePreset }),
    [rows, search, typeFilter, statusFilter, datePreset]
  );

  const pendingCashKpi = React.useMemo(
    () =>
      rows.reduce((sum, r) => {
        if (!isCashPrize(r) || r.claimed) return sum;
        return sum + Math.max(0, Number.parseFloat(r.prize_value) || 0);
      }, 0),
    [rows]
  );

  const { page, setPage, totalPages, paginated, reset } = usePagination(filtered, 20);

  React.useEffect(() => {
    reset();
  }, [search, typeFilter, statusFilter, datePreset, reset]);

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setDatePreset("all");
  }

  async function markPaid(spinId: string) {
    setError(null);
    setPendingId(spinId);
    try {
      const res = await markSpinClaimedAction(spinId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Administration</p>
        <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-semibold text-white">
          <Sparkles className="h-6 w-6 text-pink-400" aria-hidden />
          Spin Results
        </h1>
        <p className="mt-1 text-sm text-white/55">All spin wheel outcomes and manual claims</p>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Pending Cash"
          value={formatMoney(pendingCashKpi)}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-rose-500/10 via-transparent to-transparent"
          iconClass="border-rose-500/25 bg-rose-500/15 text-rose-400"
          valueClass="text-rose-300"
        />
        <KpiCard
          label="Total Spins"
          value={stats.totalSpins}
          icon={RotateCw}
          gradient="bg-gradient-to-br from-blue-500/10 via-transparent to-transparent"
          iconClass="border-blue-500/25 bg-blue-500/15 text-blue-400"
          valueClass="text-blue-300"
        />
        <KpiCard
          label="Most Common Prize"
          value={
            <span className="block truncate text-xl font-semibold leading-snug text-purple-300">
              {stats.mostCommonPrize ?? "—"}
            </span>
          }
          icon={Trophy}
          gradient="bg-gradient-to-br from-purple-500/10 via-transparent to-transparent"
          iconClass="border-purple-500/25 bg-purple-500/15 text-purple-400"
        />
        <KpiCard
          label="Cash Awarded Claimed"
          value={formatMoney(stats.totalCashAwarded)}
          icon={CheckCircle}
          gradient="bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent"
          iconClass="border-emerald-500/25 bg-emerald-500/15 text-emerald-400"
          valueClass="text-emerald-300"
        />
      </section>

      <section className="glass-card space-y-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by chatter name..."
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/35"
            aria-label="Search by chatter name"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">Type</p>
            <FilterPills
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { key: "all", label: "All" },
                { key: "points", label: "Points" },
                { key: "cash", label: "Cash" },
                { key: "extra_break", label: "Extra Break" },
              ]}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">Status</p>
            <FilterPills
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { key: "all", label: "All" },
                { key: "pending", label: "Pending" },
                { key: "claimed", label: "Claimed" },
                { key: "na", label: "—" },
              ]}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">Date</p>
            <FilterPills
              value={datePreset}
              onChange={setDatePreset}
              options={[
                { key: "week", label: "This week" },
                { key: "month", label: "This month" },
                { key: "all", label: "All time" },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
          <p className="text-sm text-white/50">
            Results: {filtered.length} of {rows.length} total spins
          </p>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 disabled:pointer-events-none disabled:opacity-40"
          >
            Reset filters
          </button>
        </div>
      </section>

      {filtered.length === 0 ? (
        <p className="glass-card border-dashed py-12 text-center text-sm text-white/45">
          No spin records match your filters.
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {paginated.map((row) => {
              const showMarkPaid = needsManualClaim(row);
              const busy = pendingId === row.id;
              const amt = Math.max(0, Number.parseFloat(row.prize_value) || 0);
              const isPendingCash = isCashPrize(row) && !row.claimed;

              return (
                <li
                  key={row.id}
                  className={cn(
                    "glass-card space-y-3 p-4 transition hover:bg-white/[0.07]",
                    isPendingCash && "border-rose-500/20 bg-gradient-to-r from-rose-500/[0.06] to-transparent"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">{row.chatter_name}</p>
                      <p className="mt-0.5 truncate text-sm text-white/60">{row.prize_label}</p>
                    </div>
                    <StatusBadge row={row} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeBadge prizeType={row.prize_type} />
                    <AmountCell row={row} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <RelativeDate iso={row.created_at} />
                    {showMarkPaid ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => markPaid(row.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-pink-500/40 bg-pink-500/20 px-3 py-2 text-xs font-semibold text-pink-200 transition hover:bg-pink-500/30 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                        Mark as Paid
                        <span className="tabular-nums">{formatMoney(amt)}</span>
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop table */}
          <div className="glass-card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
                <tr className="text-xs uppercase tracking-wider text-white/45">
                  <th className="px-4 py-3.5 font-semibold">Chatter</th>
                  <th className="px-4 py-3.5 font-semibold">Prize</th>
                  <th className="px-4 py-3.5 font-semibold">Type</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3.5 font-semibold">Date</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((row, idx) => {
                  const showMarkPaid = needsManualClaim(row);
                  const busy = pendingId === row.id;
                  const amt = Math.max(0, Number.parseFloat(row.prize_value) || 0);
                  const isPendingCash = isCashPrize(row) && !row.claimed;

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04]",
                        idx % 2 === 1 && "bg-white/[0.02]",
                        isPendingCash && "bg-gradient-to-r from-rose-500/[0.07] to-transparent"
                      )}
                    >
                      <td className="px-4 py-3 align-middle font-medium text-white">{row.chatter_name}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 align-middle text-white/80">
                        {row.prize_label}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <TypeBadge prizeType={row.prize_type} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <AmountCell row={row} />
                      </td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">
                        <RelativeDate iso={row.created_at} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StatusBadge row={row} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {showMarkPaid ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => markPaid(row.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-pink-500/40 bg-pink-500/20 px-3 py-2 text-xs font-semibold text-pink-200 transition hover:bg-pink-500/30 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                            Mark as Paid
                            <span className="tabular-nums">{formatMoney(amt)}</span>
                          </button>
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            totalItems={filtered.length}
          />
        </>
      )}
    </div>
  );
}
