"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarCheck,
  Paperclip,
  Plus,
} from "lucide-react";
import { DailyReviewFormFields, type DailyReviewFormState } from "@/components/daily-review-form-fields";
import {
  emptyExecAuditDraft,
  ExecAuditCard,
  type ExecAuditDraft,
} from "@/components/exec-audit-card";
import {
  ListPagination,
  useClientPagination,
} from "@/components/earnings-filter-list";
import {
  CountUp,
  LuxuryStatCard,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import {
  ReviewEmptyState,
  ReviewLoadingState,
  ReviewPageEyebrow,
  ReviewSectionHeader,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
  VA_MODEL_TAG,
} from "@/components/manager-review-ui";
import { useToast } from "@/contexts/toast-context";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { uploadFilesToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import { formatReviewDate, isoDateDaysAgo, todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { cn } from "@/lib/utils";
import type {
  MarketingDailyReview,
  MarketingDailyReviewDetail,
} from "@/services/marketing-reviews";
import { staffDisplayName, type StaffUserOption } from "@/components/staff-assignee-picker";

const API_BASE = "/api/daily-reviews";
const HISTORY_PAGE_SIZE = 12;

function localToast(id: string, title: string, body: string, priority: "normal" | "high") {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system" as const,
    event_type: "system_alert" as const,
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

function detailToFormState(review: MarketingDailyReviewDetail | null): DailyReviewFormState {
  return {
    kpis: review?.overall_kpis_reviewed ?? [],
    compliance: review?.account_compliance_vs_master ?? [],
    topPerformerId: review?.top_performer_id ?? "",
    issues: review?.issues_found ?? "",
    actions: review?.actions_assigned ?? "",
    timeSpent: review?.time_spent_minutes != null ? String(review.time_spent_minutes) : "",
  };
}

function detailToExecAudits(review: MarketingDailyReviewDetail | null): ExecAuditDraft[] {
  return (review?.exec_audits ?? []).map((a) => ({
    id: a.id,
    exec_va_id: a.exec_va_id,
    exec_va_name: a.exec_va_name,
    phase1_on_time: a.phase1_on_time,
    phase2_on_time: a.phase2_on_time,
    screenshots_authentic: a.screenshots_authentic,
    posting_compliance: a.posting_compliance,
    engagement_looks_real: a.engagement_looks_real,
    issues_found: a.issues_found,
    actions_taken: a.actions_taken,
  }));
}

type Props = {
  initialSubmissions: MarketingDailyReview[];
  todayReview: MarketingDailyReviewDetail | null;
  staffUsers: StaffUserOption[];
  roleLabels: Record<string, string>;
};

export function SupervisorDailyReviewClient({
  initialSubmissions,
  todayReview,
  staffUsers,
  roleLabels,
}: Props) {
  const { addToast } = useToast();
  const isSupabase = useIsSupabaseBackend();
  const [myReviews, setMyReviews] = React.useState(initialSubmissions);
  const [selectedDate, setSelectedDate] = React.useState(todayReviewIso());
  const [activeReview, setActiveReview] = React.useState<MarketingDailyReviewDetail | null>(todayReview);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [formState, setFormState] = React.useState<DailyReviewFormState>(() => detailToFormState(todayReview));
  const [execAudits, setExecAudits] = React.useState<ExecAuditDraft[]>(() => detailToExecAudits(todayReview));
  const [attachFiles, setAttachFiles] = React.useState<File[]>([]);

  function applyReviewToForm(review: MarketingDailyReviewDetail | null) {
    setFormState(detailToFormState(review));
    setExecAudits(detailToExecAudits(review));
    setAttachFiles([]);
  }

  async function loadDate(date: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}?date=${encodeURIComponent(date)}`);
      const data = (await res.json()) as { review?: MarketingDailyReview | null };
      if (!data.review) {
        setActiveReview(null);
        applyReviewToForm(null);
        return;
      }
      const detailRes = await fetch(`${API_BASE}/${data.review.id}`);
      const detailData = (await detailRes.json()) as { review?: MarketingDailyReviewDetail };
      const detail = detailData.review ?? null;
      setActiveReview(detail);
      applyReviewToForm(detail);
    } finally {
      setLoading(false);
    }
  }

  const selectedDateRef = React.useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  React.useEffect(() => {
    void loadDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  async function reloadHistory() {
    const res = await fetch(API_BASE);
    const data = (await res.json()) as { reviews?: MarketingDailyReview[] };
    if (res.ok) setMyReviews(data.reviews ?? []);
  }

  const reloadHistoryRef = React.useRef(reloadHistory);
  reloadHistoryRef.current = reloadHistory;

  useSupabaseRealtimeRefresh(
    ["marketing_daily_reviews"],
    () => {
      void reloadHistoryRef.current();
      void loadDate(selectedDateRef.current);
    },
    { debounceMs: 700 },
  );

  const stats = React.useMemo(() => {
    const weekFrom = isoDateDaysAgo(7);
    let withIssues = 0;
    let withAttachments = 0;
    let thisWeek = 0;
    for (const r of myReviews) {
      if (r.issues_found.trim()) withIssues += 1;
      if (r.attachments.length > 0) withAttachments += 1;
      if (r.review_date >= weekFrom) thisWeek += 1;
    }
    return {
      total: myReviews.length,
      withIssues,
      withAttachments,
      thisWeek,
    };
  }, [myReviews]);

  const pagination = useClientPagination(myReviews, HISTORY_PAGE_SIZE);
  React.useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReviews.length]);

  async function startReview() {
    setSaving(true);
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_date: selectedDate }),
      });
      const data = (await res.json()) as { review?: MarketingDailyReview; error?: string };
      if (res.status === 409) {
        await loadDate(selectedDate);
        await reloadHistory();
        addToast(
          localToast(
            `dr-dupe-${Date.now()}`,
            "Review already exists",
            `A review for ${formatReviewDate(selectedDate)} already exists — loaded it for editing.`,
            "normal",
          ),
        );
        return;
      }
      if (!res.ok || !data.review) {
        addToast(localToast(`dr-err-${Date.now()}`, "Failed", data.error ?? "Could not start review", "high"));
        return;
      }
      await loadDate(selectedDate);
      await reloadHistory();
      addToast(
        localToast(`dr-start-${Date.now()}`, "Review started", `Daily review for ${formatReviewDate(selectedDate)}`, "normal"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveReview() {
    if (!activeReview) return;
    setSaving(true);
    try {
      const topPerformer = staffUsers.find((v) => v.id === formState.topPerformerId);
      const res = await fetch(`${API_BASE}/${activeReview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overall_kpis_reviewed: formState.kpis,
          account_compliance_vs_master: formState.compliance,
          top_performer_id: formState.topPerformerId,
          top_performer_name: topPerformer ? staffDisplayName(topPerformer) : "",
          issues_found: formState.issues,
          actions_assigned: formState.actions,
          time_spent_minutes: formState.timeSpent ? Number(formState.timeSpent) : null,
        }),
      });
      if (!res.ok) {
        addToast(localToast(`dr-save-err-${Date.now()}`, "Failed", "Could not save review", "high"));
        return;
      }

      for (const audit of execAudits) {
        const payload = {
          exec_va_id: audit.exec_va_id,
          exec_va_name: audit.exec_va_name,
          reviewing_day: selectedDate,
          phase1_on_time: audit.phase1_on_time,
          phase2_on_time: audit.phase2_on_time,
          screenshots_authentic: audit.screenshots_authentic,
          posting_compliance: audit.posting_compliance,
          engagement_looks_real: audit.engagement_looks_real,
          issues_found: audit.issues_found,
          actions_taken: audit.actions_taken,
        };
        let auditRes: Response;
        if (audit.id) {
          auditRes = await fetch(`${API_BASE}/exec-audits/${audit.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else if (audit.exec_va_id) {
          auditRes = await fetch(`${API_BASE}/exec-audits`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, daily_review_id: activeReview.id }),
          });
        } else {
          continue;
        }
        if (!auditRes.ok) {
          addToast(
            localToast(`dr-audit-err-${Date.now()}`, "Failed", "Could not save one or more exec audits", "high"),
          );
          return;
        }
      }

      if (attachFiles.length > 0) {
        const fd = new FormData();
        if (isSupabase) {
          const uploaded = await uploadFilesToSupabaseStorage(attachFiles, "daily-review", {
            itemId: activeReview.id,
          });
          for (const u of uploaded) fd.append("attachment_url", u.sbUrl);
        } else {
          for (const f of attachFiles) fd.append("attachments", f);
        }
        const attachRes = await fetch(`${API_BASE}/${activeReview.id}/attachments`, {
          method: "POST",
          body: fd,
        });
        if (!attachRes.ok) {
          addToast(localToast(`dr-att-err-${Date.now()}`, "Failed", "Could not upload attachments", "high"));
          return;
        }
      }

      await loadDate(selectedDate);
      await reloadHistory();
      addToast(localToast(`dr-save-ok-${Date.now()}`, "Saved", "Daily review updated.", "normal"));
    } catch {
      addToast(localToast(`dr-save-err-${Date.now()}`, "Failed", "Could not save review", "high"));
    } finally {
      setSaving(false);
    }
  }

  const isToday = selectedDate === todayReviewIso();

  return (
    <div className="mx-auto max-w-3xl space-y-6 md:space-y-8">
      <div>
        <ReviewPageEyebrow>Supervision</ReviewPageEyebrow>
        <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">Daily Review</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">End-of-day marketing supervisor checklist</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <LuxuryStatCard
          label="My reviews"
          value={<CountUp value={stats.total} />}
          accent="white"
          tooltip="All of your submitted daily reviews"
          className="!p-3"
        />
        <LuxuryStatCard
          label="With issues"
          value={<CountUp value={stats.withIssues} />}
          accent="amber"
          tooltip="Reviews where you logged issues"
          className="!p-3"
        />
        <LuxuryStatCard
          label="Attachments"
          value={<CountUp value={stats.withAttachments} />}
          accent="champagne"
          tooltip="Reviews with supporting files"
          className="!p-3"
        />
        <LuxuryStatCard
          label="This week"
          value={<CountUp value={stats.thisWeek} />}
          accent="pink"
          tooltip="Your reviews from the last 7 days"
          className="!p-3"
          glow
        />
      </div>

      <section className={cn(VA_CARD, "flex flex-wrap items-end gap-3 p-4 md:gap-4 md:p-5")}>
        <label className="min-w-[10rem] flex-1 space-y-1.5 text-sm sm:flex-none">
          <span className="inline-flex items-center gap-1 text-[#B8B4B8]/60">
            Review date
            <StatInfoTooltip text="Pick a date to start or edit. Tap a history card below to reopen that day." />
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
          />
        </label>
        {isToday && !activeReview ? (
          <button
            type="button"
            onClick={() => void startReview()}
            disabled={saving}
            className={cn(VA_BTN_PRIMARY, "min-h-11")}
          >
            {saving ? "Starting…" : "Start today's review"}
          </button>
        ) : null}
      </section>

      {loading ? (
        <ReviewLoadingState />
      ) : !activeReview ? (
        <ReviewEmptyState
          icon={CalendarCheck}
          title={`No review for ${formatReviewDate(selectedDate)}`}
          description="Start a new review or pick another date from your history."
          action={
            <button
              type="button"
              onClick={() => void startReview()}
              disabled={saving}
              className={cn(VA_BTN_PRIMARY, "min-h-11")}
            >
              Start review for this date
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          <section className={cn(VA_CARD, "space-y-5 p-4 shadow-[0_0_20px_rgba(255,20,147,0.06)] md:p-5")}>
            <DailyReviewFormFields
              state={formState}
              staffUsers={staffUsers}
              roleLabels={roleLabels}
              managerName={activeReview.manager_name}
              reviewLabel={activeReview.review_label}
              showAttachments
              attachFiles={attachFiles}
              onToggleKpi={(kpi) =>
                setFormState((prev) => ({
                  ...prev,
                  kpis: prev.kpis.includes(kpi) ? prev.kpis.filter((k) => k !== kpi) : [...prev.kpis, kpi],
                }))
              }
              onToggleCompliance={(item) =>
                setFormState((prev) => ({
                  ...prev,
                  compliance: prev.compliance.includes(item)
                    ? prev.compliance.filter((k) => k !== item)
                    : [...prev.compliance, item],
                }))
              }
              onChange={(patch) => setFormState((prev) => ({ ...prev, ...patch }))}
              onAttachFiles={setAttachFiles}
            />
          </section>

          <section className="space-y-3">
            <ReviewSectionHeader
              action={
                <button
                  type="button"
                  onClick={() => setExecAudits((prev) => [...prev, emptyExecAuditDraft()])}
                  className={cn(VA_BTN_SECONDARY, "inline-flex min-h-10 items-center gap-1.5 py-2 text-xs")}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add VA audit
                </button>
              }
            >
              Per-exec audits
            </ReviewSectionHeader>
            {execAudits.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-[#B8B4B8]/45">
                No per-exec audits yet — add one to score VA compliance.
              </p>
            ) : (
              execAudits.map((audit, index) => (
                <ExecAuditCard
                  key={audit.id ?? `new-${index}`}
                  audit={audit}
                  index={index}
                  staffUsers={staffUsers}
                  roleLabels={roleLabels}
                  onChange={(patch) =>
                    setExecAudits((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
                  }
                  onDelete={() => setExecAudits((prev) => prev.filter((_, i) => i !== index))}
                />
              ))
            )}
          </section>

          <div className="flex justify-stretch sm:justify-end">
            <button
              type="button"
              onClick={() => void saveReview()}
              disabled={saving}
              className={cn(VA_BTN_PRIMARY, "min-h-11 w-full sm:w-auto")}
            >
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <ReviewSectionHeader>My review history</ReviewSectionHeader>
        {myReviews.length === 0 ? (
          <ReviewEmptyState
            icon={CalendarCheck}
            title="No past reviews yet"
            description="Completed reviews you submit will appear here. Tap a card later to reopen that day."
          />
        ) : (
          <div className="space-y-2">
            {pagination.pageItems.map((r) => {
              const selected = r.review_date === selectedDate;
              const hasIssues = Boolean(r.issues_found.trim());
              const hasAtt = r.attachments.length > 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedDate(r.review_date)}
                  className={cn(
                    "mr-finding-card va-card w-full rounded-2xl p-4 text-left transition duration-200 motion-reduce:transition-none active:bg-white/[0.04]",
                    selected && "ring-1 ring-[#FF1493]/35 shadow-[0_0_20px_rgba(255,20,147,0.08)]",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{r.review_label || formatReviewDate(r.review_date)}</p>
                    {hasIssues ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Issues
                      </span>
                    ) : null}
                    {hasAtt ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[#D4AF8C]/25 bg-[#D4AF8C]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]">
                        <Paperclip className="h-3 w-3" aria-hidden />
                        {r.attachments.length}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#B8B4B8]/50">
                    {formatReviewDate(r.review_date)}
                    {r.time_spent_minutes != null ? ` · ${r.time_spent_minutes} min` : ""}
                  </p>
                  {r.top_performer_name ? (
                    <span className={cn(VA_MODEL_TAG, "mt-2 inline-block")}>{r.top_performer_name}</span>
                  ) : null}
                  {r.issues_found ? (
                    <p className="mt-3 line-clamp-2 text-sm text-[#B8B4B8]/70">{r.issues_found}</p>
                  ) : null}
                </button>
              );
            })}
            <ListPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={HISTORY_PAGE_SIZE}
              onPageChange={pagination.setPage}
            />
          </div>
        )}
      </section>
    </div>
  );
}
