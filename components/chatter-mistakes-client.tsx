"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { usePagination } from "@/lib/use-pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import type { MistakeReasonCategory, MistakeRecord } from "@/services/chatter-mistakes";
import {
  EmptyState,
  FilterChip,
  MistakePoints,
  MistakeSeverityBadge,
  MistakeStatusBadge,
  RelativeDate,
  ScreenshotGallery,
  formatWeekGroupLabel,
  getMistakeDateRange,
  startOfWeekMonday,
  toDateStr,
  weekStartKeyFromIso,
  type MistakeDatePreset,
} from "@/components/mistakes";

type Props = {
  initialMistakes: MistakeRecord[];
};

type StatusTab = "all" | "pending" | "approved" | "rejected";
type SortKey = "newest" | "highest";
type ChatterPeriod = "this_week" | "this_month" | "last_month" | "all" | "custom";

const PERIOD_OPTIONS: { key: ChatterPeriod; label: string }[] = [
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

function mistakeDay(m: MistakeRecord): string {
  return (m.mistake_date || m.created_at || "").slice(0, 10);
}

function approvedPoints(m: MistakeRecord): number {
  if (m.status !== "approved") return 0;
  return Math.abs(Math.round(m.points_deducted ?? 0));
}

function WeeksSparkline({
  weeks,
}: {
  weeks: { key: string; label: string; points: number }[];
}) {
  const max = Math.max(1, ...weeks.map((w) => w.points));
  const w = 160;
  const h = 36;
  const pad = 2;
  const n = weeks.length;
  const gap = 3;
  const barW = n > 0 ? (w - pad * 2 - gap * (n - 1)) / n : 0;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-9 w-40 max-w-full text-red-400/80"
      role="img"
      aria-label="Points lost per week"
    >
      {weeks.map((week, i) => {
        const bh = week.points <= 0 ? 2 : Math.max(3, (week.points / max) * (h - pad * 2));
        const x = pad + i * (barW + gap);
        const y = h - pad - bh;
        return (
          <rect
            key={week.key}
            x={x}
            y={y}
            width={Math.max(2, barW)}
            height={bh}
            rx={1.5}
            className={week.points > 0 ? "fill-current" : "fill-white/15"}
          >
            <title>
              {week.label}: {week.points} pts
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

function SeverityBreakdownBar({
  low,
  med,
  high,
}: {
  low: number;
  med: number;
  high: number;
}) {
  const total = low + med + high;
  if (total === 0) {
    return <div className="h-1.5 w-full rounded-full bg-white/10" aria-hidden />;
  }
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10"
      role="img"
      aria-label={`Severity: ${low} low, ${med} medium, ${high} high`}
    >
      {low > 0 ? (
        <div className="h-full bg-blue-400/80" style={{ width: `${(low / total) * 100}%` }} />
      ) : null}
      {med > 0 ? (
        <div className="h-full bg-amber-400/80" style={{ width: `${(med / total) * 100}%` }} />
      ) : null}
      {high > 0 ? (
        <div className="h-full bg-red-400/80" style={{ width: `${(high / total) * 100}%` }} />
      ) : null}
    </div>
  );
}

function MistakeTimelineCard({ m }: { m: MistakeRecord }) {
  const rejected = m.status === "rejected";
  const showReviewerNote =
    Boolean(m.admin_notes?.trim()) && (m.status === "approved" || m.status === "rejected");

  return (
    <article
      className={`rounded-2xl border p-4 transition ${
        rejected
          ? "border-white/8 bg-white/[0.02] opacity-90"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-white">{m.reason_label || "Mistake"}</p>
            <MistakeSeverityBadge severity={m.reason_category} withDot />
            <MistakeStatusBadge status={m.status} underReview />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
            <span>{m.model_name || "—"}</span>
            <RelativeDate iso={m.mistake_date || m.created_at} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <MistakePoints points={m.points_deducted ?? 0} status={m.status} className="text-sm" />
        </div>
      </div>

      {m.explanation?.trim() ? (
        <p className="mt-3 text-sm leading-relaxed text-white/65">{m.explanation.trim()}</p>
      ) : null}

      {m.screenshot?.length ? (
        <div className="mt-3">
          <ScreenshotGallery
            shots={m.screenshot}
            preferAnnotatedThumbs
            allowOriginalToggle
            size="md"
          />
        </div>
      ) : null}

      {showReviewerNote ? (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 ${
            rejected
              ? "border-red-500/25 bg-red-500/10"
              : "border-white/10 bg-white/[0.04]"
          }`}
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
            Reviewer note
          </p>
          <p
            className={`text-sm italic ${
              rejected ? "font-medium text-red-100/90" : "text-white/65"
            }`}
          >
            &ldquo;{m.admin_notes.trim()}&rdquo;
          </p>
        </div>
      ) : null}
    </article>
  );
}

export function ChatterMistakesClient({ initialMistakes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mistakes] = React.useState(initialMistakes);

  const period = (searchParams.get("period") as ChatterPeriod) || "this_month";
  const statusTab = (searchParams.get("status") as StatusTab) || "all";
  const severityParam = searchParams.get("severity") || "";
  const modelId = searchParams.get("model") || "";
  const reasonId = searchParams.get("reason") || "";
  const sort = (searchParams.get("sort") as SortKey) || "newest";
  const qParam = searchParams.get("q") ?? "";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  const [searchDraft, setSearchDraft] = React.useState(qParam);
  React.useEffect(() => setSearchDraft(qParam), [qParam]);

  const replaceParams = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchDraft !== qParam) replaceParams({ q: searchDraft.trim() || null });
    }, 280);
    return () => window.clearTimeout(t);
  }, [searchDraft, qParam, replaceParams]);

  const datePreset: MistakeDatePreset =
    period === "custom"
      ? "custom"
      : period === "this_week"
        ? "this_week"
        : period === "this_month"
          ? "this_month"
          : period === "last_month"
            ? "last_month"
            : "all";

  const dateRange = React.useMemo(
    () => getMistakeDateRange(datePreset, dateFrom, dateTo),
    [datePreset, dateFrom, dateTo]
  );

  const inPeriod = React.useMemo(() => {
    return mistakes.filter((m) => {
      const d = mistakeDay(m);
      if (dateRange.from && (!d || d < dateRange.from)) return false;
      if (dateRange.to && (!d || d > dateRange.to)) return false;
      return true;
    });
  }, [mistakes, dateRange]);

  const modelOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mistakes) {
      if (m.model_id) map.set(m.model_id, m.model_name || m.model_id);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mistakes]);

  const reasonOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mistakes) {
      if (m.reason_id) map.set(m.reason_id, m.reason_label || m.reason_id);
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mistakes]);

  const statusCounts = React.useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const m of inPeriod) {
      if (m.status === "pending") pending += 1;
      else if (m.status === "approved") approved += 1;
      else if (m.status === "rejected") rejected += 1;
    }
    return { all: inPeriod.length, pending, approved, rejected };
  }, [inPeriod]);

  const periodSummary = React.useMemo(() => {
    let pointsLost = 0;
    let pending = 0;
    let low = 0;
    let med = 0;
    let high = 0;
    const reasonCounts = new Map<string, { label: string; count: number }>();

    for (const m of inPeriod) {
      pointsLost += approvedPoints(m);
      if (m.status === "pending") pending += 1;
      if (m.reason_category === "High") high += 1;
      else if (m.reason_category === "Medium") med += 1;
      else low += 1;
      const key = m.reason_id || m.reason_label;
      if (key) {
        const prev = reasonCounts.get(key);
        if (prev) prev.count += 1;
        else reasonCounts.set(key, { label: m.reason_label || key, count: 1 });
      }
    }

    let topReason: { label: string; count: number } | null = null;
    for (const r of reasonCounts.values()) {
      if (!topReason || r.count > topReason.count) topReason = r;
    }

    const now = new Date();
    const weeks: { key: string; label: string; points: number }[] = [];
    for (let i = 7; i >= 0; i -= 1) {
      const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const start = startOfWeekMonday(anchor);
      const key = toDateStr(start);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      const endStr = toDateStr(end);
      let pts = 0;
      for (const m of inPeriod) {
        const d = mistakeDay(m);
        if (d && d >= key && d <= endStr) pts += approvedPoints(m);
      }
      weeks.push({ key, label: formatWeekGroupLabel(key, now), points: pts });
    }

    return { total: inPeriod.length, pointsLost, pending, low, med, high, topReason, weeks };
  }, [inPeriod]);

  const filtered = React.useMemo(() => {
    const q = qParam.trim().toLowerCase();
    const sev = severityParam as MistakeReasonCategory | "";

    let rows = inPeriod.filter((m) => {
      if (statusTab !== "all" && m.status !== statusTab) return false;
      if (sev && m.reason_category !== sev) return false;
      if (modelId && m.model_id !== modelId) return false;
      if (reasonId && m.reason_id !== reasonId) return false;
      if (q) {
        const hay = `${m.explanation} ${m.reason_label} ${m.model_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sort === "highest") {
        const pa = a.status === "approved" ? approvedPoints(a) : 0;
        const pb = b.status === "approved" ? approvedPoints(b) : 0;
        if (pb !== pa) return pb - pa;
      }
      const da = mistakeDay(a) || a.created_at;
      const db = mistakeDay(b) || b.created_at;
      return db.localeCompare(da);
    });

    return rows;
  }, [inPeriod, statusTab, severityParam, modelId, reasonId, qParam, sort]);

  const { page, setPage, totalPages, paginated, reset: resetPage } = usePagination(filtered, 20);

  React.useEffect(() => {
    resetPage();
  }, [statusTab, severityParam, modelId, reasonId, qParam, sort, period, dateFrom, dateTo, resetPage]);

  const weekGroups = React.useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: MistakeRecord[]; points: number }>();
    const now = new Date();
    for (const m of paginated) {
      const key = weekStartKeyFromIso(m.mistake_date || m.created_at) || "unknown";
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          label: key === "unknown" ? "Unknown date" : formatWeekGroupLabel(key, now),
          items: [],
          points: 0,
        };
        map.set(key, g);
      }
      g.items.push(m);
      g.points += approvedPoints(m);
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [paginated]);

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (statusTab !== "all") {
    const labels: Record<Exclude<StatusTab, "all">, string> = {
      pending: "Under review",
      approved: "Approved",
      rejected: "Rejected",
    };
    activeChips.push({
      key: "status",
      label: labels[statusTab],
      clear: () => replaceParams({ status: null }),
    });
  }
  if (severityParam) {
    activeChips.push({
      key: "severity",
      label: `Severity: ${severityParam}`,
      clear: () => replaceParams({ severity: null }),
    });
  }
  if (modelId) {
    const name = modelOptions.find((o) => o.id === modelId)?.name || modelId;
    activeChips.push({
      key: "model",
      label: `Model: ${name}`,
      clear: () => replaceParams({ model: null }),
    });
  }
  if (reasonId) {
    const label = reasonOptions.find((o) => o.id === reasonId)?.label || reasonId;
    activeChips.push({
      key: "reason",
      label: `Reason: ${label}`,
      clear: () => replaceParams({ reason: null }),
    });
  }
  if (qParam.trim()) {
    activeChips.push({
      key: "q",
      label: `Search: ${qParam.trim()}`,
      clear: () => {
        setSearchDraft("");
        replaceParams({ q: null });
      },
    });
  }
  if (sort === "highest") {
    activeChips.push({
      key: "sort",
      label: "Highest points",
      clear: () => replaceParams({ sort: null }),
    });
  }

  const clearAllFilters = () => {
    setSearchDraft("");
    replaceParams({
      status: null,
      severity: null,
      model: null,
      reason: null,
      q: null,
      sort: null,
    });
  };

  const hasActiveFilters = activeChips.length > 0;
  const emptyPeriod = inPeriod.length === 0;
  const emptyFiltered = !emptyPeriod && filtered.length === 0;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-red-400/60">My performance</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">My mistakes</h1>
          <p className="mt-1 text-sm text-white/40">
            What happened, why it mattered, and what it cost — for the period you choose.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Period">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() =>
                replaceParams({
                  period: p.key === "this_month" ? null : p.key,
                  from: p.key === "custom" ? dateFrom || null : null,
                  to: p.key === "custom" ? dateTo || null : null,
                })
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 ${
                period === p.key
                  ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
                  : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[10px] uppercase tracking-wider text-white/40">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => replaceParams({ period: "custom", from: e.target.value || null })}
                className="mt-1 block h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-white focus:border-pink-500/40 focus:outline-none"
              />
            </label>
            <label className="text-[10px] uppercase tracking-wider text-white/40">
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => replaceParams({ period: "custom", to: e.target.value || null })}
                className="mt-1 block h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-white focus:border-pink-500/40 focus:outline-none"
              />
            </label>
          </div>
        ) : null}
      </header>

      <section
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        aria-label="Period summary"
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-white/35">Mistakes in period</p>
          <p className="text-2xl font-bold tabular-nums text-white">{periodSummary.total}</p>
          <div className="mt-3 space-y-1.5">
            <SeverityBreakdownBar
              low={periodSummary.low}
              med={periodSummary.med}
              high={periodSummary.high}
            />
            <p className="text-[10px] text-white/35">
              Low {periodSummary.low} · Med {periodSummary.med} · High {periodSummary.high}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-red-300/60">
            Points lost (approved)
          </p>
          <p className="text-2xl font-bold tabular-nums text-red-400">−{periodSummary.pointsLost}</p>
          <div className="mt-3">
            <WeeksSparkline weeks={periodSummary.weeks} />
            <p className="mt-1 text-[10px] text-white/35">Weekly approved points</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-white/35">Under review</p>
          <p className="text-2xl font-bold tabular-nums text-white/80">{periodSummary.pending}</p>
          <p className="mt-2 text-xs text-white/40">Pending — points not final</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-white/35">Most common reason</p>
          {periodSummary.topReason ? (
            <>
              <p className="line-clamp-2 text-sm font-semibold text-white" title={periodSummary.topReason.label}>
                {periodSummary.topReason.label}
              </p>
              <p className="mt-2 text-xs tabular-nums text-white/40">
                {periodSummary.topReason.count}× in this period
              </p>
            </>
          ) : (
            <p className="text-sm text-white/40">—</p>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status">
          {(
            [
              { key: "all" as const, label: "All", n: statusCounts.all },
              { key: "pending" as const, label: "Under review", n: statusCounts.pending },
              { key: "approved" as const, label: "Approved", n: statusCounts.approved },
              { key: "rejected" as const, label: "Rejected", n: statusCounts.rejected },
            ] as const
          ).map((t) => (
            <FilterChip
              key={t.key}
              label={t.label}
              count={t.n}
              active={statusTab === t.key}
              onClick={() => replaceParams({ status: t.key === "all" ? null : t.key })}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["Low", "Medium", "High"] as MistakeReasonCategory[]).map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={severityParam === s}
              onClick={() => replaceParams({ severity: severityParam === s ? null : s })}
            />
          ))}

          <select
            value={modelId}
            onChange={(e) => replaceParams({ model: e.target.value || null })}
            className="min-h-9 max-w-[10rem] rounded-full border border-white/10 bg-black/40 px-3 text-xs text-white focus:border-pink-500/40 focus:outline-none"
            aria-label="Filter by model"
          >
            <option value="">All models</option>
            {modelOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <select
            value={reasonId}
            onChange={(e) => replaceParams({ reason: e.target.value || null })}
            className="min-h-9 max-w-[12rem] rounded-full border border-white/10 bg-black/40 px-3 text-xs text-white focus:border-pink-500/40 focus:outline-none"
            aria-label="Filter by reason"
          >
            <option value="">All reasons</option>
            {reasonOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) =>
              replaceParams({ sort: e.target.value === "highest" ? "highest" : null })
            }
            className="min-h-9 rounded-full border border-white/10 bg-black/40 px-3 text-xs text-white focus:border-pink-500/40 focus:outline-none"
            aria-label="Sort mistakes"
          >
            <option value="newest">Newest</option>
            <option value="highest">Highest points</option>
          </select>

          <div className="relative min-w-[10rem] flex-1 basis-40">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" aria-hidden />
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search explanation / reason"
              className="h-9 w-full rounded-full border border-white/10 bg-black/40 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/30 focus:border-pink-500/40 focus:outline-none"
              aria-label="Search explanation or reason"
            />
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            {activeChips.map((c) => (
              <FilterChip key={c.key} label={c.label} onRemove={c.clear} />
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-medium text-pink-300/80 hover:text-pink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </section>

      {emptyPeriod ? (
        <EmptyState
          title="Clean record — no mistakes in this period"
          description="Nothing logged for the selected dates. Switch period or enjoy the quiet."
        />
      ) : emptyFiltered ? (
        <EmptyState
          title="No results"
          description="Nothing matches these filters."
          action={
            <button
              type="button"
              onClick={clearAllFilters}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <>
          <div className="space-y-6">
            {weekGroups.map((g) => (
              <section key={g.key} aria-labelledby={`week-${g.key}`}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`week-${g.key}`} className="text-sm font-semibold text-white/80">
                    {g.label}
                  </h2>
                  <p className="text-xs tabular-nums text-white/40">
                    {g.points > 0 ? (
                      <>
                        Subtotal <MistakePoints points={g.points} className="text-xs" />
                      </>
                    ) : (
                      <span>No approved points</span>
                    )}
                  </p>
                </div>
                <ul className="space-y-3">
                  {g.items.map((m) => (
                    <li key={m.id}>
                      <MistakeTimelineCard m={m} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
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
