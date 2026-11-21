"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { formatRelativeTime } from "@/lib/format";
import type { ModelTopFanRow, ModelTopFansSummary, TopFansPeriodDays } from "@/services/model-top-fans";

const FETCH_LIMIT = 100;

type ApiResponse = {
  summary: ModelTopFansSummary;
  fans: ModelTopFanRow[];
  has_more: boolean;
  error?: string;
};

const PERIODS: Array<{ value: TopFansPeriodDays; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: "all", label: "All time" },
];

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatUsdExact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPct(share: number): string {
  return `${(share * 100).toFixed(share >= 0.1 ? 0 : 1)}%`;
}

function typeBreakdown(row: ModelTopFanRow): string {
  const parts: string[] = [];
  if (row.tips_net > 0) parts.push(`Tips ${formatUsdExact(row.tips_net)}`);
  if (row.messages_net > 0) parts.push(`Messages ${formatUsdExact(row.messages_net)}`);
  if (row.subscription_net > 0) parts.push(`Subs ${formatUsdExact(row.subscription_net)}`);
  if (row.posts_net > 0) parts.push(`Posts ${formatUsdExact(row.posts_net)}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

const listContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const listItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

export function ModelTopFans({ modelId, modelName }: { modelId: string; modelName: string }) {
  const [period, setPeriod] = React.useState<TopFansPeriodDays>(30);
  const [search, setSearch] = React.useState("");
  const [searchDebounced, setSearchDebounced] = React.useState("");
  const [inactiveOnly, setInactiveOnly] = React.useState(false);
  const [inactiveMinNet, setInactiveMinNet] = React.useState(100);
  const [inactiveMinDraft, setInactiveMinDraft] = React.useState("100");
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fans, setFans] = React.useState<ModelTopFanRow[]>([]);
  const [summary, setSummary] = React.useState<ModelTopFansSummary>({
    fan_count: 0,
    total_net: 0,
    top10_net_share: 0,
  });
  const [hasMore, setHasMore] = React.useState(false);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  function buildUrl(nextOffset: number) {
    const qs = new URLSearchParams();
    qs.set("period", String(period));
    qs.set("limit", String(FETCH_LIMIT));
    qs.set("offset", String(nextOffset));
    if (searchDebounced) qs.set("search", searchDebounced);
    if (inactiveOnly) {
      qs.set("inactive", "1");
      qs.set("inactive_min_net", String(inactiveMinNet));
    }
    return `/api/admin/models/${encodeURIComponent(modelId)}/top-fans?${qs.toString()}`;
  }

  React.useEffect(() => {
    if (!modelId.trim()) {
      setFans([]);
      setSummary({ fan_count: 0, total_net: 0, top10_net_share: 0 });
      setHasMore(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setOffset(0);

    void (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("period", String(period));
        qs.set("limit", String(FETCH_LIMIT));
        qs.set("offset", "0");
        if (searchDebounced) qs.set("search", searchDebounced);
        if (inactiveOnly) {
          qs.set("inactive", "1");
          qs.set("inactive_min_net", String(inactiveMinNet));
        }
        const res = await fetch(
          `/api/admin/models/${encodeURIComponent(modelId)}/top-fans?${qs.toString()}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Failed to load top fans.");
          setFans([]);
          setHasMore(false);
          return;
        }
        setFans(data.fans ?? []);
        setSummary(
          data.summary ?? { fan_count: 0, total_net: 0, top10_net_share: 0 }
        );
        setHasMore(data.has_more === true);
        setOffset(FETCH_LIMIT);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load top fans.");
          setFans([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modelId, period, searchDebounced, inactiveOnly, inactiveMinNet]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(offset), { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load more fans.");
        return;
      }
      setFans((prev) => [...prev, ...(data.fans ?? [])]);
      setHasMore(data.has_more === true);
      setOffset((o) => o + FETCH_LIMIT);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more fans.");
    } finally {
      setLoadingMore(false);
    }
  }

  function commitInactiveMin() {
    const parsed = Number(inactiveMinDraft);
    setInactiveMinNet(Number.isFinite(parsed) && parsed >= 0 ? parsed : 100);
  }

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
      aria-label={`Top fans for ${modelName}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
            Top Fans
          </h2>
          <p className="mt-1 text-xs text-white/40">
            From Infloww transactions · net revenue by fan
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={String(p.value)}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                period === p.value
                  ? "bg-pink-500/25 text-pink-100 ring-1 ring-pink-400/40"
                  : "bg-white/[0.05] text-white/55 hover:bg-white/[0.08] hover:text-white/80"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Fans</p>
          <p className="mt-0.5 text-lg font-semibold text-white">
            {summary.fan_count.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Total net</p>
          <p className="mt-0.5 text-lg font-semibold text-white">{formatUsd(summary.total_net)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Top 10 share</p>
          <p className="mt-0.5 text-lg font-semibold text-white">
            {formatPct(summary.top10_net_share)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 text-xs text-white/50">
          Search fan
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name…"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-pink-400/40 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={inactiveOnly}
            onChange={(e) => setInactiveOnly(e.target.checked)}
            className="rounded border-white/20 bg-black/40"
          />
          Inactive
        </label>
        <label className="w-28 text-xs text-white/50">
          Min net ($)
          <input
            type="number"
            min={0}
            step={1}
            value={inactiveMinDraft}
            disabled={!inactiveOnly}
            onChange={(e) => setInactiveMinDraft(e.target.value)}
            onBlur={commitInactiveMin}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white disabled:opacity-40 focus:border-pink-400/40 focus:outline-none"
          />
        </label>
        <p className="pb-2 text-[11px] text-white/35">
          Inactive = net ≥ threshold in period, no purchase in last 14 days
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/40">
              <th className="pb-2 pr-3 font-medium">Fan</th>
              <th className="pb-2 pr-3 font-medium text-right">Net</th>
              <th className="pb-2 pr-3 font-medium text-right">Purchases</th>
              <th className="pb-2 pr-3 font-medium">Last purchase</th>
              <th className="pb-2 font-medium">By type</th>
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <tr>
                <td colSpan={5} className="py-8 text-center text-white/45">
                  Loading…
                </td>
              </tr>
            </tbody>
          ) : fans.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={5} className="py-8 text-center text-white/45">
                  No fans for this period.
                </td>
              </tr>
            </tbody>
          ) : (
            <motion.tbody variants={listContainer} initial="hidden" animate="show">
              {fans.map((row) => (
                <motion.tr
                  key={row.fan_id}
                  variants={listItem}
                  className="border-b border-white/[0.06] last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-white/90">{row.fan_name}</div>
                    <div className="text-[11px] text-white/35">{row.fan_id}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-medium text-emerald-200/90">
                    {formatUsdExact(row.net)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-white/70">{row.purchase_count}</td>
                  <td className="py-2.5 pr-3 text-white/60">
                    {formatRelativeTime(row.last_purchase_at)}
                  </td>
                  <td className="py-2.5 text-xs text-white/50">{typeBreakdown(row)}</td>
                </motion.tr>
              ))}
            </motion.tbody>
          )}
        </table>
      </div>

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
