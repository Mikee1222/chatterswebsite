"use server";

import {
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, formulaTextEquals } from "@/lib/airtable-linked";
import { getModelById, listAllModelss } from "@/services/modelss";
import { ensureMondayForQuery, WEEKLY_PROGRAM_DAY_OPTIONS } from "@/lib/weekly-program";
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

/** Same shape as {@link services/model-periods} — link arrays and legacy single-line text. */
function valuesFromModelishField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

const MODEL_LINK_FIELD_NAMES = ["model", "model_id"] as const;

function weeklyRequestFieldsMatchModelIds(fields: Fields, ids: Set<string>): boolean {
  for (const name of MODEL_LINK_FIELD_NAMES) {
    for (const v of valuesFromModelishField(fields[name])) {
      if (ids.has(v)) return true;
    }
  }
  return false;
}

/**
 * All identity keys for a model row: session `rec…`, stable `model_…`, and cross-resolved ids.
 * Mirrors the dual-id approach in {@link getPeriodsForModelRaw}.
 */
async function buildWeeklyAvailabilityModelLookupIds(modelId: string): Promise<Set<string>> {
  const trimmed = modelId.trim();
  if (!trimmed) return new Set();
  const out = new Set<string>([trimmed]);
  if (trimmed.startsWith("rec")) {
    const m = await getModelById(trimmed).catch(() => null);
    const stable = m?.model_id?.trim();
    if (stable) out.add(stable);
  } else if (trimmed.startsWith("model_")) {
    try {
      const models = await listAllModelss(formulaTextEquals("model_id", trimmed));
      for (const m of models) {
        if (m.id) out.add(m.id);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Whether a mapped row belongs to the same model as `sessionModelId` (rec or stable). */
export async function modelOwnsWeeklyAvailabilityRequest(
  mappedRowModelId: string,
  sessionModelId: string
): Promise<boolean> {
  const a = mappedRowModelId.trim();
  const b = sessionModelId.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const ids = await buildWeeklyAvailabilityModelLookupIds(b);
  return ids.has(a);
}

function mapRecord(rec: AirtableRecord<Fields>): ModelWeeklyAvailabilityRequest {
  const f = rec.fields;
  const time_windows = windowsFromRecord(f.start_time, f.end_time, f.availability_windows);
  return {
    id: rec.id,
    request_id: f.request_id ?? "",
    week_start: (f.week_start ?? "").slice(0, 10),
    model_id: firstLinkedId(f.model ?? f.model_id) ?? "",
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
  if (!weekStart || !modelId) return [];
  const monday = ensureMondayForQuery(weekStart);
  const idSet = await buildWeeklyAvailabilityModelLookupIds(modelId.trim());
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "created_at", direction: "desc" }] });
  return records
    .filter((rec) => {
      const ws = (rec.fields.week_start ?? "").slice(0, 10);
      if (ws !== monday) return false;
      return weeklyRequestFieldsMatchModelIds(rec.fields, idSet);
    })
    .map(mapRecord)
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        (a.time_windows[0]?.start ?? a.start_time ?? "").localeCompare(b.time_windows[0]?.start ?? b.start_time ?? "")
    );
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
  await deleteRecord(TABLE, recordId);
}

export async function getRequests(weekStart: string, modelId: string): Promise<ModelWeeklyAvailabilityRequest[]> {
  return getModelAvailabilityRequestsForWeek(weekStart, modelId);
}
