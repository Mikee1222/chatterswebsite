"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownRight,
  ArrowUpRight,
  GitCompareArrows,
  Trophy,
} from "lucide-react";
import {
  CountUp,
  SectionLabel,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import { IgEmptyState } from "@/components/instagram-insights-shared";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import {
  CHART_TOOLTIP_STYLE,
  fmtDelta,
  fmtNum,
  fmtPct,
  IG_STAT_INFO,
} from "@/lib/instagram-insights-ui";
import {
  buildNormalizedCompareChartData,
  compareFieldReason,
  COMPARE_FIELD_REASON_LABELS,
  type ModelComparisonRow,
} from "@/lib/instagram-insights-stats";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

const COMPARE_COLORS = ["#FF1493", "#D4AF8C", "#34D399", "#60A5FA", "#F472B6", "#A78BFA"];

export type CompareSortKey =
  | "reach"
  | "views"
  | "followers"
  | "engagement"
  | "growth_rate"
  | "posting_frequency"
  | "consistency"
  | "top_post_engagement";

export type CompareCallout = {
  kind: "improved" | "declining";
  modelId: string;
  modelName: string;
  metric: string;
  current: number;
  prior: number;
  deltaPct: number | null;
  message: string;
};

type CompareModelsSectionProps = {
  rows: ModelComparisonRow[];
  callouts?: CompareCallout[];
  priorRange?: { startYmd: string; endYmd: string; days: number };
  loading?: boolean;
  selectedModelId?: string;
  onSelectModel: (modelId: string) => void;
};

function sortValue(row: ModelComparisonRow, key: CompareSortKey): number {
  if (key === "reach") return row.reach;
  if (key === "views") return row.views ?? -1;
  if (key === "followers") return row.follower_end ?? -1;
  if (key === "engagement") return row.avg_engagement_rate ?? -1;
  if (key === "growth_rate") return row.growth_rate_pct ?? -Infinity;
  if (key === "posting_frequency") return row.posting_frequency ?? -1;
  if (key === "consistency") return row.consistency_score ?? -1;
  return row.top_post_engagement ?? -1;
}

function modelInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ModelAvatar({ name, rank }: { name: string; rank: number }) {
  const medal =
    rank === 0 ? "text-[#FFD700]" : rank === 1 ? "text-[#C0C0C0]" : rank === 2 ? "text-[#CD7F32]" : "";
  return (
    <div className="relative shrink-0">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FF1493]/25 to-[#D4AF8C]/15 text-xs font-bold text-white ring-1 ring-white/10">
        {modelInitials(name)}
      </div>
      {rank < 3 ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#121218] text-[9px] font-bold ring-1 ring-white/10",
            medal
          )}
        >
          {rank + 1}
        </span>
      ) : null}
    </div>
  );
}

function GrowthBadge({
  delta,
  pct,
}: {
  delta: number | null;
  pct: number | null;
}) {
  if (delta == null && pct == null) {
    return (
      <span className="text-white/35" title="Need follower history in this range">
        —
      </span>
    );
  }
  const up = (delta ?? 0) > 0 || (pct ?? 0) > 0;
  const down = (delta ?? 0) < 0 || (pct ?? 0) < 0;
  return (
    <div className="flex flex-col gap-0.5">
      {delta != null ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
            up && "text-emerald-300",
            down && "text-amber-200",
            !up && !down && "text-white/55"
          )}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : down ? <ArrowDownRight className="h-3 w-3" /> : null}
          {fmtDelta(delta)}
        </span>
      ) : null}
      {pct != null ? (
        <span className={cn("text-[10px] tabular-nums", up ? "text-emerald-300/80" : down ? "text-amber-200/80" : "text-white/40")}>
          {pct > 0 ? "+" : ""}
          {pct.toFixed(2)}%
        </span>
      ) : null}
    </div>
  );
}

