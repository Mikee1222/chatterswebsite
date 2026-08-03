"use server";

import {
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, formulaTextEquals, linkedRecordIds } from "@/lib/airtable-linked";
import { isSupabaseBackend } from "@/lib/data-backend";
import { getModelById, listAllModelss } from "@/services/modelss";
import {
  airtableWeekStartToMonday,
  ensureMondayForQuery,
  WEEKLY_PROGRAM_DAY_OPTIONS,
} from "@/lib/weekly-program";
import type {
  ModelWeeklyAvailabilityRequest,
  ModelAvailabilityEntryType,
  ModelAvailabilityTimeWindow,
  WeeklyProgramDay,
  WeeklyAvailabilityRequestStatus,
} from "@/types";
import { airtablePayloadFromWindows, emptyTimeFieldsPayload, windowsFromRecord } from "@/lib/model-availability-windows";

const TABLE = "weekly_availability_requests_models";

type Fields = {
  request_id?: string;
  week_start?: string;
  /** multipleRecordLinks → modelss; legacy: `model_id` */
  model?: string | string[];
  model_id?: string | string[];
  model_name?: string;
  day?: string;
  entry_type?: string;
  start_time?: string | null;
  end_time?: string | null;
  /** JSON array: [{ start, end }] — multiline text in Airtable */
  availability_windows?: string;
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
  const sRaw = typeof raw === "string" ? raw.trim() : "";
  if (sRaw === "used_in_schedule") return "used";
  if (sRaw === "approved") return "reviewed";
  const s = sRaw;
  const allowed: WeeklyAvailabilityRequestStatus[] = ["submitted", "reviewed", "used", "rejected"];
  return allowed.includes(s as WeeklyAvailabilityRequestStatus) ? (s as WeeklyAvailabilityRequestStatus) : "submitted";
}

/** Plain `model_id` text from Airtable (stable `model_…` or legacy values). */
function textFieldModelId(fields: Fields): string {
  const v = fields.model_id;
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v)) {
    for (const item of v) {
      if (typeof item === "string" && item.trim()) return item.trim();
    }
  }
  return "";
}

/**
 * Session id → stable text + Airtable row id for weekly request filtering.
 * - `rec…` → record id + stable from {@link getModelById}
 * - `model_…` → stable + first matching modelss row id
 */
async function resolveSessionModelForWeeklyFilter(sessionModelId: string): Promise<{
  stableModelId: string | null;
  airtableRecordId: string | null;
}> {
  const t = sessionModelId.trim();
  if (!t) return { stableModelId: null, airtableRecordId: null };
  if (t.startsWith("rec")) {
    const m = await getModelById(t).catch(() => null);
    return { stableModelId: m?.model_id?.trim() || null, airtableRecordId: t };
  }
  if (t.startsWith("model_")) {
    let airtableRecordId: string | null = null;
    try {
      const models = await listAllModelss(formulaTextEquals("model_id", t));
      airtableRecordId = models[0]?.id?.trim() || null;
    } catch {
      /* ignore */
    }
    return { stableModelId: t, airtableRecordId };
  }
  return { stableModelId: t, airtableRecordId: null };
}

function weeklyAvailabilityRecordMatchesModel(
  fields: Fields,
  resolution: { stableModelId: string | null; airtableRecordId: string | null }
): boolean {
  const textId = textFieldModelId(fields);
  if (resolution.stableModelId && textId === resolution.stableModelId) return true;
  const linkedModel = linkedRecordIds(fields.model);
  if (resolution.airtableRecordId && linkedModel.includes(resolution.airtableRecordId)) return true;
  return false;
}

/** Whether a mapped row belongs to the same model as `sessionModelId` (rec or stable). */
export async function modelOwnsWeeklyAvailabilityRequest(
  mappedRowModelId: string,
  sessionModelId: string
): Promise<boolean> {
  if (isSupabaseBackend()) return (await import("./weekly-availability-requests-models-supabase")).modelOwnsWeeklyAvailabilityRequest(mappedRowModelId, sessionModelId);
  const a = mappedRowModelId.trim();
  const b = sessionModelId.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const r = await resolveSessionModelForWeeklyFilter(b);
  if (r.stableModelId && a === r.stableModelId) return true;
  if (r.airtableRecordId && a === r.airtableRecordId) return true;
  return false;
}

