"use client";

import * as React from "react";
import { CalendarCheck, Plus } from "lucide-react";
import { DailyReviewFormFields, type DailyReviewFormState } from "@/components/daily-review-form-fields";
import {
  emptyExecAuditDraft,
  ExecAuditCard,
  type ExecAuditDraft,
} from "@/components/exec-audit-card";
import {
  FindingCard,
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
import { formatReviewDate, todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { cn } from "@/lib/utils";
import type {
  MarketingDailyReview,
  MarketingDailyReviewDetail,
} from "@/services/marketing-reviews";
import type { UserRecord } from "@/types";

const API_BASE = "/api/daily-reviews";

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
  vaUsers: UserRecord[];
};

export function SupervisorDailyReviewClient({ initialSubmissions, todayReview, vaUsers }: Props) {
  const { addToast } = useToast();
  const [myReviews, setMyReviews] = React.useState(initialSubmissions);
  const [selectedDate, setSelectedDate] = React.useState(todayReviewIso());
  const [activeReview, setActiveReview] = React.useState<MarketingDailyReviewDetail | null>(todayReview);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [formState, setFormState] = React.useState<DailyReviewFormState>(() => detailToFormState(todayReview));
  const [execAudits, setExecAudits] = React.useState<ExecAuditDraft[]>(() => detailToExecAudits(todayReview));
  const [attachFiles, setAttachFiles] = React.useState<File[]>([]);

  const marketingVas = React.useMemo(
    () => vaUsers.filter((u) => u.va_type === "marketing" || u.va_type === "both" || !u.va_type),
    [vaUsers],
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
    const res = await fetch(API_BASE);
    const data = (await res.json()) as { reviews?: MarketingDailyReview[] };
    if (res.ok) setMyReviews(data.reviews ?? []);
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
      const topVa = marketingVas.find((v) => v.id === formState.topPerformerId);
      const res = await fetch(`${API_BASE}/${activeReview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overall_kpis_reviewed: formState.kpis,
          account_compliance_vs_master: formState.compliance,
          top_performer_id: formState.topPerformerId,
          top_performer_name: topVa?.full_name ?? "",
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
          await fetch(`${API_BASE}/exec-audits/${audit.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else if (audit.exec_va_id) {
          await fetch(`${API_BASE}/exec-audits`, {
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

  const isToday = selectedDate === todayReviewIso();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <ReviewPageEyebrow>Supervision</ReviewPageEyebrow>
        <h1 className="mt-1 text-2xl font-bold text-white">Daily Review</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">End-of-day marketing supervisor checklist</p>
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
      </section>

      {loading ? (
        <ReviewLoadingState />
      ) : !activeReview ? (
        <ReviewEmptyState
          icon={CalendarCheck}
          title={`No review for ${formatReviewDate(selectedDate)}`}
          description="Start a new review or pick another date."
          action={
            <button type="button" onClick={() => void startReview()} disabled={saving} className={VA_BTN_PRIMARY}>
              Start review for this date
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          <section className={cn(VA_CARD, "space-y-5 p-5 shadow-[0_0_20px_rgba(255,20,147,0.06)]")}>
            <DailyReviewFormFields
              state={formState}
              marketingVas={marketingVas}
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
                  marketingVas={marketingVas}
                  onChange={(patch) =>
                    setExecAudits((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
                  }
                  onDelete={() => setExecAudits((prev) => prev.filter((_, i) => i !== index))}
                />
              ))
            )}
          </section>

          <div className="flex justify-end">
            <button type="button" onClick={() => void saveReview()} disabled={saving} className={VA_BTN_PRIMARY}>
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
            description="Completed reviews you submit will appear here."
          />
        ) : (
          myReviews.map((r) => (
            <FindingCard key={r.id}>
              <p className="font-medium text-white">{r.review_label}</p>
              <p className="mt-1 text-xs text-[#B8B4B8]/50">
                {formatReviewDate(r.review_date)}
                {r.time_spent_minutes != null ? ` · ${r.time_spent_minutes} min` : ""}
              </p>
              {r.top_performer_name ? (
                <span className={cn(VA_MODEL_TAG, "mt-2 inline-block")}>{r.top_performer_name}</span>
              ) : null}
              {r.issues_found ? (
                <p className="mt-3 text-sm text-[#B8B4B8]/70">{r.issues_found}</p>
              ) : null}
            </FindingCard>
          ))
        )}
      </section>
    </div>
  );
}
