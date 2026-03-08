import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  getBaseSchema,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import { WEEKLY_PROGRAM_DAY_OPTIONS, WEEKLY_PROGRAM_SHIFT_TYPES, ensureMondayForQuery, airtableWeekStartToMonday } from "@/lib/weekly-program";
import type {
  WeeklyAvailabilityRequest,
  WeeklyProgramDay,
  WeeklyProgramShiftType,
  WeeklyAvailabilityRequestStatus,
  WeeklyAvailabilityEntryType,
} from "@/types";

const TABLE = "weekly_availability_requests_va";

const ENTRY_TYPES: WeeklyAvailabilityEntryType[] = ["availability", "day_off"];

type Fields = {
  request_id?: string;
  week_start?: string;
  chatter?: string | string[];
  chatter_name?: string;
  day?: string;
  entry_type?: string;
  shift_type?: string;
  custom_start_time?: string;
  custom_end_time?: string;
  notes?: string;
  status?: string;
  created_at?: string;
};

function getWeekStartFromFields(f: Record<string, unknown>): string {
  let raw: string | undefined;
  if (f.week_start != null && typeof f.week_start === "string") raw = f.week_start;
  else if (f["Week start"] != null && typeof f["Week start"] === "string") raw = f["Week start"] as string;
  else {
    const key = Object.keys(f).find((k) => /^week[-_]?start$/i.test(k));
    raw = key && typeof f[key] === "string" ? (f[key] as string) : undefined;
  }
  return raw ? airtableWeekStartToMonday(raw) : "";
}

function getVaLinkedFromFields(f: Record<string, unknown>): string | string[] | undefined {
  if (f.chatter != null) return f.chatter as string | string[];
  if (f.va != null) return f.va as string | string[];
  if (f.Chatter != null) return f.Chatter as string | string[];
  if (f.VA != null) return f.VA as string | string[];
  const key = Object.keys(f).find((k) => k.toLowerCase() === "chatter" || k.toLowerCase() === "va");
  return key ? (f[key] as string | string[]) : undefined;
}

function getEntryTypeFromFields(f: Record<string, unknown>): WeeklyAvailabilityEntryType {
  const val = (f.entry_type ?? f["Entry type"]) as string | undefined;
  return val && ENTRY_TYPES.includes(val as WeeklyAvailabilityEntryType) ? (val as WeeklyAvailabilityEntryType) : "availability";
}

const WEEK_START_FIELD = "week_start";

async function discoverWeekStartFieldName(): Promise<string> {
  try {
    const schema = await getBaseSchema();
    const table = schema.tables?.find(
      (t) =>
        t.name === "weekly_availability_requests_va" ||
        t.name === "Weekly availability requests VA" ||
        t.name === "Weekly Availability Requests VA"
    );
    const field = table?.fields?.find((f) => /^week[-_\s]?start$/i.test(f.name));
    if (field?.name) return field.name;
  } catch (_) {
    // ignore
  }
  return WEEK_START_FIELD;
}

function getShiftTypeFromFields(f: Record<string, unknown>): WeeklyProgramShiftType {
  const val = (f.shift_type ?? f["Shift type"]) as string | undefined;
  return val && WEEKLY_PROGRAM_SHIFT_TYPES.includes(val as WeeklyProgramShiftType) ? (val as WeeklyProgramShiftType) : "Morning";
}

function getDayFromFields(f: Record<string, unknown>): WeeklyProgramDay {
  const val = (f.day ?? f["Day"]) as string | undefined;
  return val && WEEKLY_PROGRAM_DAY_OPTIONS.includes(val as WeeklyProgramDay) ? (val as WeeklyProgramDay) : "Monday";
}

function mapRecord(rec: AirtableRecord<Fields>): WeeklyAvailabilityRequest {
  const f = rec.fields as unknown as Record<string, unknown>;
  const day = getDayFromFields(f);
  const entry_type = getEntryTypeFromFields(f);
  const shift_type = getShiftTypeFromFields(f);
  const status = (f.status ?? f["Status"]) as WeeklyAvailabilityRequestStatus | undefined;
  const validStatuses: WeeklyAvailabilityRequestStatus[] = ["submitted", "reviewed", "used", "rejected"];
  const statusVal = status && validStatuses.includes(status) ? status : "submitted";
  const vaLinked = getVaLinkedFromFields(f);
  const nameVal = f.chatter_name ?? f["Chatter name"] ?? f.va_name ?? f["VA name"];
  return {
    id: rec.id,
    request_id: String(f.request_id ?? f["Request id"] ?? ""),
    week_start: getWeekStartFromFields(f),
    chatter_id: firstLinkedId(vaLinked) ?? "",
    chatter_name: snapshotText(nameVal),
    day,
    entry_type,
    shift_type,
    custom_start_time: String(f.custom_start_time ?? f["Custom start time"] ?? ""),
    custom_end_time: String(f.custom_end_time ?? f["Custom end time"] ?? ""),
    notes: String(f.notes ?? f["Notes"] ?? ""),
    status: statusVal,
    created_at: String(f.created_at ?? f["Created at"] ?? (rec as { createdTime?: string }).createdTime ?? ""),
  };
}

