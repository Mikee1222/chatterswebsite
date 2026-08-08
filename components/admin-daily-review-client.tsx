"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
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
  InflowwCustomDateRange,
  LuxuryStatCard,
  StatInfoTooltip,
  toLocalYmd,
} from "@/components/infloww-performance-ui";
import {
  FilterBar,
  FilterChip,
  ManagerReviewSelect,
  QuickActionDelete,
  ReviewEmptyState,
  ReviewLoadingState,
  ReviewPageEyebrow,
  ReviewSectionHeader,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
  VA_MODEL_TAG,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import { useToast } from "@/contexts/toast-context";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { uploadFilesToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import { ROUTES } from "@/lib/routes";
import { formatReviewDate, isoDateDaysAgo, todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { cn } from "@/lib/utils";
import type {
  MarketingDailyReview,
  MarketingDailyReviewDetail,
} from "@/services/marketing-reviews";
import { staffDisplayName, type StaffUserOption } from "@/components/staff-assignee-picker";

const API_BASE = "/api/admin/marketing-reviews/daily-reviews";
const HISTORY_PAGE_SIZE = 12;

type DateRange = "all" | "7d" | "30d" | "custom";
type TriFilter = "" | "true" | "false";

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
  initialReviews: MarketingDailyReview[];
  todayReview: MarketingDailyReviewDetail | null;
  staffUsers: StaffUserOption[];
  roleLabels: Record<string, string>;
};

export function AdminDailyReviewClient({
  initialReviews,
  todayReview,
  staffUsers,
  roleLabels,
}: Props) {
  const { addToast } = useToast();
  const isSupabase = useIsSupabaseBackend();
  const [reviews, setReviews] = React.useState(initialReviews);
  const [selectedDate, setSelectedDate] = React.useState(todayReviewIso());
  const [focusManagerName, setFocusManagerName] = React.useState(todayReview?.manager_name ?? "");
  const [focusManagerId, setFocusManagerId] = React.useState(todayReview?.manager_id ?? "");
  const [activeReview, setActiveReview] = React.useState<MarketingDailyReviewDetail | null>(todayReview);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [deleteReviewId, setDeleteReviewId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [filterSupervisor, setFilterSupervisor] = React.useState("");
  const [filterDateRange, setFilterDateRange] = React.useState<DateRange>("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState(() => toLocalYmd(new Date()));
  const [filterDateTo, setFilterDateTo] = React.useState(() => toLocalYmd(new Date()));
  const [filterIssues, setFilterIssues] = React.useState<TriFilter>("");
  const [filterAttachment, setFilterAttachment] = React.useState<TriFilter>("");
  const [filterExecAudit, setFilterExecAudit] = React.useState<TriFilter>("");

  const [formState, setFormState] = React.useState<DailyReviewFormState>(() => detailToFormState(todayReview));
  const [execAudits, setExecAudits] = React.useState<ExecAuditDraft[]>(() => detailToExecAudits(todayReview));
  const [attachFiles, setAttachFiles] = React.useState<File[]>([]);

  const supervisorOptions = React.useMemo(() => {
    const names = new Set(reviews.map((r) => r.manager_name).filter(Boolean));
    if (filterSupervisor) names.add(filterSupervisor);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [reviews, filterSupervisor]);

  const supervisorFilterOptions = React.useMemo<CustomSelectOption[]>(
    () => [{ value: "", label: "All supervisors" }, ...supervisorOptions.map((name) => ({ value: name, label: name }))],
    [supervisorOptions],
  );
  const triOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "Any" },
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
    [],
  );

  const datePresetChips: { id: DateRange; label: string }[] = [
    { id: "all", label: "All time" },
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
    { id: "custom", label: "Custom" },
  ];

  function applyReviewToForm(review: MarketingDailyReviewDetail | null) {
    setFormState(detailToFormState(review));
    setExecAudits(detailToExecAudits(review));
    setAttachFiles([]);
  }

  async function loadDate(
    date: string,
    manager?: { name?: string; id?: string },
  ) {
    setLoading(true);
    try {
      const name = (manager?.name ?? focusManagerName).trim();
      const id = (manager?.id ?? focusManagerId).trim();
      const params = new URLSearchParams({ date });
      if (name) params.set("manager_name", name);
      if (id) params.set("manager_id", id);
      const res = await fetch(`${API_BASE}?${params}`);
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
      if (detail) {
        setFocusManagerName(detail.manager_name);
        setFocusManagerId(detail.manager_id);
      }
    } finally {
      setLoading(false);
    }
  }

  const selectedDateRef = React.useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const focusManagerNameRef = React.useRef(focusManagerName);
  focusManagerNameRef.current = focusManagerName;
  const focusManagerIdRef = React.useRef(focusManagerId);
  focusManagerIdRef.current = focusManagerId;

  React.useEffect(() => {
    void loadDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  async function reloadHistory() {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSupervisor) params.set("manager_name", filterSupervisor);
      if (filterDateRange === "7d") params.set("date_from", isoDateDaysAgo(7));
      if (filterDateRange === "30d") params.set("date_from", isoDateDaysAgo(30));
      if (filterDateRange === "custom") {
        if (filterDateFrom) params.set("date_from", filterDateFrom);
        if (filterDateTo) params.set("date_to", filterDateTo);
      }
      if (filterIssues) params.set("has_issues", filterIssues);
      if (filterAttachment) params.set("has_attachment", filterAttachment);
      if (filterExecAudit) params.set("exec_audit_complete", filterExecAudit);
      const res = await fetch(`${API_BASE}?${params}`);
      const data = (await res.json()) as { reviews?: MarketingDailyReview[] };
      if (res.ok) setReviews(data.reviews ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }

  React.useEffect(() => {
    void reloadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterSupervisor,
    filterDateRange,
    filterDateFrom,
    filterDateTo,
    filterIssues,
    filterAttachment,
    filterExecAudit,
  ]);

  const reloadHistoryRef = React.useRef(reloadHistory);
  reloadHistoryRef.current = reloadHistory;

  useSupabaseRealtimeRefresh(
    ["marketing_daily_reviews"],
    () => {
      void reloadHistoryRef.current();
      void loadDate(selectedDateRef.current, {
        name: focusManagerNameRef.current,
        id: focusManagerIdRef.current,
      });
    },
    { debounceMs: 700 },
  );

  const stats = React.useMemo(() => {
    const weekFrom = isoDateDaysAgo(7);
    let withIssues = 0;
    let withAttachments = 0;
    let thisWeek = 0;
    for (const r of reviews) {
      if (r.issues_found.trim()) withIssues += 1;
      if (r.attachments.length > 0) withAttachments += 1;
      if (r.review_date >= weekFrom) thisWeek += 1;
    }
    return {
      total: reviews.length,
      withIssues,
      withAttachments,
      thisWeek,
    };
  }, [reviews]);

  const pagination = useClientPagination(reviews, HISTORY_PAGE_SIZE);
  React.useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterSupervisor,
    filterDateRange,
    filterDateFrom,
    filterDateTo,
    filterIssues,
    filterAttachment,
    filterExecAudit,
    reviews.length,
  ]);

  const hasFilters =
    Boolean(filterSupervisor) ||
    filterDateRange !== "all" ||
    Boolean(filterIssues) ||
    Boolean(filterAttachment) ||
    Boolean(filterExecAudit);

  function clearFilters() {
    setFilterSupervisor("");
    setFilterDateRange("all");
    setFilterDateFrom(toLocalYmd(new Date()));
    setFilterDateTo(toLocalYmd(new Date()));
    setFilterIssues("");
    setFilterAttachment("");
    setFilterExecAudit("");
  }

  function openHistoryReview(r: MarketingDailyReview) {
    const sameDate = r.review_date === selectedDate;
    setFocusManagerName(r.manager_name);
    setFocusManagerId(r.manager_id);
    if (sameDate) {
      void loadDate(r.review_date, { name: r.manager_name, id: r.manager_id });
    } else {
      setSelectedDate(r.review_date);
    }
  }

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
        const existing = data.review;
        if (existing) {
          setFocusManagerName(existing.manager_name);
          setFocusManagerId(existing.manager_id);
        }
        await loadDate(selectedDate, existing
          ? { name: existing.manager_name, id: existing.manager_id }
          : undefined);
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
      setFocusManagerName(data.review.manager_name);
      setFocusManagerId(data.review.manager_id);
      await loadDate(selectedDate, {
        name: data.review.manager_name,
        id: data.review.manager_id,
      });
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
          auditRes = await fetch(`/api/admin/marketing-reviews/exec-audits/${audit.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else if (audit.exec_va_id) {
          auditRes = await fetch("/api/admin/marketing-reviews/exec-audits", {
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

      await loadDate(selectedDate, {
        name: activeReview.manager_name,
        id: activeReview.manager_id,
      });
      await reloadHistory();
      addToast(localToast(`dr-save-ok-${Date.now()}`, "Saved", "Daily review updated.", "normal"));
    } catch {
      addToast(localToast(`dr-save-err-${Date.now()}`, "Failed", "Could not save review", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteExecAuditById(auditId: string) {
    await fetch(`/api/admin/marketing-reviews/exec-audits/${auditId}`, { method: "DELETE" });
    setExecAudits((prev) => prev.filter((a) => a.id !== auditId));
  }

  async function confirmDeleteReview() {
    if (!deleteReviewId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/${deleteReviewId}`, { method: "DELETE" });
      if (!res.ok) {
        addToast(localToast(`dr-del-err-${Date.now()}`, "Failed", "Could not delete review", "high"));
        return;
      }
      if (activeReview?.id === deleteReviewId) {
        setActiveReview(null);
        applyReviewToForm(null);
      }
      await reloadHistory();
      addToast(localToast(`dr-del-ok-${Date.now()}`, "Deleted", "Daily review removed.", "normal"));
    } finally {
      setDeleting(false);
      setDeleteReviewId(null);
    }
  }

  const isToday = selectedDate === todayReviewIso();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <ReviewPageEyebrow>Manager review</ReviewPageEyebrow>
          <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">Daily review</h1>
          <p className="mt-1 text-sm text-[#B8B4B8]/60">
            Manage supervisor end-of-day checklists across the team
          </p>
        </div>
        <Link
          href={ROUTES.admin.spotChecks}
          className={cn(VA_BTN_SECONDARY, "min-h-11 px-4 py-2.5 text-sm")}
        >
          ← Spot checks
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <LuxuryStatCard
          label="Total reviews"
          value={<CountUp value={stats.total} />}
          accent="white"
          tooltip="Reviews matching the current history filters"
          className="!p-3"
        />
        <LuxuryStatCard
          label="With issues"
          value={<CountUp value={stats.withIssues} />}
          accent="amber"
          tooltip="Reviews that recorded issues found"
          className="!p-3"
        />
        <LuxuryStatCard
          label="With attachments"
          value={<CountUp value={stats.withAttachments} />}
          accent="champagne"
          tooltip="Reviews that include supporting files"
          className="!p-3"
        />
        <LuxuryStatCard
          label="This week"
          value={<CountUp value={stats.thisWeek} />}
          accent="pink"
          tooltip="Reviews dated in the last 7 days (within current filters)"
          className="!p-3"
          glow
        />
      </div>

      <section className={cn(VA_CARD, "flex flex-wrap items-end gap-3 p-4 md:gap-4 md:p-5")}>
        <label className="min-w-[10rem] flex-1 space-y-1.5 text-sm sm:flex-none">
          <span className="inline-flex items-center gap-1 text-[#B8B4B8]/60">
            Review date
            <StatInfoTooltip text="Pick a date, then start or edit that day's review. History cards also jump here." />
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
          />
        </label>
        {focusManagerName ? (
          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            <span className="text-[#B8B4B8]/60">Focused supervisor</span>
            <p className="truncate rounded-xl border border-[#D4AF8C]/25 bg-[#D4AF8C]/10 px-3 py-2.5 text-sm text-[#D4AF8C]">
              {focusManagerName}
            </p>
          </div>
        ) : null}
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
        {activeReview ? (
          <QuickActionDelete
            onClick={() => setDeleteReviewId(activeReview.id)}
            className="min-h-11 px-4 py-2.5 text-sm"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete review
          </QuickActionDelete>
        ) : null}
      </section>

      {loading ? (
        <ReviewLoadingState />
      ) : !activeReview ? (
        <ReviewEmptyState
          icon={CalendarCheck}
          title={`No review for ${formatReviewDate(selectedDate)}`}
          description={
            focusManagerName
              ? `No daily review found for ${focusManagerName} on this date.`
              : "Start a new review or open one from history below."
          }
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
          <div className={cn(VA_CARD, "space-y-5 p-4 shadow-[0_0_20px_rgba(255,20,147,0.06)] md:p-5")}>
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
          </div>

          <div className="space-y-3">
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
                  onDelete={() => {
                    if (audit.id) void deleteExecAuditById(audit.id);
                    else setExecAudits((prev) => prev.filter((_, i) => i !== index));
                  }}
                />
              ))
            )}
          </div>

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

      <div className="space-y-4">
        <ReviewSectionHeader
          action={
            hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-10 px-2 text-xs text-[#D4AF8C]/80 active:text-[#D4AF8C]"
              >
                Clear filters
              </button>
            ) : null
          }
        >
          Review history
        </ReviewSectionHeader>

        <FilterBar className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {datePresetChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterDateRange(chip.id)}
                className={cn(
                  "min-h-10 rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-200 motion-reduce:transition-none",
                  filterDateRange === chip.id
                    ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FF1493] shadow-[0_0_24px_-8px_rgba(255,20,147,0.55)]"
                    : "border-white/10 bg-white/5 text-white/60 active:border-white/20 active:text-white",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {filterDateRange === "custom" ? (
            <InflowwCustomDateRange
              startYmd={filterDateFrom}
              endYmd={filterDateTo}
              className="border-0 bg-transparent p-0 shadow-none"
              onChange={(start, end) => {
                setFilterDateFrom(start);
                setFilterDateTo(end);
              }}
              onApply={(start, end) => {
                setFilterDateFrom(start);
                setFilterDateTo(end);
              }}
            />
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-[#B8B4B8]/60">
              <span className="inline-flex items-center gap-1">
                Supervisor
                <StatInfoTooltip text="Filter history by the supervisor who submitted the review." />
              </span>
              <ManagerReviewSelect
                value={filterSupervisor}
                onChange={setFilterSupervisor}
                options={supervisorFilterOptions}
                triggerClassName="min-h-11 min-w-[10rem]"
              />
            </label>
            <label className="space-y-1 text-xs text-[#B8B4B8]/60">
              <span className="inline-flex items-center gap-1">
                Has issues
                <StatInfoTooltip text="Only show reviews with (or without) issues recorded." />
              </span>
              <ManagerReviewSelect
                value={filterIssues}
                onChange={(v) => setFilterIssues(v as TriFilter)}
                options={triOptions}
                triggerClassName="min-h-11 min-w-[7.5rem]"
              />
            </label>
            <label className="space-y-1 text-xs text-[#B8B4B8]/60">
              <span className="inline-flex items-center gap-1">
                Attachments
                <StatInfoTooltip text="Filter by whether supporting files were uploaded." />
              </span>
              <ManagerReviewSelect
                value={filterAttachment}
                onChange={(v) => setFilterAttachment(v as TriFilter)}
                options={triOptions}
                triggerClassName="min-h-11 min-w-[7.5rem]"
              />
            </label>
            <label className="space-y-1 text-xs text-[#B8B4B8]/60">
              <span className="inline-flex items-center gap-1">
                Exec audits
                <StatInfoTooltip text="Complete = at least one VA audit with checklist answers filled in." />
              </span>
              <ManagerReviewSelect
                value={filterExecAudit}
                onChange={(v) => setFilterExecAudit(v as TriFilter)}
                options={[
                  { value: "", label: "Any" },
                  { value: "true", label: "Complete" },
                  { value: "false", label: "Incomplete" },
                ]}
                triggerClassName="min-h-11 min-w-[8.5rem]"
              />
            </label>
          </div>
        </FilterBar>

        {hasFilters ? (
          <div className="flex flex-wrap gap-2">
            {filterSupervisor ? (
              <FilterChip label={`Supervisor: ${filterSupervisor}`} onRemove={() => setFilterSupervisor("")} />
            ) : null}
            {filterDateRange === "7d" ? (
              <FilterChip label="Last 7 days" onRemove={() => setFilterDateRange("all")} />
            ) : null}
            {filterDateRange === "30d" ? (
              <FilterChip label="Last 30 days" onRemove={() => setFilterDateRange("all")} />
            ) : null}
            {filterDateRange === "custom" && (filterDateFrom || filterDateTo) ? (
              <FilterChip
                label={`${filterDateFrom || "…"} → ${filterDateTo || "…"}`}
                onRemove={() => {
                  setFilterDateRange("all");
                  setFilterDateFrom(toLocalYmd(new Date()));
                  setFilterDateTo(toLocalYmd(new Date()));
                }}
              />
            ) : null}
            {filterIssues === "true" ? (
              <FilterChip label="Has issues" onRemove={() => setFilterIssues("")} />
            ) : null}
            {filterIssues === "false" ? (
              <FilterChip label="No issues" onRemove={() => setFilterIssues("")} />
            ) : null}
            {filterAttachment === "true" ? (
              <FilterChip label="Has attachments" onRemove={() => setFilterAttachment("")} />
            ) : null}
            {filterAttachment === "false" ? (
              <FilterChip label="No attachments" onRemove={() => setFilterAttachment("")} />
            ) : null}
            {filterExecAudit === "true" ? (
              <FilterChip label="Audits complete" onRemove={() => setFilterExecAudit("")} />
            ) : null}
            {filterExecAudit === "false" ? (
              <FilterChip label="Audits incomplete" onRemove={() => setFilterExecAudit("")} />
            ) : null}
          </div>
        ) : null}

        {historyLoading && reviews.length === 0 ? (
          <ReviewLoadingState />
        ) : reviews.length === 0 ? (
          <ReviewEmptyState
            icon={CalendarCheck}
            title="No reviews match your filters"
            description="Try clearing filters or widening the date range."
            action={
              hasFilters ? (
                <button type="button" onClick={clearFilters} className={cn(VA_BTN_SECONDARY, "min-h-11")}>
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-2">
            {pagination.pageItems.map((r) => {
              const selected =
                r.review_date === selectedDate &&
                (focusManagerId
                  ? r.manager_id === focusManagerId
                  : focusManagerName
                    ? r.manager_name === focusManagerName
                    : true);
              const hasIssues = Boolean(r.issues_found.trim());
              const hasAtt = r.attachments.length > 0;
              return (
                <div
                  key={r.id}
                  className={cn(
                    "mr-finding-card va-card flex w-full items-stretch gap-2 rounded-2xl p-2 transition duration-200 motion-reduce:transition-none sm:items-center sm:gap-3 sm:p-3",
                    selected && "ring-1 ring-[#FF1493]/35 shadow-[0_0_20px_rgba(255,20,147,0.08)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openHistoryReview(r)}
                    className="min-h-12 min-w-0 flex-1 rounded-xl px-2 py-2 text-left active:bg-white/[0.04] sm:px-3"
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
                      {formatReviewDate(r.review_date)} · {r.manager_name}
                      {r.time_spent_minutes != null ? ` · ${r.time_spent_minutes} min` : ""}
                    </p>
                    {r.top_performer_name ? (
                      <span className={cn(VA_MODEL_TAG, "mt-2 inline-block")}>{r.top_performer_name}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteReviewId(r.id)}
                    className="shrink-0 self-center rounded-lg border border-white/10 p-2.5 text-red-400/55 transition active:border-red-500/30 active:bg-red-500/10 active:text-red-300"
                    aria-label="Delete review"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
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
      </div>

      <ConfirmDeleteModal
        open={deleteReviewId != null}
        title="Delete daily review?"
        description="This will permanently delete the review and all linked exec audits."
        confirming={deleting}
        onConfirm={() => void confirmDeleteReview()}
        onClose={() => setDeleteReviewId(null)}
      />
    </div>
  );
}
