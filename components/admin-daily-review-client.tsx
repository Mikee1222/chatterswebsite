"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { DailyReviewFormFields, type DailyReviewFormState } from "@/components/daily-review-form-fields";
import {
  emptyExecAuditDraft,
  ExecAuditCard,
  type ExecAuditDraft,
} from "@/components/exec-audit-card";
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
import { ROUTES } from "@/lib/routes";
import { formatReviewDate, todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { cn } from "@/lib/utils";
import type {
  MarketingDailyReview,
  MarketingDailyReviewDetail,
} from "@/services/marketing-reviews";
import { staffDisplayName, type StaffUserOption } from "@/components/staff-assignee-picker";

const API_BASE = "/api/admin/marketing-reviews/daily-reviews";

type DateRange = "all" | "7d" | "30d" | "custom";

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

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
  const [reviews, setReviews] = React.useState(initialReviews);
  const [selectedDate, setSelectedDate] = React.useState(todayReviewIso());
  const [activeReview, setActiveReview] = React.useState<MarketingDailyReviewDetail | null>(todayReview);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleteReviewId, setDeleteReviewId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [filterSupervisor, setFilterSupervisor] = React.useState("");
  const [filterDateRange, setFilterDateRange] = React.useState<DateRange>("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState("");
  const [filterDateTo, setFilterDateTo] = React.useState("");

  const [formState, setFormState] = React.useState<DailyReviewFormState>(() => detailToFormState(todayReview));
  const [execAudits, setExecAudits] = React.useState<ExecAuditDraft[]>(() => detailToExecAudits(todayReview));
  const [attachFiles, setAttachFiles] = React.useState<File[]>([]);

  const supervisorOptions = React.useMemo(() => {
    const names = new Set(reviews.map((r) => r.manager_name).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [reviews]);

  const supervisorFilterOptions = React.useMemo<CustomSelectOption[]>(
    () => [{ value: "", label: "All" }, ...supervisorOptions.map((name) => ({ value: name, label: name }))],
    [supervisorOptions],
  );
  const dateRangeOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "all", label: "All time" },
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
      { value: "custom", label: "Custom" },
    ],
    [],
  );

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

  React.useEffect(() => {
    void loadDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  async function reloadHistory() {
    const params = new URLSearchParams();
    if (filterSupervisor) params.set("manager_name", filterSupervisor);
    if (filterDateRange === "7d") params.set("date_from", isoDateDaysAgo(7));
    if (filterDateRange === "30d") params.set("date_from", isoDateDaysAgo(30));
    if (filterDateRange === "custom") {
      if (filterDateFrom) params.set("date_from", filterDateFrom);
      if (filterDateTo) params.set("date_to", filterDateTo);
    }
    const res = await fetch(`${API_BASE}?${params}`);
    const data = (await res.json()) as { reviews?: MarketingDailyReview[] };
    if (res.ok) setReviews(data.reviews ?? []);
  }

  React.useEffect(() => {
    void reloadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSupervisor, filterDateRange, filterDateFrom, filterDateTo]);

  const hasFilters = Boolean(filterSupervisor) || filterDateRange !== "all";

  function clearFilters() {
    setFilterSupervisor("");
    setFilterDateRange("all");
    setFilterDateFrom("");
    setFilterDateTo("");
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
        if (audit.id) {
          await fetch(`/api/admin/marketing-reviews/exec-audits/${audit.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else if (audit.exec_va_id) {
          await fetch("/api/admin/marketing-reviews/exec-audits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, daily_review_id: activeReview.id }),
          });
        }
      }

      if (attachFiles.length > 0) {
        const fd = new FormData();
        for (const f of attachFiles) fd.append("attachments", f);
        await fetch(`${API_BASE}/${activeReview.id}/attachments`, { method: "POST", body: fd });
      }

      await loadDate(selectedDate);
      await reloadHistory();
      addToast(localToast(`dr-save-ok-${Date.now()}`, "Saved", "Daily review updated.", "normal"));
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
          <h1 className="mt-1 text-2xl font-bold text-white">Daily review</h1>
          <p className="mt-1 text-sm text-[#B8B4B8]/60">Manage all supervisor daily reviews</p>
        </div>
        <Link href={ROUTES.admin.spotChecks} className={cn(VA_BTN_SECONDARY, "px-4 py-2.5 text-sm")}>
          ← Spot checks
        </Link>
      </div>

      <section className={cn(VA_CARD, "flex flex-wrap items-end gap-4 p-4 md:p-5")}>
        <label className="space-y-1.5 text-sm">
          <span className="text-[#B8B4B8]/60">Review date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={VA_FILTER_INPUT}
          />
        </label>
        {isToday && !activeReview ? (
          <button type="button" onClick={() => void startReview()} disabled={saving} className={VA_BTN_PRIMARY}>
            {saving ? "Starting…" : "Start today's review"}
          </button>
        ) : null}
        {activeReview ? (
          <QuickActionDelete onClick={() => setDeleteReviewId(activeReview.id)} className="px-4 py-2.5 text-sm">
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
          action={
            <button type="button" onClick={() => void startReview()} disabled={saving} className={VA_BTN_PRIMARY}>
              Start review for this date
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className={cn(VA_CARD, "space-y-5 p-5 shadow-[0_0_20px_rgba(255,20,147,0.06)]")}>
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
                  className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 py-2 text-xs")}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add VA audit
                </button>
              }
            >
              Per-exec audits
            </ReviewSectionHeader>
            {execAudits.length === 0 ? (
              <p className="text-sm text-[#B8B4B8]/45">No per-exec audits yet.</p>
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

          <div className="flex justify-end">
            <button type="button" onClick={() => void saveReview()} disabled={saving} className={VA_BTN_PRIMARY}>
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <ReviewSectionHeader
          action={
            hasFilters ? (
              <button type="button" onClick={clearFilters} className="text-xs text-[#D4AF8C]/80 hover:text-[#D4AF8C]">
                Clear filters
              </button>
            ) : null
          }
        >
          Review history
        </ReviewSectionHeader>

        <FilterBar className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-[#B8B4B8]/60">
            Supervisor
            <ManagerReviewSelect
              value={filterSupervisor}
              onChange={setFilterSupervisor}
              options={supervisorFilterOptions}
              triggerClassName="min-w-[9rem]"
            />
          </label>
          <label className="space-y-1 text-xs text-[#B8B4B8]/60">
            Date range
            <ManagerReviewSelect
              value={filterDateRange}
              onChange={(v) => setFilterDateRange(v as DateRange)}
              options={dateRangeOptions}
              triggerClassName="min-w-[9rem]"
            />
          </label>
          {filterDateRange === "custom" ? (
            <>
              <label className="space-y-1 text-xs text-[#B8B4B8]/60">
                From
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className={cn(VA_FILTER_INPUT, "min-w-[9rem]")}
                />
              </label>
              <label className="space-y-1 text-xs text-[#B8B4B8]/60">
                To
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className={cn(VA_FILTER_INPUT, "min-w-[9rem]")}
                />
              </label>
            </>
          ) : null}
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
                  setFilterDateFrom("");
                  setFilterDateTo("");
                }}
              />
            ) : null}
          </div>
        ) : null}

        {reviews.length === 0 ? (
          <p className="text-sm text-[#B8B4B8]/45">No reviews match your filters.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "mr-finding-card va-card rounded-2xl flex w-full items-center justify-between gap-3 p-4 transition duration-200 motion-reduce:transition-none hover:-translate-y-0.5",
                  r.review_date === selectedDate && "ring-1 ring-[#FF1493]/35",
                )}
              >
                <button type="button" onClick={() => setSelectedDate(r.review_date)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium text-white">{r.review_label}</p>
                  <p className="text-xs text-[#B8B4B8]/50">
                    {formatReviewDate(r.review_date)} · {r.manager_name}
                    {r.time_spent_minutes != null ? ` · ${r.time_spent_minutes} min` : ""}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {r.top_performer_name ? <span className={VA_MODEL_TAG}>{r.top_performer_name}</span> : null}
                  <button
                    type="button"
                    onClick={() => setDeleteReviewId(r.id)}
                    className="rounded-lg border border-white/10 p-2 text-red-400/55 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                    aria-label="Delete review"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
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
