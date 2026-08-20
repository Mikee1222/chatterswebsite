"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminRowAvatar } from "@/components/admin-list-primitives";
import {
  CountUp,
  LuxuryStatCard,
  SectionLabel,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import { ROUTES } from "@/lib/routes";
import {
  APPLICATION_RESPONSE_STATUSES,
  RESPONSE_STATUS_LABELS,
  type ApplicationFormAnalytics,
  type ApplicationFormResponseWithAnswers,
  type ApplicationFormWithQuestions,
  type ApplicationResponseStatus,
} from "@/lib/application-forms-types";
import {
  APPLY_CHART,
  APPLY_CHART_TOOLTIP,
  RESPONSE_STATUS_STYLE,
} from "@/lib/application-ui-tokens";
import { VA_CARD, VA_FILTER_INPUT, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

const COGNITIVE_SCORE_TIP =
  "Cognitive percentile shows how this candidate compares to others who took the screening — this becomes more meaningful as more candidates apply";
const EQ_SCORE_TIP = "EQ score (0-100) from situational judgment scenarios";

const RESPONSE_STAT_CHIP =
  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium tabular-nums";

const RechartsBar = dynamic(
  () =>
    import("recharts").then((m) => {
      const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
      function Chart({
        data,
        dataKey,
        nameKey,
        fill = APPLY_CHART.primary,
      }: {
        data: { label: string; count: number }[];
        dataKey: string;
        nameKey: string;
        fill?: string;
      }) {
        return (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={APPLY_CHART.grid} vertical={false} />
              <XAxis
                dataKey={nameKey}
                tick={{ fill: APPLY_CHART.tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: APPLY_CHART.tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={APPLY_CHART_TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey={dataKey} fill={fill} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      return Chart;
    }),
  { ssr: false },
);

type Props = {
  form: ApplicationFormWithQuestions;
  canManage: boolean;
};

function candidateLabel(r: ApplicationFormResponseWithAnswers): string {
  const first = r.answers.find((a) => (a.answer_text ?? "").trim());
  return first?.answer_text?.trim() || "Candidate";
}

export function AdminApplicationResponsesClient({ form, canManage }: Props) {
  const [responses, setResponses] = useState<ApplicationFormResponseWithAnswers[]>([]);
  const [analytics, setAnalytics] = useState<ApplicationFormAnalytics | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<
    | "newest"
    | "oldest"
    | "cognitive_desc"
    | "cognitive_asc"
    | "eq_desc"
    | "eq_asc"
    | "typing_desc"
    | "typing_asc"
  >("newest");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        sort,
        analytics: "1",
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(
        `/api/admin/application-forms/${form.id}/responses?${params.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setResponses(data.responses ?? []);
      setAnalytics(data.analytics ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [form.id, status, sort, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const funnel = useMemo(() => {
    if (!analytics) return [];
    return APPLICATION_RESPONSE_STATUSES.map((s) => ({
      label: RESPONSE_STATUS_LABELS[s],
      count: analytics.by_status[s],
    }));
  }, [analytics]);

  async function exportCsv() {
    try {
      const res = await fetch(`/api/admin/application-forms/${form.id}/responses/export`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.slug}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={ROUTES.admin.applicationFormDetail(form.id)}
            className="text-xs text-white/40 hover:text-white/70"
          >
            ← Back to builder
          </Link>
          <div className="mt-3">
            <SectionLabel>Responses</SectionLabel>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {form.title}
          </h1>
          <p className="mt-1 text-sm text-white/45">Pipeline, search, analytics, and CSV export.</p>
        </div>
        <button
          type="button"
          onClick={() => void exportCsv()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-white/75 transition hover:border-[#D4AF8C]/35 hover:text-[#D4AF8C]"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <LuxuryStatCard
          label="Total"
          value={<CountUp value={analytics?.total ?? 0} />}
          accent="champagne"
        />
        <LuxuryStatCard
          label="Avg cognitive %ile"
          value={
            analytics?.avg_cognitive_percentile != null ? (
              <CountUp
                value={analytics.avg_cognitive_percentile}
                format={(n) => n.toFixed(1)}
              />
            ) : (
              "—"
            )
          }
          accent="pink"
        />
        <LuxuryStatCard
          label="Avg EQ score"
          value={
            analytics?.avg_eq_score != null ? (
              <CountUp value={analytics.avg_eq_score} format={(n) => n.toFixed(1)} />
            ) : (
              "—"
            )
          }
          accent="champagne"
        />
        <LuxuryStatCard
          label="Shortlisted"
          value={<CountUp value={analytics?.by_status.shortlisted ?? 0} />}
          accent="pink"
        />
      </div>

      {(analytics?.volume_by_day.length || funnel.some((f) => f.count > 0)) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Volume over time
            </p>
            {analytics && analytics.volume_by_day.length > 0 ? (
              <RechartsBar
                data={analytics.volume_by_day.map((d) => ({ label: d.date, count: d.count }))}
                dataKey="count"
                nameKey="label"
                fill={APPLY_CHART.primary}
              />
            ) : (
              <p className="py-10 text-center text-sm text-white/35">No submissions yet</p>
            )}
          </div>
          <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Pipeline funnel
            </p>
            <RechartsBar
              data={funnel}
              dataKey="count"
              nameKey="label"
              fill={APPLY_CHART.secondary}
            />
          </div>
        </div>
      )}

      {analytics &&
        (analytics.cognitive_score_distribution.some((b) => b.count > 0) ||
          analytics.eq_score_distribution.some((b) => b.count > 0)) && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Cognitive percentile distribution
              </p>
              <RechartsBar
                data={analytics.cognitive_score_distribution.map((d) => ({
                  label: d.bucket,
                  count: d.count,
                }))}
                dataKey="count"
                nameKey="label"
                fill={APPLY_CHART.primary}
              />
            </div>
            <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                EQ score distribution
              </p>
              <RechartsBar
                data={analytics.eq_score_distribution.map((d) => ({
                  label: d.bucket,
                  count: d.count,
                }))}
                dataKey="count"
                nameKey="label"
                fill={APPLY_CHART.secondary}
              />
            </div>
          </div>
        )}

      {analytics && analytics.choice_distributions.length > 0 && (
        <div className="mt-6 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Choice distributions
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {analytics.choice_distributions.map((dist) => (
              <div
                key={dist.question_id}
                className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}
              >
                <p className="mb-3 line-clamp-2 text-sm text-white/80">{dist.question_text}</p>
                <RechartsBar
                  data={dist.buckets}
                  dataKey="count"
                  nameKey="label"
                  fill={APPLY_CHART.primary}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search answers…"
            className={cn(VA_FILTER_INPUT, "w-full pl-9")}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={VA_FILTER_INPUT}
        >
          <option value="all">All statuses</option>
          {APPLICATION_RESPONSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RESPONSE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) =>
            setSort(
              e.target.value as
                | "newest"
                | "oldest"
                | "cognitive_desc"
                | "cognitive_asc"
                | "eq_desc"
                | "eq_asc"
                | "typing_desc"
                | "typing_asc",
            )
          }
          className={VA_FILTER_INPUT}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="cognitive_desc">Cognitive %ile ↓</option>
          <option value="cognitive_asc">Cognitive %ile ↑</option>
          <option value="eq_desc">EQ score ↓</option>
          <option value="eq_asc">EQ score ↑</option>
          <option value="typing_desc">Typing WPM ↓</option>
          <option value="typing_asc">Typing WPM ↑</option>
        </select>
      </div>

      <div className="mt-4 space-y-2.5">
        {loading ? (
          <p className="py-12 text-center text-sm text-white/40">Loading…</p>
        ) : responses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-white/40">
            No responses match your filters.
          </p>
        ) : (
          responses.map((r) => {
            const name = candidateLabel(r);
            const cognitivePct = r.cognitive?.percentile_at_time_of_completion;
            const eqScore = r.eq?.overall_score;
            const typingWpm = r.typing?.wpm;
            const detailHref = ROUTES.admin.applicationFormResponseDetail(form.id, r.id);
            return (
              <div
                key={r.id}
                className={cn(
                  VA_CARD,
                  "relative flex flex-col gap-3 border border-white/10 bg-[#0D0B0D]/80 p-4 transition hover:border-[#FF1493]/25 sm:flex-row sm:items-center sm:justify-between",
                )}
              >
                <Link
                  href={detailHref}
                  className="absolute inset-0 z-0 rounded-[inherit]"
                  aria-label={`View response from ${name}`}
                />
                <div className="pointer-events-none relative z-[1] flex min-w-0 items-start gap-3">
                  <AdminRowAvatar name={name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white/90">{name}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {new Date(r.submitted_at).toLocaleString()}
                      {canManage && r.respondent_ip ? ` · ${r.respondent_ip}` : ""}
                    </p>
                  </div>
                </div>
                <div className="relative z-[1] flex flex-wrap items-center gap-2.5 sm:justify-end">
                  <span
                    className={cn(
                      RESPONSE_STAT_CHIP,
                      "pointer-events-none border-[#FF1493]/20 bg-[#FF1493]/10 text-[#FF1493]/90",
                    )}
                  >
                    Cognitive:{" "}
                    {cognitivePct != null ? `${cognitivePct}th percentile` : "Not completed"}
                    <span className="pointer-events-auto">
                      <StatInfoTooltip text={COGNITIVE_SCORE_TIP} />
                    </span>
                  </span>
                  <span
                    className={cn(
                      RESPONSE_STAT_CHIP,
                      "pointer-events-none border-[#D4AF8C]/25 bg-[#D4AF8C]/10 text-[#D4AF8C]",
                    )}
                  >
                    EQ: {eqScore != null ? `${eqScore}/100` : "Not completed"}
                    <span className="pointer-events-auto">
                      <StatInfoTooltip text={EQ_SCORE_TIP} />
                    </span>
                  </span>
                  {typingWpm != null ? (
                    <span
                      className={cn(
                        RESPONSE_STAT_CHIP,
                        "pointer-events-none border-white/10 bg-white/[0.04] text-white/70",
                      )}
                    >
                      Typing: {typingWpm} WPM
                      {r.typing?.accuracy_percent != null
                        ? ` · ${r.typing.accuracy_percent}%`
                        : ""}
                    </span>
                  ) : null}
                  <span
                    className="pointer-events-none hidden h-4 w-px shrink-0 bg-white/15 sm:block"
                    aria-hidden
                  />
                  <span
                    className={cn(
                      VA_STATUS_BADGE,
                      "pointer-events-none",
                      RESPONSE_STATUS_STYLE[r.status as ApplicationResponseStatus],
                    )}
                  >
                    {RESPONSE_STATUS_LABELS[r.status]}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
