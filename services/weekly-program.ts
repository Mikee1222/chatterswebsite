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

const TABLE = "weekly_program";

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

function mapRecord(rec: AirtableRecord<Fields>): WeeklyProgramRecord {
  const f = rec.fields as unknown as Record<string, unknown>;
  const day = (f.day as WeeklyProgramDay | undefined) && WEEKLY_PROGRAM_DAY_OPTIONS.includes(f.day as WeeklyProgramDay) ? (f.day as WeeklyProgramDay) : "Monday";
  const shift_type = (f.shift_type as WeeklyProgramShiftType) && WEEKLY_PROGRAM_SHIFT_TYPES.includes(f.shift_type as WeeklyProgramShiftType) ? (f.shift_type as WeeklyProgramShiftType) : "Morning";
  return {
    id: rec.id,
    program_id: (f.program_id ?? "") as string,
    chatter_id: firstLinkedId(f.chatter) ?? "",
    chatter_name: snapshotText(f.chatter_name),
    model_ids: linkedRecordIds(f.models),
    day,
    shift_type,
    start_time: (f.start_time ?? "") as string,
    end_time: (f.end_time ?? "") as string,
    week_start: getWeekStartFromFields(f),
    notes: (f.notes ?? "") as string,
    created_at: (f.created_at ?? "") as string,
    updated_at: (f.updated_at ?? "") as string,
  };
}

export async function listWeeklyProgram(params: ListParams & { filterByFormula?: string } = {}) {
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { programs: records.map((r) => mapRecord(r as AirtableRecord<Fields>)), offset };
}

export async function listAllWeeklyProgram(filterByFormula?: string): Promise<WeeklyProgramRecord[]> {
  const records = await listAllRecords<Fields>(TABLE, filterByFormula ? { filterByFormula } : {});
  return records.map((r) => mapRecord(r as AirtableRecord<Fields>));
}

const esc = (s: string) => s.replace(/"/g, '""');

/** Airtable formula field names are case-sensitive and must match the base. */
const WEEK_START_FIELD = "week_start";

function findWeekStartFieldName(fields: Record<string, unknown>): string {
  const keys = Object.keys(fields);
  if (keys.includes("week_start")) return "week_start";
  const withSpace = keys.find((k) => k === "Week start" || k.toLowerCase() === "week start");
  if (withSpace) return withSpace;
  const weekLike = keys.find((k) => /^week[-_]?start$/i.test(k) || k === "week_start");
  return weekLike ?? WEEK_START_FIELD;
}

/** Build filter formula for week_start (Airtable DATE field). Use DATESTR() so date is compared to YYYY-MM-DD string. */
function weekStartFormula(fieldName: string, weekStartYmd: string): string {
  return `DATESTR({${fieldName}}) = "${esc(weekStartYmd)}"`;
}

export async function getProgramsForWeek(weekStart: string): Promise<WeeklyProgramRecord[]> {
  const weekYmd = ensureMondayForQuery(weekStart);
  let formula = weekStartFormula(WEEK_START_FIELD, weekYmd);
  let rawRecords = await listAllRecords<Fields>(TABLE, { filterByFormula: formula, _caller: "getProgramsForWeek" });

  if (rawRecords.length === 0) {
    const { records: anyRecord } = await listRecords<Record<string, unknown>>(TABLE, { pageSize: 1 }).catch(() => ({ records: [] }));
    const one = anyRecord?.[0];
    if (one?.fields) {
      const fieldName = findWeekStartFieldName(one.fields as Record<string, unknown>);
      if (fieldName !== WEEK_START_FIELD) {
        formula = weekStartFormula(fieldName, weekYmd);
        rawRecords = await listAllRecords<Fields>(TABLE, { filterByFormula: formula, _caller: "getProgramsForWeek_retry" });
        if (process.env.NODE_ENV !== "production") {
          console.log("[getProgramsForWeek] retry with discovered week field", { fieldName, formula, count: rawRecords.length });
        }
      }
    }
  }

  if (rawRecords.length === 0) {
    try {
      const all = await listAllRecords<Fields>(TABLE, { _caller: "getProgramsForWeek_fetchAll" });
      const mapped = all.map((r) => mapRecord(r as AirtableRecord<Fields>));
      const forWeek = mapped.filter((p) => p.week_start === weekYmd);
      if (process.env.NODE_ENV !== "production" && forWeek.length > 0) {
        console.log("[getProgramsForWeek] fetch-then-filter (DATESTR missed records)", {
          weekYmd,
          total_fetched: all.length,
          after_normalized_week_filter: forWeek.length,
        });
      }
      return forWeek;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[getProgramsForWeek] fetch-all fallback failed", err);
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[getProgramsForWeek] query", {
      week_start_queried: weekYmd,
      exact_formula: formula,
      total_records_fetched: rawRecords.length,
      record_ids: rawRecords.map((r) => r.id),
    });
    if (rawRecords.length > 0) {
      rawRecords.slice(0, 5).forEach((r, i) => {
        const f = r.fields as Record<string, unknown>;
        console.log(`[getProgramsForWeek] raw record ${i + 1}`, {
          id: r.id,
          field_names: Object.keys(f),
          week_start: f.week_start ?? (f as Record<string, unknown>)["Week start"],
          day: f.day,
          shift_type: f.shift_type,
          chatter_name: f.chatter_name,
        });
      });
    } else {
      const { records: anyRecord } = await listRecords<Record<string, unknown>>(TABLE, { pageSize: 1 }).catch(() => ({ records: [] }));
      const one = anyRecord?.[0];
      if (one?.fields) {
        const keys = Object.keys(one.fields);
        const weekLike = keys.filter((k) => /week|start|date/i.test(k));
        console.log("[getProgramsForWeek] ZERO records – sample record (any week)", {
          sample_record_id: one.id,
          all_field_names: keys,
          week_like_fields: weekLike,
          sample_values: one.fields as Record<string, unknown>,
        });
      }
    }
  }

  const programs = rawRecords.map((r) => mapRecord(r as AirtableRecord<Fields>));
  return programs;
}

