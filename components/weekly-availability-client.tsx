"use client";
import { devLog } from "@/lib/dev-log";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  ListChecks,
  Moon,
  Palmtree,
  Pencil,
  Sparkles,
  StickyNote,
  Sun,
  Trash2,
} from "lucide-react";
import {
  submitAvailabilityAction,
  updateAvailabilityAction,
  deleteAvailabilityAction,
} from "@/app/actions/weekly-availability";
import { weeklyAvailabilityUrl } from "@/lib/routes";
import { addDays, getThisWeekMonday, normalizeWeekStart, formatWeekLabel } from "@/lib/weekly-program";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { cn } from "@/lib/utils";
import type { WeeklyAvailabilityRequest, WeeklyProgramDay, WeeklyProgramShiftType, WeeklyAvailabilityEntryType } from "@/types";

function isoTimeToHHmm(iso: string | undefined): string {
  if (!iso || iso.length < 16) return "";
  return iso.slice(11, 16);
}

function formatCustomTime(value: string | undefined): string {
  if (!value?.trim()) return "—";
  const t = value.trim();
  if (t.length >= 16) return t.slice(11, 16);
  if (/^\d{1,2}:\d{2}$/.test(t)) return t;
  return t;
}

const DAYS: WeeklyProgramDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const selectOptionClass = "bg-[#1a1a1a] text-white";

type Props = {
  weekStart: string;
  initialRequests: WeeklyAvailabilityRequest[];
};

const fieldMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

function statusBadgeClass(status: WeeklyAvailabilityRequest["status"]) {
  if (status === "submitted") return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30";
  if (status === "used") return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
  if (status === "rejected") return "bg-red-500/15 text-red-200 ring-1 ring-red-500/30";
  return "bg-white/10 text-white/75 ring-1 ring-white/15";
}

