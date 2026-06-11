"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Download, Loader2, Home } from "lucide-react";
import { useSWRConfig } from "swr";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { dashboardSwrKeys } from "@/lib/hooks/use-dashboard-data";
import type { ModelContentAssignmentCardDTO } from "@/types";
import { useTranslations } from "@/lib/use-translations";
import { formatDateTime as formatDateTimeUk } from "@/lib/format-date";

type Filter = "pending" | "scheduled" | "completed";

function ModelBodyModal({
  open,
  onBackdropClick,
  ariaLabelledBy,
  children,
}: {
  open: boolean;
  onBackdropClick: () => void;
  ariaLabelledBy: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClick={onBackdropClick}
    >
      {children}
    </div>,
    document.body
  );
}

const MODEL_MODAL_PANEL_CLASS =
  "w-full max-w-md rounded-2xl border border-white/10 bg-[hsl(240,10%,8%)] p-6 pb-[calc(env(safe-area-inset-bottom)+76px+1.5rem)] shadow-2xl md:p-6";

function deadlineSortKey(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function hoursUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  return (d - Date.now()) / (1000 * 60 * 60);
}

function priorityClass(p: string): string {
  const x = (p || "").toLowerCase();
  if (x === "urgent") return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  if (x === "high") return "border-amber-500/35 bg-amber-500/12 text-amber-200";
  if (x === "low") return "border-white/15 bg-white/[0.06] text-white/65";
  return "border-pink-400/30 bg-pink-500/12 text-pink-200";
}

export type ModelContentAssignmentsClientProps = {
  assignments: ModelContentAssignmentCardDTO[];
};

