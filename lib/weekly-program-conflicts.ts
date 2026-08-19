/**
 * Weekly program conflict detection and model coverage.
 * Pure functions; no server/DB. Use with programs + modelss from the weekly program page.
 */

import { addDays, WEEKLY_PROGRAM_DAY_OPTIONS } from "./weekly-program";
import type { WeeklyProgramRecord, WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";

export type ConflictType =
  | "model_time_overlap"| "chatter_overlap"| "custom_overlap"| "uncovered_model"| "too_many_models";

export type Conflict = {
  type: ConflictType;
  message: string;
  recordIds: string[];
  day?: WeeklyProgramDay;
  shiftType?: WeeklyProgramShiftType;
  modelId?: string;
  modelName?: string;
  chatterName?: string;
};

export type ConflictSummary = {
  modelConflicts: number;
  chatterOverlaps: number;
  customOverlaps: number;
  uncoveredCount: number;
  tooManyModelsCount: number;
  total: number;
};

function parseIsoTime(iso: string): number {
  if (!iso) return 0;
  return new Date(iso).getTime();
}

/** Two time ranges overlap if startA < endB && startB < endA. Works for overnight (ISO timestamps). */
export function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a = parseIsoTime(startA);
  const b = parseIsoTime(endA);
  const c = parseIsoTime(startB);
  const d = parseIsoTime(endB);
  return a < d && c < b;
}

/** When editing, drop the row being saved so its previous times are not compared. */
export type ConflictCheckExclude = {
  recordId?: string;
  programId?: string;
};

/** Match chatter identity across records (id when present, else normalized name). */
export function sameWeeklyProgramChatter(
  a: { chatter_id?: string | null; chatter_name?: string | null },
  b: { chatter_id?: string | null; chatter_name?: string | null }
): boolean {
  const idA = (a.chatter_id ?? "").trim();
  const idB = (b.chatter_id ?? "").trim();
  if (idA && idB) return idA === idB;
  const na = (a.chatter_name ?? "").trim().toLowerCase();
  const nb = (b.chatter_name ?? "").trim().toLowerCase();
  return na !== "" && na === nb;
}

export function filterProgramsForConflictCheck(
  programs: WeeklyProgramRecord[],
  exclude?: ConflictCheckExclude
): WeeklyProgramRecord[] {
  if (!exclude?.recordId && !exclude?.programId) return programs;
  return programs.filter((p) => {
    if (exclude.recordId && p.id === exclude.recordId) return false;
    if (exclude.programId && p.program_id && p.program_id === exclude.programId) return false;
    return true;
  });
}

export function getWeeklyProgramConflicts(
  programs: WeeklyProgramRecord[],
  modelIds: string[],
  modelIdToName: Record<string, string>,
  options?: { tooManyModelsThreshold?: number }
): { conflicts: Conflict[]; summary: ConflictSummary } {
  void options?.tooManyModelsThreshold;
  const conflicts: Conflict[] = [];
  const weekStart = programs[0]?.week_start ?? "";

  const dayIndex = (d: WeeklyProgramDay) => WEEKLY_PROGRAM_DAY_OPTIONS.indexOf(d);
  const dateYmd = (p: WeeklyProgramRecord) =>
    weekStart ? addDays(weekStart, dayIndex(p.day)) : "";

  // Model time overlap: same model, overlapping ISO windows anywhere in the week (overnight-safe; matches server save checks)
  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    if (!p.start_time || !p.end_time) continue;
    for (let j = i + 1; j < programs.length; j++) {
      const q = programs[j];
      if (!q.start_time || !q.end_time) continue;
      const modelSetP = new Set(p.model_ids.filter(Boolean));
      for (const mid of q.model_ids.filter(Boolean)) {
        if (!modelSetP.has(mid)) continue;
        if (!rangesOverlap(p.start_time, p.end_time, q.start_time, q.end_time)) continue;
        const name = modelIdToName[mid] ?? mid;
        const dayLabel =
          p.day === q.day ? p.day : `${p.day} / ${q.day}`;
        conflicts.push({
          type: "model_time_overlap",
          message: `Model "${name}" has overlapping times (${dayLabel}): ${p.chatter_name ?? "—"} (${p.shift_type}) and ${q.chatter_name ?? "—"} (${q.shift_type}). Same model cannot be assigned to two overlapping shifts this week.`,
          recordIds: [p.id, q.id],
          day: p.day,
          shiftType: p.shift_type,
          modelId: mid,
          modelName: name,
          chatterName: q.chatter_name ?? undefined,
        });
      }
    }
  }

  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    for (let j = i + 1; j < programs.length; j++) {
      const q = programs[j];
      if (p.chatter_id !== q.chatter_id) continue;
      if (!p.start_time || !p.end_time || !q.start_time || !q.end_time) continue;
      const overlap = rangesOverlap(p.start_time, p.end_time, q.start_time, q.end_time);
      if (overlap) {
        conflicts.push({
          type: "chatter_overlap",
          message: `${p.chatter_name ?? "Chatter"} has overlapping shifts: ${p.day} ${p.shift_type} and ${q.day} ${q.shift_type}`,
          recordIds: [p.id, q.id],
          day: p.day,
          chatterName: p.chatter_name ?? undefined,
        });
      }
    }
  }

  const customPrograms = programs.filter((p) => p.shift_type === "Custom");
  for (let i = 0; i < customPrograms.length; i++) {
    const p = customPrograms[i];
    for (let j = i + 1; j < customPrograms.length; j++) {
      const q = customPrograms[j];
      if (!p.start_time || !p.end_time || !q.start_time || !q.end_time) continue;
      const overlap = rangesOverlap(p.start_time, p.end_time, q.start_time, q.end_time);
      if (overlap) {
        conflicts.push({
          type: "custom_overlap",
          message: `Custom shifts overlap: ${p.chatter_name ?? "—"} (${p.day}) and ${q.chatter_name ?? "—"} (${q.day})`,
          recordIds: [p.id, q.id],
        });
      }
    }
  }

  const assignedModelIds = new Set<string>();
  for (const p of programs) {
    for (const mid of p.model_ids.filter(Boolean)) assignedModelIds.add(mid);
  }
  const uncovered = modelIds.filter((id) => !assignedModelIds.has(id));
  for (const mid of uncovered) {
    conflicts.push({
      type: "uncovered_model",
      message: `"${modelIdToName[mid] ?? mid}" has no assignment this week`,
      recordIds: [],
      modelId: mid,
      modelName: modelIdToName[mid] ?? mid,
    });
  }

  const summary: ConflictSummary = {
    modelConflicts: conflicts.filter((c) => c.type === "model_time_overlap").length,
    chatterOverlaps: conflicts.filter((c) => c.type === "chatter_overlap").length,
    customOverlaps: conflicts.filter((c) => c.type === "custom_overlap").length,
    uncoveredCount: uncovered.length,
    tooManyModelsCount: conflicts.filter((c) => c.type === "too_many_models").length,
    total: conflicts.length,
  };

  return { conflicts, summary };
}

