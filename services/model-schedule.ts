import { listAllRecords, createRecord, getRecord, deleteRecord, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import { devLog } from "@/lib/dev-log";
import type { ModelScheduleItem, ModelScheduleItemType, ModelTimeOffRequest, VaTaskStatus } from "@/types";

const TABLE = "model_schedule";

type Fields = {
  /** multipleRecordLinks → modelss (canonical). Never write `model_id` — Airtable rejects it on link cols. */
  model?: string | string[];
  /** Legacy read-only mirror if base still exposes old name */
  model_id?: string | string[];
  model_name?: string;
  chatter?: string | string[];
  created_by?: string | string[];
  title?: string;
  item_type?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  priority?: string;
  status?: string;
  details?: string;
  details_en?: string;
  details_es?: string;
  instructions?: string;
  instructions_en?: string;
  instructions_es?: string;
  linked_custom_request?: string | string[];
  created_at?: string;
  updated_at?: string;
};

function asItemType(raw: unknown): ModelScheduleItemType {
  const v = typeof raw === "string" ? raw : "";
  const allowed: ModelScheduleItemType[] = [
    "script",
    "mass_message",
    "live_stream",
    "custom",
    "content_shoot",
    "promo",
    "meeting",
    "rest",
    "time_off",
    "va_content",
    "other",
  ];
  return allowed.includes(v as ModelScheduleItemType) ? (v as ModelScheduleItemType) : "other";
}

function mapRecord(rec: AirtableRecord<Fields>): ModelScheduleItem {
  const f = rec.fields;
  return {
    id: rec.id,
    model_id: firstLinkedId(f.model ?? f.model_id) ?? "",
    title: f.title ?? "",
    item_type: asItemType(f.item_type),
    date: (f.date ?? "").slice(0, 10),
    start_time: f.start_time ?? null,
    end_time: f.end_time ?? null,
    duration_minutes: typeof f.duration_minutes === "number" ? f.duration_minutes : null,
    priority: f.priority ?? "",
    status: f.status ?? "",
    details: f.details ?? "",
    details_en: f.details_en ?? null,
    details_es: f.details_es ?? null,
    instructions: f.instructions ?? "",
    instructions_en: f.instructions_en ?? null,
    instructions_es: f.instructions_es ?? null,
    linked_custom_request_id: firstLinkedId(f.linked_custom_request) ?? null,
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
  };
}

export async function listModelScheduleItems(
  modelId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<ModelScheduleItem[]> {
  if (!modelId) return [];
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "date", direction: "asc" }] });
  let rows = records.map(mapRecord).filter((r) => r.model_id === modelId);
  if (opts?.fromDate) rows = rows.filter((r) => r.date >= opts.fromDate!);
  if (opts?.toDate) rows = rows.filter((r) => r.date <= opts.toDate!);
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return rows;
}

