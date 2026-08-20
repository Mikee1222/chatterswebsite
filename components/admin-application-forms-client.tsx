"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Archive,
  Brain,
  ClipboardCopy,
  Copy,
  ExternalLink,
  FileText,
  HeartHandshake,
  Keyboard,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { CountUp, LuxuryStatCard, SectionLabel } from "@/components/infloww-performance-ui";
import { ApplyButton } from "@/components/application-ui-buttons";
import { ROUTES } from "@/lib/routes";
import {
  FORM_STATUS_LABELS,
  PIPELINE_STEP_LABELS,
  RESPONSE_STATUS_LABELS,
  emptyFunnel,
  type ApplicationFormListItem,
  type ApplicationFormStatus,
  type ApplicationFormsOverview,
  type PipelineStepType,
} from "@/lib/application-forms-types";
import {
  APPLY_CHART,
  APPLY_CHART_TOOLTIP,
  APPLY_EYEBROW,
  APPLY_SECTION,
  APPLY_INPUT,
  RESPONSE_STATUS_STYLE,
} from "@/lib/application-ui-tokens";
import { cn } from "@/lib/utils";

const RechartsArea = dynamic(
  () =>
    import("recharts").then((m) => {
      const {
        AreaChart,
        Area,
        XAxis,
        YAxis,
        Tooltip,
        ResponsiveContainer,
        CartesianGrid,
      } = m;
      function Chart({ data }: { data: { date: string; count: number }[] }) {
        return (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="applyVolFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={APPLY_CHART.primary} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={APPLY_CHART.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={APPLY_CHART.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: APPLY_CHART.tick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                width={28}
                tick={{ fill: APPLY_CHART.tick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={APPLY_CHART_TOOLTIP}
                labelFormatter={(l) => String(l)}
                formatter={(v) => [v as number, "Responses"]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={APPLY_CHART.primary}
                strokeWidth={2}
                fill="url(#applyVolFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      return Chart;
    }),
  { ssr: false },
);

const STATUS_STYLE: Record<ApplicationFormStatus, string> = {
  draft: "border-white/15 bg-white/5 text-white/60",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  closed: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

const PIPELINE_ICON: Record<
  PipelineStepType,
  { icon: typeof Brain; short: string; tone: string }
> = {
  cognitive_screening: {
    icon: Brain,
    short: "Cognitive",
    tone: "border-[#FF1493]/30 bg-[#FF1493]/10 text-[#FF1493]",
  },
  eq_screening: {
    icon: HeartHandshake,
    short: "EQ",
    tone: "border-[#D4AF8C]/35 bg-[#D4AF8C]/10 text-[#D4AF8C]",
  },
  typing_speed_test: {
    icon: Keyboard,
    short: "Typing",
    tone: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  },
  application_form: {
    icon: FileText,
    short: "Form",
    tone: "border-white/15 bg-white/5 text-white/65",
  },
};

const FUNNEL_STEPS = ["new", "reviewed", "shortlisted", "hired"] as const;

type Props = {
  initialForms: ApplicationFormListItem[];
  initialOverview: ApplicationFormsOverview;
  canManage: boolean;
};

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function trendDelta(last7: number, prev7: number): {
  label: string;
  tone: string;
  Icon: typeof TrendingUp;
} {
  if (last7 === 0 && prev7 === 0) {
    return { label: "No recent activity", tone: "text-white/40", Icon: Minus };
  }
  if (prev7 === 0) {
    return {
      label: `+${last7} this week`,
      tone: "text-emerald-300",
      Icon: TrendingUp,
    };
  }
  const pct = Math.round(((last7 - prev7) / prev7) * 100);
  if (pct > 0) {
    return { label: `+${pct}% vs prior week`, tone: "text-emerald-300", Icon: TrendingUp };
  }
  if (pct < 0) {
    return { label: `${pct}% vs prior week`, tone: "text-amber-200", Icon: TrendingDown };
  }
  return { label: "Flat vs prior week", tone: "text-white/45", Icon: Minus };
}

function publicUrl(slug: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${ROUTES.applyForm(slug)}`;
  }
  return ROUTES.applyForm(slug);
}

export function AdminApplicationFormsClient({
  initialForms,
  initialOverview,
  canManage,
}: Props) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [overview, setOverview] = useState(initialOverview);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const hasVolume = useMemo(
    () => overview.volume_by_day.some((d) => d.count > 0),
    [overview.volume_by_day],
  );

  const triageFormId = useMemo(() => {
    const withNew = [...forms]
      .filter((f) => (f.funnel?.new ?? 0) > 0)
      .sort((a, b) => (b.funnel?.new ?? 0) - (a.funnel?.new ?? 0));
    return withNew[0]?.id ?? null;
  }, [forms]);

  async function refreshOverview() {
    try {
      const res = await fetch("/api/admin/application-forms/overview");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.overview) setOverview(data.overview);
    } catch {
      /* keep SSR snapshot */
    }
  }

  async function createForm() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/application-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Create failed");
      toast.success("Form created");
      router.push(ROUTES.admin.applicationFormDetail(data.form.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteForm(id: string, formTitle: string) {
    if (!confirm(`Delete “${formTitle}”? All responses will be removed.`)) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/application-forms/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setForms((prev) => prev.filter((f) => f.id !== id));
      toast.success("Form deleted");
      void refreshOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionId(null);
    }
  }

  async function duplicateForm(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/application-forms/${id}/duplicate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Duplicate failed");
      toast.success("Form duplicated as draft");
      router.push(ROUTES.admin.applicationFormDetail(data.form.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
      setActionId(null);
    }
  }

  async function closeForm(form: ApplicationFormListItem) {
    if (form.status === "closed") return;
    if (!confirm(`Close “${form.title}”? Candidates will no longer be able to apply.`)) return;
    setActionId(form.id);
    try {
      const res = await fetch(`/api/admin/application-forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Close failed");
      setForms((prev) =>
        prev.map((f) =>
          f.id === form.id
            ? { ...f, status: "closed" as const, updated_at: data.form?.updated_at ?? f.updated_at }
            : f,
        ),
      );
      toast.success("Form closed");
      void refreshOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Close failed");
    } finally {
      setActionId(null);
    }
  }

  async function copyPublicLink(slug: string) {
    const url = publicUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1218] via-[#0D0B0D] to-[#120810] p-6 shadow-[0_24px_80px_-40px_rgba(255,20,147,0.35)] sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,20,147,0.28), transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(212,175,140,0.22), transparent 70%)",
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={APPLY_EYEBROW}>Recruitment · Pipeline</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Applications
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#B8B4B8]/70">
              Build custom application forms, share a public link, and manage every candidate
              from Cognitive → EQ → Typing → Form in one hub.
            </p>
          </div>
          {canManage && (
            <ApplyButton
              variant="adminChampagne"
              iconLeft={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => setCreating((v) => !v)}
              className="shrink-0"
            >
              New form
            </ApplyButton>
          )}
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
          <LuxuryStatCard
            label="In pipeline"
            value={<CountUp value={overview.total_candidates} />}
            accent="champagne"
            tooltip="Total candidates across all forms"
          />
          {triageFormId && overview.awaiting_review > 0 ? (
            <Link
              href={ROUTES.admin.applicationFormResponses(triageFormId)}
              className="block rounded-2xl outline-none ring-[#FF1493]/40 transition hover:brightness-110 focus-visible:ring-2"
            >
              <LuxuryStatCard
                label="Awaiting review"
                value={<CountUp value={overview.awaiting_review} />}
                accent="pink"
                glow
                hint={<span className="text-[#FF1493]/80">Review now →</span>}
                badge={<Users className="h-3.5 w-3.5 text-[#FF1493]/70" aria-hidden />}
              />
            </Link>
          ) : (
            <LuxuryStatCard
              label="Awaiting review"
              value={<CountUp value={overview.awaiting_review} />}
              accent="pink"
            />
          )}
          <LuxuryStatCard
            label="Hired this month"
            value={<CountUp value={overview.hired_this_month} />}
            accent="emerald"
            hint={`Quarter: ${overview.hired_this_quarter}`}
          />
          <LuxuryStatCard
            label="Avg cognitive"
            value={
              overview.avg_cognitive_percentile != null ? (
                <CountUp
                  value={overview.avg_cognitive_percentile}
                  format={(n) => `${n.toFixed(1)}%`}
                />
              ) : (
                "—"
              )
            }
            accent="pink"
            tooltip="Average cognitive percentile across all completed screenings"
          />
          <LuxuryStatCard
            label="Avg EQ"
            value={
              overview.avg_eq_score != null ? (
                <CountUp value={overview.avg_eq_score} format={(n) => n.toFixed(1)} />
              ) : (
                "—"
              )
            }
            accent="champagne"
            tooltip="Average EQ score (0–100) across all completed screenings"
          />
          <LuxuryStatCard
            label="Most active"
            value={
              overview.most_active_form ? (
                <span className="block truncate text-lg sm:text-xl">
                  {overview.most_active_form.title}
                </span>
              ) : (
                "—"
              )
            }
            accent="white"
            hint={
              overview.most_active_form
                ? `${overview.most_active_form.response_count} responses`
                : "No responses yet"
            }
          />
        </div>
      </div>

      {creating && canManage && (
        <div className={cn(APPLY_SECTION, "mt-6 p-5")}>
          <label className="block text-xs font-medium uppercase tracking-wider text-white/45">
            Form title
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chatter application 2026"
              className={cn(APPLY_INPUT, "h-11 min-h-0 flex-1 py-2.5")}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createForm();
              }}
            />
            <ApplyButton
              variant="adminChampagne"
              loading={busy}
              onClick={() => void createForm()}
              className="sm:w-auto"
            >
              {busy ? "Creating…" : "Create & edit"}
            </ApplyButton>
          </div>
        </div>
      )}

      {/* Volume + recent activity */}
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className={cn(APPLY_SECTION, "p-5 lg:col-span-3")}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionLabel>Volume · last 30 days</SectionLabel>
            <span className="text-[11px] text-white/35">
              {overview.published_count} published · {overview.draft_count} draft
              {overview.closed_count ? ` · ${overview.closed_count} closed` : ""}
            </span>
          </div>
          {hasVolume ? (
            <RechartsArea data={overview.volume_by_day} />
          ) : (
            <div className="flex h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-center">
              <p className="text-sm text-white/45">No submissions in the last 30 days</p>
              <p className="mt-1 text-xs text-white/30">
                Publish a form and share the public link to start the pipeline.
              </p>
            </div>
          )}
        </div>

        <div className={cn(APPLY_SECTION, "p-5 lg:col-span-2")}>
          <SectionLabel>Recent activity</SectionLabel>
          {overview.recent_activity.length === 0 ? (
            <p className="mt-6 text-center text-sm text-white/40">
              New applications will appear here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {overview.recent_activity.map((item) => (
                <li key={item.response_id}>
                  <Link
                    href={ROUTES.admin.applicationFormResponseDetail(
                      item.form_id,
                      item.response_id,
                    )}
                    className="group flex items-start gap-3 rounded-xl border border-transparent px-2 py-2 transition hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-[#D4AF8C]">
                      {item.candidate_label.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white group-hover:text-[#E8D0B0]">
                        {item.candidate_label}
                      </p>
                      <p className="truncate text-[11px] text-white/40">{item.form_title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                            RESPONSE_STATUS_STYLE[item.status],
                          )}
                        >
                          {RESPONSE_STATUS_LABELS[item.status]}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {formatRelative(item.submitted_at)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {overview.awaiting_review > 0 && (
            <p className="mt-4 text-center text-[11px] text-[#FF1493]/80">
              {overview.awaiting_review} awaiting review — open a form&apos;s Responses to triage
            </p>
          )}
        </div>
      </div>

      {/* Form cards */}
      <div className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <SectionLabel>Forms</SectionLabel>
            <p className="mt-1 text-sm text-white/45">
              {forms.length} form{forms.length === 1 ? "" : "s"} in your recruitment library
            </p>
          </div>
        </div>

        {forms.length === 0 ? (
          <div
            className={cn(
              APPLY_SECTION,
              "flex flex-col items-center px-6 py-16 text-center",
            )}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF8C]/25 bg-[#D4AF8C]/10 text-[#D4AF8C]">
              <FileText className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">No forms yet</h2>
            <p className="mt-2 max-w-md text-sm text-white/45">
              Create your first recruitment form, publish it, then copy the public link to share
              with candidates.
            </p>
            {canManage && (
              <ApplyButton
                variant="adminChampagne"
                className="mt-5"
                iconLeft={<Plus className="h-4 w-4" aria-hidden />}
                onClick={() => setCreating(true)}
              >
                Create first form
              </ApplyButton>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {forms.map((form) => {
              const funnel = form.funnel ?? emptyFunnel();
              const trend = trendDelta(form.responses_last_7d, form.responses_prev_7d);
              const TrendIcon = trend.Icon;
              const enabledSteps = (form.pipeline_config ?? [])
                .filter((s) => s.enabled)
                .sort((a, b) => a.order - b.order);
              const busyRow = actionId === form.id;
              const showFunnel = form.response_count > 0;

              return (
                <article
                  key={form.id}
                  className={cn(
                    APPLY_SECTION,
                    "group p-5 transition duration-200 hover:border-[#D4AF8C]/25 hover:shadow-[0_16px_48px_-24px_rgba(255,20,147,0.25)]",
                  )}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={ROUTES.admin.applicationFormDetail(form.id)}
                          className="truncate text-lg font-semibold text-white transition hover:text-[#E8D0B0]"
                        >
                          {form.title}
                        </Link>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            STATUS_STYLE[form.status],
                          )}
                        >
                          {FORM_STATUS_LABELS[form.status]}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                        <span className="font-mono text-white/50">/apply/{form.slug}</span>
                        <span>
                          {form.response_count} response
                          {form.response_count === 1 ? "" : "s"}
                        </span>
                        <span className={cn("inline-flex items-center gap-1", trend.tone)}>
                          <TrendIcon className="h-3 w-3" aria-hidden />
                          {trend.label}
                        </span>
                        <span>
                          Created {new Date(form.created_at).toLocaleDateString()}
                        </span>
                        <span>
                          Edited {formatRelative(form.updated_at)}
                        </span>
                      </div>

                      {/* Pipeline badges */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {enabledSteps.map((step) => {
                          const meta = PIPELINE_ICON[step.step];
                          const Icon = meta.icon;
                          return (
                            <span
                              key={step.step}
                              title={PIPELINE_STEP_LABELS[step.step]}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium",
                                meta.tone,
                              )}
                            >
                              <Icon className="h-3 w-3" aria-hidden />
                              {meta.short}
                            </span>
                          );
                        })}
                      </div>

                      {/* Funnel mini-stats */}
                      {showFunnel && (
                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                          {FUNNEL_STEPS.map((status, i) => (
                            <div key={status} className="flex items-center gap-1.5">
                              {i > 0 && (
                                <span className="text-[10px] text-white/20" aria-hidden>
                                  →
                                </span>
                              )}
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] tabular-nums",
                                  RESPONSE_STATUS_STYLE[status],
                                )}
                              >
                                <span className="opacity-70">
                                  {RESPONSE_STATUS_LABELS[status]}
                                </span>
                                <span className="font-semibold">{funnel[status]}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {form.status === "published" && form.response_count === 0 && (
                        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.06] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-[#E8D0B0]/80">
                            Form is live — share the public link to start collecting candidates.
                          </p>
                          <ApplyButton
                            variant="adminSecondary"
                            className="shrink-0"
                            iconLeft={<ClipboardCopy className="h-3.5 w-3.5" aria-hidden />}
                            onClick={() => void copyPublicLink(form.slug)}
                          >
                            Copy public link
                          </ApplyButton>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 lg:max-w-[280px] lg:justify-end">
                      <Link
                        href={ROUTES.admin.applicationFormResponses(form.id)}
                        className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:border-white/20 hover:text-white"
                      >
                        Responses
                        {form.funnel?.new ? (
                          <span className="ml-1.5 inline-flex rounded-full bg-[#FF1493]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#FF1493]">
                            {form.funnel.new}
                          </span>
                        ) : null}
                      </Link>
                      <Link
                        href={ROUTES.admin.applicationFormDetail(form.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-[#D4AF8C]/50 bg-gradient-to-br from-[#E8D0B0] to-[#D4AF8C] px-3 py-2 text-xs font-semibold text-[#0D0B0D] shadow-[0_6px_20px_-8px_rgba(212,175,140,0.45)] transition hover:brightness-105"
                      >
                        Edit
                      </Link>
                      {form.status === "published" && (
                        <>
                          <a
                            href={ROUTES.applyForm(form.slug)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:border-[#D4AF8C]/35 hover:text-[#D4AF8C]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            Preview
                          </a>
                          <button
                            type="button"
                            onClick={() => void copyPublicLink(form.slug)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:border-white/20 hover:text-white"
                          >
                            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                            Copy link
                          </button>
                        </>
                      )}
                      {canManage && (
                        <>
                          <button
                            type="button"
                            disabled={busyRow}
                            onClick={() => void duplicateForm(form.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            Duplicate
                          </button>
                          {form.status !== "closed" && (
                            <button
                              type="button"
                              disabled={busyRow}
                              onClick={() => void closeForm(form)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200/80 transition hover:bg-amber-500/10 disabled:opacity-40"
                            >
                              <Archive className="h-3.5 w-3.5" aria-hidden />
                              Close
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyRow}
                            onClick={() => void deleteForm(form.id, form.title)}
                            className="rounded-xl border border-red-500/20 p-2 text-red-300/70 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"
                            aria-label="Delete form"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
