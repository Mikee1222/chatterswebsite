"use client";

import * as React from "react";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { RefreshingIndicator } from "@/components/refreshing-indicator";
import {
  useAdaptiveRefreshInterval,
  useAdminTodayEarnings,
} from "@/lib/hooks/use-dashboard-data";
import { formatDate, formatDateYmd } from "@/lib/format-date";

export type TodayEarningsCardProps = {
  /** Compact block for embedding inside a stat card (no outer frame). */
  embedded?: boolean;
};

export function TodayEarningsCard({ embedded = false }: TodayEarningsCardProps) {
  const refreshInterval = useAdaptiveRefreshInterval(5 * 60 * 1000, 0);
  const query = useAdminTodayEarnings({ refreshInterval });
  const earnings = query.data?.totals?.gross ?? null;
  const displayYmd = getTodayYmdAthens();
  const loading = query.isLoading && !query.data;
  const error = Boolean(query.error);
  const errorMessage = query.error?.message ?? null;

  const titleClass = embedded
    ? "text-[11px] font-semibold uppercase tracking-wider text-white/50"
    : "text-sm font-semibold uppercase tracking-wide text-white/60";

  const amountClass = embedded
    ? "mt-1 text-2xl font-bold tabular-nums text-white sm:text-3xl"
    : "mt-2 text-4xl font-bold tabular-nums text-white";

  const inner = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className={titleClass}>Today&apos;s earnings</h3>
        <div className="flex items-center gap-2">
          <RefreshingIndicator isRefreshing={query.isValidating && !loading} />
          {error ? (
            <button
              type="button"
              onClick={() => void query.mutate()}
              className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/80 transition hover:border-pink-500/40 hover:bg-white/[0.08]"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div
          className={embedded ? "mt-2 h-9 w-full max-w-[10rem] animate-pulse rounded-lg bg-white/10" : "mt-2 h-12 w-48 max-w-full animate-pulse rounded-lg bg-white/5"}
          aria-busy="true"
          aria-label="Loading earnings"
        />
      ) : null}

      {!loading && error ? (
        <div className="mt-1">
          <p className={`font-semibold tabular-nums text-white/35 ${embedded ? "text-lg" : "text-2xl"}`}>—</p>
          <p className={`text-white/45 ${embedded ? "mt-0.5 text-xs" : "mt-1 text-sm"}`}>{errorMessage ?? "Unavailable"}</p>
          <p className="mt-0.5 text-[10px] text-white/35">Infloww · Athens · Gross</p>
        </div>
      ) : null}

      {!loading && !error && earnings !== null ? (
        <>
          <p className={amountClass}>
            $
            {earnings.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className={`text-white/50 ${embedded ? "mt-0.5 text-xs" : "mt-1 text-sm"}`}>
            {displayYmd ? formatDateYmd(displayYmd) : formatDate(new Date().toISOString())} · Gross (pre OF 20%)
          </p>
          <p className="mt-0.5 text-[10px] text-white/40">Infloww · Refreshes every 5 min</p>
        </>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="min-w-0 flex-1 text-left">{inner}</div>;
  }

  return <div className="rounded-2xl border border-white/10 bg-black/40 p-6">{inner}</div>;
}