/** All models; optional inclusive date bounds (YYYY-MM-DD). */
export async function listAllModelScheduleItemsInRange(opts?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ModelScheduleItem[]> {
  const records = await listAllRecords<Fields>(TABLE, { sort: [{ field: "date", direction: "asc" }] });
  let rows = records.map(mapRecord);
  if (opts?.fromDate) rows = rows.filter((r) => r.date >= opts.fromDate!);
  if (opts?.toDate) rows = rows.filter((r) => r.date <= opts.toDate!);
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return rows;
}

export async function getSchedule(modelId: string): Promise<ModelScheduleItem[]> {
  return listModelScheduleItems(modelId);
}

export type CreateModelScheduleCustomInput = {
  model_record_id: string;
  custom_request_id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  details: string;
  /** Optional: `modelss` display snapshot on `model_schedule` */
  model_name?: string;
  /** Optional: link → users (chatter) */
  chatter_record_id?: string | null;
  /** Optional: link → users (actor who created the row) */
  created_by_record_id?: string | null;
};

/** One calendar row for a custom, linked back to `custom_requests`. */
export async function createModelScheduleItemForCustom(
  input: CreateModelScheduleCustomInput
): Promise<ModelScheduleItem> {
  const date = input.date.trim().slice(0, 10);
  const payload: Record<string, unknown> = {
    model: [input.model_record_id],
    title: input.title.trim() || "Custom",
    item_type: "custom",
    date,
    start_time: input.start_time?.trim() || "",
    end_time: input.end_time?.trim() || "",
    details: input.details.trim(),
    linked_custom_request: [input.custom_request_id],
    status: "scheduled",
  };
  const mn = input.model_name?.trim();
  if (mn) payload.model_name = mn;
  const chatter = input.chatter_record_id?.trim();
  if (chatter) payload.chatter = [chatter];
  const creator = input.created_by_record_id?.trim();
  if (creator) payload.created_by = [creator];
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

const VA_TASK_ID_PREFIX = "va_task_id:";

function parseDueForSchedule(iso: string): { date: string; start_time: string; end_time: string } {
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return { date: "", start_time: "", end_time: "" };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const date = `${y}-${m}-${day}`;
  const h = d.getHours();
  const mi = d.getMinutes();
  const sec = d.getSeconds();
  const isAllDay = h === 0 && mi === 0 && sec === 0;
  if (isAllDay) return { date, start_time: "", end_time: "" };
  const hh = String(h).padStart(2, "0");
  const mm = String(mi).padStart(2, "0");
  return { date, start_time: `${hh}:${mm}`, end_time: "" };
}

export type VaTaskScheduleSyncInput = {
  taskId: string;
  title: string;
  description?: string;
  due_date?: string | null;
  assigned_to_ids: string[];
  assigned_model_ids: string[];
  assigned_model_names?: string[];
  status?: VaTaskStatus;
  assigned_by_ids?: string[];
};

/** Best-effort: one `model_schedule` row per assigned model (`item_type` = va_content). */
export async function createModelScheduleItemsForVaTask(input: VaTaskScheduleSyncInput): Promise<void> {
  const dueRaw = input.due_date?.trim();
  if (!dueRaw) return;
  const { date, start_time, end_time } = parseDueForSchedule(dueRaw);
  if (!date) return;

  const modelIds = [...new Set((input.assigned_model_ids ?? []).map((id) => id.trim()).filter(Boolean))];
  if (modelIds.length === 0) return;

  const vaChatterId = (input.assigned_to_ids ?? []).map((id) => id.trim()).find(Boolean) ?? null;
  const statusMap: Record<VaTaskStatus, string> = {
    pending: "scheduled",
    in_progress: "scheduled",
    done: "completed",
    skipped: "completed",
  };
  const schedStatus = statusMap[input.status ?? "pending"] ?? "scheduled";

  const detailsLines = [`${VA_TASK_ID_PREFIX}${input.taskId}`];
  const desc = (input.description ?? "").trim();
  if (desc) detailsLines.push(desc);
  const details = detailsLines.join("\n");

  const nameByModelId = new Map<string, string>();
  (input.assigned_model_ids ?? []).forEach((id, i) => {
    const name = (input.assigned_model_names ?? [])[i]?.trim();
    if (name) nameByModelId.set(id, name);
  });

  const creator = input.assigned_by_ids?.map((id) => id.trim()).find(Boolean);

  for (const modelId of modelIds) {
    try {
      const payload: Record<string, unknown> = {
        model: [modelId],
        title: input.title.trim() || "VA task",
        item_type: "va_content",
        date,
        start_time,
        end_time,
        details,
        status: schedStatus,
      };
      const modelName = nameByModelId.get(modelId);
      if (modelName) payload.model_name = modelName;
      if (vaChatterId) payload.chatter = [vaChatterId];
      if (creator) payload.created_by = [creator];
      const rec = await createRecord<Fields>(TABLE, payload as Fields);
      await notifyModelScheduleCreated(modelId, mapRecord(rec as AirtableRecord<Fields>), creator ?? null);
    } catch (err) {
      devLog("[va_tasks] model_schedule sync failed", { modelId, taskId: input.taskId, err });
    }
  }
}

async function notifyModelScheduleCreated(
  modelRecordId: string,
  item: ModelScheduleItem,
  actorUserId: string | null
): Promise<void> {
  try {
    const { getActiveModelUserAirtableIdByLinkedModelRecordId } = await import("@/services/users");
    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(modelRecordId);
    if (!modelUserId) return;
    const { notify } = await import("@/services/notification-service");
    const { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } = await import(
      "@/lib/notification-types"
    );
    const title = item.title?.trim() || "New schedule item";
    await notify({
      user_id: modelUserId,
      event_type: NOTIFICATION_EVENT.MODEL_SCHEDULE_CREATED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "📅 New schedule item",
      body: `"${title}" was added to your schedule${item.date ? ` for ${item.date}` : ""}.`,
      entity_type: NOTIFICATION_ENTITY.MODEL_SCHEDULE,
      entity_id: item.id,
      actor_user_id: actorUserId ?? undefined,
      _triggerSource: "model_schedule_created_va_task",
    });
  } catch (err) {
    devLog("[model_schedule_created] notify failed", { modelRecordId, itemId: item.id, err });
  }
}

/** Single schedule row for a multi-day absence (`date` = first day; range in `details`). */
export async function createModelScheduleTimeOff(input: {
  model_record_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  model_name?: string;
  created_by_record_id?: string | null;
}): Promise<ModelScheduleItem> {
  const start = input.start_date.trim().slice(0, 10);
  const end = input.end_date.trim().slice(0, 10);
  const reason = input.reason.trim() || "Time off";
  const details = `${reason}\nThrough ${end}`;
  const payload: Record<string, unknown> = {
    model: [input.model_record_id],
    title: "Time off",
    item_type: "time_off",
    date: start,
    details,
    status: "scheduled",
  };
  const mn = input.model_name?.trim();
  if (mn) payload.model_name = mn;
  const creator = input.created_by_record_id?.trim();
  if (creator) payload.created_by = [creator];
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Parses `details` produced by {@link createModelScheduleTimeOff} (`reason` + `\nThrough YYYY-MM-DD`). */
export function parseTimeOffRangeFromScheduleDetails(
  details: string,
  fallbackStartYmd: string
): { endYmd: string; reasonLine: string } {
  const d = (details || "").trim();
  const through = d.match(/Through\s+(\d{4}-\d{2}-\d{2})/);
  const endYmd = through?.[1] ?? fallbackStartYmd.slice(0, 10);
  const lines = d.split(/\n/).map((x) => x.trim()).filter(Boolean);
  const reasonLine =
    lines.find((line) => !/^through\s+/i.test(line)) ?? lines[0] ?? "Time off";
  return { endYmd, reasonLine };
}

export function modelScheduleTimeOffItemToRequest(item: ModelScheduleItem): ModelTimeOffRequest | null {
  if (item.item_type !== "time_off") return null;
  const start = (item.date || "").slice(0, 10);
  if (!start) return null;
  const { endYmd, reasonLine } = parseTimeOffRangeFromScheduleDetails(item.details ?? "", start);
  return {
    id: item.id,
    request_id: `schedule_${item.id}`,
    model_id: item.model_id,
    model_name: "",
    start_date: start,
    end_date: endYmd,
    reason: reasonLine,
    status: item.status?.trim() || "scheduled",
    created_at: item.created_at ?? "",
  };
}

export async function getModelScheduleItemById(recordId: string): Promise<ModelScheduleItem | null> {
  const id = recordId?.trim();
  if (!id) return null;
  try {
    const rec = await getRecord<Fields>(TABLE, id);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

/** Deletes a calendar time-off row if it belongs to the model and is still cancellable (`pending`/`scheduled`/empty status). */
export async function deleteModelScheduleTimeOffForModel(recordId: string, modelRecordId: string): Promise<boolean> {
  const item = await getModelScheduleItemById(recordId);
  if (!item || item.model_id !== modelRecordId || item.item_type !== "time_off") return false;
  const st = (item.status ?? "").trim().toLowerCase();
  if (st && st !== "pending" && st !== "scheduled") return false;
  await deleteRecord(TABLE, recordId);
  return true;
}
