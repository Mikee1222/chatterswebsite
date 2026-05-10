"use client";
import { devLog } from "@/lib/dev-log";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, CalendarDays, Clock, Copy, Layers, Loader2, Moon, Search, StickyNote, Sun, UserRound } from "lucide-react";
import {
  createProgramAction,
  updateProgramAction,
  deleteProgramAction,
} from "@/app/actions/weekly-program";
import { formatTimeEuropean, formatDateEuropean, formatDateTimeEuropean, formatTimeFromISO, isoToEuropeanDisplay, parseEuropeanDateInput } from "@/lib/format";
import { GlassModal, Checkbox, ButtonPrimary, ButtonSecondary } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { CustomSelect, CUSTOM_SELECT_HOUR_12_OPTIONS, type CustomSelectOption } from "@/components/ui/custom-select";
import { adminWeeklyProgramUrl, adminWeeklyProgramVaUrl } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  getTimesForShiftType,
  buildCustomShiftTimes,
  getThisWeekMonday,
  addDays,
  addWeeks,
  normalizeWeekStart,
  formatWeekLabel,
  normalizeHHmm,
} from "@/lib/weekly-program";
import { getWeeklyProgramConflicts, rangesOverlap } from "@/lib/weekly-program-conflicts";
import type { Conflict, ConflictSummary, CoverageBoard, CoverageCell } from "@/lib/weekly-program-conflicts";
import type { WeeklyProgramRecord, WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";
import type { ModelRecord } from "@/types";
import type { WeeklyAvailabilityRequest } from "@/types";
import { ModelPeriodNamesRow } from "@/components/model-period-names-row";
import { AdminRowAvatar, CoverageSlotChip, ShiftTypeBadge } from "@/components/admin-list-primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Format ISO start/end to time range string (HH:mm–HH:mm). Uses UTC for schedule times. */
function formatTimeRange(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return "—";
  return `${formatTimeFromISO(startIso)}–${formatTimeFromISO(endIso)}`;
}

function shiftCardAccentClass(shiftType: WeeklyProgramShiftType): string {
  if (shiftType === "Morning") return "border-l-[3px] border-l-amber-400/55";
  if (shiftType === "Night") return "border-l-[3px] border-l-indigo-400/55";
  return "border-l-[3px] border-l-pink-400/55";
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

const SHIFT_FILTER_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "All shifts" },
  { value: "Morning", label: "Morning" },
  { value: "Night", label: "Night" },
];

const AVAIL_SHIFT_TYPE_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "All types" },
  { value: "Morning", label: "Morning" },
  { value: "Night", label: "Night" },
  { value: "Custom", label: "Custom" },
];

type Chatter = { id: string; full_name: string };

function getModelNames(modelIds: string[], modelss: ModelRecord[]): string[] {
  return modelIds
    .map((id) => modelss.find((m) => m.id === id)?.model_name)
    .filter((n): n is string => Boolean(n));
}

/** getWeeklyProgramConflicts flags `too_many_models` when model_ids.length >= this value; keep high so large shifts are allowed. */
const TOO_MANY_MODELS_THRESHOLD = 1000;

/** Positive-duration intersection only: shiftA.start < shiftB.end && shiftA.end > shiftB.start (touching = no overlap). */
function intervalsStrictOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sa = new Date(startA).getTime();
  const ea = new Date(endA).getTime();
  const sb = new Date(startB).getTime();
  const eb = new Date(endB).getTime();
  if (![sa, ea, sb, eb].every(Number.isFinite)) return false;
  return sa < eb && ea > sb;
}

const OVERLAP_TOLERANCE_MINUTES = 5;

/** True only if intersection duration is strictly greater than OVERLAP_TOLERANCE_MINUTES (touching or ≤5 min = false). */
function shiftsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sa = new Date(startA).getTime();
  const ea = new Date(endA).getTime();
  const sb = new Date(startB).getTime();
  const eb = new Date(endB).getTime();
  if (![sa, ea, sb, eb].every(Number.isFinite)) return false;
  const overlapStart = Math.max(sa, sb);
  const overlapEnd = Math.min(ea, eb);
  const overlapMinutes = (overlapEnd - overlapStart) / (60 * 1000);
  return overlapMinutes > OVERLAP_TOLERANCE_MINUTES;
}

type CoverageChipTone = "covered" | "gap" | "uncovered";

type CoverageChip = { tone: CoverageChipTone; text: string };

type ClientCoverageCell = CoverageCell & {
  coverageTier: "full" | "partial" | "none";
  gapHint: string | null;
  coverageChips: CoverageChip[];
};

