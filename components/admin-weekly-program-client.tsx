"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createProgramAction,
  updateProgramAction,
  deleteProgramAction,
} from "@/app/actions/weekly-program";
import { formatTimeEuropean, formatDateEuropean, formatDateTimeEuropean, formatTimeFromISO, isoToEuropeanDisplay, parseEuropeanDateInput } from "@/lib/format";
import { GlassModal, Input, Label, Select, Textarea, Checkbox, SubmitButton, ButtonPrimary, ButtonSecondary } from "@/components/ui/form";
import { adminWeeklyProgramUrl, adminWeeklyProgramVaUrl } from "@/lib/routes";
import { getTimesForShiftType, buildCustomShiftTimes, getThisWeekMonday, addDays, normalizeWeekStart, formatWeekLabel } from "@/lib/weekly-program";
import { rangesOverlap } from "@/lib/weekly-program-conflicts";
import type { ConflictSummary, CoverageBoard } from "@/lib/weekly-program-conflicts";
import type { WeeklyProgramRecord, WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";
import type { ModelRecord } from "@/types";
import type { WeeklyAvailabilityRequest } from "@/types";

/** Format ISO start/end to time range string (HH:mm–HH:mm). Uses UTC for schedule times. */
function formatTimeRange(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return "—";
  return `${formatTimeFromISO(startIso)}–${formatTimeFromISO(endIso)}`;
}

/** Duration in hours between two ISO timestamps (supports overnight). */
function durationHours(startIso: string, endIso: string): number {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return Math.round((b - a) / (1000 * 60 * 60) * 10) / 10;
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

const SHIFT_TYPES: WeeklyProgramShiftType[] = ["Morning", "Night"];

type Chatter = { id: string; full_name: string };

function getModelNames(modelIds: string[], modelss: ModelRecord[]): string[] {
  return modelIds
    .map((id) => modelss.find((m) => m.id === id)?.model_name)
    .filter((n): n is string => Boolean(n));
}

type Props = {
  programs: WeeklyProgramRecord[];
  chatters: Chatter[];
  modelss: ModelRecord[];
  currentWeekStart: string;
  conflicts: { type: string; message: string; recordIds: string[] }[];
  conflictSummary: ConflictSummary;
  conflictRecordIds: string[];
  coverageBoard: CoverageBoard;
  lastAssignmentMap: Record<string, { date: string; dateTime: string; relative: string }>;
  suggestionsByKey?: Record<string, { type: string; text: string }[]>;
  availabilityRequests: WeeklyAvailabilityRequest[];
};

function lastWithLabel(
  lastAssignmentMap: Record<string, { date: string; dateTime: string; relative: string }>,
  chatterId: string,
  modelId: string,
  modelName: string
): string | null {
  const info = lastAssignmentMap[`${chatterId}:${modelId}`];
  if (!info) return null;
  return `Last with ${modelName}: ${info.relative}`;
}

export function AdminWeeklyProgramClient({
  programs: initialPrograms,
  chatters,
  modelss,
  currentWeekStart,
  conflicts,
  conflictSummary,
  conflictRecordIds,
  coverageBoard,
  lastAssignmentMap,
  suggestionsByKey,
  availabilityRequests,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [programs, setPrograms] = React.useState(initialPrograms);
  const [filterChatter, setFilterChatter] = React.useState("");
  const [filterModel, setFilterModel] = React.useState("");
  const [filterShiftType, setFilterShiftType] = React.useState<WeeklyProgramShiftType | "">("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<WeeklyProgramRecord | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [prefillFromAvailability, setPrefillFromAvailability] = React.useState<WeeklyAvailabilityRequest | null>(null);
  const [availFilterChatter, setAvailFilterChatter] = React.useState("");
  const [availFilterShiftType, setAvailFilterShiftType] = React.useState<WeeklyProgramShiftType | "">("");
  const [availFilterDay, setAvailFilterDay] = React.useState<WeeklyProgramDay | "">("");
  const [mobileHelperOpen, setMobileHelperOpen] = React.useState(false);

  React.useEffect(() => setPrograms(initialPrograms), [initialPrograms]);

  const effectiveWeekStart = normalizeWeekStart(searchParams.get("week_start") || currentWeekStart);

  const filtered = React.useMemo(() => {
    let list = programs;
    if (filterChatter) list = list.filter((p) => p.chatter_id === filterChatter);
    if (filterModel) list = list.filter((p) => p.model_ids.includes(filterModel));
    if (filterShiftType) list = list.filter((p) => p.shift_type === filterShiftType);
    return list;
  }, [programs, filterChatter, filterModel, filterShiftType]);

  const byDay = React.useMemo(() => {
    return DAYS.map((day) => ({
      day,
      entries: filtered
        .filter((e) => e.day === day)
        .sort((a, b) => {
          const order = (s: string) => (s === "Morning" ? 0 : s === "Night" ? 1 : 2);
          return order(a.shift_type) - order(b.shift_type);
        }),
    }));
  }, [filtered]);

  const renderedEntryCount = byDay.reduce((acc, d) => acc + d.entries.length, 0);

  const filteredAvailabilityRequests = React.useMemo(() => {
    const list = Array.isArray(availabilityRequests) ? availabilityRequests : [];
    let out = list;
    if (availFilterChatter) out = out.filter((r) => r.chatter_id === availFilterChatter);
    if (availFilterShiftType) out = out.filter((r) => r.shift_type === availFilterShiftType);
    if (availFilterDay) out = out.filter((r) => r.day === availFilterDay);
    return out;
  }, [availabilityRequests, availFilterChatter, availFilterShiftType, availFilterDay]);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[admin weekly-program] availability helper panel", {
        selected_week_start: effectiveWeekStart,
        fetched_weekly_availability_requests_count: Array.isArray(availabilityRequests) ? availabilityRequests.length : 0,
        filtered_count_after_helper_filters: filteredAvailabilityRequests.length,
      });
    }
  }, [effectiveWeekStart, availabilityRequests, filteredAvailabilityRequests.length]);

  const availabilityChatters = React.useMemo(() => {
    const list = Array.isArray(availabilityRequests) ? availabilityRequests : [];
    const seen = new Set<string>();
    return list
      .filter((r) => r.chatter_id && !seen.has(r.chatter_id) && (seen.add(r.chatter_id), true))
      .map((r) => ({ id: r.chatter_id, full_name: r.chatter_name || "—" }));
  }, [availabilityRequests]);

  const useRequestInSchedule = (request: WeeklyAvailabilityRequest) => {
    setPrefillFromAvailability(request);
    setCreateOpen(true);
    setEditingEntry(null);
    setError(null);
  };

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[admin weekly-program client] render", {
        selected_week_start: effectiveWeekStart,
        programs_count: programs.length,
        filtered_count: filtered.length,
        rendered_entry_count: renderedEntryCount,
      });
    }
  }, [effectiveWeekStart, programs.length, filtered.length, renderedEntryCount]);

  const goToWeek = (offset: number) => {
    const next = addDays(effectiveWeekStart, offset * 7);
    router.push(adminWeeklyProgramUrl(next));
  };

  const goToThisWeek = () => {
    router.push(adminWeeklyProgramUrl(getThisWeekMonday()));
  };

  const modelIdToName = React.useMemo(() => {
    const map: Record<string, string> = {};
    modelss.forEach((m) => { map[m.id] = m.model_name; });
    return map;
  }, [modelss]);

  const handleCreate = async (fields: {
    chatter_id: string;
    chatter_name: string;
    model_ids: string[];
    day: WeeklyProgramDay;
    shift_type: WeeklyProgramShiftType;
    week_start: string;
    notes: string;
    custom_start_time?: string;
    custom_end_time?: string;
  }) => {
    setError(null);
    const res = await createProgramAction({
      chatter: [fields.chatter_id],
      chatter_name: fields.chatter_name,
      models: fields.model_ids,
      day: fields.day,
      shift_type: fields.shift_type,
      week_start: fields.week_start,
      notes: fields.notes || "",
      modelIdToName,
      ...(fields.shift_type === "Custom" && {
        custom_start_time: fields.custom_start_time,
        custom_end_time: fields.custom_end_time,
      }),
    });
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess("Scheduled shift created.");
    setCreateOpen(false);
    // Use the week_start returned by the action (normalized Monday) so URL and fetch stay in sync.
    window.location.href = adminWeeklyProgramUrl(res.week_start);
  };

  const handleUpdate = async (
    recordId: string,
    fields: {
      chatter_id: string;
      chatter_name: string;
      model_ids: string[];
      day: WeeklyProgramDay;
      shift_type: WeeklyProgramShiftType;
      week_start: string;
      notes: string;
      custom_start_time?: string;
      custom_end_time?: string;
    }
  ) => {
    setError(null);
    const res = await updateProgramAction(recordId, {
      chatter: [fields.chatter_id],
      chatter_name: fields.chatter_name,
      models: fields.model_ids,
      day: fields.day,
      shift_type: fields.shift_type,
      week_start: fields.week_start,
      notes: fields.notes || "",
      modelIdToName,
      ...(fields.shift_type === "Custom" && {
        custom_start_time: fields.custom_start_time,
        custom_end_time: fields.custom_end_time,
      }),
    });
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess("Shift updated.");
    setEditingEntry(null);
    router.refresh();
  };

  const handleDelete = async (recordId: string) => {
    setError(null);
    setDeletingId(recordId);
    const res = await deleteProgramAction(recordId);
    setDeletingId(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess("Shift deleted.");
    router.refresh();
  };

  return (
    <div className="flex flex-col xl:flex-row xl:gap-6 gap-6">
      <div className="min-w-0 flex-1 space-y-6">
      {/* Mobile: Chatters | VA tab bar */}
      <div className="md:hidden">
        <div className="flex rounded-xl border border-white/10 bg-black/60 p-1 backdrop-blur-xl">
          <span className="flex flex-1 items-center justify-center rounded-lg bg-[hsl(330,80%,55%)]/20 py-3 text-sm font-semibold text-[hsl(330,90%,75%)]">Chatters</span>
          <Link
            href={adminWeeklyProgramVaUrl(searchParams.get("week_start") || undefined)}
            className="flex flex-1 items-center justify-center rounded-lg py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white/90"
          >
            VA
          </Link>
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Weekly program</h1>
        <p className="mt-1 text-sm text-white/60">Standard shifts: Morning 12:00–20:00, Night 20:00–03:00. Multiple models per chatter per shift.</p>
      </div>

      {error && (
        <div
          className={`rounded-2xl border px-5 py-4 text-sm ${
            error.includes("conflict") || error.includes("overlapping")
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-5 py-4 text-sm text-[hsl(330,90%,75%)]">
          {success}
        </div>
      )}

      {conflictSummary.total > 0 && (
        <div className="glass-card border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </span>
            <div>
              <p className="font-semibold text-amber-200">Conflict summary</p>
              <p className="mt-0.5 text-sm text-white/80">
                {conflictSummary.modelConflicts > 0 && <span>{conflictSummary.modelConflicts} model conflict{conflictSummary.modelConflicts !== 1 ? "s" : ""}</span>}
                {conflictSummary.modelConflicts > 0 && (conflictSummary.chatterOverlaps > 0 || conflictSummary.customOverlaps > 0 || conflictSummary.uncoveredCount > 0 || conflictSummary.tooManyModelsCount > 0) && " · "}
                {conflictSummary.chatterOverlaps > 0 && <span>{conflictSummary.chatterOverlaps} chatter overlap{conflictSummary.chatterOverlaps !== 1 ? "s" : ""}</span>}
                {conflictSummary.chatterOverlaps > 0 && (conflictSummary.customOverlaps > 0 || conflictSummary.uncoveredCount > 0 || conflictSummary.tooManyModelsCount > 0) && " · "}
                {conflictSummary.customOverlaps > 0 && <span>{conflictSummary.customOverlaps} overlapping custom shift{conflictSummary.customOverlaps !== 1 ? "s" : ""}</span>}
                {conflictSummary.customOverlaps > 0 && (conflictSummary.uncoveredCount > 0 || conflictSummary.tooManyModelsCount > 0) && " · "}
                {conflictSummary.uncoveredCount > 0 && <span>{conflictSummary.uncoveredCount} uncovered model{conflictSummary.uncoveredCount !== 1 ? "s" : ""}</span>}
                {conflictSummary.uncoveredCount > 0 && conflictSummary.tooManyModelsCount > 0 && " · "}
                {conflictSummary.tooManyModelsCount > 0 && <span>{conflictSummary.tooManyModelsCount} too many models</span>}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile: helper accordion in flow (after conflict, before week controls) */}
      <div className="glass-card overflow-hidden xl:hidden">
        <button
          type="button"
          onClick={() => setMobileHelperOpen((o) => !o)}
          className="flex w-full items-center justify-between border-b border-white/10 bg-black/40 px-4 py-4 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">Chatter availability</h2>
            <p className="mt-0.5 text-xs text-white/50">This week · helper</p>
          </div>
          <span className="text-white/60 transition-transform" style={{ transform: mobileHelperOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </span>
        </button>
        {mobileHelperOpen && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Select value={availFilterChatter} onChange={(e) => setAvailFilterChatter(e.target.value)} className="min-h-[48px] text-sm">
                <option value="">All chatters</option>
                {availabilityChatters.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </Select>
              <Select value={availFilterShiftType} onChange={(e) => setAvailFilterShiftType(e.target.value as WeeklyProgramShiftType | "")} className="min-h-[48px] text-sm">
                <option value="">All types</option>
                <option value="Morning">Morning</option>
                <option value="Night">Night</option>
                <option value="Custom">Custom</option>
              </Select>
              <Select value={availFilterDay} onChange={(e) => setAvailFilterDay(e.target.value as WeeklyProgramDay | "")} className="min-h-[48px] text-sm">
                <option value="">All days</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {filteredAvailabilityRequests.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/50">No submissions match</p>
              ) : (
                filteredAvailabilityRequests.map((r) => {
                  const timeStr = r.entry_type === "availability" && r.shift_type === "Custom" && (r.custom_start_time || r.custom_end_time)
                    ? ` · ${formatTimeFromISO(r.custom_start_time)}–${formatTimeFromISO(r.custom_end_time)}`
                    : "";
                  return (
                    <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white/95 truncate text-sm">{r.chatter_name || "—"}</p>
                          <p className="mt-0.5 text-xs text-white/60">
                            {r.day} · {r.entry_type === "day_off" ? "day off" : r.shift_type}{timeStr}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                          r.status === "submitted" ? "bg-amber-500/20 text-amber-300" :
                          r.status === "used" ? "bg-emerald-500/20 text-emerald-300" :
                          r.status === "rejected" ? "bg-red-500/20 text-red-300" :
                          "bg-white/10 text-white/70"
                        }`}>{r.status}</span>
                      </div>
                      {r.entry_type === "availability" ? (
                        <button
                          type="button"
                          onClick={() => useRequestInSchedule(r)}
                          className="mt-2 w-full min-h-[44px] rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/10 py-2 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/20"
                        >
                          Use in schedule
                        </button>
                      ) : (
                        <p className="mt-1 text-xs text-white/45 italic">Unavailable</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Week controls + filters: stacked on mobile, row on desktop */}
      <div className="glass-card flex flex-col gap-4 p-5 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Week</span>
          <button type="button" onClick={() => goToWeek(-1)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors">
            ← Previous
          </button>
          <button type="button" onClick={goToThisWeek} className="rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/25 transition-colors">
            This week
          </button>
          <button type="button" onClick={() => goToWeek(1)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors">
            Next →
          </button>
          <span className="ml-0 md:ml-2 text-sm font-medium text-white/80 w-full md:w-auto">Week of {formatWeekLabel(effectiveWeekStart)}</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={filterChatter} onChange={(e) => setFilterChatter(e.target.value)} className="w-full min-h-[44px] sm:min-w-[140px] sm:min-h-0">
            <option value="">All chatters</option>
            {chatters.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </Select>
          <Select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className="w-full min-h-[44px] sm:min-w-[140px] sm:min-h-0">
            <option value="">All models</option>
            {modelss.map((m) => <option key={m.id} value={m.id}>{m.model_name}</option>)}
          </Select>
          <Select value={filterShiftType} onChange={(e) => setFilterShiftType(e.target.value as WeeklyProgramShiftType | "")} className="w-full min-h-[44px] sm:min-w-[120px] sm:min-h-0">
            <option value="">All shifts</option>
            <option value="Morning">Morning</option>
            <option value="Night">Night</option>
          </Select>
          <ButtonPrimary type="button" onClick={() => { setCreateOpen(true); setError(null); setSuccess(null); }} className="w-full sm:w-auto">
            Create shift
          </ButtonPrimary>
        </div>
      </div>

      {/* Model coverage board */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Model coverage</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-white/10 bg-black/40 px-4 py-3">
              <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(330,90%,75%)]">Morning</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-white/50">Model</th>
                    {coverageBoard.days.map((d) => (
                      <th key={d} className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-white/50">{d.slice(0, 3)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverageBoard.morning.map((row, idx) => (
                    <tr key={coverageBoard.modelNames[idx]} className="border-b border-white/5">
                      <td className="px-3 py-2 font-medium text-white/90">{coverageBoard.modelNames[idx]}</td>
                      {row.map((cell) => (
                        <td key={cell.day} className="px-2 py-1.5 text-center">
                          <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${cell.covered ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                            {cell.covered ? (cell.chatterName ?? "—") : "Uncovered"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="border-b border-white/10 bg-black/40 px-4 py-3">
              <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(330,90%,75%)]">Night</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-white/50">Model</th>
                    {coverageBoard.days.map((d) => (
                      <th key={d} className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-white/50">{d.slice(0, 3)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverageBoard.night.map((row, idx) => (
                    <tr key={coverageBoard.modelNames[idx]} className="border-b border-white/5">
                      <td className="px-3 py-2 font-medium text-white/90">{coverageBoard.modelNames[idx]}</td>
                      {row.map((cell) => (
                        <td key={cell.day} className="px-2 py-1.5 text-center">
                          <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${cell.covered ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                            {cell.covered ? (cell.chatterName ?? "—") : "Uncovered"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile: week header + stacked day cards (vertical scroll) */}
      <section className="space-y-4 md:hidden">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Week at a glance</h2>
        <p className="text-base font-semibold text-white/90">Week of {formatWeekLabel(effectiveWeekStart)}</p>
        <div className="space-y-4">
          {byDay.map(({ day, entries }) => {
            const dayIndex = DAYS.indexOf(day);
            const dateYmd = addDays(effectiveWeekStart, dayIndex);
            const dateLabel = formatDateEuropean(dateYmd);
            return (
              <div key={day} className="glass-card overflow-hidden rounded-2xl border border-white/10">
                <div className="border-b border-white/10 bg-black/40 px-4 py-3">
                  <p className="text-base font-semibold uppercase tracking-wider text-white/90">{day}</p>
                  <p className="mt-0.5 text-sm text-white/50">{dateLabel}</p>
                </div>
                <div className="p-4 space-y-3">
                  {entries.length === 0 ? (
                    <p className="py-4 text-center text-sm text-white/45">No shifts</p>
                  ) : (
                    entries.map((e) => {
                      const names = getModelNames(e.model_ids, modelss);
                      const timeRange = e.start_time && e.end_time ? formatTimeRange(e.start_time, e.end_time) : "—";
                      return (
                        <div key={e.id} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                          <p className="text-sm font-semibold text-[hsl(330,90%,75%)]">{timeRange}</p>
                          <p className="mt-1 text-sm text-white/70">Models: {names.length ? names.join(", ") : "—"}</p>
                          {e.chatter_name && <p className="mt-0.5 text-xs text-white/50">{e.chatter_name}</p>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="hidden md:block space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Week at a glance</h2>
        <p className="text-xs text-white/50">Scroll horizontally to see all days. Each column is a day board.</p>
        <div className="overflow-x-auto pb-3 -mx-1">
          <div className="flex gap-6 min-w-max">
            {byDay.map(({ day, entries }) => {
              const dayIndex = DAYS.indexOf(day);
              const dateYmd = addDays(effectiveWeekStart, dayIndex);
              const dateLabel = formatDateEuropean(dateYmd);
              return (
                <div key={day} className="glass-card overflow-hidden flex flex-col w-[280px] min-w-[280px] min-h-[480px] shrink-0">
                  <div className="border-b border-white/10 bg-black/40 px-5 py-4 shrink-0">
                    <p className="text-base font-semibold uppercase tracking-wider text-white/90">{day}</p>
                    <p className="mt-1 text-sm text-white/50">{dateLabel}</p>
                  </div>
                  <div className="flex-1 p-4 space-y-3 min-h-0 overflow-y-auto">
                    {entries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-sm text-white/45">No shifts</p>
                        <button type="button" onClick={() => { setCreateOpen(true); setError(null); setSuccess(null); }} className="mt-3 rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/10 px-4 py-2 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/20 transition-colors">
                          Add shift
                        </button>
                      </div>
                    ) : (
                      entries.map((e) => {
                        const names = getModelNames(e.model_ids, modelss);
                        const hasConflict = conflictRecordIds.includes(e.id);
                        const modelCount = e.model_ids?.filter(Boolean).length ?? 0;
                        const hasTooManyModels = modelCount > 10;
                        const timeRange = e.start_time && e.end_time ? formatTimeRange(e.start_time, e.end_time) : "—";
                        return (
                          <div
                            key={e.id}
                            className={`rounded-xl border transition-all hover:border-white/20 ${
                              hasConflict
                                ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/30"
                                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                            }`}
                          >
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(330,90%,75%)]">{timeRange}</p>
                                  <p className="mt-1 font-medium text-white/95 truncate text-base">{e.chatter_name || "—"}</p>
                                  <p className="mt-1 text-sm text-white/65 truncate" title={names.length ? names.join(", ") : undefined}>
                                    {names.length ? names.join(", ") : "—"}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  {hasTooManyModels && (
                                    <span className="rounded-full bg-amber-500/25 p-1.5 text-amber-400" title="More than 10 models assigned">
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </span>
                                  )}
                                  {hasConflict && (
                                    <span className="rounded-full bg-amber-500/25 p-1.5 text-amber-400" title="Conflict">
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <button type="button" onClick={() => setEditingEntry(e)} className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors">
                                  Edit
                                </button>
                                <button type="button" onClick={() => handleDelete(e.id)} disabled={deletingId === e.id} className="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-300/80 hover:bg-red-500/10 disabled:opacity-50 transition-colors">
                                  {deletingId === e.id ? "…" : "Delete"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      </div>

      <aside className="hidden w-full shrink-0 xl:block xl:w-80">
        <div className="glass-card overflow-hidden sticky top-6">
          <div className="border-b border-white/10 bg-black/40 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/80">Chatter availability</h2>
            <p className="mt-0.5 text-[11px] text-white/50">This week · helper</p>
          </div>
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-1 gap-1.5">
              <Select value={availFilterChatter} onChange={(e) => setAvailFilterChatter(e.target.value)} className="text-xs">
                <option value="">All chatters</option>
                {availabilityChatters.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </Select>
              <Select value={availFilterShiftType} onChange={(e) => setAvailFilterShiftType(e.target.value as WeeklyProgramShiftType | "")} className="text-xs">
                <option value="">All types</option>
                <option value="Morning">Morning</option>
                <option value="Night">Night</option>
                <option value="Custom">Custom</option>
              </Select>
              <Select value={availFilterDay} onChange={(e) => setAvailFilterDay(e.target.value as WeeklyProgramDay | "")} className="text-xs">
                <option value="">All days</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div className="max-h-[380px] overflow-y-auto space-y-1.5">
              {filteredAvailabilityRequests.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-white/50">No submissions match</p>
              ) : (
                filteredAvailabilityRequests.map((r) => {
                  const timeStr = r.entry_type === "availability" && r.shift_type === "Custom" && (r.custom_start_time || r.custom_end_time)
                    ? ` · ${formatTimeFromISO(r.custom_start_time)}–${formatTimeFromISO(r.custom_end_time)}`
                    : "";
                  return (
                    <div key={r.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white/95 truncate text-xs">{r.chatter_name || "—"}</p>
                          <p className="mt-0.5 text-[11px] text-white/60">
                            {r.day} · {r.entry_type === "day_off" ? "day off" : r.shift_type}{timeStr}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          r.status === "submitted" ? "bg-amber-500/20 text-amber-300" :
                          r.status === "used" ? "bg-emerald-500/20 text-emerald-300" :
                          r.status === "rejected" ? "bg-red-500/20 text-red-300" :
                          "bg-white/10 text-white/70"
                        }`}>{r.status}</span>
                      </div>
                      {r.entry_type === "availability" ? (
                        <button
                          type="button"
                          onClick={() => useRequestInSchedule(r)}
                          className="mt-1.5 w-full rounded-md border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/10 py-1 text-[11px] font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/20 transition-colors"
                        >
                          Use in schedule
                        </button>
                      ) : (
                        <p className="mt-1 text-[10px] text-white/45 italic">Unavailable</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </aside>

      {(createOpen || editingEntry || prefillFromAvailability) && (
        <div className="fixed inset-0 z-50 flex overflow-hidden" role="dialog" aria-modal="true" aria-label="Create or edit shift">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden onClick={() => { setCreateOpen(false); setEditingEntry(null); setPrefillFromAvailability(null); setError(null); }} />
          {/* Mobile: full-screen sheet. Desktop: offset for sidebar, side panel */}
          <div
            className="relative flex h-full w-full flex-col overflow-hidden md:ml-64 md:w-[calc(100vw-16rem)] md:flex-row md:flex-1 md:flex-shrink-0 md:items-stretch md:gap-6 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border-0 bg-black/95 shadow-2xl md:min-w-[380px] md:max-w-2xl md:rounded-2xl md:border md:border-white/10" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7), 0 0 80px -24px hsl(330 80% 55% / 0.08)" }}>
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <ShiftEntryModal
                  asPanel
                  chatters={chatters}
                  modelss={modelss}
                  weekStart={effectiveWeekStart}
                  entry={editingEntry}
                  prefillFromAvailability={prefillFromAvailability}
                  coverageBoard={coverageBoard}
                  lastAssignmentMap={lastAssignmentMap}
                  programs={programs}
                  onClose={() => { setCreateOpen(false); setEditingEntry(null); setPrefillFromAvailability(null); setError(null); }}
                  onCreate={handleCreate}
                  onUpdate={editingEntry ? (fields) => handleUpdate(editingEntry.id, fields) : undefined}
                />
              </div>
            </div>
            <aside className="hidden md:flex md:h-full md:min-h-0 md:w-[400px] md:shrink-0 md:flex-col md:overflow-hidden md:rounded-2xl md:border md:border-white/10 md:bg-black/95 md:shadow-2xl md:shadow-black/50 md:backdrop-blur-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7), 0 0 80px -24px hsl(330 80% 55% / 0.08)" }}>
              <div className="border-b border-white/10 bg-black/40 px-5 py-4 shrink-0">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">Chatter availability</h2>
                <p className="mt-1 text-xs text-white/50">Filter and use in schedule while creating the shift</p>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                <div className="grid grid-cols-1 gap-3 shrink-0">
                  <Select value={availFilterChatter} onChange={(e) => setAvailFilterChatter(e.target.value)} className="text-sm">
                    <option value="">All chatters</option>
                    {availabilityChatters.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </Select>
                  <Select value={availFilterShiftType} onChange={(e) => setAvailFilterShiftType(e.target.value as WeeklyProgramShiftType | "")} className="text-sm">
                    <option value="">All types</option>
                    <option value="Morning">Morning</option>
                    <option value="Night">Night</option>
                    <option value="Custom">Custom</option>
                  </Select>
                  <Select value={availFilterDay} onChange={(e) => setAvailFilterDay(e.target.value as WeeklyProgramDay | "")} className="text-sm">
                    <option value="">All days</option>
                    {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pt-4">
                  {filteredAvailabilityRequests.length === 0 ? (
                    <p className="py-4 text-center text-sm text-white/50">No submissions match filters</p>
                  ) : (
                    filteredAvailabilityRequests.map((r) => {
                      const timeStr = r.entry_type === "availability" && r.shift_type === "Custom" && (r.custom_start_time || r.custom_end_time)
                        ? ` · ${formatTimeFromISO(r.custom_start_time)}–${formatTimeFromISO(r.custom_end_time)}`
                        : "";
                      return (
                        <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white/95 truncate text-sm">{r.chatter_name || "—"}</p>
                              <p className="mt-1 text-xs text-white/60">
                                {r.day} · {r.entry_type === "day_off" ? "day off" : r.shift_type}{timeStr}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              r.status === "submitted" ? "bg-amber-500/20 text-amber-300" :
                              r.status === "used" ? "bg-emerald-500/20 text-emerald-300" :
                              r.status === "rejected" ? "bg-red-500/20 text-red-300" :
                              "bg-white/10 text-white/70"
                            }`}>{r.status}</span>
                          </div>
                          {r.entry_type === "availability" ? (
                            <button
                              type="button"
                              onClick={() => useRequestInSchedule(r)}
                              className="mt-2 w-full rounded-lg border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/10 py-2 text-xs font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/20 transition-colors"
                            >
                              Use in schedule
                            </button>
                          ) : (
                            <p className="mt-1.5 text-xs text-white/45 italic">Unavailable this day</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

type ModalProps = {
  chatters: Chatter[];
  modelss: ModelRecord[];
  weekStart: string;
  entry: WeeklyProgramRecord | null;
  prefillFromAvailability: WeeklyAvailabilityRequest | null;
  coverageBoard: CoverageBoard;
  lastAssignmentMap: Record<string, { date: string; dateTime: string; relative: string }>;
  programs: WeeklyProgramRecord[];
  onClose: () => void;
  onCreate: (fields: {
    chatter_id: string;
    chatter_name: string;
    model_ids: string[];
    day: WeeklyProgramDay;
    shift_type: WeeklyProgramShiftType;
    week_start: string;
    notes: string;
    custom_start_time?: string;
    custom_end_time?: string;
  }) => Promise<void>;
  onUpdate?: (fields: {
    chatter_id: string;
    chatter_name: string;
    model_ids: string[];
    day: WeeklyProgramDay;
    shift_type: WeeklyProgramShiftType;
    week_start: string;
    notes: string;
    custom_start_time?: string;
    custom_end_time?: string;
  }) => Promise<void>;
  /** When true, render as a panel (no overlay/centering) for split layout with helper. */
  asPanel?: boolean;
};

function isoTimeToHHmm(iso: string | undefined): string {
  if (!iso || iso.length < 16) return "";
  return iso.slice(11, 16);
}

function ShiftEntryModal({ chatters, modelss, weekStart, entry, prefillFromAvailability, coverageBoard, lastAssignmentMap, programs, onClose, onCreate, onUpdate, asPanel }: ModalProps) {
  const isEdit = !!entry;
  const prefill = prefillFromAvailability ?? null;
  const [chatterId, setChatterId] = React.useState(() =>
    entry?.chatter_id ?? prefill?.chatter_id ?? ""
  );
  const [selectedModelIds, setSelectedModelIds] = React.useState<Set<string>>(new Set(entry?.model_ids ?? []));
  const [day, setDay] = React.useState<WeeklyProgramDay>(entry?.day ?? prefill?.day ?? "Monday");
  const [shiftType, setShiftType] = React.useState<WeeklyProgramShiftType>(entry?.shift_type ?? prefill?.shift_type ?? "Morning");
  const [weekStartVal, setWeekStartVal] = React.useState(normalizeWeekStart(entry?.week_start ?? weekStart));
  const [weekStartDisplay, setWeekStartDisplay] = React.useState(() => isoToEuropeanDisplay(normalizeWeekStart(entry?.week_start ?? weekStart)));
  React.useEffect(() => {
    setWeekStartDisplay(isoToEuropeanDisplay(weekStartVal));
  }, [weekStartVal]);
  const [customStartTime, setCustomStartTime] = React.useState(() => {
    if (entry?.shift_type === "Custom") return isoTimeToHHmm(entry.start_time);
    if (prefill?.shift_type === "Custom" && prefill.custom_start_time) return prefill.custom_start_time.length >= 16 ? prefill.custom_start_time.slice(11, 16) : prefill.custom_start_time;
    return "09:00";
  });
  const [customEndTime, setCustomEndTime] = React.useState(() => {
    if (entry?.shift_type === "Custom") return isoTimeToHHmm(entry.end_time);
    if (prefill?.shift_type === "Custom" && prefill.custom_end_time) return prefill.custom_end_time.length >= 16 ? prefill.custom_end_time.slice(11, 16) : prefill.custom_end_time;
    return "17:00";
  });
  const [notes, setNotes] = React.useState(entry?.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [modelSearch, setModelSearch] = React.useState("");
  const [availabilityFilter, setAvailabilityFilter] = React.useState<"all" | "free" | "taken">("all");
  const [customTimeError, setCustomTimeError] = React.useState<string | null>(null);
  const [modalLastAssignments, setModalLastAssignments] = React.useState<Record<string, { date: string; dateTime: string; relative: string }>>({});
  const [showTooManyModelsConfirm, setShowTooManyModelsConfirm] = React.useState(false);

  React.useEffect(() => {
    if (entry) setSelectedModelIds(new Set(entry.model_ids));
  }, [entry]);

  React.useEffect(() => {
    if (entry?.shift_type === "Custom") {
      setCustomStartTime(isoTimeToHHmm(entry.start_time));
      setCustomEndTime(isoTimeToHHmm(entry.end_time));
    }
  }, [entry?.id, entry?.shift_type, entry?.start_time, entry?.end_time]);

  React.useEffect(() => {
    if (prefillFromAvailability) {
      setChatterId(prefillFromAvailability.chatter_id);
      setDay(prefillFromAvailability.day);
      setShiftType(prefillFromAvailability.shift_type);
      if (prefillFromAvailability.shift_type === "Custom") {
        const st = prefillFromAvailability.custom_start_time;
        const et = prefillFromAvailability.custom_end_time;
        setCustomStartTime(st?.length >= 16 ? st.slice(11, 16) : st || "09:00");
        setCustomEndTime(et?.length >= 16 ? et.slice(11, 16) : et || "17:00");
      }
    }
  }, [prefillFromAvailability?.id]);

  React.useEffect(() => {
    if (!chatterId || isEdit) return;
    let cancelled = false;
    (async () => {
      const { getLastAssignmentsForChatterAction } = await import("@/app/actions/weekly-program");
      const map = await getLastAssignmentsForChatterAction(chatterId, modelss.map((m) => m.id));
      if (!cancelled) setModalLastAssignments(map ?? {});
    })();
    return () => { cancelled = true; };
  }, [chatterId, isEdit, modelss]);

  const assignmentsInModal: Record<string, { date: string; dateTime: string; relative: string }> =
    (isEdit ? (lastAssignmentMap ?? {}) : (modalLastAssignments ?? {}));
  const chatterName = chatters.find((c) => c.id === chatterId)?.full_name ?? "";

  const suggestions = React.useMemo(() => {
    const out: { type: string; text: string }[] = [];
    const dayIdx = DAYS.indexOf(day);
    if (shiftType === "Morning" && coverageBoard.morning.length > 0) {
      coverageBoard.morning.forEach((row, idx) => {
        const cell = row[dayIdx];
        if (cell && !cell.covered) out.push({ type: "uncovered", text: `${coverageBoard.modelNames[idx]} is uncovered for Morning on ${day}` });
      });
    }
    if (shiftType === "Night" && coverageBoard.night.length > 0) {
      coverageBoard.night.forEach((row, idx) => {
        const cell = row[dayIdx];
        if (cell && !cell.covered) out.push({ type: "uncovered", text: `${coverageBoard.modelNames[idx]} is uncovered for Night on ${day}` });
      });
    }
    selectedModelIds.forEach((mid) => {
      const key = `${chatterId}:${mid}`;
      const info = assignmentsInModal?.[key];
      const name = modelss.find((m) => m.id === mid)?.model_name ?? "this model";
      if (info) out.push({ type: "recently_handled", text: `You last had ${name} ${info.relative}` });
    });
    const chatterHasShiftThatDay = programs.some((p) => p.chatter_id === chatterId && p.day === day);
    if (!chatterHasShiftThatDay && chatterId) out.push({ type: "no_shift", text: "This chatter has no shift yet that day" });
    return out.slice(0, 6);
  }, [day, shiftType, coverageBoard, selectedModelIds, assignmentsInModal, chatterId, modelss, programs]);

  const preview = React.useMemo(() => {
    const dayIdx = DAYS.indexOf(day);
    const dateYmd = addDays(weekStartVal, dayIdx);
    const dateLabel = formatDateEuropean(dateYmd);
    let startIso: string;
    let endIso: string;
    if (shiftType === "Morning") {
      const t = getTimesForShiftType("Morning", dateYmd);
      startIso = t.start_time;
      endIso = t.end_time;
    } else if (shiftType === "Night") {
      const t = getTimesForShiftType("Night", dateYmd);
      startIso = t.start_time;
      endIso = t.end_time;
    } else {
      const startHHmm = customStartTime.trim();
      const endHHmm = customEndTime.trim();
      if (!startHHmm || !endHHmm || startHHmm === endHHmm) {
        return { dateLabel, day, chatterName, modelNames: [], shiftType, timeRange: "—", durationHours: null };
      }
      const built = buildCustomShiftTimes(dateYmd, startHHmm, endHHmm);
      startIso = built.start_time;
      endIso = built.end_time;
    }
    const timeRange = formatTimeRange(startIso, endIso);
    const hours = durationHours(startIso, endIso);
    const modelNames = Array.from(selectedModelIds)
      .map((id) => modelss.find((m) => m.id === id)?.model_name)
      .filter((n): n is string => Boolean(n));
    return { dateLabel, day, chatterName, modelNames, shiftType, timeRange, durationHours: hours };
  }, [weekStartVal, day, shiftType, customStartTime, customEndTime, chatterName, selectedModelIds, modelss]);

  const formTimeWindow = React.useMemo((): { startIso: string; endIso: string } | null => {
    const dayIdx = DAYS.indexOf(day);
    const dateYmd = addDays(weekStartVal, dayIdx);
    if (shiftType === "Morning") {
      const t = getTimesForShiftType("Morning", dateYmd);
      return { startIso: t.start_time, endIso: t.end_time };
    }
    if (shiftType === "Night") {
      const t = getTimesForShiftType("Night", dateYmd);
      return { startIso: t.start_time, endIso: t.end_time };
    }
    const startHHmm = customStartTime.trim();
    const endHHmm = customEndTime.trim();
    if (!startHHmm || !endHHmm || startHHmm === endHHmm) return null;
    const built = buildCustomShiftTimes(dateYmd, startHHmm, endHHmm);
    return { startIso: built.start_time, endIso: built.end_time };
  }, [weekStartVal, day, shiftType, customStartTime, customEndTime]);

  const modelAvailability = React.useMemo((): Record<string, { taken: boolean; takenBy?: string }> => {
    const result: Record<string, { taken: boolean; takenBy?: string }> = {};
    const window = formTimeWindow;
    const otherPrograms = programs.filter((p) => p.id !== entry?.id);
    for (const m of modelss) {
      result[m.id] = { taken: false };
      if (!window) continue;
      for (const p of otherPrograms) {
        if (!p.start_time || !p.end_time) continue;
        if (!p.model_ids.includes(m.id)) continue;
        if (!rangesOverlap(p.start_time, p.end_time, window.startIso, window.endIso)) continue;
        result[m.id] = { taken: true, takenBy: p.chatter_name ?? "—" };
        break;
      }
    }
    return result;
  }, [programs, entry?.id, modelss, formTimeWindow]);

  React.useEffect(() => {
    const next = new Set(selectedModelIds);
    let changed = false;
    next.forEach((id) => {
      if (modelAvailability[id]?.taken) {
        next.delete(id);
        changed = true;
      }
    });
    if (changed) setSelectedModelIds(next);
  }, [modelAvailability]);

  const filteredModels = React.useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    let list = modelss;
    if (q) list = list.filter((m) => m.model_name.toLowerCase().includes(q));
    if (availabilityFilter === "free") list = list.filter((m) => !modelAvailability[m.id]?.taken);
    else if (availabilityFilter === "taken") list = list.filter((m) => modelAvailability[m.id]?.taken);
    return list;
  }, [modelss, modelSearch, availabilityFilter, modelAvailability]);

  const toggleModel = (id: string) => {
    if (modelAvailability[id]?.taken) return;
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const performSave = React.useCallback(async () => {
    if (!chatterId || selectedModelIds.size === 0) return;
    setSaving(true);
    const fields = {
      chatter_id: chatterId,
      chatter_name: chatterName,
      model_ids: Array.from(selectedModelIds),
      day,
      shift_type: shiftType,
      week_start: weekStartVal,
      notes,
      ...(shiftType === "Custom" && {
        custom_start_time: customStartTime.trim(),
        custom_end_time: customEndTime.trim(),
      }),
    };
    if (onUpdate) await onUpdate(fields);
    else await onCreate(fields);
    setSaving(false);
  }, [chatterId, chatterName, selectedModelIds, day, shiftType, weekStartVal, notes, customStartTime, customEndTime, onUpdate, onCreate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomTimeError(null);
    if (!chatterId || selectedModelIds.size === 0) return;
    if (shiftType === "Custom") {
      const start = customStartTime.trim();
      const end = customEndTime.trim();
      if (!start || !end) {
        setCustomTimeError("Start time and End time are required for Custom shift.");
        return;
      }
      if (start === end) {
        setCustomTimeError("End time cannot equal Start time.");
        return;
      }
    }
    if (selectedModelIds.size > 10) {
      setShowTooManyModelsConfirm(true);
      return;
    }
    await performSave();
  };

  const title = isEdit ? "Edit scheduled shift" : "Create scheduled shift";
  const subtitle = "Chatter, day, shift type, and assign models.";

  const tooManyModelsDialog = showTooManyModelsConfirm ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="too-many-models-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={() => setShowTooManyModelsConfirm(false)} />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black/95 shadow-2xl shadow-black/50 backdrop-blur-xl px-6 py-5"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7), 0 0 80px -24px hsl(330 80% 55% / 0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="too-many-models-title" className="text-lg font-semibold tracking-tight text-white">Too many models assigned</h2>
            <p className="mt-2 text-sm text-white/70">
              This chatter currently has more than 10 models assigned in this shift. Managing too many models may reduce performance.
            </p>
            <p className="mt-1 text-sm text-white/60">Is this okay?</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowTooManyModelsConfirm(false)}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowTooManyModelsConfirm(false);
                  await performSave();
                }}
                disabled={saving}
                className="rounded-xl border border-[hsl(330,80%,55%)]/50 bg-[hsl(330,80%,55%)]/20 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/30 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Yes, continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const formContent = (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <div className="flex-1 space-y-5 p-4 pb-32 md:pb-5" style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
        <div className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
            <span className="font-medium text-[hsl(330,90%,75%)]">{preview.timeRange}</span>
            <span className="text-white/50">·</span>
            <span className="text-white/80">{preview.dateLabel} · {preview.day}</span>
            <span className="text-white/50">·</span>
            <span className="text-white/80 truncate max-w-[180px]">{preview.chatterName || "—"}</span>
            {preview.durationHours != null && (
              <span className="text-white/50">· {preview.durationHours}h</span>
            )}
          </div>
          {preview.modelNames.length > 0 && (
            <p className="mt-1.5 text-[11px] text-white/55 truncate">Models: {preview.modelNames.join(", ")}</p>
          )}
        </div>
        {suggestions.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 4).map((s, i) => (
                <span
                  key={i}
                  className={`inline-flex max-w-full truncate rounded px-2 py-0.5 text-[11px] font-medium ${
                    s.type === "uncovered" ? "bg-amber-500/15 text-amber-300" :
                    s.type === "recently_handled" ? "bg-[hsl(330,80%,55%)]/15 text-[hsl(330,90%,75%)]" :
                    s.type === "no_shift" ? "bg-white/10 text-white/70" :
                    "bg-white/10 text-white/60"
                  }`}
                  title={s.text}
                >
                  {s.text}
                </span>
              ))}
            </div>
          </div>
        )}
        <div>
          <Label>Chatter</Label>
          <Select required value={chatterId} onChange={(e) => setChatterId(e.target.value)} className="mt-1 w-full">
            <option value="">Select chatter</option>
            {chatters.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Day</Label>
            <Select required value={day} onChange={(e) => setDay(e.target.value as WeeklyProgramDay)} className="mt-1 w-full">
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <div>
            <Label>Shift type</Label>
            <Select required value={shiftType} onChange={(e) => { setShiftType(e.target.value as WeeklyProgramShiftType); setCustomTimeError(null); }} className="mt-1 w-full">
              <option value="Morning">Morning (12:00–20:00)</option>
              <option value="Night">Night (20:00–03:00)</option>
              <option value="Custom">Custom</option>
            </Select>
          </div>
        </div>
        <div
          className={`grid grid-cols-2 gap-3 overflow-hidden transition-all duration-300 ease-out ${
            shiftType === "Custom" ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
          }`}
          aria-hidden={shiftType !== "Custom"}
        >
          <div>
            <Label>Start time <span className="text-red-400">*</span></Label>
            <input
              type="time"
              value={customStartTime}
              onChange={(e) => { setCustomStartTime(e.target.value); setCustomTimeError(null); }}
              className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white transition-colors focus:border-[hsl(330,80%,55%)]/60 focus:outline-none focus:ring-2 focus:ring-[hsl(330,80%,55%)]/20 focus:bg-white/[0.08] hover:border-white/15 [color-scheme:dark]"
              required={shiftType === "Custom"}
              aria-invalid={!!customTimeError}
            />
          </div>
          <div>
            <Label>End time <span className="text-red-400">*</span></Label>
            <input
              type="time"
              value={customEndTime}
              onChange={(e) => { setCustomEndTime(e.target.value); setCustomTimeError(null); }}
              className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white transition-colors focus:border-[hsl(330,80%,55%)]/60 focus:outline-none focus:ring-2 focus:ring-[hsl(330,80%,55%)]/20 focus:bg-white/[0.08] hover:border-white/15 [color-scheme:dark]"
              required={shiftType === "Custom"}
              aria-invalid={!!customTimeError}
            />
          </div>
        </div>
        {customTimeError && (
          <p className="text-sm text-rose-300/95">{customTimeError}</p>
        )}
        <div>
          <Label>Week start</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="dd/mm/yyyy"
            required
            value={weekStartDisplay}
            onChange={(e) => setWeekStartDisplay(e.target.value)}
            onBlur={() => {
              const iso = parseEuropeanDateInput(weekStartDisplay);
              if (iso) setWeekStartVal(iso);
              else setWeekStartDisplay(isoToEuropeanDisplay(weekStartVal));
            }}
            className="mt-1 w-full"
          />
        </div>
        <div>
          <Label>Assign models</Label>
          <p className="mt-0.5 text-[11px] text-white/50">Taken models are disabled for this day/time.</p>
          <Input
            type="search"
            placeholder="Search models…"
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
            className="mt-1.5 w-full"
          />
          <div className="mt-1.5 flex w-full items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
            {(["all", "free", "taken"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setAvailabilityFilter(key)}
                className={`flex-1 rounded-md px-2.5 py-2.5 text-[11px] font-medium capitalize transition-colors md:py-1.5 ${
                  availabilityFilter === key
                    ? "bg-[hsl(330,80%,55%)]/25 text-[hsl(330,90%,75%)]"
                    : "text-white/60 hover:text-white/80 hover:bg-white/[0.06]"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="mt-1.5 max-h-[40vh] overflow-y-auto rounded-lg border border-white/10 bg-white/[0.04] p-1.5 space-y-1 md:max-h-40">
            {filteredModels.length === 0 ? (
              <p className="py-3 text-center text-sm text-white/50">No models match</p>
            ) : (
              filteredModels.map((m) => {
                const key = `${chatterId}:${m.id}`;
                const lastInfo = assignmentsInModal?.[key];
                const availability = modelAvailability[m.id];
                const isTaken = availability?.taken ?? false;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-2 transition-colors ${
                      isTaken ? "bg-white/[0.02] opacity-75" : "hover:bg-white/[0.06]"
                    } ${isTaken ? "cursor-not-allowed" : ""}`}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <Checkbox
                        checked={selectedModelIds.has(m.id)}
                        onChange={() => toggleModel(m.id)}
                        label=""
                        className="shrink-0"
                        disabled={isTaken}
                      />
                      <div className="min-w-0">
                        <p className={`font-medium truncate ${isTaken ? "text-white/60" : "text-white/95"}`}>
                          {m.model_name}
                        </p>
                        <p className="mt-0.5 text-xs">
                          {isTaken ? (
                            <span className="text-amber-400/90">Taken by {availability.takenBy}</span>
                          ) : (
                            <span className="text-emerald-400/90">Free</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {lastInfo && !isTaken && (
                      <span className="shrink-0 text-xs text-white/50" title={formatDateTimeEuropean(lastInfo.dateTime)}>
                        Last: {lastInfo.relative}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {selectedModelIds.size > 0 && (
            <p className="mt-1.5 text-xs text-white/55">{selectedModelIds.size} model{selectedModelIds.size !== 1 ? "s" : ""} selected</p>
          )}
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" className="mt-1 w-full" />
        </div>
        </div>
        <div className="sticky bottom-0 z-10 flex w-full flex-col gap-3 border-t border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl md:flex-row md:justify-end md:border-t-0 md:bg-transparent md:px-5 md:py-0 md:pt-4 md:backdrop-blur-none" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))", paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
          <ButtonSecondary type="button" onClick={onClose} className="w-full md:w-auto">Cancel</ButtonSecondary>
          <SubmitButton type="submit" disabled={saving} className="w-full md:w-auto">
            {saving ? "Saving…" : isEdit ? "Update" : "Create"}
          </SubmitButton>
        </div>
      </form>
  );

  if (asPanel) {
    return (
      <>
        {tooManyModelsDialog}
        <div
          className="relative flex min-h-0 w-full flex-col rounded-none border-0 bg-black/95 shadow-2xl md:rounded-2xl md:border md:border-white/10 md:shadow-black/50 md:backdrop-blur-xl"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7), 0 0 80px -24px hsl(330 80% 55% / 0.08)" }}
        >
          <div className="shrink-0 flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3.5 pt-[calc(0.875rem+env(safe-area-inset-top))] md:px-5 md:pt-3.5">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold tracking-tight text-white md:text-base">{title}</h2>
              <p className="mt-0.5 hidden text-xs text-white/55 md:block">{subtitle}</p>
              <div className="mt-1.5 hidden h-px w-10 rounded-full bg-[hsl(330,80%,55%)]/40 md:block" />
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors touch-manipulation" aria-label="Close">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{formContent}</div>
        </div>
      </>
    );
  }

  return (
    <>
      {tooManyModelsDialog}
      <GlassModal onClose={onClose} title={title} subtitle={subtitle}>
        {formContent}
      </GlassModal>
    </>
  );
}
