/**
 * Supabase backend for services/weekly-program.ts
 */

import {
  publicId,
  sbAirtableIdsForUuids,
  sbDeleteByPublicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import {
  WEEKLY_PROGRAM_DAY_OPTIONS,
  WEEKLY_PROGRAM_SHIFT_TYPES,
  ensureMondayForQuery,
  airtableWeekStartToMonday,
} from "@/lib/weekly-program";
import { rangesOverlap } from "@/lib/weekly-program-conflicts";
import type { WeeklyProgramRecord, WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";
import type { ListParams } from "@/lib/airtable-server";
import type { CreateWeeklyProgramFields, ConflictResult } from "./weekly-program";

const TABLE = "weekly_program";

type Row = SbRow & {
  program_id?: string | null;
  chatter?: string[] | null;
  chatter_id?: string | null;
  chatter_name?: string | null;
  models?: string[] | null;
  model_name?: string | null;
  day?: string | null;
  shift_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  week_start?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function asDay(raw: unknown): WeeklyProgramDay {
  const s = typeof raw === "string" ? raw.trim() : "";
  if ((WEEKLY_PROGRAM_DAY_OPTIONS as readonly string[]).includes(s)) return s as WeeklyProgramDay;
  const found = WEEKLY_PROGRAM_DAY_OPTIONS.find((d) => d.toLowerCase() === s.toLowerCase());
  return found ?? "Monday";
}

function asShiftType(raw: unknown): WeeklyProgramShiftType {
  const s = typeof raw === "string" ? raw.trim() : "";
  if ((WEEKLY_PROGRAM_SHIFT_TYPES as readonly string[]).includes(s)) return s as WeeklyProgramShiftType;
  const found = WEEKLY_PROGRAM_SHIFT_TYPES.find((t) => t.toLowerCase() === s.toLowerCase());
  return found ?? "Morning";
}

function isoOrEmpty(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  // Normalize "2026-07-05 20:00:00+00" → ISO-ish
  return s.includes("T") ? s : s.replace(" ", "T");
}

function weekStartYmd(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  const ymd = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? airtableWeekStartToMonday(ymd) : "";
}

async function mapRow(row: Row): Promise<WeeklyProgramRecord> {
  const chatter_id =
    (await sbFirstLinkedAirtableId("users", row.chatter)) ||
    String(row.chatter_id ?? "").trim() ||
    "";
  const model_ids = await sbAirtableIdsForUuids("modelss", row.models);
  return {
    id: publicId(row),
    program_id: String(row.program_id ?? ""),
    chatter_id,
    chatter_name: String(row.chatter_name ?? ""),
    model_ids,
    day: asDay(row.day),
    shift_type: asShiftType(row.shift_type),
    start_time: isoOrEmpty(row.start_time),
    end_time: isoOrEmpty(row.end_time),
    week_start: weekStartYmd(row.week_start),
    notes: String(row.notes ?? ""),
    created_at: isoOrEmpty(row.created_at),
    updated_at: isoOrEmpty(row.updated_at),
  };
}

export async function listWeeklyProgram(params: ListParams & { filterByFormula?: string } = {}) {
  void params;
  const rows = await sbSelectAll<Row>(TABLE);
  const programs = await Promise.all(rows.map(mapRow));
  return { programs, offset: undefined as string | undefined };
}

export async function listAllWeeklyProgram(_filterByFormula?: string): Promise<WeeklyProgramRecord[]> {
  void _filterByFormula;
  const rows = await sbSelectAll<Row>(TABLE);
  return Promise.all(rows.map(mapRow));
}

export async function getProgramsForWeek(weekStart: string): Promise<WeeklyProgramRecord[]> {
  const weekYmd = ensureMondayForQuery(weekStart);
  const all = await listAllWeeklyProgram();
  return all.filter((p) => p.week_start === weekYmd);
}

export async function getProgramsForWeekAndChatter(
  weekStart: string,
  chatterRecordId: string
): Promise<WeeklyProgramRecord[]> {
  const all = await getProgramsForWeek(weekStart);
  return all.filter((p) => p.chatter_id === chatterRecordId);
}

export async function getWeeklyProgramById(recordId: string): Promise<WeeklyProgramRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (!row) return null;
  return mapRow(row);
}

export async function updateWeeklyProgram(
  recordId: string,
  fields: Record<string, unknown>
): Promise<WeeklyProgramRecord> {
  const patch: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  if (Array.isArray(fields.chatter)) {
    patch.chatter = await sbUuidsForAirtableIds("users", fields.chatter as string[]);
    delete patch.chatter_id;
  }
  if (Array.isArray(fields.models)) {
    patch.models = await sbUuidsForAirtableIds("modelss", fields.models as string[]);
  }
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, patch);
  return mapRow(row);
}

export async function createWeeklyProgram(fields: CreateWeeklyProgramFields): Promise<WeeklyProgramRecord> {
  const programId = `prog_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const chatterUuids = await sbUuidsForAirtableIds("users", fields.chatter);
  const modelUuids = await sbUuidsForAirtableIds("modelss", fields.models);
  const row = await sbInsert<Row>(TABLE, {
    program_id: programId,
    chatter: chatterUuids,
    chatter_name: fields.chatter_name,
    models: modelUuids,
    day: fields.day,
    shift_type: fields.shift_type,
    start_time: fields.start_time || null,
    end_time: fields.end_time || null,
    week_start: fields.week_start || null,
    notes: fields.notes ?? "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return mapRow(row);
}

export async function deleteWeeklyProgram(recordId: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, recordId);
}

export async function checkScheduledShiftConflicts(
  _chatterId: string,
  modelIds: string[],
  _day: WeeklyProgramDay,
  _shiftType: WeeklyProgramShiftType,
  weekStart: string,
  excludeRecordId: string | undefined,
  modelIdToName: Record<string, string> | undefined,
  start_time: string,
  end_time: string
): Promise<ConflictResult> {
  void _chatterId;
  void _day;
  void _shiftType;
  const programs = await getProgramsForWeek(weekStart);
  const others = programs.filter((p) => p.id !== excludeRecordId);
  const modelSet = new Set(modelIds.filter(Boolean));
  for (const p of others) {
    if (!p.start_time || !p.end_time) continue;
    if (!rangesOverlap(p.start_time, p.end_time, start_time, end_time)) continue;
    for (const mid of p.model_ids.filter(Boolean)) {
      if (!modelSet.has(mid)) continue;
      const modelName = modelIdToName?.[mid] ?? "model";
      return {
        conflict: true,
        type: "model",
        message: `Model "${modelName}" is already assigned to ${p.chatter_name ?? "another chatter"} during overlapping hours in this week. Same model cannot be in two overlapping shifts.`,
        modelName,
        otherChatter: p.chatter_name ?? undefined,
      };
    }
  }
  return { conflict: false };
}