function pad2u(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatUtcRangeCompactFromMs(csMs: number, ceMs: number): string {
  const d1 = new Date(csMs);
  const d2 = new Date(ceMs);
  const t1 = `${pad2u(d1.getUTCHours())}:${pad2u(d1.getUTCMinutes())}`;
  const t2 = `${pad2u(d2.getUTCHours())}:${pad2u(d2.getUTCMinutes())}`;
  return `${t1}–${t2}`;
}

/** Last word of full name (surname) for compact chips. */
function coverageSurname(chatterName: string): string {
  const t = chatterName.trim();
  if (!t || t === "—") return "—";
  const parts = t.split(/\s+/);
  return parts[parts.length - 1] ?? t;
}

/** Chip time: HH-HH when on hour boundaries, else HH:mm–HH:mm (UTC). */
function formatChipRangeUtc(csMs: number, ceMs: number): string {
  const a = new Date(csMs);
  const b = new Date(ceMs);
  const sh = a.getUTCHours();
  const sm = a.getUTCMinutes();
  const ss = a.getUTCSeconds();
  const eh = b.getUTCHours();
  const em = b.getUTCMinutes();
  const es = b.getUTCSeconds();
  if (sm === 0 && ss === 0 && em === 0 && es === 0) {
    return `${pad2u(sh)}-${pad2u(eh)}`;
  }
  return `${pad2u(sh)}:${pad2u(sm)}-${pad2u(eh)}:${pad2u(em)}`;
}

function isoToMs(iso: string): number {
  return new Date(iso).getTime();
}

type ClipSeg = { cs: number; ce: number; chatterName: string; recordId: string };

function buildClippedSegmentsForModelInSlot(
  candidates: WeeklyProgramRecord[],
  winStartIso: string,
  winEndIso: string
): ClipSeg[] {
  const ws = isoToMs(winStartIso);
  const we = isoToMs(winEndIso);
  const out: ClipSeg[] = [];
  for (const p of candidates) {
    if (!p.start_time || !p.end_time) continue;
    const ps = isoToMs(p.start_time);
    const pe = isoToMs(p.end_time);
    if (!intervalsStrictOverlap(p.start_time, p.end_time, winStartIso, winEndIso)) continue;
    const cs = Math.max(ps, ws);
    const ce = Math.min(pe, we);
    if (cs >= ce) continue;
    out.push({
      cs,
      ce,
      chatterName: p.chatter_name ?? "—",
      recordId: p.id,
    });
  }
  return out.sort((a, b) => a.cs - b.cs);
}

function mergeTouchingSegments(segs: { cs: number; ce: number }[]): { cs: number; ce: number }[] {
  if (segs.length === 0) return [];
  const sorted = [...segs].sort((a, b) => a.cs - b.cs);
  const merged: { cs: number; ce: number }[] = [];
  for (const seg of sorted) {
    if (merged.length === 0) {
      merged.push({ cs: seg.cs, ce: seg.ce });
      continue;
    }
    const last = merged[merged.length - 1]!;
    if (seg.cs <= last.ce) {
      last.ce = Math.max(last.ce, seg.ce);
    } else {
      merged.push({ cs: seg.cs, ce: seg.ce });
    }
  }
  return merged;
}

function analyzeModelSlotCoverage(
  segments: ClipSeg[],
  winStartIso: string,
  winEndIso: string
): {
  tier: "full" | "partial" | "none";
  label: string;
  gapHint: string | null;
  recordId: string | null;
  chips: CoverageChip[];
} {
  const ws = isoToMs(winStartIso);
  const we = isoToMs(winEndIso);
  if (segments.length === 0) {
    return {
      tier: "none",
      label: "",
      gapHint: null,
      recordId: null,
      chips: [{ tone: "uncovered", text: "Uncovered" }],
    };
  }
  const displayLabel = segments.map((s) => `${s.chatterName} (${formatUtcRangeCompactFromMs(s.cs, s.ce)})`).join(" / ");
  const sortedSegs = [...segments].sort((a, b) => a.cs - b.cs);
  const chips: CoverageChip[] = [];
  let walk = ws;
  for (const seg of sortedSegs) {
    if (seg.cs > walk) {
      chips.push({ tone: "gap", text: `Gap ${formatChipRangeUtc(walk, seg.cs)}` });
    }
    chips.push({
      tone: "covered",
      text: `${coverageSurname(seg.chatterName)} ${formatChipRangeUtc(seg.cs, seg.ce)}`,
    });
    walk = Math.max(walk, seg.ce);
  }
  if (walk < we) {
    chips.push({ tone: "gap", text: `Gap ${formatChipRangeUtc(walk, we)}` });
  }

  const merged = mergeTouchingSegments(segments);
  const first = merged[0]!;
  const last = merged[merged.length - 1]!;
  const coversFull = merged.length === 1 && first.cs <= ws && last.ce >= we;
  const hasGapChip = chips.some((c) => c.tone === "gap");
  const gapParts: string[] = [];
  let cursor = ws;
  for (const m of merged) {
    if (m.cs > cursor) gapParts.push(formatUtcRangeCompactFromMs(cursor, m.cs));
    cursor = Math.max(cursor, m.ce);
  }
  if (cursor < we) gapParts.push(formatUtcRangeCompactFromMs(cursor, we));
  const gapHint = gapParts.length ? `Gap ${gapParts.join(", ")}` : null;

  const tier: "full" | "partial" = coversFull && !hasGapChip ? "full" : "partial";
  return {
    tier,
    label: displayLabel,
    gapHint: tier === "full" ? null : gapHint,
    recordId: segments[0]!.recordId,
    chips,
  };
}

function coverageCellIsUncovered(cell: CoverageCell | null | undefined): boolean {
  if (!cell) return false;
  const t = (cell as ClientCoverageCell).coverageTier;
  if (t) return t === "none";
  return !cell.covered;
}

function ModelCoverageTableCell({ cell }: { cell: CoverageCell }) {
  const cc = cell as ClientCoverageCell;
  const chips = cc.coverageChips ?? [{ tone: "uncovered" as const, text: "Uncovered" }];
  const tier = cc.coverageTier ?? (cell.covered ? "full" : "none");
  const title =
    tier === "partial" && cc.gapHint
      ? cc.gapHint
      : tier === "full"
        ? "Full shift coverage"
        : "No coverage";
  const flexCls = chips.length > 2 ? "flex flex-col gap-1" : "flex flex-wrap gap-1";
  return (
    <td className="min-w-[120px] border-l border-white/[0.04] px-2 py-2 text-center align-top" title={title}>
      <div className={cn(flexCls, "justify-center")}>
        {chips.map((c, i) => (
          <CoverageSlotChip key={i} tone={c.tone} text={c.text} />
        ))}
      </div>
    </td>
  );
}

function sharedModelIds(p: WeeklyProgramRecord, q: WeeklyProgramRecord): string[] {
  const setQ = new Set(q.model_ids.filter(Boolean));
  return p.model_ids.filter((id): id is string => Boolean(id) && setQ.has(id));
}

/** Custom rows only: same model, two different chatters, time overlap strictly > 5 minutes. */
function computeClientCustomOverlaps(
  programsWeek: WeeklyProgramRecord[],
  modelIdToName: Record<string, string>
): Conflict[] {
  const customs = programsWeek.filter((p) => p.shift_type === "Custom");
  const out: Conflict[] = [];
  for (let i = 0; i < customs.length; i++) {
    const p = customs[i]!;
    for (let j = i + 1; j < customs.length; j++) {
      const q = customs[j]!;
      if (p.chatter_id === q.chatter_id) continue;
      if (p.day !== q.day) continue;
      if (!p.start_time || !p.end_time || !q.start_time || !q.end_time) continue;
      if (!shiftsOverlap(p.start_time, p.end_time, q.start_time, q.end_time)) continue;
      const shared = sharedModelIds(p, q);
      if (shared.length === 0) continue;
      const modelLabel = shared.map((id) => modelIdToName[id] ?? id).join(", ");
      out.push({
        type: "custom_overlap",
        message: `Model "${modelLabel}" has overlapping custom shifts on ${p.day}: ${p.chatter_name ?? "—"} and ${q.chatter_name ?? "—"}.`,
        recordIds: [p.id, q.id],
        day: p.day,
        modelId: shared[0],
        modelName: modelIdToName[shared[0]!] ?? shared[0],
      });
    }
  }
  return out;
}

function programsCoveringSlot(
  programsWeek: WeeklyProgramRecord[],
  weekStartNorm: string,
  day: WeeklyProgramDay,
  slot: "Morning" | "Night",
  morningWin: { start_time: string; end_time: string },
  nightWin: { start_time: string; end_time: string }
): WeeklyProgramRecord[] {
  const win = slot === "Morning" ? morningWin : nightWin;
  return programsWeek.filter((p) => {
    if (normalizeWeekStart(p.week_start) !== weekStartNorm) return false;
    if (p.day !== day) return false;
    if (!p.start_time || !p.end_time) return false;
    if (p.shift_type === slot) return true;
    if (p.shift_type === "Custom") {
      return intervalsStrictOverlap(p.start_time, p.end_time, win.start_time, win.end_time);
    }
    return false;
  });
}

function buildClientCoverageBoard(
  programsWeek: WeeklyProgramRecord[],
  modelss: ModelRecord[],
  weekStartNorm: string
): CoverageBoard {
  const idToName: Record<string, string> = {};
  modelss.forEach((m) => {
    idToName[m.id] = m.model_name ?? m.id;
  });
  const morning: CoverageCell[][] = [];
  const night: CoverageCell[][] = [];
  const modelNames: string[] = [];

  for (const m of modelss) {
    modelNames.push(idToName[m.id] ?? m.id);
    const morningRow: CoverageCell[] = [];
    const nightRow: CoverageCell[] = [];
    for (const day of DAYS) {
      const dayIdx = DAYS.indexOf(day);
      const dateYmd = addDays(weekStartNorm, dayIdx);
      const morningWin = getTimesForShiftType("Morning", dateYmd);
      const nightWin = getTimesForShiftType("Night", dateYmd);
      const morningCands = programsCoveringSlot(programsWeek, weekStartNorm, day, "Morning", morningWin, nightWin).filter((p) =>
        (p.model_ids ?? []).includes(m.id)
      );
      const nightCands = programsCoveringSlot(programsWeek, weekStartNorm, day, "Night", morningWin, nightWin).filter((p) =>
        (p.model_ids ?? []).includes(m.id)
      );
      const segM = buildClippedSegmentsForModelInSlot(morningCands, morningWin.start_time, morningWin.end_time);
      const segN = buildClippedSegmentsForModelInSlot(nightCands, nightWin.start_time, nightWin.end_time);
      const metaM = analyzeModelSlotCoverage(segM, morningWin.start_time, morningWin.end_time);
      const metaN = analyzeModelSlotCoverage(segN, nightWin.start_time, nightWin.end_time);

      if (process.env.NODE_ENV !== "production") {
        const assignedModelsM = morningCands.map((p) => ({
          chatter: p.chatter_name,
          shift_type: p.shift_type,
          id: p.id,
          models: p.model_ids,
          range: p.start_time && p.end_time ? formatTimeRange(p.start_time, p.end_time) : "—",
        }));
        const assignedModelsN = nightCands.map((p) => ({
          chatter: p.chatter_name,
          shift_type: p.shift_type,
          id: p.id,
          models: p.model_ids,
          range: p.start_time && p.end_time ? formatTimeRange(p.start_time, p.end_time) : "—",
        }));
        devLog("[coverage]", {
          day,
          shiftType: "Morning",
          modelName: idToName[m.id] ?? m.id,
          assignedModels: assignedModelsM,
          coverageTier: metaM.tier,
          gapHint: metaM.gapHint,
        });
        devLog("[coverage]", {
          day,
          shiftType: "Night",
          modelName: idToName[m.id] ?? m.id,
          assignedModels: assignedModelsN,
          coverageTier: metaN.tier,
          gapHint: metaN.gapHint,
        });
      }

      morningRow.push({
        day,
        shiftType: "Morning",
        modelId: m.id,
        modelName: idToName[m.id] ?? m.id,
        chatterName: metaM.tier === "none" ? null : metaM.label,
        covered: metaM.tier !== "none",
        recordId: metaM.recordId,
        coverageTier: metaM.tier,
        gapHint: metaM.gapHint,
        coverageChips: metaM.chips,
      } as ClientCoverageCell);
      nightRow.push({
        day,
        shiftType: "Night",
        modelId: m.id,
        modelName: idToName[m.id] ?? m.id,
        chatterName: metaN.tier === "none" ? null : metaN.label,
        covered: metaN.tier !== "none",
        recordId: metaN.recordId,
        coverageTier: metaN.tier,
        gapHint: metaN.gapHint,
        coverageChips: metaN.chips,
      } as ClientCoverageCell);
    }
    morning.push(morningRow);
    night.push(nightRow);
  }

  return { morning, night, modelNames, days: [...DAYS] };
}

function recomputeClientConflicts(
  programsWeek: WeeklyProgramRecord[],
  modelss: ModelRecord[],
  modelIdToName: Record<string, string>
): { summary: ConflictSummary; conflictRecordIds: string[] } {
  const modelIds = modelss.map((m) => m.id);
  const { conflicts: raw } = getWeeklyProgramConflicts(programsWeek, modelIds, modelIdToName, {
    tooManyModelsThreshold: TOO_MANY_MODELS_THRESHOLD,
  });
  const byId = Object.fromEntries(programsWeek.map((p) => [p.id, p]));

  const clientCustom = computeClientCustomOverlaps(programsWeek, modelIdToName);

  const filtered = raw.filter((c) => {
    if (c.type === "chatter_overlap" || c.type === "custom_overlap") return false;
    if (c.type === "model_time_overlap") {
      const a = c.recordIds[0];
      const b = c.recordIds[1];
      const p = a ? byId[a] : undefined;
      const q = b ? byId[b] : undefined;
      if (!p || !q || !p.start_time || !p.end_time || !q.start_time || !q.end_time) return false;
      return intervalsStrictOverlap(p.start_time, p.end_time, q.start_time, q.end_time);
    }
    return true;
  });

  const merged = [...filtered, ...clientCustom];

  const customOverlaps = merged.filter((x) => x.type === "custom_overlap").length;
  const uncoveredCount = merged.filter((x) => x.type === "uncovered_model").length;

  const summary: ConflictSummary = {
    modelConflicts: 0,
    chatterOverlaps: 0,
    customOverlaps,
    uncoveredCount,
    tooManyModelsCount: 0,
    total: customOverlaps + uncoveredCount,
  };
  const conflictRecordIds: string[] = [];
  const seen = new Set<string>();
  for (const c of merged) {
    for (const id of c.recordIds) {
      if (id && !seen.has(id)) {
        seen.add(id);
        conflictRecordIds.push(id);
      }
    }
  }
  return { summary, conflictRecordIds };
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
  periodDatesByModelId: Record<string, string[]>;
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

function isoTimeToHHmm(iso: string | undefined): string {
  if (!iso || iso.length < 16) return "";
  return iso.slice(11, 16);
}

function hhmm24To12Parts(hhmm: string): { h12: number; minute: number; pm: boolean } {
  const [hs, ms] = hhmm.trim().split(":");
  const h24 = Math.min(23, Math.max(0, parseInt(hs ?? "0", 10) || 0));
  const minute = Math.min(59, Math.max(0, parseInt(ms ?? "0", 10) || 0));
  const pm = h24 >= 12;
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h12, minute, pm };
}

function hhmm12To24(h12: number, minute: number, pm: boolean): string {
  const h12Safe = Number.isFinite(h12) ? h12 : 12;
  const minSafe = Number.isFinite(minute) ? minute : 0;
  const h = Math.min(12, Math.max(1, Math.round(h12Safe)));
  const m = Math.min(59, Math.max(0, Math.round(minSafe)));
  let h24: number;
  if (pm) h24 = h === 12 ? 12 : h + 12;
  else h24 = h === 12 ? 0 : h;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(h24)}:${pad(m)}`;
}

function CustomTime12hBlock({
  label,
  required,
  value,
  onChange,
  ariaInvalid,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (next: string) => void;
  ariaInvalid?: boolean;
}) {
  const { h12, minute, pm } = hhmm24To12Parts(value || "09:00");
  const sync = (patch: Partial<{ h12: number; minute: number; pm: boolean }>) => {
    const next = { h12, minute, pm, ...patch };
    onChange(hhmm12To24(next.h12, next.minute, next.pm));
  };
  return (
    <FormField label={label} icon={<Clock />} required={required}>
      <div className="flex flex-wrap items-center gap-2">
        <CustomSelect portaled
          value={String(h12)}
          onChange={(v) => {
            const n = Number(v);
            sync({ h12: Number.isFinite(n) ? n : 12 });
          }}
          options={CUSTOM_SELECT_HOUR_12_OPTIONS}
          className="w-[4.5rem] shrink-0"
          aria-invalid={ariaInvalid}
        />
        <span className="text-white/50">:</span>
        <FormInput
          type="number"
          min={0}
          max={59}
          step={1}
          inputMode="numeric"
          value={minute}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            sync({ minute: Number.isNaN(v) ? 0 : Math.min(59, Math.max(0, v)) });
          }}
          className="!min-h-[44px] w-[4.25rem] shrink-0 px-2 py-2 text-center text-[15px] md:!min-h-0"
          aria-invalid={ariaInvalid}
        />
        <button
          type="button"
          onClick={() => sync({ pm: !pm })}
          className="min-h-[44px] min-w-[3.75rem] shrink-0 rounded-2xl border border-white/20 bg-white/[0.08] px-3 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/[0.12] md:min-h-[var(--luxury-form-min-height)]"
          aria-pressed={pm}
          aria-label={pm ? "Currently PM, switch to AM" : "Currently AM, switch to PM"}
        >
          {pm ? "PM" : "AM"}
        </button>
      </div>
    </FormField>
  );
}

export function AdminWeeklyProgramClient({
  programs: initialPrograms,
  chatters,
  modelss,
  currentWeekStart,
  conflicts: _conflictsFromServer,
  conflictSummary: _conflictSummaryFromServer,
  conflictRecordIds: _conflictRecordIdsFromServer,
  coverageBoard: _coverageBoardFromServer,
  lastAssignmentMap,
  suggestionsByKey,
  availabilityRequests,
  periodDatesByModelId,
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
  const [deleteProgramConfirmId, setDeleteProgramConfirmId] = React.useState<string | null>(null);
  const [prefillFromAvailability, setPrefillFromAvailability] = React.useState<WeeklyAvailabilityRequest | null>(null);
  const [availFilterChatter, setAvailFilterChatter] = React.useState("");
  const [availFilterShiftType, setAvailFilterShiftType] = React.useState<WeeklyProgramShiftType | "">("");
  const [availFilterDay, setAvailFilterDay] = React.useState<WeeklyProgramDay | "">("");
  const [mobileHelperOpen, setMobileHelperOpen] = React.useState(false);
  const [duplicateOpenDay, setDuplicateOpenDay] = React.useState<WeeklyProgramDay | null>(null);
  const [duplicateTargetDay, setDuplicateTargetDay] = React.useState<WeeklyProgramDay>("Tuesday");
  /** idle: ready · working: Airtable copy in flight · done / failed: brief feedback before reset */
  const [duplicateUi, setDuplicateUi] = React.useState<"idle" | "working" | "done" | "failed">("idle");
  const [duplicateWeekModal, setDuplicateWeekModal] = React.useState<{
    chatterId: string;
    chatterName: string;
  } | null>(null);
  const [duplicateWeekTarget, setDuplicateWeekTarget] = React.useState<string>("");
  const [duplicateWeekOverwrite, setDuplicateWeekOverwrite] = React.useState(false);
  const [duplicateWeekUi, setDuplicateWeekUi] = React.useState<"idle" | "working" | "failed">("idle");
  const [duplicateSlotModal, setDuplicateSlotModal] = React.useState<WeeklyProgramRecord | null>(null);
  const [dupSlotTargetWeek, setDupSlotTargetWeek] = React.useState<string>("");
  const [dupSlotSelectedDays, setDupSlotSelectedDays] = React.useState<number[]>([]);
  const [dupSlotOverwrite, setDupSlotOverwrite] = React.useState(false);
  const [dupSlotUi, setDupSlotUi] = React.useState<"idle" | "working" | "failed">("idle");
  const duplicateUiRef = React.useRef(duplicateUi);
  React.useEffect(() => {
    duplicateUiRef.current = duplicateUi;
  }, [duplicateUi]);
  const duplicateResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDuplicateResetTimer = React.useCallback(() => {
    if (duplicateResetTimerRef.current) {
      clearTimeout(duplicateResetTimerRef.current);
      duplicateResetTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => clearDuplicateResetTimer(), [clearDuplicateResetTimer]);

  React.useEffect(() => setPrograms(initialPrograms), [initialPrograms]);

  const modelIdToDisplayName = React.useMemo(
    () => Object.fromEntries(modelss.map((m) => [m.id, m.model_name ?? m.id])),
    [modelss]
  );

  const effectiveWeekStart = normalizeWeekStart(searchParams.get("week_start") || currentWeekStart);

  const programsThisWeek = React.useMemo(
    () => programs.filter((p) => normalizeWeekStart(p.week_start) === effectiveWeekStart),
    [programs, effectiveWeekStart]
  );

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

  const duplicateTargetExistingCount = React.useMemo(() => {
    if (!duplicateOpenDay) return 0;
    return programs.filter(
      (p) =>
        p.day === duplicateTargetDay &&
        normalizeWeekStart(p.week_start) === effectiveWeekStart &&
        !p.id.startsWith("dup-pending-")
    ).length;
  }, [duplicateOpenDay, duplicateTargetDay, programs, effectiveWeekStart]);

  const chattersWithSlotsThisWeek = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of programsThisWeek) {
      if (!p.chatter_id || p.id.startsWith("dup-pending-")) continue;
      if (!seen.has(p.chatter_id)) seen.set(p.chatter_id, p.chatter_name?.trim() || "—");
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [programsThisWeek]);

  const duplicateWeekNextStart = React.useMemo(() => addWeeks(effectiveWeekStart, 1), [effectiveWeekStart]);
  const duplicateWeekAfterStart = React.useMemo(() => addWeeks(effectiveWeekStart, 2), [effectiveWeekStart]);

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
      devLog("[admin weekly-program] availability helper panel", {
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

  const availChatterSelectOptions = React.useMemo(
    () => [
      { value: "", label: "All chatters" },
      ...availabilityChatters.map((c) => ({ value: c.id, label: c.full_name })),
    ],
    [availabilityChatters]
  );
  const chatterFilterSelectOptions = React.useMemo(
    () => [
      { value: "", label: "All chatters" },
      ...chatters.map((c) => ({ value: c.id, label: c.full_name })),
    ],
    [chatters]
  );
  const modelFilterSelectOptions = React.useMemo(
    () => [
      { value: "", label: "All models" },
      ...modelss.map((m) => ({ value: m.id, label: m.model_name })),
    ],
    [modelss]
  );
  const dayFilterSelectOptions = React.useMemo(
    () => [{ value: "", label: "All days" }, ...DAYS.map((d) => ({ value: d, label: d }))],
    []
  );

  const useRequestInSchedule = (request: WeeklyAvailabilityRequest) => {
    setPrefillFromAvailability(request);
    setCreateOpen(true);
    setEditingEntry(null);
    setError(null);
  };

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      devLog("[admin weekly-program client] render", {
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

  const resolvedCoverageBoard = React.useMemo(
    () => buildClientCoverageBoard(programsThisWeek, modelss, effectiveWeekStart),
    [programsThisWeek, modelss, effectiveWeekStart]
  );

  const { summary: resolvedConflictSummary, conflictRecordIds: resolvedConflictRecordIds } = React.useMemo(
    () => recomputeClientConflicts(programsThisWeek, modelss, modelIdToName),
    [programsThisWeek, modelss, modelIdToName]
  );

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

  const runProgramDelete = async (recordId: string) => {
    setError(null);
    setDeletingId(recordId);
    const res = await deleteProgramAction(recordId);
    setDeletingId(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess("Shift deleted.");
    setDeleteProgramConfirmId(null);
    router.refresh();
  };

  const handleDelete = (recordId: string) => {
    setDeleteProgramConfirmId(recordId);
  };

  const openDuplicateModal = (sourceDay: WeeklyProgramDay) => {
    clearDuplicateResetTimer();
    setDuplicateUi("idle");
    setDuplicateOpenDay(sourceDay);
    setDuplicateTargetDay(DAYS.find((d) => d !== sourceDay) ?? "Tuesday");
  };

  const closeDuplicateModal = React.useCallback(() => {
    if (duplicateUiRef.current === "working") return;
    clearDuplicateResetTimer();
    setDuplicateOpenDay(null);
    setDuplicateUi("idle");
  }, [clearDuplicateResetTimer]);

  const handleDuplicateCopy = (sourceDay: WeeklyProgramDay, targetDay: WeeklyProgramDay) => {
    const week = effectiveWeekStart;
    const sourceEntries = programs.filter(
      (p) => p.day === sourceDay && normalizeWeekStart(p.week_start) === week
    );
    if (sourceEntries.length === 0) {
      setError("No shifts to copy on that day.");
      return;
    }
    if (targetDay === sourceDay) return;

    setError(null);
    setSuccess(null);
    setDuplicateUi("working");

    const base = Date.now();
    const pendingIds: string[] = sourceEntries.map((_, i) => `dup-pending-${base}-${i}`);

    const optimisticRows: WeeklyProgramRecord[] = sourceEntries.map((e, i) => ({
      ...e,
      id: pendingIds[i]!,
      day: targetDay,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    setPrograms((prev) => [...prev, ...optimisticRows]);

    void (async () => {
      try {
        const results = await Promise.all(
          sourceEntries.map((e) =>
            createProgramAction({
              chatter: [e.chatter_id],
              chatter_name: e.chatter_name,
              models: e.model_ids,
              day: targetDay,
              shift_type: e.shift_type,
              week_start: week,
              notes: e.notes || "",
              modelIdToName,
              ...(e.shift_type === "Custom" && {
                custom_start_time: isoTimeToHHmm(e.start_time),
                custom_end_time: isoTimeToHHmm(e.end_time),
              }),
            })
          )
        );
        for (const r of results) {
          if (!r.success) throw new Error(r.error);
        }
        setDuplicateUi("done");
        router.refresh();
        clearDuplicateResetTimer();
        duplicateResetTimerRef.current = setTimeout(() => {
          duplicateResetTimerRef.current = null;
          setDuplicateOpenDay(null);
          setDuplicateUi("idle");
        }, 900);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPrograms((prev) => prev.filter((p) => !pendingIds.includes(p.id)));
        setError(msg);
        setDuplicateUi("failed");
        router.refresh();
        clearDuplicateResetTimer();
        duplicateResetTimerRef.current = setTimeout(() => {
          duplicateResetTimerRef.current = null;
          setDuplicateOpenDay(null);
          setDuplicateUi("idle");
        }, 1600);
      }
    })();
  };

  const closeDuplicateWeekModal = React.useCallback(() => {
    if (duplicateWeekUi === "working") return;
    setDuplicateWeekModal(null);
    setDuplicateWeekUi("idle");
  }, [duplicateWeekUi]);

  const openDuplicateWeekModal = (chatterId: string, chatterName: string) => {
    setError(null);
    setSuccess(null);
    setDuplicateWeekModal({ chatterId, chatterName });
    setDuplicateWeekTarget(addWeeks(effectiveWeekStart, 1));
    setDuplicateWeekOverwrite(false);
    setDuplicateWeekUi("idle");
  };

  const openDuplicateSlotModal = (slot: WeeklyProgramRecord) => {
    if (slot.id.startsWith("dup-pending-")) return;
    setError(null);
    setSuccess(null);
    setDuplicateSlotModal(slot);
    setDupSlotTargetWeek(addWeeks(effectiveWeekStart, 1));
    setDupSlotSelectedDays([DAYS.indexOf(slot.day)]);
    setDupSlotOverwrite(false);
    setDupSlotUi("idle");
  };

  const closeDuplicateSlotModal = React.useCallback(() => {
    if (dupSlotUi === "working") return;
    setDuplicateSlotModal(null);
    setDupSlotUi("idle");
  }, [dupSlotUi]);

  const toggleDupSlotDay = (dayIndex: number) => {
    setDupSlotSelectedDays((prev) => {
      if (prev.includes(dayIndex)) return prev.filter((d) => d !== dayIndex);
      const next = [...prev, dayIndex];
      next.sort((a, b) => a - b);
      return next;
    });
  };

  const runDuplicateSlot = () => {
    if (!duplicateSlotModal || dupSlotUi === "working") return;
    const slot = duplicateSlotModal;
    if (dupSlotSelectedDays.length === 0) {
      setError("Select at least one day.");
      return;
    }
    const targetNorm = normalizeWeekStart(dupSlotTargetWeek);
    const dayCount = dupSlotSelectedDays.length;
    setError(null);
    setSuccess(null);
    setDupSlotUi("working");
    void (async () => {
      try {
        for (const dayIdx of dupSlotSelectedDays) {
          const targetDay = DAYS[dayIdx];
          if (!targetDay) continue;
          if (dupSlotOverwrite) {
            const victims = programs.filter((p) => {
              if (p.id.startsWith("dup-pending-")) return false;
              if (normalizeWeekStart(p.week_start) !== targetNorm) return false;
              if (p.chatter_id !== slot.chatter_id) return false;
              if (p.day !== targetDay) return false;
              if (!p.start_time || !p.end_time || !slot.start_time || !slot.end_time) return false;
              return rangesOverlap(p.start_time, p.end_time, slot.start_time, slot.end_time);
            });
            for (const p of victims) {
              const d = await deleteProgramAction(p.id);
              if (!d.success) throw new Error(d.error);
            }
          }
          const res = await createProgramAction({
            chatter: [slot.chatter_id],
            chatter_name: slot.chatter_name,
            models: slot.model_ids,
            day: targetDay,
            shift_type: slot.shift_type,
            week_start: targetNorm,
            notes: slot.notes || "",
            modelIdToName,
            ...(slot.shift_type === "Custom" && {
              custom_start_time: isoTimeToHHmm(slot.start_time),
              custom_end_time: isoTimeToHHmm(slot.end_time),
            }),
          });
          if (!res.success) throw new Error(res.error);
        }
        setDuplicateSlotModal(null);
        setDupSlotUi("idle");
        setSuccess(`Created ${dayCount} slot${dayCount !== 1 ? "s" : ""} in week of ${formatWeekLabel(targetNorm)}.`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setDupSlotUi("failed");
      }
    })();
  };

  const runDuplicateEntireWeek = () => {
    if (!duplicateWeekModal || duplicateWeekUi === "working") return;
    const { chatterId, chatterName } = duplicateWeekModal;
    const sourceNorm = effectiveWeekStart;
    const targetNorm = normalizeWeekStart(duplicateWeekTarget);
    if (targetNorm === sourceNorm) {
      setError("Choose a target week different from the current week.");
      return;
    }
    const sourceEntries = programsThisWeek.filter(
      (p) => p.chatter_id === chatterId && !p.id.startsWith("dup-pending-")
    );
    if (sourceEntries.length === 0) {
      setError("No shifts for this chatter in the week you are viewing.");
      return;
    }
    setError(null);
    setSuccess(null);
    setDuplicateWeekUi("working");
    void (async () => {
      try {
        if (duplicateWeekOverwrite) {
          const victims = programs.filter(
            (p) =>
              p.chatter_id === chatterId &&
              normalizeWeekStart(p.week_start) === targetNorm &&
              !p.id.startsWith("dup-pending-")
          );
          for (const p of victims) {
            const d = await deleteProgramAction(p.id);
            if (!d.success) throw new Error(d.error);
          }
        }
        for (const e of sourceEntries) {
          const res = await createProgramAction({
            chatter: [e.chatter_id],
            chatter_name: e.chatter_name,
            models: e.model_ids,
            day: e.day,
            shift_type: e.shift_type,
            week_start: targetNorm,
            notes: e.notes || "",
            modelIdToName,
            ...(e.shift_type === "Custom" && {
              custom_start_time: isoTimeToHHmm(e.start_time),
              custom_end_time: isoTimeToHHmm(e.end_time),
            }),
          });
          if (!res.success) throw new Error(res.error);
        }
        setDuplicateWeekModal(null);
        setDuplicateWeekUi("idle");
        setSuccess(`Copied full week for ${chatterName} to week of ${formatWeekLabel(targetNorm)}.`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setDuplicateWeekUi("failed");
      }
    })();
  };

  return (
    <>
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

      {resolvedConflictSummary.total > 0 && (
        <div className="glass-card border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </span>
            <div>
              <p className="font-semibold text-amber-200">Conflict summary</p>
              <p className="mt-0.5 text-sm text-white/80">
                {resolvedConflictSummary.customOverlaps > 0 && (
                  <span>
                    {resolvedConflictSummary.customOverlaps} overlapping custom shift
                    {resolvedConflictSummary.customOverlaps !== 1 ? "s" : ""}
                  </span>
                )}
                {resolvedConflictSummary.customOverlaps > 0 && resolvedConflictSummary.uncoveredCount > 0 && " · "}
                {resolvedConflictSummary.uncoveredCount > 0 && (
                  <span>
                    {resolvedConflictSummary.uncoveredCount} uncovered model{resolvedConflictSummary.uncoveredCount !== 1 ? "s" : ""}
                  </span>
                )}
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
              <CustomSelect portaled
                value={availFilterChatter}
                onChange={setAvailFilterChatter}
                options={availChatterSelectOptions}
                className="min-h-[48px] text-sm"
              />
              <CustomSelect portaled
                value={availFilterShiftType}
                onChange={(v) => setAvailFilterShiftType(v as WeeklyProgramShiftType | "")}
                options={AVAIL_SHIFT_TYPE_OPTIONS}
                className="min-h-[48px] text-sm"
              />
              <CustomSelect portaled
                value={availFilterDay}
                onChange={(v) => setAvailFilterDay(v as WeeklyProgramDay | "")}
                options={dayFilterSelectOptions}
                className="min-h-[48px] text-sm"
              />
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
                          {r.notes?.trim() ? (
                            <p className="mt-1 text-sm text-white/50 italic">{r.notes.trim()}</p>
                          ) : null}
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
          <CustomSelect portaled
            value={filterChatter}
            onChange={setFilterChatter}
            options={chatterFilterSelectOptions}
            className="w-full min-h-[44px] sm:min-w-[140px] sm:min-h-0"
          />
          <CustomSelect portaled
            value={filterModel}
            onChange={setFilterModel}
            options={modelFilterSelectOptions}
            className="w-full min-h-[44px] sm:min-w-[140px] sm:min-h-0"
          />
          <CustomSelect portaled
            value={filterShiftType}
            onChange={(v) => setFilterShiftType(v as WeeklyProgramShiftType | "")}
            options={SHIFT_FILTER_OPTIONS}
            className="w-full min-h-[44px] sm:min-w-[120px] sm:min-h-0"
          />
          <ButtonPrimary type="button" onClick={() => { setCreateOpen(true); setError(null); setSuccess(null); }} className="w-full sm:w-auto">
            Create shift
          </ButtonPrimary>
        </div>
      </div>

      {chattersWithSlotsThisWeek.length > 0 ? (
        <div className="glass-card space-y-3 p-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Duplicate chatter week</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Copy every shift for a chatter from <span className="text-white/70">week of {formatWeekLabel(effectiveWeekStart)}</span> into another week.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {chattersWithSlotsThisWeek.map((c) => (
              <div
                key={c.id}
                className="flex min-w-0 flex-1 basis-[220px] items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
              >
                <span className="truncate text-sm font-semibold text-white/90">{c.name}</span>
                <button
                  type="button"
                  onClick={() => openDuplicateWeekModal(c.id, c.name)}
                  disabled={duplicateWeekUi === "working"}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white/85 disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Duplicate week
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Model coverage board */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Model coverage</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card overflow-hidden shadow-[inset_0_0_0_1px_rgba(251,191,36,0.08)]">
            <div className="flex items-center gap-2 border-b border-amber-500/15 bg-gradient-to-r from-amber-500/10 to-transparent px-4 py-3">
              <Sun className="h-4 w-4 text-amber-300/90" aria-hidden />
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-100/95">Morning</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-black/35">
                    <th className="sticky left-0 z-[1] bg-[#0c0c0c] px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-white/50 shadow-[1px_0_0_rgba(255,255,255,0.06)]">
                      Model
                    </th>
                    {resolvedCoverageBoard.days.map((d) => (
                      <th key={d} className="min-w-[120px] px-2 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-white/50">
                        {d.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {resolvedCoverageBoard.morning.map((row, idx) => (
                    <tr
                      key={resolvedCoverageBoard.modelNames[idx]}
                      className="transition-[background-color,box-shadow] duration-150 ease-out hover:bg-amber-500/[0.04]"
                    >
                      <td className="sticky left-0 z-[1] bg-[#0a0a0a]/95 px-3 py-2.5 font-medium text-white/90 shadow-[1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                        <span className="flex items-center gap-2.5">
                          <AdminRowAvatar name={resolvedCoverageBoard.modelNames[idx] ?? "?"} size="sm" />
                          <span className="truncate">{resolvedCoverageBoard.modelNames[idx]}</span>
                        </span>
                      </td>
                      {row.map((cell) => (
                        <ModelCoverageTableCell key={cell.day} cell={cell} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="glass-card overflow-hidden shadow-[inset_0_0_0_1px_rgba(129,140,248,0.12)]">
            <div className="flex items-center gap-2 border-b border-indigo-500/15 bg-gradient-to-r from-indigo-500/12 to-transparent px-4 py-3">
              <Moon className="h-4 w-4 text-indigo-300/90" aria-hidden />
              <p className="text-sm font-semibold uppercase tracking-wider text-indigo-100/95">Night</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-black/35">
                    <th className="sticky left-0 z-[1] bg-[#0c0c0c] px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-white/50 shadow-[1px_0_0_rgba(255,255,255,0.06)]">
                      Model
                    </th>
                    {resolvedCoverageBoard.days.map((d) => (
                      <th key={d} className="min-w-[120px] px-2 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-white/50">
                        {d.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {resolvedCoverageBoard.night.map((row, idx) => (
                    <tr
                      key={resolvedCoverageBoard.modelNames[idx]}
                      className="transition-[background-color,box-shadow] duration-150 ease-out hover:bg-indigo-500/[0.05]"
                    >
                      <td className="sticky left-0 z-[1] bg-[#0a0a0a]/95 px-3 py-2.5 font-medium text-white/90 shadow-[1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                        <span className="flex items-center gap-2.5">
                          <AdminRowAvatar name={resolvedCoverageBoard.modelNames[idx] ?? "?"} size="sm" />
                          <span className="truncate">{resolvedCoverageBoard.modelNames[idx]}</span>
                        </span>
                      </td>
                      {row.map((cell) => (
                        <ModelCoverageTableCell key={cell.day} cell={cell} />
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
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 bg-black/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold uppercase tracking-wider text-white/90">{day}</p>
                    <p className="mt-0.5 text-sm text-white/50">{dateLabel}</p>
                  </div>
                  {entries.length > 0 ? (
                    <button
                      type="button"
                      disabled={duplicateOpenDay === day && duplicateUi === "working"}
                      onClick={() => openDuplicateModal(day)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-60"
                    >
                      {duplicateOpenDay === day && duplicateUi === "working" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                          Duplicating…
                        </>
                      ) : (
                        "Duplicate"
                      )}
                    </button>
                  ) : null}
                </div>
                <div className="p-4 space-y-3">
                  {entries.length === 0 ? (
                    <p className="py-4 text-center text-sm text-white/45">No shifts</p>
                  ) : (
                    entries.map((e) => {
                      const timeRange = e.start_time && e.end_time ? formatTimeRange(e.start_time, e.end_time) : "—";
                      return (
                        <div
                          key={e.id}
                          className={cn(
                            "rounded-xl border border-white/10 bg-white/[0.06] p-4 pl-3.5",
                            shiftCardAccentClass(e.shift_type)
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <ShiftTypeBadge shiftType={e.shift_type} />
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[hsl(330,90%,75%)]">{timeRange}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/70">
                            <span className="text-white/50">Models:</span>
                            {e.model_ids.length ? (
                              <ModelPeriodNamesRow
                                modelIds={e.model_ids}
                                idToName={modelIdToDisplayName}
                                dateYmd={dateYmd}
                                periodDatesByModelId={periodDatesByModelId}
                              />
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                          {e.chatter_name && <p className="mt-0.5 text-xs text-white/50">{e.chatter_name}</p>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={e.id.startsWith("dup-pending-")}
                              onClick={() => openDuplicateSlotModal(e)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white/85 disabled:opacity-40"
                            >
                              <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Duplicate
                            </button>
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
                  <div className="shrink-0 border-b border-white/10 bg-black/40 px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold uppercase tracking-wider text-white/90">{day}</p>
                        <p className="mt-1 text-sm text-white/50">{dateLabel}</p>
                      </div>
                      {entries.length > 0 ? (
                        <button
                          type="button"
                          disabled={duplicateOpenDay === day && duplicateUi === "working"}
                          onClick={() => openDuplicateModal(day)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/80 hover:bg-white/10 disabled:opacity-60"
                        >
                          {duplicateOpenDay === day && duplicateUi === "working" ? (
                            <>
                              <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                              Duplicating…
                            </>
                          ) : (
                            "Duplicate"
                          )}
                        </button>
                      ) : null}
                    </div>
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
                        const hasConflict = resolvedConflictRecordIds.includes(e.id);
                        const timeRange = e.start_time && e.end_time ? formatTimeRange(e.start_time, e.end_time) : "—";
                        return (
                          <div
                            key={e.id}
                            className={cn(
                              "rounded-xl border pl-3.5 transition-all hover:border-white/20",
                              shiftCardAccentClass(e.shift_type),
                              hasConflict
                                ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/30"
                                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                            )}
                          >
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <ShiftTypeBadge shiftType={e.shift_type} className="mb-2" />
                                  <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(330,90%,75%)]">{timeRange}</p>
                                  <p className="mt-1 font-medium text-white/95 truncate text-base">{e.chatter_name || "—"}</p>
                                  <div className="mt-1 min-w-0 text-sm text-white/65">
                                    {e.model_ids.length ? (
                                      <ModelPeriodNamesRow
                                        modelIds={e.model_ids}
                                        idToName={modelIdToDisplayName}
                                        dateYmd={dateYmd}
                                        periodDatesByModelId={periodDatesByModelId}
                                      />
                                    ) : (
                                      <span>—</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  {hasConflict && (
                                    <span className="rounded-full bg-amber-500/25 p-1.5 text-amber-400" title="Conflict">
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => setEditingEntry(e)} className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors">
                                  Edit
                                </button>
                                <button type="button" onClick={() => handleDelete(e.id)} disabled={deletingId === e.id} className="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-300/80 hover:bg-red-500/10 disabled:opacity-50 transition-colors">
                                  {deletingId === e.id ? "…" : "Delete"}
                                </button>
                                <button
                                  type="button"
                                  disabled={e.id.startsWith("dup-pending-")}
                                  onClick={() => openDuplicateSlotModal(e)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/85 disabled:opacity-40"
                                >
                                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  Duplicate
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
              <CustomSelect portaled
                value={availFilterChatter}
                onChange={setAvailFilterChatter}
                options={availChatterSelectOptions}
                className="text-xs"
              />
              <CustomSelect portaled
                value={availFilterShiftType}
                onChange={(v) => setAvailFilterShiftType(v as WeeklyProgramShiftType | "")}
                options={AVAIL_SHIFT_TYPE_OPTIONS}
                className="text-xs"
              />
              <CustomSelect portaled
                value={availFilterDay}
                onChange={(v) => setAvailFilterDay(v as WeeklyProgramDay | "")}
                options={dayFilterSelectOptions}
                className="text-xs"
              />
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
                          {r.notes?.trim() ? (
                            <p className="mt-1 text-sm text-white/50 italic">{r.notes.trim()}</p>
                          ) : null}
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

      <AnimatePresence>
      {(createOpen || editingEntry || prefillFromAvailability) && (
        <motion.div
          key="weekly-shift-sheet"
          className="fixed inset-0 z-50 flex overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Create or edit shift"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden onClick={() => { setCreateOpen(false); setEditingEntry(null); setPrefillFromAvailability(null); setError(null); }} />
          {/* Mobile: full-screen sheet. Desktop: offset for sidebar, side panel */}
          <div
            className="relative flex h-full w-full flex-col overflow-hidden md:ml-64 md:w-[calc(100vw-16rem)] md:flex-row md:flex-1 md:flex-shrink-0 md:items-stretch md:gap-6 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border-0 bg-black/95 shadow-2xl md:min-w-[380px] md:max-w-4xl md:rounded-2xl md:border md:border-white/10" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7), 0 0 80px -24px hsl(330 80% 55% / 0.08)" }}>
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <ShiftEntryModal
                  asPanel
                  chatters={chatters}
                  modelss={modelss}
                  weekStart={effectiveWeekStart}
                  entry={editingEntry}
                  prefillFromAvailability={prefillFromAvailability}
                  coverageBoard={resolvedCoverageBoard}
                  lastAssignmentMap={lastAssignmentMap}
                  programs={programsThisWeek}
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
                  <CustomSelect portaled
                    value={availFilterChatter}
                    onChange={setAvailFilterChatter}
                    options={availChatterSelectOptions}
                    className="text-sm"
                  />
                  <CustomSelect portaled
                    value={availFilterShiftType}
                    onChange={(v) => setAvailFilterShiftType(v as WeeklyProgramShiftType | "")}
                    options={AVAIL_SHIFT_TYPE_OPTIONS}
                    className="text-sm"
                  />
                  <CustomSelect portaled
                    value={availFilterDay}
                    onChange={(v) => setAvailFilterDay(v as WeeklyProgramDay | "")}
                    options={dayFilterSelectOptions}
                    className="text-sm"
                  />
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
                              {r.notes?.trim() ? (
                                <p className="mt-1 text-sm text-white/50 italic">{r.notes.trim()}</p>
                              ) : null}
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
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {duplicateOpenDay ? (
          <motion.div
            key="duplicate-week-popover"
            className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" aria-hidden onClick={closeDuplicateModal} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="dup-week-title"
              className="relative z-[1] flex max-h-[90dvh] w-full max-w-sm flex-col rounded-t-2xl border border-white/10 border-b-0 bg-black/95 p-5 shadow-2xl md:max-h-[calc(100vh-2rem)] md:rounded-2xl md:border-b"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7), 0 0 80px -24px hsl(330 80% 55% / 0.08)",
                paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
              }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12, ease: "easeIn" } }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="dup-week-title" className="text-lg font-semibold tracking-tight text-white">
                Copy {duplicateOpenDay} shifts to:
              </h2>
              <p className="mt-1 text-xs text-white/50">Pick a day. New rows appear right away; Airtable saves in the background.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {DAYS.filter((d) => d !== duplicateOpenDay).map((d) => {
                  const abbrev = d.slice(0, 3);
                  const selected = duplicateTargetDay === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={duplicateUi === "working"}
                      onClick={() => setDuplicateTargetDay(d)}
                      className={`min-w-[3rem] rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        selected
                          ? "border-[hsl(330,80%,55%)]/60 bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,85%)]"
                          : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                      } disabled:opacity-50`}
                    >
                      {abbrev}
                    </button>
                  );
                })}
              </div>
              {duplicateTargetExistingCount > 0 ? (
                <p className="mt-3 text-xs font-medium text-amber-300/90">This will add to existing shifts.</p>
              ) : null}
              {duplicateUi === "failed" ? <p className="mt-3 text-sm font-medium text-red-400">Failed</p> : null}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <ButtonSecondary
                  type="button"
                  disabled={duplicateUi === "working"}
                  onClick={closeDuplicateModal}
                  className="w-full sm:min-w-[100px]"
                >
                  Cancel
                </ButtonSecondary>
                <button
                  type="button"
                  disabled={
                    duplicateUi === "working" ||
                    duplicateUi === "done" ||
                    duplicateOpenDay === duplicateTargetDay
                  }
                  onClick={() => handleDuplicateCopy(duplicateOpenDay, duplicateTargetDay)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[hsl(330,80%,55%)]/50 bg-[hsl(330,80%,55%)]/25 px-4 py-2.5 text-sm font-semibold text-[hsl(330,90%,80%)] hover:bg-[hsl(330,80%,55%)]/35 disabled:opacity-50 sm:min-w-[120px]"
                >
                  {duplicateUi === "working" ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      Duplicating...
                    </>
                  ) : duplicateUi === "done" ? (
                    "✓ Done"
                  ) : (
                    "Copy"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    <ConfirmDialog
      open={deleteProgramConfirmId != null}
      onClose={() => deletingId == null && setDeleteProgramConfirmId(null)}
      onConfirm={() => {
        const id = deleteProgramConfirmId;
        if (id) return runProgramDelete(id);
      }}
      title="Delete this shift?"
      description="This removes the scheduled shift from the weekly program. This cannot be undone."
      confirmLabel="Delete"
      confirmVariant="danger"
      loading={deletingId != null}
    />

      {duplicateWeekModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="dup-week-title">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <h3 id="dup-week-title" className="text-lg font-bold text-white">
              Duplicate week for {duplicateWeekModal.chatterName}
            </h3>
            <p className="mt-2 text-sm text-white/50">
              Copy all shifts from <span className="text-white/75">week of {formatWeekLabel(effectiveWeekStart)}</span> to:
            </p>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wider text-white/40" htmlFor="dup-week-target">
              Target week
            </label>
            <select
              id="dup-week-target"
              value={duplicateWeekTarget}
              onChange={(e) => setDuplicateWeekTarget(e.target.value)}
              disabled={duplicateWeekUi === "working"}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500/40 disabled:opacity-50"
            >
              <option value={duplicateWeekNextStart}>
                Next week ({formatWeekLabel(duplicateWeekNextStart)})
              </option>
              <option value={duplicateWeekAfterStart}>
                Week after ({formatWeekLabel(duplicateWeekAfterStart)})
              </option>
            </select>
            <Checkbox
              className="mt-4"
              checked={duplicateWeekOverwrite}
              onChange={(e) => setDuplicateWeekOverwrite(e.target.checked)}
              disabled={duplicateWeekUi === "working"}
              label="Overwrite this chatter's existing shifts in the target week"
            />
            {duplicateWeekUi === "failed" ? (
              <p className="mt-3 text-sm font-medium text-red-400">Something went wrong. Check the message above or try again.</p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={runDuplicateEntireWeek}
                disabled={duplicateWeekUi === "working"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/20 py-2.5 text-sm font-semibold text-pink-300 transition-colors hover:bg-pink-500/30 disabled:opacity-50"
              >
                {duplicateWeekUi === "working" ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Copying…
                  </>
                ) : (
                  "Duplicate"
                )}
              </button>
              <button
                type="button"
                onClick={closeDuplicateWeekModal}
                disabled={duplicateWeekUi === "working"}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {duplicateSlotModal ? (
        <div
          className="fixed inset-0 z-[61] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dup-slot-title"
          onClick={() => dupSlotUi !== "working" && closeDuplicateSlotModal()}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 id="dup-slot-title" className="text-lg font-bold text-white">
              Duplicate slot
            </h3>
            <p className="mt-1 text-sm text-white/40">
              {duplicateSlotModal.chatter_name || "—"} ·{" "}
              {duplicateSlotModal.start_time && duplicateSlotModal.end_time
                ? formatTimeRange(duplicateSlotModal.start_time, duplicateSlotModal.end_time)
                : "—"}
            </p>
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">Week</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: "This week", value: effectiveWeekStart },
                  { label: "Next week", value: duplicateWeekNextStart },
                  { label: "Week after", value: duplicateWeekAfterStart },
                ].map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    disabled={dupSlotUi === "working"}
                    onClick={() => setDupSlotTargetWeek(w.value)}
                    className={`rounded-xl border px-3 py-2 text-sm transition-all ${
                      normalizeWeekStart(dupSlotTargetWeek) === normalizeWeekStart(w.value)
                        ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    } disabled:opacity-50`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">Days</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((abbr, i) => {
                  const selected = dupSlotSelectedDays.includes(i);
                  return (
                    <button
                      key={abbr}
                      type="button"
                      disabled={dupSlotUi === "working"}
                      onClick={() => toggleDupSlotDay(i)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xs font-medium transition-all ${
                        selected
                          ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
                          : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                      } disabled:opacity-50`}
                    >
                      {abbr}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-white/30">
                {dupSlotSelectedDays.length === 0
                  ? "Select at least one day"
                  : `Will create ${dupSlotSelectedDays.length} slot${dupSlotSelectedDays.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <Checkbox
              className="mt-4"
              checked={dupSlotOverwrite}
              onChange={(e) => setDupSlotOverwrite(e.target.checked)}
              disabled={dupSlotUi === "working"}
              label="Overwrite overlapping slots (same chatter, same day, overlapping hours in target week)"
            />
            {dupSlotUi === "failed" ? (
              <p className="mt-3 text-sm font-medium text-red-400">Could not duplicate. See the message above.</p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={runDuplicateSlot}
                disabled={dupSlotSelectedDays.length === 0 || dupSlotUi === "working"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/20 py-3 text-sm font-semibold text-pink-300 transition-colors hover:bg-pink-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {dupSlotUi === "working" ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Creating…
                  </>
                ) : (
                  `Duplicate to ${dupSlotSelectedDays.length} day${dupSlotSelectedDays.length !== 1 ? "s" : ""}`
                )}
              </button>
              <button
                type="button"
                onClick={closeDuplicateSlotModal}
                disabled={dupSlotUi === "working"}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </>
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

  const chatterFormSelectOptions = React.useMemo(
    () => [
      { value: "", label: "Select chatter" },
      ...chatters.map((c) => ({ value: c.id, label: c.full_name })),
    ],
    [chatters]
  );
  const dayFormSelectOptions = React.useMemo(() => DAYS.map((d) => ({ value: d, label: d })), []);
  const shiftTypeFormSelectOptions = React.useMemo(
    () => [
      { value: "Morning", label: "Morning (12:00–20:00)" },
      { value: "Night", label: "Night (20:00–03:00)" },
      { value: "Custom", label: "Custom" },
    ],
    []
  );

  const suggestions = React.useMemo(() => {
    const out: { type: string; text: string }[] = [];
    const dayIdx = DAYS.indexOf(day);
    if (shiftType === "Morning" && coverageBoard.morning.length > 0) {
      coverageBoard.morning.forEach((row, idx) => {
        const cell = row[dayIdx];
        if (cell && coverageCellIsUncovered(cell)) out.push({ type: "uncovered", text: `${coverageBoard.modelNames[idx]} is uncovered for Morning on ${day}` });
      });
    }
    if (shiftType === "Night" && coverageBoard.night.length > 0) {
      coverageBoard.night.forEach((row, idx) => {
        const cell = row[dayIdx];
        if (cell && coverageCellIsUncovered(cell)) out.push({ type: "uncovered", text: `${coverageBoard.modelNames[idx]} is uncovered for Night on ${day}` });
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
      const startHHmm = normalizeHHmm(customStartTime.trim());
      const endHHmm = normalizeHHmm(customEndTime.trim());
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
    const startHHmm = normalizeHHmm(customStartTime.trim());
    const endHHmm = normalizeHHmm(customEndTime.trim());
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
    const startNorm = shiftType === "Custom" ? normalizeHHmm(customStartTime.trim()) : null;
    const endNorm = shiftType === "Custom" ? normalizeHHmm(customEndTime.trim()) : null;
    const fields = {
      chatter_id: chatterId,
      chatter_name: chatterName,
      model_ids: Array.from(selectedModelIds),
      day,
      shift_type: shiftType,
      week_start: weekStartVal,
      notes,
      ...(shiftType === "Custom" &&
        startNorm &&
        endNorm && {
          custom_start_time: startNorm,
          custom_end_time: endNorm,
        }),
    };
    if (onUpdate) await onUpdate(fields);
    else await onCreate(fields);
    setSaving(false);
  }, [chatterId, chatterName, selectedModelIds, day, shiftType, weekStartVal, notes, customStartTime, customEndTime, onUpdate, onCreate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomTimeError(null);
    if (!chatterId) return;
    if (selectedModelIds.size === 0) {
      setCustomTimeError("Select at least one model for this shift.");
      return;
    }
    if (shiftType === "Custom") {
      const start = normalizeHHmm(customStartTime.trim());
      const end = normalizeHHmm(customEndTime.trim());
      if (!start || !end) {
        setCustomTimeError("Enter valid times (HH:mm, hour 00–23, minute 00–59).");
        return;
      }
      if (start === end) {
        setCustomTimeError("End time cannot equal Start time.");
        return;
      }
    }
    await performSave();
  };

  const title = isEdit ? "Edit scheduled shift" : "Create scheduled shift";
  const subtitle = "Chatter, day, shift type, and assign models.";

  const formContent = (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-4 pb-32 md:pb-5" style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
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
        <FormField label="Chatter" icon={<UserRound />} htmlFor="wp-modal-chatter" required>
          <CustomSelect portaled
            id="wp-modal-chatter"
            required
            value={chatterId}
            onChange={setChatterId}
            options={chatterFormSelectOptions}
            className="w-full"
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField label="Day" icon={<CalendarDays />} htmlFor="wp-modal-day" required>
            <CustomSelect portaled
              id="wp-modal-day"
              required
              value={day}
              onChange={(v) => setDay(v as WeeklyProgramDay)}
              options={dayFormSelectOptions}
              className="w-full"
            />
          </FormField>
          <FormField label="Shift type" icon={<Layers />} htmlFor="wp-modal-shift-type" required>
            <CustomSelect portaled
              id="wp-modal-shift-type"
              required
              value={shiftType}
              onChange={(v) => {
                setShiftType(v as WeeklyProgramShiftType);
                setCustomTimeError(null);
              }}
              options={shiftTypeFormSelectOptions}
              className="w-full"
            />
          </FormField>
        </div>
        <div
          className={`grid grid-cols-1 gap-4 transition-all duration-300 ease-out sm:grid-cols-2 ${
            shiftType === "Custom"
              ? "max-h-[min(520px,85vh)] overflow-visible opacity-100"
              : "pointer-events-none max-h-0 overflow-hidden opacity-0"
          }`}
          aria-hidden={shiftType !== "Custom"}
        >
          <CustomTime12hBlock
            label="Start time"
            required
            value={customStartTime}
            onChange={(v) => { setCustomStartTime(v); setCustomTimeError(null); }}
            ariaInvalid={!!customTimeError}
          />
          <CustomTime12hBlock
            label="End time"
            required
            value={customEndTime}
            onChange={(v) => { setCustomEndTime(v); setCustomTimeError(null); }}
            ariaInvalid={!!customTimeError}
          />
        </div>
        {customTimeError && (
          <p className="text-sm text-rose-300/95">{customTimeError}</p>
        )}
        <FormField label="Week start" icon={<Calendar />} htmlFor="wp-modal-week-start" required>
          <FormInput
            id="wp-modal-week-start"
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
          />
        </FormField>
        <FormField
          label="Assign models"
          icon={<Search />}
          htmlFor="wp-modal-model-search"
          description="Taken models are disabled for this day/time."
        >
          <FormInput
            id="wp-modal-model-search"
            type="search"
            placeholder="Search models…"
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
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
          <div className="mt-1.5 min-h-[300px] max-h-[400px] overflow-y-auto rounded-lg border border-white/10 bg-white/[0.04] p-1.5 space-y-1">
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
                    className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-3 transition-colors ${
                      isTaken ? "bg-white/[0.02] opacity-75" : "hover:bg-white/[0.06]"
                    } ${isTaken ? "cursor-not-allowed" : ""}`}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <Checkbox
                        checked={selectedModelIds.has(m.id)}
                        onChange={() => toggleModel(m.id)}
                        label=""
                        className="shrink-0 [&_input]:h-5 [&_input]:w-5 [&_input]:min-h-0"
                        disabled={isTaken}
                      />
                      <div className="min-w-0">
                        <p className={`font-medium truncate ${isTaken ? "text-white/60" : "text-white/95"}`}>
                          {m.model_name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                          {isTaken ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-400/90">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" aria-hidden />
                              Taken by {availability.takenBy}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400/90">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                              Free
                            </span>
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
        </FormField>
        <FormField label="Notes" icon={<StickyNote />} htmlFor="wp-modal-notes">
          <FormTextarea id="wp-modal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
        </FormField>
        </div>
        <div className="sticky bottom-0 z-10 flex w-full flex-col gap-3 border-t border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl md:flex-row md:justify-end md:border-t-0 md:bg-transparent md:px-5 md:py-0 md:pt-4 md:backdrop-blur-none" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))", paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
          <ButtonSecondary type="button" onClick={onClose} className="w-full md:w-auto">Cancel</ButtonSecondary>
          <FormSubmitButton type="submit" disabled={saving} loading={saving} className="w-full md:w-auto md:min-w-[10rem]">
            {saving ? "Saving…" : isEdit ? "Update" : "Create"}
          </FormSubmitButton>
        </div>
      </form>
  );

  if (asPanel) {
    return (
      <>
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
      <GlassModal onClose={onClose} title={title} subtitle={subtitle} className="md:max-w-4xl">
        {formContent}
      </GlassModal>
    </>
  );
}
