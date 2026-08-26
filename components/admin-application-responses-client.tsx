"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Download, LayoutGrid, List, PartyPopper, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminRowAvatar } from "@/components/admin-list-primitives";
import {
  CountUp,
  LuxuryStatCard,
  SectionLabel,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import { ApplyButton } from "@/components/application-ui-buttons";
import { ApplicationFlagBadges } from "@/components/application-flag-badges";
import { ApplicationResponsesKanban } from "@/components/application-responses-kanban";
import {
  ApplicationHireCredentialsModal,
  hireCandidateRequest,
  type HireCredentialsPayload,
} from "@/components/application-hire-credentials-modal";
import { ROUTES } from "@/lib/routes";
import {
  APPLICATION_RESPONSE_STATUSES,
  RESPONSE_STATUS_LABELS,
  type ApplicationFormAnalytics,
  type ApplicationFormResponseWithAnswers,
  type ApplicationFormWithQuestions,
  type ApplicationResponseStatus,
} from "@/lib/application-forms-types";
import { APPLICATION_FLAG_FILTER_OPTIONS } from "@/lib/application-candidate-flags";
import { shortAiSummary } from "@/lib/application-ai-summary";
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

type ViewMode = "list" | "kanban";

function candidateLabel(r: ApplicationFormResponseWithAnswers): string {
  const first = r.answers.find((a) => (a.answer_text ?? "").trim());
  return first?.answer_text?.trim() || "Candidate";
}

function parseNum(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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
  const [flag, setFlag] = useState("");
  const [lang, setLang] = useState("all");
  const [cognitiveMin, setCognitiveMin] = useState("");
  const [cognitiveMax, setCognitiveMax] = useState("");
  const [eqMin, setEqMin] = useState("");
  const [eqMax, setEqMax] = useState("");
  const [wpmMin, setWpmMin] = useState("");
  const [wpmMax, setWpmMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(true);
  const [hireModal, setHireModal] = useState<{
    responseId: string;
    credentials: HireCredentialsPayload;
  } | null>(null);
  const [hiringId, setHiringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        sort,
        analytics: "1",
      });
      if (search.trim()) params.set("search", search.trim());
      if (flag) params.set("flag", flag);
      if (lang !== "all") params.set("lang", lang);
      const cMin = parseNum(cognitiveMin);
      const cMax = parseNum(cognitiveMax);
      const eMin = parseNum(eqMin);
      const eMax = parseNum(eqMax);
      const wMin = parseNum(wpmMin);
      const wMax = parseNum(wpmMax);
      if (cMin != null) params.set("cognitiveMin", String(cMin));
      if (cMax != null) params.set("cognitiveMax", String(cMax));
      if (eMin != null) params.set("eqMin", String(eMin));
      if (eMax != null) params.set("eqMax", String(eMax));
      if (wMin != null) params.set("wpmMin", String(wMin));
      if (wMax != null) params.set("wpmMax", String(wMax));
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

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
  }, [
    form.id,
    status,
    sort,
    search,
    flag,
    lang,
    cognitiveMin,
    cognitiveMax,
    eqMin,
    eqMax,
    wpmMin,
    wpmMax,
    dateFrom,
    dateTo,
  ]);

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

  async function patchStatus(responseId: string, next: ApplicationResponseStatus) {
    const res = await fetch(
      `/api/admin/application-forms/${form.id}/responses/${responseId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Update failed");
    setResponses((prev) =>
      prev.map((r) =>
        r.id === responseId
          ? { ...r, ...data.response, answers: r.answers, cognitive: r.cognitive, eq: r.eq, typing: r.typing, auto_flags: r.auto_flags, ai_summary: r.ai_summary }
          : r,
      ),
    );
  }

  async function handleHire(r: ApplicationFormResponseWithAnswers) {
    setHiringId(r.id);
    try {
      const result = await hireCandidateRequest(form.id, r.id);
      setResponses((prev) =>
        prev.map((row) =>
          row.id === r.id
            ? {
                ...row,
                status: "hired",
                generated_username: result.username,
                has_hire_password: true,
              }
            : row,
        ),
      );
      setHireModal({
        responseId: r.id,
        credentials: {
          username: result.username,
          password: result.password,
          created: result.created,
        },
      });
      toast.success(result.created ? "Hired — credentials ready" : "Credentials loaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hire failed");
    } finally {
      setHiringId(null);
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
          <p className="mt-1 text-sm text-white/45">
            Pipeline, filters, AI summaries, Kanban, and CSV export.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                viewMode === "list"
                  ? "bg-[#FF1493]/20 text-[#FF1493]"
                  : "text-white/50 hover:text-white/80",
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                viewMode === "kanban"
                  ? "bg-[#FF1493]/20 text-[#FF1493]"
                  : "text-white/50 hover:text-white/80",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
          </div>
          <ApplyButton
            variant="adminSecondary"
            iconLeft={<Download className="h-3.5 w-3.5" />}
            onClick={() => void exportCsv()}
          >
            Export CSV
          </ApplyButton>
        </div>
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

      <div className="mt-8 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
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
          <select value={flag} onChange={(e) => setFlag(e.target.value)} className={VA_FILTER_INPUT}>
            <option value="">All flags</option>
            {APPLICATION_FLAG_FILTER_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className={VA_FILTER_INPUT}>
            <option value="all">All languages</option>
            <option value="en">English</option>
            <option value="el">Greek</option>
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Cog min %"
              value={cognitiveMin}
              onChange={(e) => setCognitiveMin(e.target.value)}
              className={VA_FILTER_INPUT}
            />
            <input
              type="number"
              placeholder="Cog max %"
              value={cognitiveMax}
              onChange={(e) => setCognitiveMax(e.target.value)}
              className={VA_FILTER_INPUT}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="EQ min"
              value={eqMin}
              onChange={(e) => setEqMin(e.target.value)}
              className={VA_FILTER_INPUT}
            />
            <input
              type="number"
              placeholder="EQ max"
              value={eqMax}
              onChange={(e) => setEqMax(e.target.value)}
              className={VA_FILTER_INPUT}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="WPM min"
              value={wpmMin}
              onChange={(e) => setWpmMin(e.target.value)}
              className={VA_FILTER_INPUT}
            />
            <input
              type="number"
              placeholder="WPM max"
              value={wpmMax}
              onChange={(e) => setWpmMax(e.target.value)}
              className={VA_FILTER_INPUT}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={VA_FILTER_INPUT}
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={VA_FILTER_INPUT}
            />
          </div>
        </div>

        {viewMode === "list" ? (
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
            className={cn(VA_FILTER_INPUT, "max-w-xs")}
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
        ) : null}
      </div>

      {viewMode === "kanban" ? (
        loading ? (
          <p className="py-12 text-center text-sm text-white/40">Loading…</p>
        ) : (
          <ApplicationResponsesKanban
            formId={form.id}
            responses={responses}
            canManage={canManage}
            onStatusChange={patchStatus}
            onHired={(responseId, payload, response) => {
              const resp = response as ApplicationFormResponseWithAnswers | undefined;
              setResponses((prev) =>
                prev.map((r) =>
                  r.id === responseId
                    ? {
                        ...r,
                        ...(resp ?? {}),
                        status: "hired",
                        generated_username: payload.username,
                        has_hire_password: true,
                        answers: r.answers,
                        cognitive: r.cognitive,
                        eq: r.eq,
                        typing: r.typing,
                        auto_flags: resp?.auto_flags ?? r.auto_flags,
                        ai_summary: resp?.ai_summary ?? r.ai_summary,
                      }
                    : r,
                ),
              );
              setHireModal({ responseId, credentials: payload });
            }}
          />
        )
      ) : (
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
              const blurb = shortAiSummary(r.ai_summary, 140);
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
                        {r.preferred_language ? ` · ${r.preferred_language.toUpperCase()}` : ""}
                      </p>
                      <ApplicationFlagBadges
                        flags={r.auto_flags}
                        className="pointer-events-none mt-2"
                      />
                      {blurb ? (
                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-white/40">
                          {blurb}
                        </p>
                      ) : null}
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
                    {canManage ? (
                      <button
                        type="button"
                        disabled={hiringId === r.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleHire(r);
                        }}
                        className={cn(
                          "pointer-events-auto relative z-[2] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition",
                          r.status === "hired"
                            ? "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]"
                            : "border-[#D4AF8C]/40 bg-[#D4AF8C]/15 text-[#D4AF8C] hover:bg-[#D4AF8C]/25",
                        )}
                      >
                        <PartyPopper className="h-3 w-3" aria-hidden />
                        {r.status === "hired" && r.has_hire_password ? "Credentials" : "Hire"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {hireModal ? (
        <ApplicationHireCredentialsModal
          formId={form.id}
          responseId={hireModal.responseId}
          open
          credentials={hireModal.credentials}
          onClose={() => setHireModal(null)}
        />
      ) : null}
    </div>
  );
}
