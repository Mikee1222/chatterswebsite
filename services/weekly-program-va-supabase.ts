/**
 * Supabase backend for services/weekly-program-va.ts
 */

import {
  publicId,
  sbAirtableIdsForUuids,
  sbDeleteByPublicId,
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
import type { CreateWeeklyProgramVaFields, ConflictResultVa } from "./weekly-program-va";

const TABLE = "weekly_program_va";

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
  return s.includes("T") ? s : s.replace(" ", "T");
}

function weekStartYmd(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  const ymd = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? airtableWeekStartToMonday(ymd) : "";
}

function parseModelNames(model_name: string | null | undefined): string[] {
  const s = String(model_name ?? "").trim();
  if (!s) return [];
  return s
    .split(/\s*,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function resolveUuidMap(table: string, uuidLists: (string[] | null | undefined)[]): Promise<Map<string, string>> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const list of uuidLists) {
    for (const id of list ?? []) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
    }
  }
  if (!unique.length) return new Map();
  const resolved = await sbAirtableIdsForUuids(table, unique);
  const map = new Map<string, string>();
  for (let i = 0; i < unique.length; i++) {
    map.set(unique[i]!, resolved[i] || unique[i]!);
  }
  return map;
}

function mapRowSync(
  row: Row,
  userAtByUuid: Map<string, string>,
  modelAtByUuid: Map<string, string>
): WeeklyProgramRecord {
  const chatterUuid = row.chatter?.find(Boolean);
  const chatter_id =
    (chatterUuid ? userAtByUuid.get(chatterUuid) || chatterUuid : "") ||
    String(row.chatter_id ?? "").trim() ||
    "";
  const model_ids = (row.models ?? []).map((id) => modelAtByUuid.get(id) || id).filter(Boolean);
  return {
    id: publicId(row),
    program_id: String(row.program_id ?? ""),
    chatter_id,
    chatter_name: String(row.chatter_name ?? ""),
    model_ids,
    model_names: parseModelNames(row.model_name),
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

async function mapRows(rows: Row[]): Promise<WeeklyProgramRecord[]> {
  if (!rows.length) return [];
  const [userAtByUuid, modelAtByUuid] = await Promise.all([
    resolveUuidMap(
      "users",
      rows.map((r) => r.chatter)
    ),
    resolveUuidMap(
      "modelss",
      rows.map((r) => r.models)
    ),
  ]);
  return rows.map((r) => mapRowSync(r, userAtByUuid, modelAtByUuid));
}

async function mapRow(row: Row): Promise<WeeklyProgramRecord> {
  const [mapped] = await mapRows([row]);
  return mapped;
}

export async function listWeeklyProgramVa(params: ListParams & { filterByFormula?: string } = {}) {
  void params;
  const rows = await sbSelectAll<Row>(TABLE);
  const programs = await mapRows(rows);
  return { programs, offset: undefined as string | undefined };
}

export async function listAllWeeklyProgramVa(_filterByFormula?: string): Promise<WeeklyProgramRecord[]> {
  void _filterByFormula;
  const rows = await sbSelectAll<Row>(TABLE);
  return mapRows(rows);
}

export async function getProgramsForWeekVa(weekStart: string): Promise<WeeklyProgramRecord[]> {
  const weekYmd = ensureMondayForQuery(weekStart);
  const all = await listAllWeeklyProgramVa();
  return all.filter((p) => p.week_start === weekYmd);
}

export async function getProgramsForWeekAndVa(
  weekStart: string,
  vaRecordId: string
): Promise<WeeklyProgramRecord[]> {
  const all = await getProgramsForWeekVa(weekStart);
  return all.filter((p) => p.chatter_id === vaRecordId);
}

export async function getWeeklyProgramVaById(recordId: string): Promise<WeeklyProgramRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (!row) return null;
  return mapRow(row);
}

export async function updateWeeklyProgramVa(
  recordId: string,
  fields: Record<string, unknown>
): Promise<WeeklyProgramRecord> {
  const patch: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  if (Array.isArray(fields.chatter)) {
    patch.chatter = await sbUuidsForAirtableIds("users", fields.chatter as string[]);
  }
  if (Array.isArray(fields.models)) {
    patch.models = await sbUuidsForAirtableIds("modelss", fields.models as string[]);
  }
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, patch);
  return mapRow(row);
}

export async function createWeeklyProgramVa(fields: CreateWeeklyProgramVaFields): Promise<WeeklyProgramRecord> {
  const programId = `prog_va_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

export async function deleteWeeklyProgramVa(recordId: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, recordId);
}

export async function checkScheduledShiftConflictsVa(
  _vaId: string,
  modelIds: string[],
  _day: WeeklyProgramDay,
  _shiftType: WeeklyProgramShiftType,
  weekStart: string,
  excludeRecordId: string | undefined,
  modelIdToName: Record<string, string> | undefined,
  start_time: string,
  end_time: string
): Promise<ConflictResultVa> {
  void _vaId;
  void _day;
  void _shiftType;
  const programs = await getProgramsForWeekVa(weekStart);
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
        message: `Model "${modelName}" is already assigned to ${p.chatter_name ?? "another VA"} during overlapping hours in this week.`,
        modelName,
        otherVa: p.chatter_name ?? undefined,
      };
    }
  }
  return { conflict: false };
}
