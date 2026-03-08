import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { firstLinkedId, linkedRecordIds, snapshotText } from "@/lib/airtable-linked";
import { WEEKLY_PROGRAM_DAY_OPTIONS, WEEKLY_PROGRAM_SHIFT_TYPES, ensureMondayForQuery, airtableWeekStartToMonday } from "@/lib/weekly-program";
import { rangesOverlap } from "@/lib/weekly-program-conflicts";
import type { WeeklyProgramRecord, WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";

const TABLE = "weekly_program_va";

type Fields = {
  program_id?: string;
  chatter?: string | string[];
  chatter_name?: string;
  models?: string | string[];
  day?: string;
  shift_type?: string;
  start_time?: string;
  end_time?: string;
  week_start?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

function getWeekStartFromFields(f: Record<string, unknown>): string {
  let raw: string | undefined;
  if (f.week_start != null && typeof f.week_start === "string") raw = f.week_start;
  else if (f["Week start"] != null && typeof f["Week start"] === "string") raw = f["Week start"] as string;
  else {
    const key = Object.keys(f).find((k) => /^week[-_]?start$/i.test(k) || k === "Week start");
    raw = key && typeof f[key] === "string" ? (f[key] as string) : undefined;
  }
  return raw ? airtableWeekStartToMonday(raw) : "";
}

/** Match Airtable day (e.g. "Monday" or "monday") to canonical WeeklyProgramDay. */
function normalizeDay(raw: unknown): WeeklyProgramDay {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "Monday";
  const lower = s.toLowerCase();
  const found = WEEKLY_PROGRAM_DAY_OPTIONS.find((d) => d.toLowerCase() === lower);
  return found ?? "Monday";
}

/** Match Airtable shift_type to canonical WeeklyProgramShiftType. */
function normalizeShiftType(raw: unknown): WeeklyProgramShiftType {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "Morning";
  const found = WEEKLY_PROGRAM_SHIFT_TYPES.find((t) => t.toLowerCase() === s.toLowerCase());
  return found ?? "Morning";
}

function mapRecord(rec: AirtableRecord<Fields>): WeeklyProgramRecord {
  const f = rec.fields as unknown as Record<string, unknown>;
  const chatterLinked = f.chatter ?? f["Chatter"] ?? f["VA"];
  const modelsRaw = f.models ?? f["Models"];
  return {
    id: rec.id,
    program_id: String(f.program_id ?? f["Program id"] ?? ""),
    chatter_id: firstLinkedId(chatterLinked) ?? "",
    chatter_name: snapshotText(f.chatter_name ?? f["Chatter name"] ?? f["VA name"]),
    model_ids: linkedRecordIds(modelsRaw),
    day: normalizeDay(f.day ?? f["Day"]),
    shift_type: normalizeShiftType(f.shift_type ?? f["Shift type"]),
    start_time: String(f.start_time ?? f["Start time"] ?? ""),
    end_time: String(f.end_time ?? f["End time"] ?? ""),
    week_start: getWeekStartFromFields(f),
    notes: String(f.notes ?? f["Notes"] ?? ""),
    created_at: String(f.created_at ?? f["Created at"] ?? (rec as { createdTime?: string }).createdTime ?? ""),
    updated_at: String(f.updated_at ?? f["Updated at"] ?? ""),
  };
}

export async function listWeeklyProgramVa(params: ListParams & { filterByFormula?: string } = {}) {
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { programs: records.map((r) => mapRecord(r as AirtableRecord<Fields>)), offset };
}

export async function listAllWeeklyProgramVa(filterByFormula?: string): Promise<WeeklyProgramRecord[]> {
  const records = await listAllRecords<Fields>(TABLE, filterByFormula ? { filterByFormula } : {});
  return records.map((r) => mapRecord(r as AirtableRecord<Fields>));
}

const esc = (s: string) => s.replace(/"/g, '""');
const WEEK_START_FIELD = "week_start";

function findWeekStartFieldName(fields: Record<string, unknown>): string {
  const keys = Object.keys(fields);
  if (keys.includes("week_start")) return "week_start";
  const withSpace = keys.find((k) => k === "Week start" || k.toLowerCase() === "week start");
  if (withSpace) return withSpace;
  const weekLike = keys.find((k) => /^week[-_]?start$/i.test(k) || k === "week_start");
  return weekLike ?? WEEK_START_FIELD;
}

function weekStartFormulaDate(fieldName: string, weekStartYmd: string): string {
  return `DATESTR({${fieldName}}) = "${esc(weekStartYmd)}"`;
}

function weekStartFormulaText(fieldName: string, weekStartYmd: string): string {
  return `{${fieldName}} = "${esc(weekStartYmd)}"`;
}

export async function getProgramsForWeekVa(weekStart: string): Promise<WeeklyProgramRecord[]> {
  const weekYmd = ensureMondayForQuery(weekStart);
  let fieldName = WEEK_START_FIELD;
  let rawRecords: AirtableRecord<Fields>[] = [];

  for (const formulaFn of [weekStartFormulaDate, weekStartFormulaText]) {
    const formula = formulaFn(fieldName, weekYmd);
    try {
      rawRecords = await listAllRecords<Fields>(TABLE, { filterByFormula: formula, _caller: "getProgramsForWeekVa" });
      if (rawRecords.length > 0) break;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[getProgramsForWeekVa] formula failed", { formula, err });
      }
    }
  }

  if (rawRecords.length === 0) {
    const { records: anyRecord } = await listRecords<Record<string, unknown>>(TABLE, { pageSize: 1 }).catch(() => ({ records: [] }));
    const one = anyRecord?.[0];
    if (one?.fields) {
      const altFieldName = findWeekStartFieldName(one.fields as Record<string, unknown>);
      if (altFieldName !== fieldName) {
        fieldName = altFieldName;
        for (const formulaFn of [weekStartFormulaDate, weekStartFormulaText]) {
          try {
            rawRecords = await listAllRecords<Fields>(TABLE, {
              filterByFormula: formulaFn(altFieldName, weekYmd),
              _caller: "getProgramsForWeekVa_retry",
            });
            if (rawRecords.length > 0) break;
          } catch (_) {
            // ignore
          }
        }
      }
    }
  }

  if (rawRecords.length === 0) {
    try {
      const all = await listAllRecords<Fields>(TABLE, { _caller: "getProgramsForWeekVa_fetchAll" });
      const mappedAll = all.map((r) => mapRecord(r as AirtableRecord<Fields>));
      const forWeek = mappedAll.filter((p) => p.week_start === weekYmd);
      if (process.env.NODE_ENV !== "production" && forWeek.length > 0) {
        console.log("[getProgramsForWeekVa] fetch-then-filter (DATESTR missed records)", {
          weekYmd,
          total_fetched: all.length,
          after_normalized_week_filter: forWeek.length,
        });
      }
      return forWeek;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[getProgramsForWeekVa] fetch-all fallback failed", err);
      }
    }
  }

  const mapped = rawRecords.map((r) => mapRecord(r as AirtableRecord<Fields>));

  if (process.env.NODE_ENV !== "production") {
    console.log("[getProgramsForWeekVa] query", {
      week_start_queried: weekYmd,
      field_name_used: fieldName,
      fetched_count: rawRecords.length,
      mapped_count: mapped.length,
      record_ids: mapped.map((p) => p.id),
      record_week_starts: mapped.map((p) => p.week_start),
      record_days: mapped.map((p) => p.day),
    });
    rawRecords.slice(0, 5).forEach((r, i) => {
      const f = r.fields as unknown as Record<string, unknown>;
      console.log(`[getProgramsForWeekVa] raw record ${i + 1}`, {
        id: r.id,
        program_id: f.program_id ?? f["Program id"],
        week_start: f.week_start ?? f["Week start"],
        day: f.day ?? f["Day"],
        shift_type: f.shift_type ?? f["Shift type"],
        chatter: f.chatter ?? f["Chatter"] ?? f["VA"],
        chatter_name: f.chatter_name ?? f["Chatter name"] ?? f["VA name"],
        models: Array.isArray(f.models) ? f.models.length : f.models,
        start_time: f.start_time ?? f["Start time"],
        end_time: f.end_time ?? f["End time"],
        notes: (f.notes ?? f["Notes"]) ? "set" : "",
      });
    });
  }

  return mapped;
}

export async function getProgramsForWeekAndVa(
  weekStart: string,
  vaRecordId: string
): Promise<WeeklyProgramRecord[]> {
  const all = await getProgramsForWeekVa(weekStart);
  return all.filter((p) => p.chatter_id === vaRecordId);
}

export async function getWeeklyProgramVaById(recordId: string): Promise<WeeklyProgramRecord | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

export async function updateWeeklyProgramVa(recordId: string, fields: Partial<Fields>) {
  const rec = await updateRecord(TABLE, recordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export type CreateWeeklyProgramVaFields = {
  chatter: string[];
  chatter_name: string;
  models: string[];
  day: WeeklyProgramDay;
  shift_type: WeeklyProgramShiftType;
  start_time: string;
  end_time: string;
  week_start: string;
  notes?: string;
};

export async function createWeeklyProgramVa(fields: CreateWeeklyProgramVaFields): Promise<WeeklyProgramRecord> {
  const programId = `prog_va_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const rec = await createRecord<Fields>(TABLE, {
    program_id: programId,
    chatter: fields.chatter,
    chatter_name: fields.chatter_name,
    models: fields.models,
    day: fields.day,
    shift_type: fields.shift_type,
    start_time: fields.start_time,
    end_time: fields.end_time,
    week_start: fields.week_start,
    notes: fields.notes ?? "",
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function deleteWeeklyProgramVa(recordId: string): Promise<void> {
  await deleteRecord(TABLE, recordId);
}

export type ConflictResultVa =
  | { conflict: false }
  | { conflict: true; type: "model"; message: string; modelName?: string; otherVa?: string };

export async function checkScheduledShiftConflictsVa(
  vaId: string,
  modelIds: string[],
  day: WeeklyProgramDay,
  _shiftType: WeeklyProgramShiftType,
  weekStart: string,
  excludeRecordId: string | undefined,
  modelIdToName: Record<string, string> | undefined,
  start_time: string,
  end_time: string
): Promise<ConflictResultVa> {
  const programs = await getProgramsForWeekVa(weekStart);
  const sameDay = programs.filter((p) => p.day === day && p.id !== excludeRecordId);
  const modelSet = new Set(modelIds.filter(Boolean));
  for (const p of sameDay) {
    if (!p.start_time || !p.end_time) continue;
    if (!rangesOverlap(p.start_time, p.end_time, start_time, end_time)) continue;
    for (const mid of p.model_ids.filter(Boolean)) {
      if (!modelSet.has(mid)) continue;
      const modelName = modelIdToName?.[mid] ?? "model";
      return {
        conflict: true,
        type: "model",
        message: `Model "${modelName}" is already assigned to ${p.chatter_name ?? "another VA"} during overlapping time on ${day}.`,
        modelName,
        otherVa: p.chatter_name ?? undefined,
      };
    }
  }
  return { conflict: false };
}
