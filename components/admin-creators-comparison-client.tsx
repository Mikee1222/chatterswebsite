"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRightLeft, ArrowUp, Loader2 } from "lucide-react";
import { SectionLabel } from "@/components/infloww-performance-ui";
import { IgEmptyState, IgSkeleton } from "@/components/instagram-insights-shared";
import { fmtNum, fmtPct } from "@/lib/instagram-insights-ui";
import {
  isMissingSideStatus,
  type CreatorsComparisonDays,
  type CreatorsComparisonMarketFilter,
  type CreatorsComparisonRow,
  type CreatorsComparisonSortKey,
  type CreatorsComparisonStatus,
} from "@/lib/creators-comparison";
import { ROUTES } from "@/lib/routes";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type ApiPayload = {
  days: CreatorsComparisonDays;
  market: CreatorsComparisonMarketFilter;
  range: { startYmd: string; endYmd: string };
  previousRange: { startYmd: string; endYmd: string };
  rows: CreatorsComparisonRow[];
  partial?: { ig: boolean; of: boolean; markets: boolean };
  error?: string;
};

const SORT_COLUMNS: Array<{ key: CreatorsComparisonSortKey; label: string; align?: "right" }> = [
  { key: "modelName", label: "Creator" },
  { key: "views", label: "Views", align: "right" },
  { key: "reach", label: "Reach", align: "right" },
  { key: "newSubs", label: "New subs", align: "right" },
  { key: "subsPer100kViews", label: "Subs / 100k views", align: "right" },
  { key: "viewsDeltaPct", label: "Δ Views", align: "right" },
  { key: "subsDeltaPct", label: "Δ Subs", align: "right" },
];

function statusBadge(status: CreatorsComparisonStatus): { label: string; className: string } | null {
  if (status === "ig_only") {
    return { label: "No OF data", className: "border-amber-400/30 bg-amber-400/10 text-amber-200" };
  }
  if (status === "of_only") {
    return { label: "No IG data", className: "border-sky-400/30 bg-sky-400/10 text-sky-200" };
  }
  if (status === "unlinked") {
    return { label: "Not linked", className: "border-white/15 bg-white/[0.06] text-white/55" };
  }
  return null;
}

function formatMetric(value: number | null, kind: "int" | "rate" = "int"): string {
  if (value == null) return "—";
  if (kind === "rate") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return fmtNum(Math.round(value));
}

function DeltaCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-white/35">—</span>;
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-0.5 tabular-nums",
        flat ? "text-white/55" : up ? "text-emerald-300" : "text-rose-300"
      )}
    >
      {!flat ? (up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
      {fmtPct(value)}
    </span>
  );
}

function MarketCell({ market }: { market: CreatorsComparisonRow["market"] }) {
  if (!market.length) return <span className="text-white/35">—</span>;
  return (
    <span className="text-[11px] font-medium tracking-wide text-white/50">
      {market.join(" · ")}
    </span>
  );
}

function insightsHref(row: CreatorsComparisonRow, range: { startYmd: string; endYmd: string }): string {
  const params = new URLSearchParams({
    modelId: row.modelRecordId,
    preset: "custom",
    from: range.startYmd,
    to: range.endYmd,
  });
  return `${ROUTES.admin.instagramInsights}?${params}`;
}

