import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  getBaseSchema,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { firstLinkedId, snapshotText, formulaLinkedContains } from "@/lib/airtable-linked";
import { WEEKLY_PROGRAM_DAY_OPTIONS, WEEKLY_PROGRAM_SHIFT_TYPES, ensureMondayForQuery, airtableWeekStartToMonday } from "@/lib/weekly-program";
import type {
  WeeklyAvailabilityRequest,
  WeeklyProgramDay,
  WeeklyProgramShiftType,
  WeeklyAvailabilityRequestStatus,
  WeeklyAvailabilityEntryType,
} from "@/types";

const TABLE = "weekly_availability_requests";

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

function getChatterLinkedFromFields(f: Record<string, unknown>): string | string[] | undefined {
  if (f.chatter != null) return f.chatter as string | string[];
  if (f.Chatter != null) return f.Chatter as string | string[];
  const key = Object.keys(f).find((k) => k.toLowerCase() === "chatter");
  return key ? (f[key] as string | string[]) : undefined;
}

function getEntryTypeFromFields(f: Record<string, unknown>): WeeklyAvailabilityEntryType {
  const val = (f.entry_type ?? f["Entry type"]) as string | undefined;
  return val && ENTRY_TYPES.includes(val as WeeklyAvailabilityEntryType) ? (val as WeeklyAvailabilityEntryType) : "availability";
}

