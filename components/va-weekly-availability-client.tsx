"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitAvailabilityVaAction, updateAvailabilityVaAction } from "@/app/actions/weekly-availability-va";
import { formatDateEuropean } from "@/lib/format";
import { vaWeeklyAvailabilityUrl } from "@/lib/routes";
import { addDays, getThisWeekMonday, normalizeWeekStart, formatWeekLabel } from "@/lib/weekly-program";
import { Label, Select, Textarea, SubmitButton } from "@/components/ui/form";
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

  return (
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
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <Label>Entry type</Label>
              <Select value={entryType} onChange={(e) => setEntryType(e.target.value as WeeklyAvailabilityEntryType)} className="mt-1">
                <option value="availability">Availability</option>
                <option value="day_off">Day off</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Day</Label>
                {editingRequest ? (
                  <p className="mt-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white/90">{day}</p>
                ) : (
                  <Select value={day} onChange={(e) => setDay(e.target.value as WeeklyProgramDay)} className="mt-1">
                    {DAYS.map((d) => (
                      <option key={d} value={d} disabled={daysWithSubmission.has(d)}>
                        {d}{daysWithSubmission.has(d) ? " (already submitted)" : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {entryType === "availability" && (
                <div>
                  <Label>Shift type</Label>
                  <Select value={shiftType} onChange={(e) => setShiftType(e.target.value as WeeklyProgramShiftType)} className="mt-1">
                    <option value="Morning">Morning (12:00–20:00)</option>
                    <option value="Night">Night (20:00–03:00)</option>
                    <option value="Custom">Custom</option>
                  </Select>
                </div>
              )}
            </div>
            {entryType === "availability" && shiftType === "Custom" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start time <span className="text-red-400">*</span></Label>
                    <input
                      type="time"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white [color-scheme:dark]"
                      aria-invalid={!customStart.trim()}
                      aria-describedby={!customStart.trim() || !customEnd.trim() ? "custom-time-error-va" : undefined}
                    />
                  </div>
                  <div>
                    <Label>End time <span className="text-red-400">*</span></Label>
                    <input
                      type="time"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white [color-scheme:dark]"
                      aria-invalid={!customEnd.trim()}
                      aria-describedby={!customStart.trim() || !customEnd.trim() ? "custom-time-error-va" : undefined}
                    />
                  </div>
                </div>
                {(!customStart.trim() || !customEnd.trim()) && (
                  <p id="custom-time-error-va" className="text-sm text-amber-300" role="alert">
                    Start and end time are required for Custom shift.
                  </p>
                )}
              </div>
            )}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. prefer morning" className="mt-1" />
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingRequest ? "Save changes" : "Submit availability"}
              </SubmitButton>
              {editingRequest && (
                <button type="button" onClick={handleCancelEdit} className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors">
                  Cancel
                </button>
              )}
            </div>
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
  );
}