/** Flat list of program record ids referenced by conflict rows (deduped, stable order). */
export function collectConflictRecordIds(conflicts: Conflict[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const c of conflicts) {
    for (const id of c.recordIds) {
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

export type CoverageCell = {
  day: WeeklyProgramDay;
  shiftType: WeeklyProgramShiftType;
  modelId: string;
  modelName: string;
  chatterName: string | null;
  covered: boolean;
  recordId: string | null;
};

/** Rows = models, Cols = days. morning[modelIndex][dayIndex], night[modelIndex][dayIndex]. */
export type CoverageBoard = {
  morning: CoverageCell[][];
  night: CoverageCell[][];
  modelNames: string[];
  days: WeeklyProgramDay[];
};

export function getModelCoverageBoard(
  programs: WeeklyProgramRecord[],
  modelss: { id: string; model_name: string }[],
  _weekStart: string
): CoverageBoard {
  const idToName: Record<string, string> = {};
  modelss.forEach((m) => { idToName[m.id] = m.model_name ?? m.id; });

  const byDayShift: Record<string, Record<string, { chatterName: string; recordId: string }>> = {};
  for (const p of programs) {
    const key = `${p.day}:${p.shift_type}`;
    if (!byDayShift[key]) byDayShift[key] = {};
    for (const mid of p.model_ids.filter(Boolean)) {
      if (!byDayShift[key][mid] || p.chatter_name)
        byDayShift[key][mid] = { chatterName: p.chatter_name ?? "—", recordId: p.id };
    }
  }

  const morning: CoverageCell[][] = [];
  const night: CoverageCell[][] = [];
  const modelNames: string[] = [];

  for (const m of modelss) {
    modelNames.push(idToName[m.id] ?? m.id);
    const morningRow: CoverageCell[] = [];
    const nightRow: CoverageCell[] = [];
    for (const day of WEEKLY_PROGRAM_DAY_OPTIONS) {
      const assignM = byDayShift[`${day}:Morning`]?.[m.id];
      const assignN = byDayShift[`${day}:Night`]?.[m.id];
      morningRow.push({
        day,
        shiftType: "Morning",
        modelId: m.id,
        modelName: idToName[m.id] ?? m.id,
        chatterName: assignM?.chatterName ?? null,
        covered: !!assignM,
        recordId: assignM?.recordId ?? null,
      });
      nightRow.push({
        day,
        shiftType: "Night",
        modelId: m.id,
        modelName: idToName[m.id] ?? m.id,
        chatterName: assignN?.chatterName ?? null,
        covered: !!assignN,
        recordId: assignN?.recordId ?? null,
      });
    }
    morning.push(morningRow);
    night.push(nightRow);
  }

  return { morning, night, modelNames, days: [...WEEKLY_PROGRAM_DAY_OPTIONS] };
}
