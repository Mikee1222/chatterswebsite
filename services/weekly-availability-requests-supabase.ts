/**
 * Supabase backend for services/weekly-availability-requests.ts
 */
import {
  firstMappedLinkedId,
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbResolveUuidToAirtableMap,
  sbSelectByPublicId,
  sbSelectWhere,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  requireSbUuids,
  type SbRow,
} from "@/lib/supabase-data";
import {
  WEEKLY_PROGRAM_DAY_OPTIONS,
  WEEKLY_PROGRAM_SHIFT_TYPES,
  airtableWeekStartToMonday,
  ensureMondayForQuery,
} from "@/lib/weekly-program";
import type {
  WeeklyAvailabilityEntryType,
  WeeklyAvailabilityRequest,
  WeeklyAvailabilityRequestStatus,
  WeeklyProgramDay,
  WeeklyProgramShiftType,
} from "@/types";
import type {
  CreateWeeklyAvailabilityRequestFields,
  UpdateWeeklyAvailabilityRequestFields,
} from "./weekly-availability-requests";

const TABLE = "weekly_availability_requests";
const ENTRY_TYPES: WeeklyAvailabilityEntryType[] = ["availability", "day_off"];

type Row = SbRow & {
  request_id?: string | null;
  week_start?: string | null;
  chatter?: string[] | null;
  chatter_name?: string | null;
  day?: string | null;
  entry_type?: string | null;
  shift_type?: string | null;
  custom_start_time?: string | null;
  custom_end_time?: string | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function coerceDay(v: unknown): WeeklyProgramDay {
  return typeof v === "string" && WEEKLY_PROGRAM_DAY_OPTIONS.includes(v as WeeklyProgramDay)
    ? (v as WeeklyProgramDay)
    : "Monday";
}
function coerceShift(v: unknown): WeeklyProgramShiftType {
  return typeof v === "string" && WEEKLY_PROGRAM_SHIFT_TYPES.includes(v as WeeklyProgramShiftType)
    ? (v as WeeklyProgramShiftType)
    : "Morning";
}
function coerceEntry(v: unknown): WeeklyAvailabilityEntryType {
  return typeof v === "string" && ENTRY_TYPES.includes(v as WeeklyAvailabilityEntryType)
    ? (v as WeeklyAvailabilityEntryType)
    : "availability";
}
function coerceStatus(v: unknown): WeeklyAvailabilityRequestStatus {
  const valid: WeeklyAvailabilityRequestStatus[] = ["submitted", "reviewed", "used", "rejected"];
  return typeof v === "string" && valid.includes(v as WeeklyAvailabilityRequestStatus)
    ? (v as WeeklyAvailabilityRequestStatus)
    : "submitted";
}

function mapRowSync(row: Row, userAt: Map<string, string>): WeeklyAvailabilityRequest {
  return {
    id: publicId(row),
    request_id: String(row.request_id ?? ""),
    week_start: row.week_start ? airtableWeekStartToMonday(String(row.week_start)) : "",
    chatter_id: firstMappedLinkedId(row.chatter, userAt),
    chatter_name: String(row.chatter_name ?? ""),
    day: coerceDay(row.day),
    entry_type: coerceEntry(row.entry_type),
    shift_type: coerceShift(row.shift_type),
    custom_start_time: String(row.custom_start_time ?? ""),
    custom_end_time: String(row.custom_end_time ?? ""),
    notes: String(row.notes ?? ""),
    status: coerceStatus(row.status),
    created_at: String(row.created_at ?? ""),
  };
}

async function mapRows(rows: Row[]): Promise<WeeklyAvailabilityRequest[]> {
  if (!rows.length) return [];
  const userAt = await sbResolveUuidToAirtableMap("users", rows.map((r) => r.chatter));
  return rows.map((r) => mapRowSync(r, userAt));
}

async function mapRow(row: Row): Promise<WeeklyAvailabilityRequest> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function getRequestsForWeek(
  weekStart: string,
  chatterRecordId?: string
): Promise<WeeklyAvailabilityRequest[]> {
  const weekYmd = ensureMondayForQuery(weekStart);
  let rows: Row[];
  if (chatterRecordId != null && chatterRecordId !== "") {
    const uuids = await sbUuidsForAirtableIds("users", [chatterRecordId]);
    if (!uuids[0]) return [];
    rows = await sbSelectWhere<Row>(TABLE, (q) =>
      q.eq("week_start", weekYmd).contains("chatter", [uuids[0]!])
    );
  } else {
    rows = await sbSelectWhere<Row>(TABLE, (q) => q.eq("week_start", weekYmd));
  }
  return mapRows(rows);
}

export async function getWeeklyAvailabilityRequestById(
  recordId: string
): Promise<WeeklyAvailabilityRequest | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  return row ? mapRow(row) : null;
}

export async function getRequestByWeekDayChatter(
  weekStart: string,
  chatterRecordId: string,
  day: WeeklyProgramDay
): Promise<WeeklyAvailabilityRequest | null> {
  const all = await getRequestsForWeek(weekStart, chatterRecordId);
  return all.find((r) => r.day === day) ?? null;
}

export async function createWeeklyAvailabilityRequest(
  fields: CreateWeeklyAvailabilityRequestFields
): Promise<WeeklyAvailabilityRequest> {
  const requestId = `avail_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const chatterUuids = await requireSbUuids("users", fields.chatter ?? [], "chatter");
  const payload: Record<string, unknown> = {
    request_id: requestId,
    week_start: fields.week_start,
    chatter: chatterUuids,
    chatter_name: fields.chatter_name,
    day: fields.day,
    entry_type: fields.entry_type,
    notes: fields.notes ?? "",
    status: "submitted",
    created_at: new Date().toISOString(),
  };
  if (fields.entry_type === "availability") {
    payload.shift_type = fields.shift_type ?? "Morning";
    if (fields.custom_start_time?.trim()) payload.custom_start_time = fields.custom_start_time.trim();
    if (fields.custom_end_time?.trim()) payload.custom_end_time = fields.custom_end_time.trim();
  }
  const row = await sbInsert<Row>(TABLE, payload);
  return mapRow(row);
}

export async function updateWeeklyAvailabilityRequest(
  recordId: string,
  fields: UpdateWeeklyAvailabilityRequestFields
): Promise<WeeklyAvailabilityRequest> {
  const payload: Record<string, unknown> = {
    entry_type: fields.entry_type,
    notes: fields.notes ?? "",
    updated_at: new Date().toISOString(),
  };
  if (fields.entry_type === "availability") {
    payload.shift_type = fields.shift_type ?? "Morning";
    if (fields.custom_start_time?.trim()) payload.custom_start_time = fields.custom_start_time.trim();
    if (fields.custom_end_time?.trim()) payload.custom_end_time = fields.custom_end_time.trim();
  }
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, payload);
  return mapRow(row);
}

export async function deleteWeeklyAvailabilityRequest(recordId: string): Promise<void> {
  const id = recordId?.trim();
  if (!id) throw new Error("Missing record id");
  await sbDeleteByPublicId(TABLE, id);
}