export function ModelContentAssignmentsClient({ assignments }: ModelContentAssignmentsClientProps) {
  const { t } = useTranslations();
  const { mutate } = useSWRConfig();
  const active = assignments.filter((a) => (a.status || "").toLowerCase() !== "cancelled");
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [scheduleFor, setScheduleFor] = React.useState<ModelContentAssignmentCardDTO | null>(null);
  const [completeFor, setCompleteFor] = React.useState<ModelContentAssignmentCardDTO | null>(null);
  const [scheduleDate, setScheduleDate] = React.useState("");
  const [scheduleNotes, setScheduleNotes] = React.useState("");
  const [completeNotes, setCompleteNotes] = React.useState("");
  const [isScheduling, setIsScheduling] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [expenseFor, setExpenseFor] = React.useState<ModelContentAssignmentCardDTO | null>(null);
  const [airbnbLink, setAirbnbLink] = React.useState("");
  const [expenseNotes, setExpenseNotes] = React.useState("");
  const [isRequestingExpense, setIsRequestingExpense] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const f = active.filter((a) => (a.status || "").toLowerCase() === filter);
    return [...f].sort((a, b) => deadlineSortKey(a.deadline) - deadlineSortKey(b.deadline));
  }, [active, filter]);

  const counts = React.useMemo(() => {
    return {
      pending: active.filter((a) => (a.status || "").toLowerCase() === "pending").length,
      scheduled: active.filter((a) => (a.status || "").toLowerCase() === "scheduled").length,
      completed: active.filter((a) => (a.status || "").toLowerCase() === "completed").length,
    };
  }, [active]);

  React.useEffect(() => {
    if (scheduleFor) {
      setScheduleDate("");
      setScheduleNotes("");
      setError(null);
    }
  }, [scheduleFor]);

  React.useEffect(() => {
    if (completeFor) {
      setCompleteNotes("");
      setError(null);
    }
  }, [completeFor]);

  React.useEffect(() => {
    if (expenseFor) {
      setAirbnbLink("");
      setExpenseNotes("");
      setError(null);
    }
  }, [expenseFor]);

  async function submitSchedule() {
    if (!scheduleFor || !scheduleDate) return;
    setIsScheduling(true);
    setError(null);
    try {
      const res = await fetch("/api/model/content-assignments/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: scheduleFor.id,
          scheduled_date: scheduleDate,
          notes: scheduleNotes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("common.couldNotSave"));
        return;
      }
      setScheduleFor(null);
      await mutate(dashboardSwrKeys.notificationsUnreadCount);
      window.location.reload();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setIsScheduling(false);
    }
  }

  async function submitComplete() {
    if (!completeFor) return;
    setIsCompleting(true);
    setError(null);
    try {
      const res = await fetch("/api/model/content-assignments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: completeFor.id,
          completion_notes: completeNotes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("common.couldNotSave"));
        return;
      }
      setCompleteFor(null);
      await mutate(dashboardSwrKeys.notificationsUnreadCount);
      window.location.reload();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setIsCompleting(false);
    }
  }

  async function submitExpenseRequest() {
    if (!expenseFor || !airbnbLink.trim()) return;
    setIsRequestingExpense(true);
    setError(null);
    try {
      const res = await fetch("/api/model/expense-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          va_content_assignment_id: expenseFor.id,
          assignment_title: expenseFor.title || "Assignment",
          type: "airbnb",
          airbnb_link: airbnbLink.trim(),
          notes: expenseNotes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("common.couldNotSave"));
        return;
      }
      setExpenseFor(null);
      await mutate(dashboardSwrKeys.notificationsUnreadCount);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setIsRequestingExpense(false);
    }
  }

  const saving = isScheduling || isCompleting || isRequestingExpense;

  const downloadTarget = (a: ModelContentAssignmentCardDTO) => {
    const att = a.file_attachment.find((x) => x.url);
    if (att?.url) return { href: att.url, label: att.filename || t("assignments.downloadFile") };
    if (a.file_url) return { href: a.file_url, label: t("assignments.openLink") };
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["pending", "scheduled", "completed"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              filter === key
                ? "border-pink-400/50 bg-pink-500/20 text-pink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-black/30 text-white/60 hover:border-white/20 hover:text-white/85"
            )}
          >
            {key === "pending"
              ? t("common.pending")
              : key === "scheduled"
                ? t("common.scheduled")
                : t("common.completed")}
            <span className="ml-1.5 tabular-nums text-white/40">({counts[key]})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-black/30 px-5 py-10 text-center text-sm text-white/50">
          {t("common.nothingInTab")}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {filtered.map((a) => {
            const st = (a.status || "").toLowerCase();
            const deadlineIso = a.deadline;
            const h = hoursUntil(deadlineIso);
            const urgent = st !== "completed" && h != null && h > 0 && h < 48;
            const overdue = st !== "completed" && h != null && h < 0;
            const downloadInfo = downloadTarget(a);

            return (
              <li
                key={a.id}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-2xl border bg-black/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl",
                  urgent || overdue ? "border-pink-500/35" : "border-white/10"
                )}
              >
                {(urgent || overdue) && (
                  <div
                    className={cn(
                      "mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
                      overdue ? "border-rose-500/35 bg-rose-500/10 text-rose-200" : "border-amber-500/35 bg-amber-500/10 text-amber-100"
                    )}
                  >
                    {overdue ? (
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    {overdue
                      ? t("assignments.pastDeadline")
                      : t("assignments.due48h")}
                  </div>
                )}

                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold leading-snug text-white">{a.title || "—"}</h2>
                  {a.priority ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        priorityClass(a.priority)
                      )}
                    >
                      {a.priority}
                    </span>
                  ) : null}
                </div>

                {a.description ? (
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-white/60">{a.description}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-pink-300/80" aria-hidden />
                    {t("assignments.deadline")}
                    {": "}
                    <span className={cn("font-medium text-white/70", urgent && "text-pink-200")}>
                      {formatDateTimeUk(a.deadline)}
                    </span>
                  </span>
                  {a.va_name ? (
                    <span>
                      {t("assignments.vaLabel")}: <span className="text-white/65">{a.va_name}</span>
                    </span>
                  ) : null}
                  {a.content_type ? (
                    <span>
                      {t("common.type")}: {a.content_type}
                    </span>
                  ) : null}
                </div>

                {st === "scheduled" && a.scheduled_date ? (
                  <p className="mt-2 text-xs text-white/50">
                    {t("assignments.youScheduledFor")}{""}
                    <span className="font-medium text-pink-200/95">{formatDateTimeUk(a.scheduled_date)}</span>
                  </p>
                ) : null}

                {st === "completed" && a.completed_at ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300/90">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    {t("assignments.completedAt")} {formatDateTimeUk(a.completed_at)}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {downloadInfo ? (
                    <a
                      href={downloadInfo.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg transition",
                        "bg-gradient-to-r from-pink-600 to-fuchsia-600 ring-1 ring-pink-400/40 hover:from-pink-500 hover:to-fuchsia-500",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                      )}
                    >
                      <Download className="h-4 w-4 shrink-0" aria-hidden />
                      {downloadInfo.label}
                    </a>
                  ) : null}

                  {st === "pending" ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setScheduleFor(a)}
                      className="inline-flex min-h-[44px] items-center rounded-xl border border-pink-400/35 bg-pink-500/10 px-4 py-2.5 text-sm font-semibold text-pink-100 transition hover:bg-pink-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {t("assignments.schedule")}
                    </button>
                  ) : null}

                  {(st === "pending" || st === "scheduled") ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setExpenseFor(a)}
                      className="inline-flex min-h-[44px] items-center rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="inline-flex items-center gap-1.5"><Home className="h-4 w-4" aria-hidden />Request Airbnb</span>
                    </button>
                  ) : null}

                  {st === "scheduled" ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setCompleteFor(a)}
                      className="inline-flex min-h-[44px] items-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {t("assignments.markComplete")}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-xs text-white/35">
        <Link href={ROUTES.model.home} className="text-pink-300/90 underline-offset-2 hover:underline">
          {t("common.backToHome")}
        </Link>
      </p>

      <ModelBodyModal
        open={scheduleFor != null}
        ariaLabelledBy="schedule-modal-title"
        onBackdropClick={() => !isScheduling && setScheduleFor(null)}
      >
        {scheduleFor ? (
          <div className={MODEL_MODAL_PANEL_CLASS} onClick={(e) => e.stopPropagation()}>
            <h3 id="schedule-modal-title" className="text-lg font-semibold text-white">
              {t("assignments.scheduleDelivery")}
            </h3>
            <p className="mt-1 text-sm text-white/55">{scheduleFor.title}</p>
            <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-white/45">
              {t("common.date")}
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-white/45">
              {t("periodTracker.notesOptional")}
              <textarea
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
                placeholder={t("assignments.addContextPlaceholder")}
              />
            </label>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={isScheduling}
                onClick={() => setScheduleFor(null)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isScheduling || !scheduleDate}
                onClick={() => void submitSchedule()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    {t("assignments.scheduling")}
                  </>
                ) : (
                  t("assignments.saveNotifyVa")
                )}
              </button>
            </div>
          </div>
        ) : null}
      </ModelBodyModal>

      <ModelBodyModal
        open={completeFor != null}
        ariaLabelledBy="complete-modal-title"
        onBackdropClick={() => !isCompleting && setCompleteFor(null)}
      >
        {completeFor ? (
          <div className={MODEL_MODAL_PANEL_CLASS} onClick={(e) => e.stopPropagation()}>
            <h3 id="complete-modal-title" className="text-lg font-semibold text-white">
              {t("assignments.markCompleteTitle")}
            </h3>
            <p className="mt-1 text-sm text-white/55">{completeFor.title}</p>
            <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-white/45">
              {t("assignments.completionNotes")}
              <textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
              />
            </label>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={isCompleting}
                onClick={() => setCompleteFor(null)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isCompleting}
                onClick={() => void submitComplete()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    {t("assignments.completing")}
                  </>
                ) : (
                  t("assignments.completeNotifyVa")
                )}
              </button>
            </div>
          </div>
        ) : null}
      </ModelBodyModal>

      <ModelBodyModal
        open={expenseFor != null}
        ariaLabelledBy="expense-modal-title"
        onBackdropClick={() => !isRequestingExpense && setExpenseFor(null)}
      >
        {expenseFor ? (
          <div className={MODEL_MODAL_PANEL_CLASS} onClick={(e) => e.stopPropagation()}>
            <h3 id="expense-modal-title" className="inline-flex items-center gap-2 text-lg font-semibold text-white"><Home className="h-5 w-5" aria-hidden />Airbnb request</h3>
            <p className="mt-1 text-sm text-white/55">For: {expenseFor.title}</p>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-white/45">
              Airbnb listing link
              <input
                type="url"
                value={airbnbLink}
                onChange={(e) => setAirbnbLink(e.target.value)}
                placeholder="https://airbnb.com/rooms/..."
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-white/45">
              Notes (optional)
              <textarea
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white"
              />
            </label>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={isRequestingExpense}
                onClick={() => setExpenseFor(null)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isRequestingExpense || !airbnbLink.trim()}
                onClick={() => void submitExpenseRequest()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {isRequestingExpense ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Sending...
                  </>
                ) : (
                  "Send request"
                )}
              </button>
            </div>
          </div>
        ) : null}
      </ModelBodyModal>
    </div>
  );
}