function mapRecord(rec: AirtableRecord<Fields>): ModelWeeklyAvailabilityRequest {
  const f = rec.fields;
  const time_windows = windowsFromRecord(f.start_time, f.end_time, f.availability_windows);
  const textModelId = textFieldModelId(f);
  const model_id = textModelId || firstLinkedId(f.model) || "";
  return {
    id: rec.id,
    request_id: f.request_id ?? "",
    week_start: f.week_start?.trim() ? airtableWeekStartToMonday(f.week_start) : "",
    model_id,
    model_name: f.model_name ?? "",
    day: parseDay(f.day),
    entry_type: parseEntryType(f.entry_type),
    start_time: f.start_time ?? null,
    end_time: f.end_time ?? null,
    time_windows,
    notes: f.notes ?? "",
    status: parseStatus(f.status),
    created_at: f.created_at ?? "",
  };
}

export async function getModelAvailabilityRequestsForWeek(
  weekStart: string,
  modelId: string
): Promise<ModelWeeklyAvailabilityRequest[]> {
  if (isSupabaseBackend()) return (await import("./weekly-availability-requests-models-supabase")).getModelAvailabilityRequestsForWeek(weekStart, modelId);
  if (!weekStart || !modelId) return [];
  const monday = ensureMondayForQuery(weekStart);
  const resolution = await resolveSessionModelForWeeklyFilter(modelId.trim());
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "created_at", direction: "desc" }] });
  return records
    .filter((rec) => {
      const raw = rec.fields.week_start;
      if (raw === undefined || raw === null) return false;
      if (String(raw).slice(0, 10) !== monday) return false;
      return weeklyAvailabilityRecordMatchesModel(rec.fields, resolution);
    })
    .map(mapRecord)
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        (a.time_windows[0]?.start ?? a.start_time ?? "").localeCompare(b.time_windows[0]?.start ?? b.start_time ?? "")
    );
}

export async function getModelAvailabilityRequestById(recordId: string): Promise<ModelWeeklyAvailabilityRequest | null> {
  if (isSupabaseBackend()) return (await import("./weekly-availability-requests-models-supabase")).getModelAvailabilityRequestById(recordId);
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
  time_windows?: ModelAvailabilityTimeWindow[] | null;
  notes?: string;
}): Promise<ModelWeeklyAvailabilityRequest> {
  if (isSupabaseBackend()) return (await import("./weekly-availability-requests-models-supabase")).createModelAvailabilityRequest(input);
  const noTime =
    input.entry_type !== "availability" &&
    input.entry_type !== "live_window" &&
    input.entry_type !== "custom_window";

  const timeFields =
    noTime
      ? emptyTimeFieldsPayload()
      : input.time_windows && input.time_windows.length > 0
        ? airtablePayloadFromWindows(input.time_windows)
        : input.start_time && input.end_time
          ? airtablePayloadFromWindows([{ start: input.start_time, end: input.end_time }])
          : emptyTimeFieldsPayload();

  const rec = await createRecord<Fields>(TABLE, {
    request_id: `avail_model_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    week_start: ensureMondayForQuery(input.week_start),
    model: [input.model_id],
    model_name: input.model_name,
    day: input.day,
    entry_type: input.entry_type,
    ...timeFields,
    notes: input.notes ?? "",
    status: "submitted",
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updateModelAvailabilityRequest(
  recordId: string,
  patch: {
    entry_type: ModelAvailabilityEntryType;
    time_windows?: ModelAvailabilityTimeWindow[];
    notes?: string;
    status?: WeeklyAvailabilityRequestStatus;
  }
): Promise<ModelWeeklyAvailabilityRequest> {
  if (isSupabaseBackend()) return (await import("./weekly-availability-requests-models-supabase")).updateModelAvailabilityRequest(recordId, patch);
  const fields: Partial<Fields> = {
    entry_type: patch.entry_type,
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  };
  const wantTime =
    patch.entry_type === "availability" ||
    patch.entry_type === "live_window" ||
    patch.entry_type === "custom_window";
  if (!wantTime) {
    Object.assign(fields, emptyTimeFieldsPayload());
  } else if (patch.time_windows && patch.time_windows.length > 0) {
    Object.assign(fields, airtablePayloadFromWindows(patch.time_windows));
  }
  const rec = await updateRecord<Fields>(TABLE, recordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function deleteModelAvailabilityRequest(recordId: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./weekly-availability-requests-models-supabase")).deleteModelAvailabilityRequest(recordId);
  await deleteRecord(TABLE, recordId);
}

export async function getRequests(weekStart: string, modelId: string): Promise<ModelWeeklyAvailabilityRequest[]> {
  return getModelAvailabilityRequestsForWeek(weekStart, modelId);
}