const esc = (s: string) => s.replace(/"/g, '""');

function weekStartFormulaDate(fieldName: string, weekStartYmd: string): string {
  return `DATESTR({${fieldName}}) = "${esc(weekStartYmd)}"`;
}

function weekStartFormulaText(fieldName: string, weekStartYmd: string): string {
  return `{${fieldName}} = "${esc(weekStartYmd)}"`;
}

function findWeekStartFieldName(fields: Record<string, unknown>): string {
  const keys = Object.keys(fields);
  if (keys.includes("week_start")) return "week_start";
  const withSpace = keys.find((k) => k === "Week start" || k.toLowerCase() === "week start");
  if (withSpace) return withSpace;
  const weekLike = keys.find((k) => /^week[-_]?start$/i.test(k));
  return weekLike ?? WEEK_START_FIELD;
}

/** Fetch all VA availability requests for a given week. Optional filter by vaRecordId. */
export async function getRequestsForWeekVa(
  weekStart: string,
  vaRecordId?: string
): Promise<WeeklyAvailabilityRequest[]> {
  const weekYmd = ensureMondayForQuery(weekStart);
  const fieldName = await discoverWeekStartFieldName();
  let records: AirtableRecord<Fields>[] = [];

  for (const formulaFn of [weekStartFormulaDate, weekStartFormulaText]) {
    const formula = formulaFn(fieldName, weekYmd);
    try {
      records = await listAllRecords<Fields>(TABLE, {
        filterByFormula: formula,
        _caller: "weekly-availability-requests-va.getRequestsForWeekVa",
      });
      if (records.length > 0) break;
    } catch (_) {
      // try next
    }
  }

  if (records.length === 0) {
    const { records: sample } = await listRecords<Record<string, unknown>>(TABLE, { pageSize: 1 }).catch(() => ({ records: [] }));
    const one = sample?.[0];
    if (one?.fields) {
      const altFieldName = findWeekStartFieldName(one.fields as Record<string, unknown>);
      if (altFieldName !== fieldName) {
        for (const formulaFn of [weekStartFormulaDate, weekStartFormulaText]) {
          try {
            records = await listAllRecords<Fields>(TABLE, {
              filterByFormula: formulaFn(altFieldName, weekYmd),
              _caller: "weekly-availability-requests-va.getRequestsForWeekVa_retry",
            });
            if (records.length > 0) break;
          } catch (_) {
            // ignore
          }
        }
      }
    }
  }

  if (records.length === 0) {
    try {
      const all = await listAllRecords<Fields>(TABLE, { _caller: "weekly-availability-requests-va.getRequestsForWeekVa_fetchAll" });
      const mappedAll = all.map((r) => mapRecord(r as AirtableRecord<Fields>));
      const forWeek = mappedAll.filter((r) => r.week_start === weekYmd);
      return vaRecordId != null && vaRecordId !== ""
        ? forWeek.filter((r) => r.chatter_id === vaRecordId)
        : forWeek;
    } catch (_) {
      return [];
    }
  }

  const mapped = records.map((r) => mapRecord(r as AirtableRecord<Fields>));
  return vaRecordId != null && vaRecordId !== ""
    ? mapped.filter((r) => r.chatter_id === vaRecordId)
    : mapped;
}

export async function getWeeklyAvailabilityRequestVaById(recordId: string): Promise<WeeklyAvailabilityRequest | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

export async function getRequestByWeekDayVa(
  weekStart: string,
  vaRecordId: string,
  day: WeeklyProgramDay
): Promise<WeeklyAvailabilityRequest | null> {
  const all = await getRequestsForWeekVa(weekStart, vaRecordId);
  return all.find((r) => r.day === day) ?? null;
}

export function countDayOffForWeekVa(
  requests: WeeklyAvailabilityRequest[],
  excludeRecordId?: string
): number {
  return requests.filter((r) => r.entry_type === "day_off" && r.id !== excludeRecordId).length;
}

export type CreateWeeklyAvailabilityRequestVaFields = {
  week_start: string;
  chatter: string[];
  chatter_name: string;
  day: WeeklyProgramDay;
  entry_type: WeeklyAvailabilityEntryType;
  shift_type?: WeeklyProgramShiftType;
  custom_start_time?: string;
  custom_end_time?: string;
  notes?: string;
};

export async function createWeeklyAvailabilityRequestVa(
  fields: CreateWeeklyAvailabilityRequestVaFields
): Promise<WeeklyAvailabilityRequest> {
  const requestId = `avail_va_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const payload: Record<string, unknown> = {
    request_id: requestId,
    week_start: fields.week_start,
    chatter: fields.chatter,
    chatter_name: fields.chatter_name,
    day: fields.day,
    entry_type: fields.entry_type,
    notes: fields.notes ?? "",
    status: "submitted",
  };
  if (fields.entry_type === "availability") {
    payload.shift_type = fields.shift_type ?? "Morning";
    if (fields.custom_start_time?.trim()) payload.custom_start_time = fields.custom_start_time.trim();
    if (fields.custom_end_time?.trim()) payload.custom_end_time = fields.custom_end_time.trim();
  }
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export type UpdateWeeklyAvailabilityRequestVaFields = {
  entry_type: WeeklyAvailabilityEntryType;
  shift_type?: WeeklyProgramShiftType;
  custom_start_time?: string;
  custom_end_time?: string;
  notes?: string;
};

export async function updateWeeklyAvailabilityRequestVa(
  recordId: string,
  fields: UpdateWeeklyAvailabilityRequestVaFields
): Promise<WeeklyAvailabilityRequest> {
  const payload: Record<string, unknown> = {
    entry_type: fields.entry_type,
    notes: fields.notes ?? "",
  };
  if (fields.entry_type === "availability") {
    payload.shift_type = fields.shift_type ?? "Morning";
    if (fields.custom_start_time?.trim()) payload.custom_start_time = fields.custom_start_time.trim();
    if (fields.custom_end_time?.trim()) payload.custom_end_time = fields.custom_end_time.trim();
  }
  const rec = await updateRecord<Fields>(TABLE, recordId, payload as Partial<Fields>);
  return mapRecord(rec as AirtableRecord<Fields>);
}
