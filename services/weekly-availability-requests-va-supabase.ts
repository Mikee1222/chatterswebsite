/**
 * Supabase backend for services/weekly-availability-requests-va.ts
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
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
  CreateWeeklyAvailabilityRequestVaFields,
  UpdateWeeklyAvailabilityRequestVaFields,
} from "./weekly-availability-requests-va";

const TABLE = "weekly_availability_requests_va";
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

async function mapRow(row: Row): Promise<WeeklyAvailabilityRequest> {
  return {
    id: publicId(row),
    request_id: String(row.request_id ?? ""),
    week_start: row.week_start ? airtableWeekStartToMonday(String(row.week_start)) : "",
    chatter_id: (await sbFirstLinkedAirtableId("users", row.chatter)) ?? "",
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

export async function getRequestsForWeekVa(
  weekStart: string,
  vaRecordId?: string
): Promise<WeeklyAvailabilityRequest[]> {
  const weekYmd = ensureMondayForQuery(weekStart);
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await Promise.all(rows.map(mapRow));
  const forWeek = mapped.filter((r) => r.week_start === weekYmd);
  return vaRecordId != null && vaRecordId !== ""
    ? forWeek.filter((r) => r.chatter_id === vaRecordId)
    : forWeek;
}

export async function getWeeklyAvailabilityRequestVaById(
  recordId: string
): Promise<WeeklyAvailabilityRequest | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  return row ? mapRow(row) : null;
}

export async function getRequestByWeekDayVa(
  weekStart: string,
  vaRecordId: string,
  day: WeeklyProgramDay
): Promise<WeeklyAvailabilityRequest | null> {
  const all = await getRequestsForWeekVa(weekStart, vaRecordId);
  return all.find((r) => r.day === day) ?? null;
}

export async function getRequestsByWeekDayVa(
  weekStart: string,
  vaRecordId: string,
  day: WeeklyProgramDay
): Promise<WeeklyAvailabilityRequest[]> {
  const all = await getRequestsForWeekVa(weekStart, vaRecordId);
  return all.filter((r) => r.day === day);
}

export async function createWeeklyAvailabilityRequestVa(
  fields: CreateWeeklyAvailabilityRequestVaFields
): Promise<WeeklyAvailabilityRequest> {
  const requestId = `avail_va_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

export async function updateWeeklyAvailabilityRequestVa(
  recordId: string,
  fields: UpdateWeeklyAvailabilityRequestVaFields
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

export async function deleteWeeklyAvailabilityRequestVa(recordId: string): Promise<void> {
  const id = recordId?.trim();
  if (!id) throw new Error("Missing record id");
  await sbDeleteByPublicId(TABLE, id);
}
