"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { CountUp, LuxuryStatCard, SectionLabel } from "@/components/infloww-performance-ui";
import { ROUTES } from "@/lib/routes";
import {
  APPLICATION_RESPONSE_STATUSES,
  RESPONSE_STATUS_LABELS,
  type ApplicationFormAnalytics,
  type ApplicationFormResponseWithAnswers,
  type ApplicationFormWithQuestions,
  type ApplicationResponseStatus,
} from "@/lib/application-forms-types";

const BORDER = "rgba(255,255,255,0.08)";
const GOLD = "#D4AF8C";

const RechartsBar = dynamic(
  () =>
    import("recharts").then((m) => {
      const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
      function Chart({
        data,
        dataKey,
        nameKey,
      }: {
        data: { label: string; count: number }[];
        dataKey: string;
        nameKey: string;
      }) {
        return (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey={nameKey} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#141214",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey={dataKey} fill="#D4AF8C" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      return Chart;
    }),
  { ssr: false },
);

const STATUS_STYLE: Record<ApplicationResponseStatus, string> = {
  new: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  reviewed: "border-white/15 bg-white/5 text-white/65",
  shortlisted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-300",
  hired: "border-[#D4AF8C]/40 bg-[#D4AF8C]/15 text-[#E8D0B0]",
};

type Props = {
  form: ApplicationFormWithQuestions;
  canManage: boolean;
};

export function AdminApplicationResponsesClient({ form, canManage }: Props) {
  const [responses, setResponses] = useState<ApplicationFormResponseWithAnswers[]>([]);
  const [analytics, setAnalytics] = useState<ApplicationFormAnalytics | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<
    "newest" | "oldest" | "cognitive_desc" | "cognitive_asc" | "eq_desc" | "eq_asc"
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

  function previewAnswer(r: ApplicationFormResponseWithAnswers): string {
    const first = r.answers.find((a) => (a.answer_text ?? "").trim());
    return first?.answer_text?.trim() || "—";
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
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-white/75 hover:text-white"
          style={{ borderColor: BORDER }}
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
          accent="emerald"
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
          accent="pink"
        />
        <LuxuryStatCard
          label="Shortlisted"
          value={<CountUp value={analytics?.by_status.shortlisted ?? 0} />}
          accent="white"
        />
      </div>

      {(analytics?.volume_by_day.length || funnel.some((f) => f.count > 0)) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
          >
            <p className="mb-3 text-xs uppercase tracking-wider text-white/40">Volume over time</p>
            {analytics && analytics.volume_by_day.length > 0 ? (
              <RechartsBar
                data={analytics.volume_by_day.map((d) => ({ label: d.date, count: d.count }))}
                dataKey="count"
                nameKey="label"
              />
            ) : (
              <p className="py-10 text-center text-sm text-white/35">No submissions yet</p>
            )}
          </div>
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
          >
            <p className="mb-3 text-xs uppercase tracking-wider text-white/40">Pipeline funnel</p>
            <RechartsBar data={funnel} dataKey="count" nameKey="label" />
          </div>
        </div>
      )}

      {analytics &&
        (analytics.cognitive_score_distribution.some((b) => b.count > 0) ||
          analytics.eq_score_distribution.some((b) => b.count > 0)) && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
            >
              <p className="mb-3 text-xs uppercase tracking-wider text-white/40">
                Cognitive percentile distribution
              </p>
              <RechartsBar
                data={analytics.cognitive_score_distribution.map((d) => ({
                  label: d.bucket,
                  count: d.count,
                }))}
                dataKey="count"
                nameKey="label"
              />
            </div>
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
            >
              <p className="mb-3 text-xs uppercase tracking-wider text-white/40">
                EQ score distribution
              </p>
              <RechartsBar
                data={analytics.eq_score_distribution.map((d) => ({
                  label: d.bucket,
                  count: d.count,
                }))}
                dataKey="count"
                nameKey="label"
              />
            </div>
          </div>
        )}

      {analytics && analytics.choice_distributions.length > 0 && (
        <div className="mt-6 space-y-4">
          <p className="text-xs uppercase tracking-wider text-white/40">Choice distributions</p>
          <div className="grid gap-4 md:grid-cols-2">
            {analytics.choice_distributions.map((dist) => (
              <div
                key={dist.question_id}
                className="rounded-2xl border p-4"
                style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
              >
                <p className="mb-3 line-clamp-2 text-sm text-white/80">{dist.question_text}</p>
                <RechartsBar data={dist.buckets} dataKey="count" nameKey="label" />
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
            className="h-11 w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] pl-9 pr-3 text-sm text-white placeholder:text-white/30"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-3 text-sm text-white/85"
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
                | "eq_asc",
            )
          }
          className="h-11 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-3 text-sm text-white/85"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="cognitive_desc">Cognitive %ile ↓</option>
          <option value="cognitive_asc">Cognitive %ile ↑</option>
          <option value="eq_desc">EQ score ↓</option>
          <option value="eq_asc">EQ score ↑</option>
        </select>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="py-12 text-center text-sm text-white/40">Loading…</p>
        ) : responses.length === 0 ? (
          <p
            className="rounded-2xl border border-dashed px-4 py-12 text-center text-sm text-white/40"
            style={{ borderColor: BORDER }}
          >
            No responses match your filters.
          </p>
        ) : (
          responses.map((r) => (
            <Link
              key={r.id}
              href={ROUTES.admin.applicationFormResponseDetail(form.id, r.id)}
              className="flex flex-col gap-2 rounded-2xl border p-4 transition hover:border-white/20 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: BORDER, background: "rgba(13,11,13,0.65)" }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-white/90">{previewAnswer(r)}</p>
                <p className="mt-1 text-xs text-white/40">
                  {new Date(r.submitted_at).toLocaleString()}
                  {canManage && r.respondent_ip ? ` · ${r.respondent_ip}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/55">
                  Cog{" "}
                  {r.cognitive?.percentile_at_time_of_completion != null
                    ? `${r.cognitive.percentile_at_time_of_completion}%ile`
                    : "—"}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/55">
                  EQ {r.eq?.overall_score != null ? r.eq.overall_score : "—"}
                </span>
                <span
                  className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status]}`}
                >
                  {RESPONSE_STATUS_LABELS[r.status]}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
