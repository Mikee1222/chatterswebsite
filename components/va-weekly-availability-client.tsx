"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Clock, ListChecks, StickyNote } from "lucide-react";
import { submitAvailabilityVaAction, updateAvailabilityVaAction } from "@/app/actions/weekly-availability-va";
import { vaWeeklyAvailabilityUrl } from "@/lib/routes";
import { addDays, getThisWeekMonday, normalizeWeekStart, formatWeekLabel } from "@/lib/weekly-program";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { cn } from "@/lib/utils";
import type { WeeklyAvailabilityRequest, WeeklyProgramDay, WeeklyProgramShiftType, WeeklyAvailabilityEntryType } from "@/types";

const selectOptionClass = "bg-[#1a1a1a] text-white";

const fieldMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

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
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

type Props = {
  weekStart: string;
  initialRequests: WeeklyAvailabilityRequest[];
};

export function VaWeeklyAvailabilityClient({ weekStart: initialWeekStart, initialRequests }: Props) {
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

  React.useEffect(() => setRequests(initialRequests), [weekStart, initialRequests]);

  const goToWeek = (offset: number) => {
    router.push(vaWeeklyAvailabilityUrl(addDays(weekStart, offset * 7)));
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
      const res = await updateAvailabilityVaAction(editingRequest.id, {
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
    const res = await submitAvailabilityVaAction({
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
    setSuccess("Availability submitted.");
    setNotes("");
    router.refresh();
  };

  const byDay = React.useMemo(() => {
    const order = (r: WeeklyAvailabilityRequest) =>
      r.entry_type === "day_off" ? -1 : r.shift_type === "Morning" ? 0 : r.shift_type === "Night" ? 1 : 2;
    return DAYS.map((d) => ({
      day: d,
      entries: requests.filter((r) => r.day === d).sort((a, b) => order(a) - order(b)),
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
    <>
    <div className="space-y-8">
      <div
        className="rounded-2xl border border-white/10 bg-black/40 px-6 py-5 backdrop-blur-xl"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 32px -8px hsl(330 80% 55% / 0.08)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">VA schedule</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">My weekly availability</h1>
        <p className="mt-1 text-white/60">Submit when you’re available for the selected week. Admins use this when building the VA weekly program.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</div>
      )}
      {success && (
        <div className="rounded-2xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-5 py-4 text-sm text-[hsl(330,90%,75%)]">{success}</div>
      )}

      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Week</span>
          <button type="button" onClick={() => goToWeek(-1)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors">
            ← Previous
          </button>
          <button type="button" onClick={() => router.push(vaWeeklyAvailabilityUrl(getThisWeekMonday()))} className="rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/25 transition-colors">
            This week
          </button>
          <button type="button" onClick={() => goToWeek(1)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors">
            Next →
          </button>
          <span className="ml-2 text-sm font-medium text-white/80">Week of {formatWeekLabel(weekStart)}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)" }}
        >
          <div className="border-b border-white/10 pb-4 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/90">
              {editingRequest ? "Edit availability" : "Add availability"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="weekly-availability-page mt-4 space-y-4">
            <motion.div {...fieldMotion}>
              <FormField label="Entry type" icon={<ListChecks />} htmlFor="va-avail-entry-type">
                <FormSelect
                  id="va-avail-entry-type"
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
            <div className={cn("grid grid-cols-1 gap-4", entryType === "availability" && "sm:grid-cols-2")}>
              <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.04 }}>
                <FormField
                  label="Day"
                  icon={<Calendar />}
                  htmlFor={
                    editingRequest ? "va-avail-day" : dayOptionsAvailable.length > 0 ? "va-avail-day" : "va-avail-day-empty"
                  }
                  required={!editingRequest && dayOptionsAvailable.length > 0}
                >
                  {editingRequest ? (
                    <FormInput
                      id="va-avail-day"
                      readOnly
                      tabIndex={-1}
                      value={day}
                      className="cursor-default opacity-95"
                      aria-readonly="true"
                    />
                  ) : dayOptionsAvailable.length > 0 ? (
                    <FormSelect
                      id="va-avail-day"
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
                      id="va-avail-day-empty"
                      className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/55"
                    >
                      You’ve already submitted for every day this week.
                    </p>
                  )}
                </FormField>
              </motion.div>
              {entryType === "availability" && (
                <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.08 }}>
                  <FormField label="Shift type" icon={<Clock />} htmlFor="va-avail-shift-type">
                    <FormSelect
                      id="va-avail-shift-type"
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Start" icon={<Clock />} htmlFor="va-avail-custom-start" required>
                  <FormInput
                    id="va-avail-custom-start"
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
                <FormField label="End" icon={<Clock />} htmlFor="va-avail-custom-end" required>
                  <FormInput
                    id="va-avail-custom-end"
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
              </div>
            )}
            <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.1 }}>
              <FormField
                label="Notes (optional)"
                icon={<StickyNote />}
                htmlFor="va-avail-notes"
                description="Anything admins should know for the VA program."
              >
                <FormTextarea
                  id="va-avail-notes"
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
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)" }}>
          <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/90">Your submissions this week</h2>
          </div>
          <div className="max-h-96 overflow-y-auto p-3 space-y-2">
            {requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/50">No availability submitted for this week yet.</p>
            ) : (
              byDay.map(({ day: d, entries }) =>
                entries.length > 0 ? (
                  <div key={d}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-1.5">{d}</p>
                    {entries.map((r) => (
                      <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 mb-2 text-sm">
                        {r.entry_type === "day_off" ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-[hsl(330,90%,75%)]">{d} — Day off</span>
                              <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${r.status === "submitted" ? "bg-amber-500/20 text-amber-300" : r.status === "used" ? "bg-emerald-500/20 text-emerald-300" : r.status === "rejected" ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/70"}`}>{r.status}</span>
                            </div>
                            {r.notes?.trim() && <p className="mt-1 text-white/50 truncate">notes: {r.notes}</p>}
                          </>
                        ) : r.entry_type === "availability" && (r.shift_type === "Morning" || r.shift_type === "Night") ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-[hsl(330,90%,75%)]">{d} — {r.shift_type}</span>
                              <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${r.status === "submitted" ? "bg-amber-500/20 text-amber-300" : r.status === "used" ? "bg-emerald-500/20 text-emerald-300" : r.status === "rejected" ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/70"}`}>{r.status}</span>
                            </div>
                            <p className="mt-1 text-white/60 text-xs">{r.shift_type === "Morning" ? "12:00–20:00" : "20:00–03:00"}</p>
                            {r.notes?.trim() && <p className="mt-1 text-white/50 truncate">notes: {r.notes}</p>}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-[hsl(330,90%,75%)]">{d} — Custom</span>
                              <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${r.status === "submitted" ? "bg-amber-500/20 text-amber-300" : r.status === "used" ? "bg-emerald-500/20 text-emerald-300" : r.status === "rejected" ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/70"}`}>{r.status}</span>
                            </div>
                            <p className="mt-1 text-white/70">{formatCustomTime(r.custom_start_time)} – {formatCustomTime(r.custom_end_time)}</p>
                            {r.notes?.trim() && <p className="mt-1 text-white/50 truncate">notes: {r.notes}</p>}
                          </>
                        )}
                        <div className="mt-2">
                          <button type="button" onClick={() => handleEdit(r)} className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition-colors">
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null
              )
            )}
          </div>
        </div>
      </div>
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
  </>
  );
}
