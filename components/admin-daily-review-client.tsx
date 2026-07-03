"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, Check, Loader2, Plus } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { ROUTES } from "@/lib/routes";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CHAMPAGNE_DIVIDER,
  VA_FILTER_INPUT,
  VA_MODEL_TAG,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { COMPLIANCE_VS_MASTER, DAILY_REVIEW_KPIS } from "@/lib/marketing-reviews-helpers";
import type {
  MarketingDailyReview,
  MarketingDailyReviewDetail,
  MarketingExecAudit,
} from "@/services/marketing-reviews";
import type { UserRecord } from "@/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatReviewDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

type ExecAuditDraft = {
  id?: string;
  exec_va_id: string;
  exec_va_name: string;
  phase1_on_time: boolean;
  phase2_on_time: boolean;
  screenshots_authentic: boolean;
  posting_compliance: boolean;
  engagement_looks_real: boolean;
  issues_found: string;
  actions_taken: string;
};

const COMPLIANCE_FIELDS: Array<{ key: keyof ExecAuditDraft; label: string }> = [
  { key: "phase1_on_time", label: "Phase 1 on time" },
  { key: "phase2_on_time", label: "Phase 2 on time" },
  { key: "screenshots_authentic", label: "Screenshots authentic" },
  { key: "posting_compliance", label: "Posting compliance" },
  { key: "engagement_looks_real", label: "Engagement looks real" },
];

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

type Props = {
  initialReviews: MarketingDailyReview[];
  todayReview: MarketingDailyReviewDetail | null;
  vaUsers: UserRecord[];
};