/** Discover week_start field name from Airtable base schema (exact case). */
async function discoverWeekStartFieldName(): Promise<string> {
  try {
    const schema = await getBaseSchema();
    const table = schema.tables?.find(
      (t) => t.name === "weekly_availability_requests" || t.name === "Weekly availability requests" || t.name === "Weekly Availability Requests"
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
  const chatterLinked = getChatterLinkedFromFields(f);
  const chatterNameVal = f.chatter_name ?? f["Chatter name"];
  return {
    id: rec.id,
    request_id: String(f.request_id ?? f["Request id"] ?? ""),
    week_start: getWeekStartFromFields(f),
    chatter_id: firstLinkedId(chatterLinked) ?? "",
    chatter_name: snapshotText(chatterNameVal),
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

/** DATESTR for Airtable date field comparison. */
function weekStartFormulaDate(fieldName: string, weekStartYmd: string): string {
  return `DATESTR({${fieldName}}) = "${esc(weekStartYmd)}"`;
}

/** Direct string equality for text field or when DATESTR fails. */
function weekStartFormulaText(fieldName: string, weekStartYmd: string): string {
  return `{${fieldName}} = "${esc(weekStartYmd)}"`;
}

const WEEK_START_FIELD = "week_start";

function findWeekStartFieldName(fields: Record<string, unknown>): string {
  const keys = Object.keys(fields);
  if (keys.includes("week_start")) return "week_start";
  const withSpace = keys.find((k) => k === "Week start" || k.toLowerCase() === "week start");
  if (withSpace) return withSpace;
  const weekLike = keys.find((k) => /^week[-_]?start$/i.test(k));
  return weekLike ?? WEEK_START_FIELD;
}

/** Fetch all availability requests for a given week. Week is normalized to Monday. Filters by week then by chatter in app. */
export async function getRequestsForWeek(
  weekStart: string,
  chatterRecordId?: string
): Promise<WeeklyAvailabilityRequest[]> {
  const weekYmd = ensureMondayForQuery(weekStart);

  if (process.env.NODE_ENV !== "production") {
    const { records: rawSample } = await listRecords<Record<string, unknown>>(TABLE, { pageSize: 15 }).catch(() => ({ records: [] }));
    const exactValues = rawSample.map((r) => {
      const f = (r.fields ?? {}) as Record<string, unknown>;
      return {
        airtable_record_id: r.id,
        week_start: f.week_start ?? f["Week start"] ?? f["week_start"],
        chatter_linked_raw: f.chatter ?? f["Chatter"] ?? f["chatter"],
        chatter_name: f.chatter_name ?? f["Chatter name"],
        day: f.day,
        entry_type: f.entry_type ?? f["Entry type"],
        shift_type: f.shift_type ?? f["Shift type"],
        custom_start_time: f.custom_start_time ?? f["Custom start time"],
        custom_end_time: f.custom_end_time ?? f["Custom end time"],
        status: f.status ?? f["Status"],
        field_keys: Object.keys(f),
      };
    });
    console.log("[getRequestsForWeek] RAW Airtable records (unfiltered sample)", {
      queried_week_normalized_to_monday: weekYmd,
      input_week_start: weekStart,
      sample_count: exactValues.length,
      exact_record_values: exactValues,
    });
  }

  const fieldName = await discoverWeekStartFieldName();
  let records: AirtableRecord<Fields>[] = [];

  for (const formulaFn of [weekStartFormulaDate, weekStartFormulaText]) {
    const formula = formulaFn(fieldName, weekYmd);
    try {
      records = await listAllRecords<Fields>(TABLE, {
        filterByFormula: formula,
        _caller: "weekly-availability-requests.getRequestsForWeek",
      });
      if (records.length > 0) break;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[getRequestsForWeek] formula failed", { formula, err });
      }
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
            const retryFormula = formulaFn(altFieldName, weekYmd);
            records = await listAllRecords<Fields>(TABLE, {
              filterByFormula: retryFormula,
              _caller: "weekly-availability-requests.getRequestsForWeek_retry",
            });
            if (records.length > 0 && process.env.NODE_ENV !== "production") {
              console.log("[getRequestsForWeek] retry with alt field", { altFieldName, count: records.length });
            }
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
      const all = await listAllRecords<Fields>(TABLE, { _caller: "weekly-availability-requests.getRequestsForWeek_fetchAll" });
      const mappedAll = all.map((r) => mapRecord(r as AirtableRecord<Fields>));
      const forWeek = mappedAll.filter((r) => r.week_start === weekYmd);
      const result =
        chatterRecordId != null && chatterRecordId !== ""
          ? forWeek.filter((r) => r.chatter_id === chatterRecordId)
          : forWeek;
      if (process.env.NODE_ENV !== "production") {
        console.log("[getRequestsForWeek] fetch-then-filter", {
          total_fetched: all.length,
          after_week_filter: forWeek.length,
          after_chatter_filter: result.length,
          weekYmd,
        });
      }
      return result;
    } catch (fetchAllErr) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[getRequestsForWeek] fetch-all fallback failed", fetchAllErr);
      }
    }
  }

  const mapped = records.map((r) => mapRecord(r as AirtableRecord<Fields>));
  const filtered =
    chatterRecordId != null && chatterRecordId !== ""
      ? mapped.filter((r) => r.chatter_id === chatterRecordId)
      : mapped;

  if (process.env.NODE_ENV !== "production") {
    console.log("[getRequestsForWeek] result", {
      week_start_normalized_to_monday: weekYmd,
      input_week_start: weekStart,
      chatter_filter: chatterRecordId ?? "(all)",
      fetched_records_count: records.length,
      mapped_count: mapped.length,
      filtered_count: filtered.length,
    });
  }

  return filtered;
}

/** Fetch a single request by Airtable record id. Returns null if not found. */
export async function getWeeklyAvailabilityRequestById(
  recordId: string
): Promise<WeeklyAvailabilityRequest | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

/** Find existing request for (week_start, chatter, day). Uniqueness: one entry per day per chatter per week. */
export async function getRequestByWeekDayChatter(
  weekStart: string,
  chatterRecordId: string,
  day: WeeklyProgramDay
): Promise<WeeklyAvailabilityRequest | null> {
  const all = await getRequestsForWeek(weekStart, chatterRecordId);
  return all.find((r) => r.day === day) ?? null;
}

/** Count day_off entries for a chatter in a given week (optionally excluding one record id). */
export function countDayOffForWeek(
  requests: WeeklyAvailabilityRequest[],
  excludeRecordId?: string
): number {
  return requests.filter(
    (r) => r.entry_type === "day_off" && r.id !== excludeRecordId
  ).length;
}

export type CreateWeeklyAvailabilityRequestFields = {
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

export async function createWeeklyAvailabilityRequest(
  fields: CreateWeeklyAvailabilityRequestFields
): Promise<WeeklyAvailabilityRequest> {
  const requestId = `avail_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
    const startTrimmed = fields.custom_start_time?.trim();
    const endTrimmed = fields.custom_end_time?.trim();
    if (startTrimmed) payload.custom_start_time = startTrimmed;
    if (endTrimmed) payload.custom_end_time = endTrimmed;
  }
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  if (process.env.NODE_ENV !== "production") {
    const f = rec.fields as unknown as Record<string, unknown>;
    console.log("[createWeeklyAvailabilityRequest] created record", {
      airtable_record_id: rec.id,
      request_id: f.request_id ?? payload.request_id,
      week_start: f.week_start ?? f["Week start"] ?? payload.week_start,
      chatter: f.chatter ?? f.Chatter ?? payload.chatter,
      chatter_name: f.chatter_name ?? f["Chatter name"] ?? payload.chatter_name,
      day: f.day ?? payload.day,
      shift_type: f.shift_type ?? payload.shift_type,
      custom_start_time: f.custom_start_time ?? payload.custom_start_time,
      custom_end_time: f.custom_end_time ?? payload.custom_end_time,
      notes: f.notes ?? payload.notes,
      status: f.status ?? payload.status,
      created_at: f.created_at ?? (rec as { createdTime?: string }).createdTime,
      raw_field_names: Object.keys(f),
    });
  }
  return mapRecord(rec as AirtableRecord<Fields>);
}

export type UpdateWeeklyAvailabilityRequestFields = {
  entry_type: WeeklyAvailabilityEntryType;
  shift_type?: WeeklyProgramShiftType;
  custom_start_time?: string;
  custom_end_time?: string;
  notes?: string;
};

export async function updateWeeklyAvailabilityRequest(
  recordId: string,
  fields: UpdateWeeklyAvailabilityRequestFields
): Promise<WeeklyAvailabilityRequest> {
  const payload: Record<string, unknown> = {
    entry_type: fields.entry_type,
    notes: fields.notes ?? "",
  };
  if (fields.entry_type === "availability") {
    payload.shift_type = fields.shift_type ?? "Morning";
    const startTrimmed = fields.custom_start_time?.trim();
    const endTrimmed = fields.custom_end_time?.trim();
    if (startTrimmed) payload.custom_start_time = startTrimmed;
    if (endTrimmed) payload.custom_end_time = endTrimmed;
  }
  const rec = await updateRecord<Fields>(TABLE, recordId, payload as Partial<Fields>);
  return mapRecord(rec as AirtableRecord<Fields>);
}
