/**
 * Supabase backend for services/weekly-availability-requests-models.ts
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
  airtableWeekStartToMonday,
  ensureMondayForQuery,
  WEEKLY_PROGRAM_DAY_OPTIONS,
} from "@/lib/weekly-program";
import type {
  ModelAvailabilityEntryType,
  ModelAvailabilityTimeWindow,
  ModelWeeklyAvailabilityRequest,
  WeeklyAvailabilityRequestStatus,
  WeeklyProgramDay,
} from "@/types";
import {
  airtablePayloadFromWindows,
  emptyTimeFieldsPayload,
  windowsFromRecord,
} from "@/lib/model-availability-windows";
import { getModelById } from "@/services/modelss";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

const TABLE = "weekly_availability_requests_models";

type Row = SbRow & {
  request_id?: string | null;
  week_start?: string | null;
  model?: string[] | null;
  model_id?: string | null;
  model_name?: string | null;
  day?: string | null;
  entry_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  availability_windows?: string | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string | null;
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
  const allowed: WeeklyAvailabilityRequestStatus[] = ["submitted", "reviewed", "used", "rejected"];
  return allowed.includes(sRaw as WeeklyAvailabilityRequestStatus)
    ? (sRaw as WeeklyAvailabilityRequestStatus)
    : "submitted";
}

async function resolveModelStable(sessionModelId: string): Promise<{ stableModelId: string | null; airtableRecordId: string | null }> {
  const t = sessionModelId.trim();
  if (!t) return { stableModelId: null, airtableRecordId: null };
  if (t.startsWith("rec")) {
    const m = await getModelById(t).catch(() => null);
    return { stableModelId: m?.model_id?.trim() || null, airtableRecordId: t };
  }
  if (t.startsWith("model_")) {
    let airtableRecordId: string | null = null;
    try {
      const sb = getSupabaseServiceClient();
      const { data } = await sb.from("modelss").select("id, airtable_id").eq("model_id", t).limit(1);
      airtableRecordId = ((data as Array<{ airtable_id?: string | null; id?: string }> | null)?.[0]?.airtable_id) || null;
    } catch { /* ignore */ }
    return { stableModelId: t, airtableRecordId };
  }
  return { stableModelId: t, airtableRecordId: null };
}

async function mapRow(row: Row): Promise<ModelWeeklyAvailabilityRequest> {
  const time_windows = windowsFromRecord(row.start_time, row.end_time, row.availability_windows);
  let model_id = String(row.model_id ?? "");
  if (!model_id) {
    const ats = await sbAirtableIdsForUuids("modelss", row.model);
    model_id = ats[0] ?? "";
  }
  return {
    id: publicId(row),
    request_id: row.request_id ?? "",
    week_start: row.week_start?.trim() ? airtableWeekStartToMonday(row.week_start) : "",
    model_id,
    model_name: row.model_name ?? "",
    day: parseDay(row.day),
    entry_type: parseEntryType(row.entry_type),
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    time_windows,
    notes: row.notes ?? "",
    status: parseStatus(row.status),
    created_at: row.created_at ?? "",
  };
}

export async function modelOwnsWeeklyAvailabilityRequest(
  mappedRowModelId: string,
  sessionModelId: string
): Promise<boolean> {
  const a = mappedRowModelId.trim();
  const b = sessionModelId.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const r = await resolveModelStable(b);
  if (r.stableModelId && a === r.stableModelId) return true;
  if (r.airtableRecordId && a === r.airtableRecordId) return true;
  return false;
}

export async function getModelAvailabilityRequestsForWeek(
  weekStart: string,
  modelId: string
): Promise<ModelWeeklyAvailabilityRequest[]> {
  if (!weekStart || !modelId) return [];
  const monday = ensureMondayForQuery(weekStart);
  const resolution = await resolveModelStable(modelId.trim());
  const rows = await sbSelectAll<Row>(TABLE);
  const filtered = rows.filter((row) => {
    const raw = row.week_start;
    if (!raw) return false;
    if (String(raw).slice(0, 10) !== monday) return false;
    const textId = String(row.model_id ?? "");
    if (resolution.stableModelId && textId === resolution.stableModelId) return true;
    const links = Array.isArray(row.model) ? row.model : [];
    if (resolution.airtableRecordId) {
      return false;
    }
    return links.length > 0 && resolution.stableModelId === textId;
  });
  const mapped = await Promise.all(filtered.map(mapRow));
  return mapped.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (a.time_windows[0]?.start ?? a.start_time ?? "").localeCompare(b.time_windows[0]?.start ?? b.start_time ?? "")
  );
}

export async function getModelAvailabilityRequestById(
  recordId: string
): Promise<ModelWeeklyAvailabilityRequest | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  return row ? mapRow(row) : null;
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
  const modelUuids = await sbUuidsForAirtableIds("modelss", [input.model_id]);
  const row = await sbInsert<Row>(TABLE, {
    request_id: `avail_model_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    week_start: ensureMondayForQuery(input.week_start),
    model: modelUuids,
    model_name: input.model_name,
    day: input.day,
    entry_type: input.entry_type,
    ...timeFields,
    notes: input.notes ?? "",
    status: "submitted",
    created_at: new Date().toISOString(),
  });
  return mapRow(row);
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
  const fields: Record<string, unknown> = {
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
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, fields);
  return mapRow(row);
}

export async function deleteModelAvailabilityRequest(recordId: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, recordId);
}
