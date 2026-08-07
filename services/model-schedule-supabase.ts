/**
 * Supabase backend for services/model-schedule.ts
 */
import {
  publicId,
  sbAirtableIdsForUuids,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUuidsForAirtableIds,
  requireSbUuids,
  type SbRow,
} from "@/lib/supabase-data";
import { devLog } from "@/lib/dev-log";
import type { ModelScheduleItem, ModelScheduleItemType, VaTaskStatus } from "@/types";
import type { CreateModelScheduleCustomInput, VaTaskScheduleSyncInput } from "./model-schedule";

const TABLE = "model_schedule";

type Row = SbRow & {
  model?: string[] | null;
  model_id?: string | null;
  model_name?: string | null;
  chatter?: string[] | null;
  created_by?: string[] | null;
  title?: string | null;
  item_type?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  priority?: string | null;
  status?: string | null;
  details?: string | null;
  details_en?: string | null;
  details_es?: string | null;
  instructions?: string | null;
  instructions_en?: string | null;
  instructions_es?: string | null;
  linked_custom_request?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function asItemType(raw: unknown): ModelScheduleItemType {
  const v = typeof raw === "string" ? raw : "";
  const allowed: ModelScheduleItemType[] = [
    "script","mass_message","live_stream","custom","content_shoot","promo",
    "meeting","rest","time_off","va_content","other",
  ];
  return allowed.includes(v as ModelScheduleItemType) ? (v as ModelScheduleItemType) : "other";
}

function isoOrEmpty(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s.includes("T") ? s : s.replace(" ", "T");
}

async function resolveUuidMap(table: string, uuidLists: (string[] | null | undefined)[]): Promise<Map<string, string>> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const list of uuidLists) {
    for (const id of list ?? []) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
    }
  }
  if (!unique.length) return new Map();
  const resolved = await sbAirtableIdsForUuids(table, unique);
  const map = new Map<string, string>();
  for (let i = 0; i < unique.length; i++) {
    map.set(unique[i]!, resolved[i] || unique[i]!);
  }
  return map;
}

function mapRowSync(
  row: Row,
  modelAtByUuid: Map<string, string>,
  crAtByUuid: Map<string, string>
): ModelScheduleItem {
  const modelUuid = row.model?.find(Boolean);
  const model_id =
    (modelUuid ? modelAtByUuid.get(modelUuid) || modelUuid : "") ||
    String(row.model_id ?? "").trim() ||
    "";
  const crUuid = row.linked_custom_request?.find(Boolean);
  return {
    id: publicId(row),
    model_id,
    title: row.title ?? "",
    item_type: asItemType(row.item_type),
    date: String(row.date ?? "").slice(0, 10),
    start_time: row.start_time ? isoOrEmpty(row.start_time) : null,
    end_time: row.end_time ? isoOrEmpty(row.end_time) : null,
    duration_minutes: typeof row.duration_minutes === "number" ? row.duration_minutes : null,
    priority: row.priority ?? "",
    status: row.status ?? "",
    details: row.details ?? "",
    details_en: row.details_en ?? null,
    details_es: row.details_es ?? null,
    instructions: row.instructions ?? "",
    instructions_en: row.instructions_en ?? null,
    instructions_es: row.instructions_es ?? null,
    linked_custom_request_id: crUuid ? crAtByUuid.get(crUuid) || crUuid : null,
    created_at: isoOrEmpty(row.created_at),
    updated_at: isoOrEmpty(row.updated_at),
  };
}

async function mapRows(rows: Row[]): Promise<ModelScheduleItem[]> {
  if (!rows.length) return [];
  const [modelAtByUuid, crAtByUuid] = await Promise.all([
    resolveUuidMap(
      "modelss",
      rows.map((r) => r.model)
    ),
    resolveUuidMap(
      "custom_requests",
      rows.map((r) => r.linked_custom_request)
    ),
  ]);
  return rows.map((r) => mapRowSync(r, modelAtByUuid, crAtByUuid));
}

async function mapRow(row: Row): Promise<ModelScheduleItem> {
  const [mapped] = await mapRows([row]);
  return mapped;
}

