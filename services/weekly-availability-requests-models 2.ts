"use server";

import {
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import { ensureMondayForQuery, WEEKLY_PROGRAM_DAY_OPTIONS } from "@/lib/weekly-program";
import type {
  ModelWeeklyAvailabilityRequest,
  ModelAvailabilityEntryType,
  WeeklyProgramDay,
  WeeklyAvailabilityRequestStatus,
} from "@/types";

const TABLE = "weekly_availability_requests_models";

type Fields = {
  request_id?: string;
  week_start?: string;
  model_id?: string | string[];
  model_name?: string;
  day?: string;
  entry_type?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  status?: string;
  created_at?: string;
};

function parseDay(raw: unknown): WeeklyProgramDay {
  const d = typeof raw === "string" ? raw : "";
  return WEEKLY_PROGRAM_DAY_OPTIONS.includes(d as WeeklyProgramDay) ? (d as WeeklyProgramDay) : "Monday";
}

function parseEntryType(raw: unknown): ModelAvailabilityEntryType {
  const e = typeof raw === "string" ? raw : "";
  const allowed: ModelAvailabilityEntryType[] = ["availability", "day_off", "live_window", "custom_window"];
  return allowed.includes(e as ModelAvailabilityEntryType) ? (e as ModelAvailabilityEntryType) : "availability";
}

function parseStatus(raw: unknown): WeeklyAvailabilityRequestStatus {
  const s = typeof raw === "string" ? raw : "";
  const allowed: WeeklyAvailabilityRequestStatus[] = ["submitted", "reviewed", "used", "rejected"];
  return allowed.includes(s as WeeklyAvailabilityRequestStatus) ? (s as WeeklyAvailabilityRequestStatus) : "submitted";
}

function mapRecord(rec: AirtableRecord<Fields>): ModelWeeklyAvailabilityRequest {
  const f = rec.fields;
  return {
    id: rec.id,
    request_id: f.request_id ?? "",
    week_start: (f.week_start ?? "").slice(0, 10),
    model_id: firstLinkedId(f.model_id) ?? "",
    model_name: f.model_name ?? "",
    day: parseDay(f.day),
    entry_type: parseEntryType(f.entry_type),
    start_time: f.start_time ?? null,
    end_time: f.end_time ?? null,
    notes: f.notes ?? "",
    status: parseStatus(f.status),
    created_at: f.created_at ?? "",
  };
}

export async function getModelAvailabilityRequestsForWeek(
  weekStart: string,
  modelId: string
): Promise<ModelWeeklyAvailabilityRequest[]> {
  if (!weekStart || !modelId) return [];
  const monday = ensureMondayForQuery(weekStart);
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "created_at", direction: "desc" }] });
  return records
    .map(mapRecord)
    .filter((r) => r.week_start === monday && r.model_id === modelId)
    .sort((a, b) => a.day.localeCompare(b.day) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
}

export async function getModelAvailabilityRequestById(recordId: string): Promise<ModelWeeklyAvailabilityRequest | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

export async function createModelAvailabilityRequest(input: {
  week_start: string;
  model_id: string;
  model_name: string;
  day: WeeklyProgramDay;
  entry_type: ModelAvailabilityEntryType;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string;
}): Promise<ModelWeeklyAvailabilityRequest> {
  const rec = await createRecord<Fields>(TABLE, {
    request_id: `avail_model_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    week_start: ensureMondayForQuery(input.week_start),
    model_id: [input.model_id],
    model_name: input.model_name,
    day: input.day,
    entry_type: input.entry_type,
    start_time: input.start_time ?? undefined,
    end_time: input.end_time ?? undefined,
    notes: input.notes ?? "",
    status: "submitted",
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updateModelAvailabilityRequest(
  recordId: string,
  patch: Partial<{
    entry_type: ModelAvailabilityEntryType;
    start_time: string | null;
    end_time: string | null;
    notes: string;
    status: WeeklyAvailabilityRequestStatus;
  }>
): Promise<ModelWeeklyAvailabilityRequest> {
  const rec = await updateRecord<Fields>(TABLE, recordId, patch as Partial<Fields>);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function deleteModelAvailabilityRequest(recordId: string): Promise<void> {
  await deleteRecord(TABLE, recordId);
}

export async function getRequests(weekStart: string, modelId: string): Promise<ModelWeeklyAvailabilityRequest[]> {
  return getModelAvailabilityRequestsForWeek(weekStart, modelId);
}