export function AdminCreatorsComparisonClient() {
  const router = useRouter();
  const [days, setDays] = React.useState<CreatorsComparisonDays>(7);
  const [market, setMarket] = React.useState<CreatorsComparisonMarketFilter>("all");
  const [sortKey, setSortKey] = React.useState<CreatorsComparisonSortKey>("views");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ApiPayload | null>(null);

  const load = React.useCallback(
    async (opts?: {
      days?: CreatorsComparisonDays;
      market?: CreatorsComparisonMarketFilter;
      sort?: CreatorsComparisonSortKey;
      dir?: "asc" | "desc";
    }) => {
      setLoading(true);
      setError(null);
      const d = opts?.days ?? days;
      const m = opts?.market ?? market;
      const s = opts?.sort ?? sortKey;
      const dir = opts?.dir ?? sortDir;
      try {
        const params = new URLSearchParams({
          days: String(d),
          market: m,
          sort: s,
          dir,
        });
        const res = await fetch(`/api/admin/creators-comparison?${params}`, { cache: "no-store" });
        const json = (await res.json()) as ApiPayload;
        if (!res.ok) throw new Error(json.error ?? "Failed to load comparison");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [days, market, sortKey, sortDir]
  );

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSort(key: CreatorsComparisonSortKey) {
    const nextDir = sortKey === key && sortDir === "desc" ? "asc" : "desc";
    const nextKey = key;
    setSortKey(nextKey);
    setSortDir(nextDir);
    void load({ sort: nextKey, dir: nextDir });
  }

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className={cn(VA_CARD, VA_CARD_GLOW, "relative overflow-hidden p-5 md:p-6")}>
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 10% 0%, rgba(255,20,147,0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 0%, rgba(212,175,140,0.12), transparent 50%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-[#FF1493]" />
              <SectionLabel>Creators comparison</SectionLabel>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">
              Instagram vs OnlyFans
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/55">
              One row per creator — views & reach from ClarioSuite, new subs from Infloww. Period is
              the last {days} complete days ending yesterday (Athens).
            </p>
            {data?.range ? (
              <p className="mt-2 text-xs text-white/40">
                {data.range.startYmd} → {data.range.endYmd}
                {data.previousRange
                  ? ` · prev ${data.previousRange.startYmd} → ${data.previousRange.endYmd}`
                  : null}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                disabled={loading}
                onClick={() => {
                  setDays(d);
                  void load({ days: d });
                }}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                  days === d
                    ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FFB6DE]"
                    : "border-white/15 bg-white/[0.04] text-white/65 hover:bg-white/[0.07]"
                )}
              >
                {d} days
              </button>
            ))}
            <div className="mx-1 h-6 w-px bg-white/10" />
            {(["all", "GR", "USA"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={loading}
                onClick={() => {
                  setMarket(m);
                  void load({ market: m });
                }}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                  market === m
                    ? "border-[#D4AF8C]/50 bg-[#D4AF8C]/15 text-[#E8D0B0]"
                    : "border-white/15 bg-white/[0.04] text-white/65 hover:bg-white/[0.07]"
                )}
              >
                {m === "all" ? "All markets" : m}
              </button>
            ))}
          </div>
        </div>

        {data?.partial && (data.partial.ig || data.partial.of) ? (
          <p className="relative mt-4 text-xs text-amber-200/80">
            Partial load
            {data.partial.ig ? " — Instagram side unavailable" : ""}
            {data.partial.of ? " — OnlyFans side unavailable" : ""}. Showing what’s available.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className={cn(VA_CARD, "p-6 text-center text-sm text-rose-300")}>{error}</div>
      ) : null}

      {loading && !data ? (
        <div className="space-y-3">
          <IgSkeleton className="h-12" />
          <IgSkeleton className="h-64" />
        </div>
      ) : !loading && rows.length === 0 ? (
        <IgEmptyState title="No creators in this window" detail="Try All markets or a longer period." />
      ) : (
        <div className={cn(VA_CARD, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  {SORT_COLUMNS.map((col) => {
                    const active = sortKey === col.key;
                    return (
                      <th key={col.key} className={cn("px-3 py-3", col.align === "right" && "text-right")}>
                        <button
                          type="button"
                          onClick={() => onSort(col.key)}
                          className={cn(
                            "inline-flex items-center gap-1 transition hover:text-white/80",
                            col.align === "right" && "flex-row-reverse",
                            active ? "text-white/80" : "text-white/40"
                          )}
                        >
                          {col.label}
                          {active ? (
                            sortDir === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUp className="h-3 w-3" />
                            )
                          ) : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const badge = statusBadge(row.status);
                  const missing = isMissingSideStatus(row.status);
                  return (
                    <tr
                      key={row.modelRecordId}
                      role="link"
                      tabIndex={0}
                      onClick={() => {
                        if (!data?.range) return;
                        router.push(insightsHref(row, data.range));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (!data?.range) return;
                          router.push(insightsHref(row, data.range));
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-b border-white/[0.06] transition hover:bg-white/[0.04]",
                        missing && "opacity-80"
                      )}
                    >
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-white">{row.modelName}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <MarketCell market={row.market} />
                            {badge ? (
                              <span
                                className={cn(
                                  "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  badge.className
                                )}
                              >
                                {badge.label}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-white/85">
                        {formatMetric(row.views)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-white/85">
                        {formatMetric(row.reach)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-white/85">
                        {formatMetric(row.newSubs)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-white/85">
                        {formatMetric(row.subsPer100kViews, "rate")}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <DeltaCell value={row.viewsDeltaPct} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <DeltaCell value={row.subsDeltaPct} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 border-t border-white/10 py-3 text-xs text-white/45">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing…
            </div>
          ) : (
            <div className="border-t border-white/10 px-3 py-2 text-xs text-white/35">
              {rows.length} creator{rows.length === 1 ? "" : "s"} · click a row for Instagram Insights
            </div>
          )}
        </div>
      )}
    </div>
  );
}