export async function listModelScheduleItems(
  modelId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<ModelScheduleItem[]> {
  if (!modelId) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  let mapped = await mapRows(rows);
  mapped = mapped.filter((r) => r.model_id === modelId);
  if (opts?.fromDate) mapped = mapped.filter((r) => r.date >= opts.fromDate!);
  if (opts?.toDate) mapped = mapped.filter((r) => r.date <= opts.toDate!);
  mapped.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return mapped;
}

export async function listAllModelScheduleItemsInRange(opts?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ModelScheduleItem[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  let mapped = await mapRows(rows);
  if (opts?.fromDate) mapped = mapped.filter((r) => r.date >= opts.fromDate!);
  if (opts?.toDate) mapped = mapped.filter((r) => r.date <= opts.toDate!);
  mapped.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return mapped;
}

export async function getSchedule(modelId: string): Promise<ModelScheduleItem[]> {
  return listModelScheduleItems(modelId);
}

export async function createModelScheduleItemForCustom(
  input: CreateModelScheduleCustomInput
): Promise<ModelScheduleItem> {
  const date = input.date.trim().slice(0, 10);
  const [modelUuids, crUuids] = await Promise.all([
    requireSbUuids("modelss", [input.model_record_id], "model"),
    requireSbUuids("custom_requests", [input.custom_request_id], "custom_request"),
  ]);
  const payload: Record<string, unknown> = {
    model: modelUuids,
    title: input.title.trim() || "Custom",
    item_type: "custom",
    date,
    start_time: input.start_time?.trim() || null,
    end_time: input.end_time?.trim() || null,
    details: input.details.trim(),
    linked_custom_request: crUuids,
    status: "scheduled",
  };
  const mn = input.model_name?.trim();
  if (mn) payload.model_name = mn;
  if (input.chatter_record_id?.trim()) {
    const chatter = await sbUuidsForAirtableIds("users", [input.chatter_record_id.trim()]);
    if (chatter.length) payload.chatter = chatter;
  }
  if (input.created_by_record_id?.trim()) {
    const created_by = await sbUuidsForAirtableIds("users", [input.created_by_record_id.trim()]);
    if (created_by.length) payload.created_by = created_by;
  }
  const row = await sbInsert<Row>(TABLE, payload);
  return mapRow(row);
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
  if (h === 0 && mi === 0 && sec === 0) return { date, start_time: "", end_time: "" };
  return { date, start_time: `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`, end_time: "" };
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

export async function createModelScheduleItemsForVaTask(input: VaTaskScheduleSyncInput): Promise<void> {
  const dueRaw = input.due_date?.trim();
  if (!dueRaw) return;
  const { date, start_time, end_time } = parseDueForSchedule(dueRaw);
  if (!date) return;
  const modelIds = [...new Set((input.assigned_model_ids ?? []).map((id) => id.trim()).filter(Boolean))];
  if (!modelIds.length) return;
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
  let chatterUuids: string[] = [];
  let createdByUuids: string[] = [];
  if (vaChatterId) {
    chatterUuids = await sbUuidsForAirtableIds("users", [vaChatterId]);
  }
  if (creator) {
    createdByUuids = await sbUuidsForAirtableIds("users", [creator]);
  }
  for (const modelId of modelIds) {
    try {
      const modelUuids = await requireSbUuids("modelss", [modelId], "model");
      const payload: Record<string, unknown> = {
        model: modelUuids,
        title: input.title.trim() || "Task",
        item_type: "va_content",
        date,
        start_time: start_time || null,
        end_time: end_time || null,
        details,
        status: schedStatus,
      };
      const modelName = nameByModelId.get(modelId);
      if (modelName) payload.model_name = modelName;
      if (chatterUuids.length) payload.chatter = chatterUuids;
      if (createdByUuids.length) payload.created_by = createdByUuids;
      const row = await sbInsert<Row>(TABLE, payload);
      await notifyModelScheduleCreated(modelId, await mapRow(row), creator ?? null);
    } catch (err) {
      devLog("[va_tasks] model_schedule sync failed", { modelId, taskId: input.taskId, err });
    }
  }
}

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
  const modelUuids = await requireSbUuids("modelss", [input.model_record_id], "model");
  const payload: Record<string, unknown> = {
    model: modelUuids,
    title: "Time off",
    item_type: "time_off",
    date: start,
    details: `${reason}\nThrough ${end}`,
    status: "scheduled",
  };
  if (input.model_name?.trim()) payload.model_name = input.model_name.trim();
  if (input.created_by_record_id?.trim()) {
    const created_by = await sbUuidsForAirtableIds("users", [input.created_by_record_id.trim()]);
    if (created_by.length) payload.created_by = created_by;
  }
  const row = await sbInsert<Row>(TABLE, payload);
  return mapRow(row);
}

export async function getModelScheduleItemById(recordId: string): Promise<ModelScheduleItem | null> {
  const id = recordId?.trim();
  if (!id) return null;
  const row = await sbSelectByPublicId<Row>(TABLE, id);
  if (!row) return null;
  return mapRow(row);
}

export async function deleteModelScheduleTimeOffForModel(recordId: string, modelRecordId: string): Promise<boolean> {
  const item = await getModelScheduleItemById(recordId);
  if (!item || item.model_id !== modelRecordId || item.item_type !== "time_off") return false;
  const st = (item.status ?? "").trim().toLowerCase();
  if (st && st !== "pending" && st !== "scheduled") return false;
  await sbDeleteByPublicId(TABLE, recordId);
  return true;
}