export function WeeklyAvailabilityClient({ weekStart: initialWeekStart, initialRequests }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStart = normalizeWeekStart(searchParams.get("week_start") || initialWeekStart);

  const [requests, setRequests] = React.useState(initialRequests);
  const [editingRequest, setEditingRequest] = React.useState<WeeklyAvailabilityRequest | null>(null);
  const [entryType, setEntryType] = React.useState<WeeklyAvailabilityEntryType>("availability");
  const [day, setDay] = React.useState<WeeklyProgramDay>("Monday");
  const [shiftType, setShiftType] = React.useState<WeeklyProgramShiftType>("Morning");
  const [customStart, setCustomStart] = React.useState("09:00");
  const [customEnd, setCustomEnd] = React.useState("17:00");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRequests(initialRequests);
    if (process.env.NODE_ENV !== "production") {
      devLog("[weekly-availability client] synced initialRequests", {
        weekStart,
        initialCount: initialRequests.length,
        initialIds: initialRequests.map((r) => r.id),
      });
    }
  }, [weekStart, initialRequests]);

  React.useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 5200);
    return () => window.clearTimeout(t);
  }, [success]);

  const goToWeek = (offset: number) => {
    const next = addDays(weekStart, offset * 7);
    router.push(weeklyAvailabilityUrl(next));
  };

  const handleEdit = (r: WeeklyAvailabilityRequest) => {
    setEditingRequest(r);
    setEntryType(r.entry_type ?? "availability");
    setDay(r.day);
    setShiftType(r.shift_type ?? "Morning");
    setCustomStart(r.custom_start_time ? isoTimeToHHmm(r.custom_start_time) || "09:00" : "09:00");
    setCustomEnd(r.custom_end_time ? isoTimeToHHmm(r.custom_end_time) || "17:00" : "17:00");
    setNotes(r.notes ?? "");
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setEntryType("availability");
    setError(null);
  };

  const handleDelete = async (r: WeeklyAvailabilityRequest) => {
    if (r.status !== "submitted") return;
    const ok = window.confirm(`Remove your ${r.day} submission? This cannot be undone.`);
    if (!ok) return;
    setDeletingId(r.id);
    setError(null);
    const res = await deleteAvailabilityAction(r.id);
    setDeletingId(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    if (editingRequest?.id === r.id) handleCancelEdit();
    setSuccess("Submission removed.");
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (entryType === "availability") {
      if (shiftType === "Custom" && (!customStart.trim() || !customEnd.trim())) {
        setError("Custom shift requires start and end time.");
        return;
      }
      if (shiftType === "Custom" && customStart === customEnd) {
        setError("Start and end time cannot be the same.");
        return;
      }
    }
    setSubmitting(true);
    if (editingRequest) {
      const res = await updateAvailabilityAction(editingRequest.id, {
        entry_type: entryType,
        notes: notes.trim() || undefined,
        ...(entryType === "availability" && {
          shift_type: shiftType,
          ...(shiftType === "Custom" && {
            custom_start_time: customStart.trim(),
            custom_end_time: customEnd.trim(),
          }),
        }),
      });
      setSubmitting(false);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSuccess("Availability updated.");
      setEditingRequest(null);
      router.refresh();
      return;
    }
    const res = await submitAvailabilityAction({
      week_start: weekStart,
      day,
      entry_type: entryType,
      notes: notes.trim() || undefined,
      ...(entryType === "availability" && {
        shift_type: shiftType,
        ...(shiftType === "Custom" && {
          custom_start_time: customStart.trim(),
          custom_end_time: customEnd.trim(),
        }),
      }),
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess("Availability submitted — you’re all set for this week.");
    setNotes("");
    router.refresh();
  };

  const byDay = React.useMemo(() => {
    const order = (r: WeeklyAvailabilityRequest) =>
      r.entry_type === "day_off" ? -1 : r.shift_type === "Morning" ? 0 : r.shift_type === "Night" ? 1 : 2;
    return DAYS.map((d) => ({
      day: d,
      entries: requests
        .filter((r) => r.day === d)
        .sort((a, b) => order(a) - order(b)),
    }));
  }, [requests]);

  const daysWithSubmission = React.useMemo(() => new Set(requests.map((r) => r.day)), [requests]);

  const dayOptionsAvailable = React.useMemo(
    () => DAYS.filter((d) => editingRequest != null || !daysWithSubmission.has(d)).map((d) => ({ value: d, label: d })),
    [editingRequest, daysWithSubmission]
  );

  React.useEffect(() => {
    if (editingRequest) return;
    if (dayOptionsAvailable.length === 0) return;
    if (!dayOptionsAvailable.some((o) => o.value === day)) {
      setDay(dayOptionsAvailable[0]!.value as WeeklyProgramDay);
    }
  }, [day, dayOptionsAvailable, editingRequest]);

  const entryTypeOptions = [
    { value: "availability", label: "Availability" },
    { value: "day_off", label: "Day off" },
  ];

  const shiftOptions = [
    { value: "Morning", label: "Morning (12:00–20:00)" },
    { value: "Night", label: "Night (20:00–03:00)" },
    { value: "Custom", label: "Custom" },
  ];

  return (
    <div className="weekly-availability-page space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-pink-500/15 bg-gradient-to-br from-pink-500/[0.07] via-black/45 to-fuchsia-950/20 px-6 py-6 backdrop-blur-xl"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 0 36px -10px hsl(330 80% 55% / 0.12)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-200/50">Your schedule</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">My weekly availability</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-white/65">
          Submit when you’re available for the selected week. This is not the final schedule—admins use it when building the
          weekly program.
        </p>
      </motion.div>

      <AnimatePresence mode="sync">
        {error ? (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl border border-red-500/35 bg-red-500/10 px-5 py-4 text-sm text-red-100"
            role="alert"
          >
            {error}
          </motion.div>
        ) : null}
        {success ? (
          <motion.div
            key={success}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="flex items-start gap-3 rounded-2xl border border-pink-400/35 bg-gradient-to-r from-pink-500/15 via-pink-500/10 to-fuchsia-600/10 px-5 py-4 shadow-[0_0_32px_-10px_rgba(236,72,153,0.35)]"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-pink-300" aria-hidden />
            <div>
              <p className="font-semibold text-pink-100">{success}</p>
              <p className="mt-1 text-xs text-white/55">
                You can edit or remove pending rows from Previous submissions.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/45 p-5 backdrop-blur-xl"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.08)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            <CalendarRange className="h-4 w-4 text-pink-300/80" aria-hidden />
            Week
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => goToWeek(-1)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:border-pink-500/30 hover:bg-pink-500/10"
          >
            ← Previous
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(weeklyAvailabilityUrl(getThisWeekMonday()))}
            className="rounded-xl border border-pink-500/40 bg-pink-500/15 px-4 py-2.5 text-sm font-medium text-pink-100 transition-colors hover:bg-pink-500/25"
          >
            This week
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => goToWeek(1)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:border-pink-500/30 hover:bg-pink-500/10"
          >
            Next →
          </motion.button>
          <span className="ml-1 text-sm font-medium text-white/85">Week of {formatWeekLabel(weekStart)}</span>
        </div>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-2">
        <motion.div
          layout
          className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/50 p-6 backdrop-blur-xl transition-shadow duration-300 focus-within:shadow-[0_0_40px_-12px_hsl(330_80%_55%/0.15)]"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)" }}
        >
          <div className="mb-5 border-b border-pink-500/10 pb-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/90">
              <Sparkles className="h-4 w-4 text-pink-400" aria-hidden />
              {editingRequest ? "Edit availability" : "Add availability"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0 }}>
              <FormField label="Entry type" icon={<ListChecks />} htmlFor="avail-entry-type">
                <FormSelect
                  id="avail-entry-type"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as WeeklyAvailabilityEntryType)}
                >
                  {entryTypeOptions.map((o) => (
                    <option key={o.value} value={o.value} className={selectOptionClass}>
                      {o.label}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </motion.div>

            <div
              className={cn(
                "grid grid-cols-1 gap-4",
                entryType === "availability" && "sm:grid-cols-2"
              )}
            >
              <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.04 }}>
                <FormField
                  label="Day"
                  icon={<Calendar />}
                  htmlFor={
                    editingRequest
                      ? "avail-day"
                      : dayOptionsAvailable.length > 0
                        ? "avail-day"
                        : "avail-day-empty"
                  }
                  required={!editingRequest && dayOptionsAvailable.length > 0}
                >
                  {editingRequest ? (
                    <FormInput
                      id="avail-day"
                      readOnly
                      tabIndex={-1}
                      value={day}
                      className="cursor-default opacity-95"
                      aria-readonly="true"
                    />
                  ) : dayOptionsAvailable.length > 0 ? (
                    <FormSelect
                      id="avail-day"
                      value={
                        dayOptionsAvailable.some((o) => o.value === day)
                          ? day
                          : (dayOptionsAvailable[0]?.value ?? "Monday")
                      }
                      onChange={(e) => setDay(e.target.value as WeeklyProgramDay)}
                      required
                    >
                      {dayOptionsAvailable.map((o) => (
                        <option key={o.value} value={o.value} className={selectOptionClass}>
                          {o.label}
                        </option>
                      ))}
                    </FormSelect>
                  ) : (
                    <p
                      id="avail-day-empty"
                      className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/55"
                    >
                      You’ve already submitted for every day this week.
                    </p>
                  )}
                </FormField>
              </motion.div>
              {entryType === "availability" && (
                <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.08 }}>
                  <FormField label="Shift type" icon={<Clock />} htmlFor="avail-shift-type">
                    <FormSelect
                      id="avail-shift-type"
                      value={shiftType}
                      onChange={(e) => setShiftType(e.target.value as WeeklyProgramShiftType)}
                    >
                      {shiftOptions.map((o) => (
                        <option key={o.value} value={o.value} className={selectOptionClass}>
                          {o.label}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                </motion.div>
              )}
            </div>

            {entryType === "availability" && shiftType === "Custom" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <FormField label="Start" icon={<Clock />} htmlFor="avail-custom-start" required>
                  <FormInput
                    id="avail-custom-start"
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="weekly-avail-time-input"
                    error={
                      !customStart.trim() && entryType === "availability" && shiftType === "Custom"
                        ? "Start time is required for a custom shift."
                        : undefined
                    }
                  />
                </FormField>
                <FormField label="End" icon={<Clock />} htmlFor="avail-custom-end" required>
                  <FormInput
                    id="avail-custom-end"
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="weekly-avail-time-input"
                    error={
                      !customEnd.trim() && entryType === "availability" && shiftType === "Custom"
                        ? "End time is required for a custom shift."
                        : undefined
                    }
                  />
                </FormField>
              </motion.div>
            )}

            <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.1 }}>
              <FormField
                label="Notes (optional)"
                icon={<StickyNote />}
                htmlFor="avail-notes"
                description="Anything admins should know when building the program."
              >
                <FormTextarea
                  id="avail-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. prefer morning"
                />
              </FormField>
            </motion.div>

            <motion.div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-stretch" layout>
              <FormSubmitButton
                disabled={submitting || (!editingRequest && dayOptionsAvailable.length === 0)}
                loading={submitting}
                className="sm:min-w-0 sm:flex-1"
              >
                {submitting ? "Saving…" : editingRequest ? "Save changes" : "Submit availability"}
              </FormSubmitButton>
              {editingRequest && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCancelEdit}
                  className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition-colors hover:border-white/25 hover:bg-white/10 sm:self-stretch"
                >
                  Cancel
                </motion.button>
              )}
            </motion.div>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]/90 backdrop-blur-xl"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.08)" }}
        >
          <div className="border-b border-white/10 bg-[#1a1a1a] px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/90">
              <CalendarDays className="h-4 w-4 text-pink-400" aria-hidden />
              Previous submissions
            </h2>
            <p className="mt-1 text-xs text-white/45">This week — edit or delete pending rows.</p>
          </div>
          <div className="max-h-[28rem] space-y-3 overflow-y-auto bg-[#0d0d0d] p-4">
            {requests.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/45">No availability submitted for this week yet.</p>
            ) : (
              byDay.map(({ day: d, entries }) =>
                entries.length > 0 ? (
                  <div key={d}>
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-200/55">
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-pink-500/25" aria-hidden />
                      {d}
                      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-pink-500/25" aria-hidden />
                    </p>
                    <ul className="space-y-3">
                      {entries.map((r) => (
                        <motion.li
                          key={r.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "group rounded-xl border border-white/10 bg-[#1a1a1a] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                            "transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-500/40 hover:bg-[#1f1f1f]",
                            "hover:shadow-[0_16px_44px_-14px_rgba(236,72,153,0.32)]"
                          )}
                        >
                          {r.entry_type === "day_off" ? (
                            <div className="flex gap-3">
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/20 transition-[box-shadow,transform] group-hover:scale-[1.02] group-hover:ring-pink-500/30">
                                <Palmtree className="h-5 w-5" aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-pink-100">{d} — Day off</span>
                                  <span className={cn("rounded-lg px-2 py-0.5 text-xs font-medium capitalize", statusBadgeClass(r.status))}>
                                    {r.status}
                                  </span>
                                </div>
                                {r.notes?.trim() ? (
                                  <p className="mt-1.5 truncate text-xs text-white/50">Notes: {r.notes}</p>
                                ) : null}
                              </div>
                            </div>
                          ) : r.entry_type === "availability" && (r.shift_type === "Morning" || r.shift_type === "Night") ? (
                            <div className="flex gap-3">
                              <span
                                className={cn(
                                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-[box-shadow,transform] group-hover:scale-[1.02] group-hover:ring-pink-500/30",
                                  r.shift_type === "Morning"
                                    ? "bg-amber-500/15 text-amber-200 ring-amber-500/25"
                                    : "bg-indigo-500/15 text-indigo-200 ring-indigo-500/25"
                                )}
                              >
                                {r.shift_type === "Morning" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-pink-100">
                                    {d} — {r.shift_type}
                                  </span>
                                  <span className={cn("rounded-lg px-2 py-0.5 text-xs font-medium capitalize", statusBadgeClass(r.status))}>
                                    {r.status}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-white/55">
                                  {r.shift_type === "Morning" ? "12:00–20:00" : "20:00–03:00"}
                                </p>
                                {r.notes?.trim() ? (
                                  <p className="mt-1 truncate text-xs text-white/50">Notes: {r.notes}</p>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3">
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/25 transition-[box-shadow,transform] group-hover:scale-[1.02] group-hover:ring-pink-500/30">
                                <Clock className="h-5 w-5" aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-pink-100">{d} — Custom</span>
                                  <span className={cn("rounded-lg px-2 py-0.5 text-xs font-medium capitalize", statusBadgeClass(r.status))}>
                                    {r.status}
                                  </span>
                                </div>
                                <p className="mt-1 font-mono text-sm text-white/75">
                                  {formatCustomTime(r.custom_start_time)} – {formatCustomTime(r.custom_end_time)}
                                </p>
                                {r.notes?.trim() ? (
                                  <p className="mt-1 truncate text-xs text-white/50">Notes: {r.notes}</p>
                                ) : null}
                              </div>
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleEdit(r)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-xs font-medium text-white/90 transition-all hover:border-pink-500/40 hover:bg-pink-500/10 hover:shadow-[0_0_20px_-10px_rgba(236,72,153,0.35)]"
                            >
                              <Pencil className="h-3.5 w-3.5 text-pink-300/90" aria-hidden />
                              Edit
                            </motion.button>
                            {r.status === "submitted" ? (
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.97 }}
                                disabled={deletingId === r.id}
                                onClick={() => void handleDelete(r)}
                                aria-label={
                                  deletingId === r.id ? "Removing submission" : `Delete ${d} submission`
                                }
                                title="Delete submission"
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/35 bg-red-500/10 text-red-200 transition-all hover:border-red-400/60 hover:bg-red-500/20 hover:shadow-[0_0_22px_-8px_rgba(248,113,113,0.45)] disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                                <span className="sr-only">
                                  {deletingId === r.id ? "Removing…" : "Delete"}
                                </span>
                              </motion.button>
                            ) : null}
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )
            )}
          </div>
        </motion.div>
      </div>

      <style jsx global>{`
        .weekly-availability-page .weekly-avail-time-input {
          accent-color: rgb(236 72 153);
          color-scheme: dark;
        }
        .weekly-availability-page .weekly-avail-time-input::-webkit-calendar-picker-indicator {
          filter: invert(0.85) sepia(1) saturate(5) hue-rotate(280deg) opacity(0.85);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