export function AdminDailyReviewClient({ initialReviews, todayReview, vaUsers }: Props) {
  const { addToast } = useToast();
  const [reviews, setReviews] = React.useState(initialReviews);
  const [selectedDate, setSelectedDate] = React.useState(todayIso());
  const [activeReview, setActiveReview] = React.useState<MarketingDailyReviewDetail | null>(todayReview);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [kpis, setKpis] = React.useState<string[]>(todayReview?.overall_kpis_reviewed ?? []);
  const [compliance, setCompliance] = React.useState<string[]>(todayReview?.account_compliance_vs_master ?? []);
  const [topPerformerId, setTopPerformerId] = React.useState(todayReview?.top_performer_id ?? "");
  const [issues, setIssues] = React.useState(todayReview?.issues_found ?? "");
  const [actions, setActions] = React.useState(todayReview?.actions_assigned ?? "");
  const [timeSpent, setTimeSpent] = React.useState(
    todayReview?.time_spent_minutes != null ? String(todayReview.time_spent_minutes) : "",
  );
  const [execAudits, setExecAudits] = React.useState<ExecAuditDraft[]>(
    (todayReview?.exec_audits ?? []).map((a) => ({
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
    })),
  );
  const [attachFiles, setAttachFiles] = React.useState<File[]>([]);

  const marketingVas = React.useMemo(
    () => vaUsers.filter((u) => u.va_type === "marketing" || u.va_type === "both" || !u.va_type),
    [vaUsers],
  );

  function applyReviewToForm(review: MarketingDailyReviewDetail | null) {
    setKpis(review?.overall_kpis_reviewed ?? []);
    setCompliance(review?.account_compliance_vs_master ?? []);
    setTopPerformerId(review?.top_performer_id ?? "");
    setIssues(review?.issues_found ?? "");
    setActions(review?.actions_assigned ?? "");
    setTimeSpent(review?.time_spent_minutes != null ? String(review.time_spent_minutes) : "");
    setExecAudits(
      (review?.exec_audits ?? []).map((a) => ({
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
      })),
    );
    setAttachFiles([]);
  }

  async function loadDate(date: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/marketing-reviews/daily-reviews?date=${encodeURIComponent(date)}`);
      const data = (await res.json()) as { review?: MarketingDailyReview | null };
      if (!data.review) {
        setActiveReview(null);
        applyReviewToForm(null);
        return;
      }
      const detailRes = await fetch(`/api/admin/marketing-reviews/daily-reviews/${data.review.id}`);
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
    const res = await fetch("/api/admin/marketing-reviews/daily-reviews");
    const data = (await res.json()) as { reviews?: MarketingDailyReview[] };
    if (res.ok) setReviews(data.reviews ?? []);
  }

  async function startTodayReview() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing-reviews/daily-reviews", {
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
      addToast(localToast(`dr-start-${Date.now()}`, "Review started", `Daily review for ${formatReviewDate(selectedDate)}`, "normal"));
    } finally {
      setSaving(false);
    }
  }

  async function saveReview() {
    if (!activeReview) return;
    setSaving(true);
    try {
      const topVa = marketingVas.find((v) => v.id === topPerformerId);
      const res = await fetch(`/api/admin/marketing-reviews/daily-reviews/${activeReview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overall_kpis_reviewed: kpis,
          account_compliance_vs_master: compliance,
          top_performer_id: topPerformerId,
          top_performer_name: topVa?.full_name ?? "",
          issues_found: issues,
          actions_assigned: actions,
          time_spent_minutes: timeSpent ? Number(timeSpent) : null,
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
        await fetch(`/api/admin/marketing-reviews/daily-reviews/${activeReview.id}/attachments`, {
          method: "POST",
          body: fd,
        });
      }

      await loadDate(selectedDate);
      await reloadHistory();
      addToast(localToast(`dr-save-ok-${Date.now()}`, "Saved", "Daily review updated.", "normal"));
    } finally {
      setSaving(false);
    }
  }

  function toggleKpi(kpi: string) {
    setKpis((prev) => (prev.includes(kpi) ? prev.filter((k) => k !== kpi) : [...prev, kpi]));
  }

  function toggleCompliance(item: string) {
    setCompliance((prev) => (prev.includes(item) ? prev.filter((k) => k !== item) : [...prev, item]));
  }

  function addExecAudit() {
    setExecAudits((prev) => [
      ...prev,
      {
        exec_va_id: "",
        exec_va_name: "",
        phase1_on_time: false,
        phase2_on_time: false,
        screenshots_authentic: false,
        posting_compliance: false,
        engagement_looks_real: false,
        issues_found: "",
        actions_taken: "",
      },
    ]);
  }

  function updateExecAudit(index: number, patch: Partial<ExecAuditDraft>) {
    setExecAudits((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  const isToday = selectedDate === todayIso();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF1493]/70">Manager review</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Daily review</h1>
          <p className="mt-1 text-sm text-[#B8B4B8]/60">End-of-day marketing supervisor checklist</p>
        </div>
        <Link
          href={ROUTES.admin.spotChecks}
          className="rounded-xl border border-[#D4AF8C]/35 px-4 py-2.5 text-sm font-medium text-[#D4AF8C] hover:bg-[#D4AF8C]/6"
        >
          ← Spot checks
        </Link>
      </div>

      <div className={cn(VA_CARD, "flex flex-wrap items-end gap-4 p-4 md:p-5")}>
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
          <button type="button" onClick={() => void startTodayReview()} disabled={saving} className={VA_BTN_PRIMARY}>
            {saving ? "Starting…" : "Start today's review"}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className={cn(VA_CARD, "flex items-center justify-center gap-2 py-16 text-[#B8B4B8]/50")}>
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : !activeReview ? (
        <div className={cn(VA_CARD, "py-16 text-center")}>
          <CalendarCheck className="mx-auto mb-3 h-10 w-10 text-[#D4AF8C]/35" aria-hidden />
          <p className="text-[#B8B4B8]/70">No review for {formatReviewDate(selectedDate)}</p>
          <button type="button" onClick={() => void startTodayReview()} disabled={saving} className={cn(VA_BTN_PRIMARY, "mt-4")}>
            Start review for this date
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className={cn(VA_CARD, "space-y-5 p-5")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">{activeReview.review_label}</h2>
              <span className={VA_MODEL_TAG}>{activeReview.manager_name}</span>
            </div>
            <div className={VA_CHAMPAGNE_DIVIDER} />

            <div>
              <p className="mb-3 text-sm font-medium text-[#D4AF8C]">KPIs reviewed</p>
              <div className="flex flex-wrap gap-2">
                {DAILY_REVIEW_KPIS.map((kpi) => {
                  const on = kpis.includes(kpi);
                  return (
                    <button
                      key={kpi}
                      type="button"
                      onClick={() => toggleKpi(kpi)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-xs transition",
                        on
                          ? "border-[#FF1493]/40 bg-[#FF1493]/15 text-[#FFB3D9]"
                          : "border-white/8 bg-white/3 text-[#B8B4B8]/60 hover:border-[#D4AF8C]/30",
                      )}
                    >
                      {on ? <Check className="mb-0.5 inline h-3 w-3" aria-hidden /> : null} {kpi}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-[#D4AF8C]">Account compliance vs master</p>
              <div className="flex flex-wrap gap-2">
                {COMPLIANCE_VS_MASTER.map((item) => {
                  const on = compliance.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleCompliance(item)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-xs transition",
                        on
                          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                          : "border-white/8 bg-white/3 text-[#B8B4B8]/60 hover:border-[#D4AF8C]/30",
                      )}
                    >
                      {on ? <Check className="mb-0.5 inline h-3 w-3" aria-hidden /> : null} {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block space-y-1.5 text-sm">
              <span className="text-[#B8B4B8]/60">Top performer VA</span>
              <select value={topPerformerId} onChange={(e) => setTopPerformerId(e.target.value)} className={cn(VA_FILTER_INPUT, "w-full max-w-md")}>
                <option value="">—</option>
                {marketingVas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.full_name || v.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5 text-sm">
              <span className="text-[#B8B4B8]/60">Issues found</span>
              <textarea value={issues} onChange={(e) => setIssues(e.target.value)} rows={3} className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-[#B8B4B8]/60">Actions assigned</span>
              <textarea value={actions} onChange={(e) => setActions(e.target.value)} rows={2} className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")} />
            </label>
            <label className="block max-w-xs space-y-1.5 text-sm">
              <span className="text-[#B8B4B8]/60">Time spent (minutes)</span>
              <input type="number" min={0} value={timeSpent} onChange={(e) => setTimeSpent(e.target.value)} className={VA_FILTER_INPUT} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-[#B8B4B8]/60">Attachments</span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => setAttachFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-sm text-[#B8B4B8]/60 file:mr-3 file:rounded-lg file:border-0 file:bg-[#FF1493]/20 file:px-3 file:py-1.5 file:text-sm file:text-[#FFB3D9]"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">Per-exec audits</h3>
              <button type="button" onClick={addExecAudit} className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 py-2 text-xs")}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add VA audit
              </button>
            </div>
            {execAudits.length === 0 ? (
              <p className="text-sm text-[#B8B4B8]/50">No per-exec audits yet.</p>
            ) : (
              execAudits.map((audit, index) => (
                <div key={audit.id ?? `new-${index}`} className={cn(VA_CARD, "space-y-4 p-4")}>
                  <select
                    value={audit.exec_va_id}
                    onChange={(e) => {
                      const va = marketingVas.find((v) => v.id === e.target.value);
                      updateExecAudit(index, { exec_va_id: e.target.value, exec_va_name: va?.full_name ?? "" });
                    }}
                    className={cn(VA_FILTER_INPUT, "w-full max-w-sm")}
                  >
                    <option value="">Select VA</option>
                    {marketingVas.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.full_name || v.email}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-3">
                    {COMPLIANCE_FIELDS.map(({ key, label }) => (
                      <label key={key} className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#B8B4B8]/80">
                        <input
                          type="checkbox"
                          checked={Boolean(audit[key])}
                          onChange={(e) => updateExecAudit(index, { [key]: e.target.checked })}
                          className="rounded border-white/20 bg-transparent text-[#FF1493] focus:ring-[#FF1493]/30"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <textarea
                    placeholder="Issues found"
                    value={audit.issues_found}
                    onChange={(e) => updateExecAudit(index, { issues_found: e.target.value })}
                    rows={2}
                    className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")}
                  />
                  <textarea
                    placeholder="Actions taken"
                    value={audit.actions_taken}
                    onChange={(e) => updateExecAudit(index, { actions_taken: e.target.value })}
                    rows={2}
                    className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")}
                  />
                </div>
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

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">Review history</h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-[#B8B4B8]/50">No past reviews.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedDate(r.review_date)}
                className={cn(
                  VA_CARD,
                  "flex w-full items-center justify-between gap-3 p-4 text-left transition",
                  r.review_date === selectedDate && "ring-1 ring-[#FF1493]/35",
                )}
              >
                <div>
                  <p className="font-medium text-white">{r.review_label}</p>
                  <p className="text-xs text-[#B8B4B8]/50">
                    {formatReviewDate(r.review_date)} · {r.manager_name}
                    {r.time_spent_minutes != null ? ` · ${r.time_spent_minutes} min` : ""}
                  </p>
                </div>
                {r.top_performer_name ? <span className={VA_MODEL_TAG}>{r.top_performer_name}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