export async function getProgramsForWeekAndChatter(
  weekStart: string,
  chatterRecordId: string
): Promise<WeeklyProgramRecord[]> {
  const all = await getProgramsForWeek(weekStart);
  return all.filter((p) => p.chatter_id === chatterRecordId);
}

export async function getWeeklyProgramById(recordId: string): Promise<WeeklyProgramRecord | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

export async function updateWeeklyProgram(recordId: string, fields: Partial<Fields>) {
  const rec = await updateRecord(TABLE, recordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export type CreateWeeklyProgramFields = {
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

export async function createWeeklyProgram(fields: CreateWeeklyProgramFields): Promise<WeeklyProgramRecord> {
  const programId = `prog_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
  if (process.env.NODE_ENV !== "production") {
    const raw = rec.fields as Record<string, unknown>;
    const dateFromStart = typeof raw.start_time === "string" ? (raw.start_time as string).slice(0, 10) : "";
    console.log("[weekly-program create] exact Airtable saved record", {
      airtable_record_id: rec.id,
      week_start: raw.week_start ?? raw["Week start"],
      date: dateFromStart,
      day: raw.day,
      shift_type: raw.shift_type,
      chatter: raw.chatter,
      chatter_name: raw.chatter_name,
      models: raw.models,
      model_name: raw.model_name,
      start_time: raw.start_time,
      end_time: raw.end_time,
      notes: raw.notes,
      raw_field_names: Object.keys(raw),
    });
    const refetched = await getRecord<Record<string, unknown>>(TABLE, rec.id).catch(() => null);
    if (refetched?.fields) {
      const f = refetched.fields as Record<string, unknown>;
      console.log("[weekly-program create] refetched from Airtable (exact keys)", {
        id: refetched.id,
        field_names: Object.keys(f),
        week_start_in_airtable: f.week_start ?? f["Week start"],
      });
    }
  }
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function deleteWeeklyProgram(recordId: string): Promise<void> {
  await deleteRecord(TABLE, recordId);
}

export type ConflictResult =
  | { conflict: false }
  | { conflict: true; type: "model"; message: string; modelName?: string; otherChatter?: string };

/**
 * Conflict rule: same model on the same day cannot have overlapping time windows (by start_time/end_time).
 * Supports Morning, Night, and Custom shifts; overnight shifts use full ISO timestamps so overlap works correctly.
 */
export async function checkScheduledShiftConflicts(
  chatterId: string,
  modelIds: string[],
  day: WeeklyProgramDay,
  _shiftType: WeeklyProgramShiftType,
  weekStart: string,
  excludeRecordId: string | undefined,
  modelIdToName: Record<string, string> | undefined,
  start_time: string,
  end_time: string
): Promise<ConflictResult> {
  const programs = await getProgramsForWeek(weekStart);
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
        message: `Model "${modelName}" is already assigned to ${p.chatter_name ?? "another chatter"} during overlapping time on ${day}. Same model cannot be in two overlapping shifts.`,
        modelName,
        otherChatter: p.chatter_name ?? undefined,
      };
    }
  }
  return { conflict: false };
}