function DashWithReason({
  reason,
}: {
  reason: keyof typeof COMPARE_FIELD_REASON_LABELS | null;
}) {
  if (!reason) return <span className="text-white/35">—</span>;
  return (
    <span className="text-white/35" title={COMPARE_FIELD_REASON_LABELS[reason]}>
      —
    </span>
  );
}

const SORT_COLUMNS: Array<{ key: CompareSortKey; label: string; short?: string }> = [
  { key: "reach", label: "Reach" },
  { key: "views", label: "Views" },
  { key: "followers", label: "Followers" },
  { key: "engagement", label: "Eng. rate" },
  { key: "growth_rate", label: "Growth" },
  { key: "posting_frequency", label: "Posts/wk" },
  { key: "consistency", label: "Consistency" },
  { key: "top_post_engagement", label: "Top post", short: "Top" },
];

export function CompareModelsSection({
  rows,
  callouts = [],
  priorRange,
  loading = false,
  selectedModelId,
  onSelectModel,
}: CompareModelsSectionProps) {
  const [sortKey, setSortKey] = React.useState<CompareSortKey>("reach");
  const [sortAsc, setSortAsc] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    const ids = rows.map((r) => r.modelId);
    if (!ids.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      if (kept.length) return kept.slice(0, 6);
      return ids.slice(0, Math.min(3, ids.length));
    });
  }, [rows]);

  const sorted = React.useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      return sortAsc ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  const chartModels = React.useMemo(
    () => sorted.filter((r) => selectedIds.includes(r.modelId)),
    [sorted, selectedIds]
  );

  const chartData = React.useMemo(
    () => buildNormalizedCompareChartData(sorted, selectedIds, 6),
    [sorted, selectedIds]
  );

  function toggleModel(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  function onSortHeader(key: CompareSortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Hero strip */}
      <div className={cn(VA_CARD, VA_CARD_GLOW, "relative overflow-hidden p-4 md:p-5")}>
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 0% 0%, rgba(255,20,147,0.14), transparent 55%), radial-gradient(ellipse 50% 60% at 100% 0%, rgba(212,175,140,0.1), transparent 50%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/85">
              <GitCompareArrows className="h-3.5 w-3.5" />
              Compare models
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white md:text-xl">
              Side-by-side Instagram performance
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-white/45">
              All linked models with combined multi-account reach. Sort any column; chart normalizes
              metrics to 0–100 for fair comparison.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/35">Models</p>
            <p className="text-xl font-semibold tabular-nums text-white">
              <CountUp value={rows.length} />
            </p>
          </div>
        </div>
      </div>

      {/* Callouts */}
      {callouts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {callouts.map((c) => (
            <div
              key={`${c.kind}-${c.modelId}`}
              className={cn(
                VA_CARD,
                "flex gap-3 p-4 transition hover:border-white/15",
                c.kind === "improved"
                  ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                  : "border-amber-500/25 bg-amber-500/[0.06]"
              )}
            >
              {c.kind === "improved" ? (
                <ArrowUpRight className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              ) : (
                <ArrowDownRight className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  {c.kind === "improved" ? "Most improved" : "Needs attention"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/80">{c.message}</p>
                {c.deltaPct != null ? (
                  <p className="mt-1.5 text-xs tabular-nums text-white/50">
                    Δ {c.deltaPct > 0 ? "+" : ""}
                    {c.deltaPct.toFixed(1)}
                    {c.metric === "reach" ? "% reach vs prior period" : " pp growth rate vs prior"}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : rows.length <= 1 && !loading ? (
        <div className={cn(VA_CARD, "border border-dashed border-white/15 px-4 py-3 text-sm text-white/45")}>
          Period-over-period callouts need at least two linked models with prior-period data.
        </div>
      ) : null}

      {/* Normalized grouped bar chart */}
      <div className={cn(VA_CARD, "overflow-hidden p-4 md:p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SectionLabel>Metric comparison</SectionLabel>
            <StatInfoTooltip text="Pick up to 6 models. Each metric is normalized 0–100 against the best in the selection so scales are comparable." />
          </div>
          <p className="text-[11px] text-white/35">Normalized 0–100 scale</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {sorted.map((row) => {
            const on = selectedIds.includes(row.modelId);
            const colorIdx = chartModels.findIndex((m) => m.modelId === row.modelId);
            return (
              <button
                key={row.modelId}
                type="button"
                onClick={() => toggleModel(row.modelId)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                  on
                    ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FFB6DE]"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                )}
              >
                {on ? (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: COMPARE_COLORS[colorIdx % COMPARE_COLORS.length] }}
                  />
                ) : null}
                {row.modelName}
              </button>
            );
          })}
        </div>
        <div className="mt-4 h-72 w-full">
          {!chartData.length || !chartModels.length ? (
            <p className="flex h-full items-center justify-center text-sm text-white/35">
              Select at least one model to compare.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="metric"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value) => [`${Number(value ?? 0)}`, "Score"]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }} />
                {chartModels.map((m, i) => (
                  <Bar
                    key={m.modelId}
                    dataKey={m.modelName}
                    fill={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {sorted.map((row, idx) => (
          <div
            key={row.modelId}
            className={cn(
              VA_CARD,
              "p-4 transition",
              row.modelId === selectedModelId && "ring-1 ring-[#FF1493]/40"
            )}
          >
            <div className="flex items-center gap-3">
              <ModelAvatar name={row.modelName} rank={idx} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="truncate text-left font-semibold text-white hover:underline"
                  onClick={() => onSelectModel(row.modelId)}
                >
                  {row.modelName}
                </button>
                {(row.accountCount ?? 1) > 1 ? (
                  <span className="mt-0.5 inline-flex rounded-full border border-[#D4AF8C]/35 bg-[#D4AF8C]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#E8D0B0]">
                    {row.accountCount} IG accounts
                  </span>
                ) : null}
              </div>
              <span className="text-lg font-semibold tabular-nums text-white/30">#{idx + 1}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-white/35">Reach</dt>
                <dd className="font-medium tabular-nums text-white">
                  <CountUp value={row.reach} format={(n) => fmtNum(Math.round(n))} />
                </dd>
              </div>
              <div>
                <dt className="text-white/35">Views</dt>
                <dd className="font-medium tabular-nums text-white/80">
                  {row.views != null ? (
                    <CountUp value={row.views} format={(n) => fmtNum(Math.round(n))} />
                  ) : (
                    <DashWithReason reason={compareFieldReason(row, "views")} />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-white/35">Followers</dt>
                <dd className="font-medium tabular-nums text-white/80">
                  {row.follower_end != null ? (
                    <CountUp value={row.follower_end} format={(n) => fmtNum(Math.round(n))} />
                  ) : (
                    <DashWithReason reason={compareFieldReason(row, "follower_end")} />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-white/35">Engagement</dt>
                <dd className="font-medium tabular-nums text-[#D4AF8C]">
                  {row.avg_engagement_rate != null ? fmtPct(row.avg_engagement_rate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-white/35">Growth</dt>
                <dd>
                  <GrowthBadge delta={row.follower_delta} pct={row.growth_rate_pct} />
                </dd>
              </div>
              <div>
                <dt className="text-white/35">Posts/wk</dt>
                <dd className="font-medium tabular-nums text-white/75">
                  {row.posting_frequency != null ? (
                    row.posting_frequency.toFixed(1)
                  ) : (
                    <DashWithReason reason={compareFieldReason(row, "posting_frequency")} />
                  )}
                </dd>
              </div>
            </dl>
          </div>
        ))}
        {!sorted.length ? (
          <IgEmptyState
            title={loading ? "Loading comparison…" : "No comparison data"}
            detail="Link models with ClarioSuite IG IDs to compare reach, engagement, and growth."
          />
        ) : null}
      </div>

      {/* Desktop sortable table */}
      <div className={cn(VA_CARD, "hidden overflow-hidden md:block")}>
        <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#D4AF8C]" />
            <SectionLabel>Model leaderboard</SectionLabel>
            <StatInfoTooltip text={IG_STAT_INFO.comparison} />
          </div>
          {priorRange ? (
            <p className="text-[11px] text-white/35">
              Prior period {priorRange.startYmd} → {priorRange.endYmd}
            </p>
          ) : null}
        </div>
        {sorted.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="sticky left-0 z-10 bg-[#121218] px-4 py-3 font-medium">#</th>
                  <th className="sticky left-10 z-10 min-w-[180px] bg-[#121218] px-4 py-3 font-medium">
                    Model
                  </th>
                  {SORT_COLUMNS.map(({ key, label }) => (
                    <th key={key} className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => onSortHeader(key)}
                        className={cn(
                          "inline-flex items-center gap-1 transition hover:text-white",
                          sortKey === key ? "text-[#FFB6DE]" : "text-white/40"
                        )}
                      >
                        {label}
                        {sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, idx) => {
                  const selected = row.modelId === selectedModelId;
                  return (
                    <tr
                      key={row.modelId}
                      className={cn(
                        "group border-b border-white/5 transition hover:bg-white/[0.04]",
                        selected && "bg-[#FF1493]/[0.07]"
                      )}
                    >
                      <td className="sticky left-0 z-[1] bg-[#121218] px-4 py-3 tabular-nums text-white/40 group-hover:bg-[#16161c]">
                        {idx + 1}
                      </td>
                      <td className="sticky left-10 z-[1] bg-[#121218] px-4 py-3 group-hover:bg-[#16161c]">
                        <div className="flex items-center gap-2.5">
                          <ModelAvatar name={row.modelName} rank={idx} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              className={cn(
                                "block truncate font-medium hover:underline",
                                selected ? "text-[#FFB6DE]" : "text-white"
                              )}
                              onClick={() => onSelectModel(row.modelId)}
                            >
                              {row.modelName}
                            </button>
                            {(row.accountCount ?? 1) > 1 ? (
                              <span className="mt-0.5 inline-flex rounded-full border border-[#D4AF8C]/35 bg-[#D4AF8C]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#E8D0B0]">
                                {row.accountCount} IG
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-medium text-white">
                        <CountUp value={row.reach} format={(n) => fmtNum(Math.round(n))} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-white/80">
                        {row.views != null ? (
                          <CountUp value={row.views} format={(n) => fmtNum(Math.round(n))} />
                        ) : (
                          <DashWithReason reason={compareFieldReason(row, "views")} />
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-white/80">
                        {row.follower_end != null ? (
                          <CountUp value={row.follower_end} format={(n) => fmtNum(Math.round(n))} />
                        ) : (
                          <DashWithReason reason={compareFieldReason(row, "follower_end")} />
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#D4AF8C]">
                        {row.avg_engagement_rate != null ? fmtPct(row.avg_engagement_rate) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <GrowthBadge delta={row.follower_delta} pct={row.growth_rate_pct} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-white/75">
                        {row.posting_frequency != null ? (
                          row.posting_frequency.toFixed(1)
                        ) : (
                          <DashWithReason reason={compareFieldReason(row, "posting_frequency")} />
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-white/75">
                        {row.consistency_score != null ? (
                          Math.round(row.consistency_score)
                        ) : (
                          <DashWithReason reason={compareFieldReason(row, "consistency_score")} />
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-white/75">
                        {row.top_post_engagement != null ? (
                          fmtPct(row.top_post_engagement)
                        ) : (
                          <DashWithReason reason={compareFieldReason(row, "top_post_engagement")} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <IgEmptyState
            title={loading ? "Loading comparison…" : "No comparison data"}
            detail="Link more models with ClarioSuite IG IDs to compare reach, engagement, and growth."
          />
        )}
      </div>
    </div>
  );
}
