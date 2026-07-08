"use server";

import {
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { linkedRecordIds, snapshotText } from "@/lib/airtable-linked";
import { isVirtualVaTaskId } from "@/lib/recurrence";
import type {
  VaTaskRecord,
  VaTaskStatus,
  VaTaskPriority,
  VaRecurrenceType,
  VaRecurrenceDay,
} from "@/types";
import { devLog } from "@/lib/dev-log";

const TABLE = "va_tasks";

/** Must match the Airtable `va_tasks` column name exactly (case-sensitive). */
const AIRTABLE_FIELD_DUE_DATE = "due_date" as const;

const VA_TASKS_LOG = "[va_tasks]";

/** Parse user/API input to a valid Date in local/UTC, or null. */
function parseFlexibleDateInput(raw: string | null | undefined): Date | null {
  if (raw == null || String(raw).trim() === "") return null;
  const d = new Date(String(raw).trim());
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * ISO 8601 UTC with milliseconds for Airtable dateTime fields, e.g. `2026-05-03T12:30:00.000Z`.
 */
function toAirtableDateTimeIsoUtc(raw: string | null | undefined): string | undefined {
  const d = parseFlexibleDateInput(raw);
  if (!d) return undefined;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${y}-${mo}-${day}T${h}:${mi}:${s}.${ms}Z`;
}

/** Read due datetime from record fields (handles alternate Airtable display names). */
function readRawDueDateFromFields(f: Fields): string | null {
  const obj = f as Record<string, unknown>;
  const tryKeys = [AIRTABLE_FIELD_DUE_DATE, "Due date"];
  for (const key of tryKeys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const norm = (k: string) => k.toLowerCase().replace(/\s+/g, "_");
  for (const k of Object.keys(obj)) {
    if (norm(k) === "due_date") {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

function logOutgoingPayload(operation: "create" | "update", recordId: string | undefined, payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);
  devLog(`${VA_TASKS_LOG} ${operation}Record outgoing fields`, {
    table: TABLE,
    recordId: recordId ?? null,
    payload: serialized,
    due_date_key: AIRTABLE_FIELD_DUE_DATE,
    due_date_value: payload[AIRTABLE_FIELD_DUE_DATE] ?? null,
  });
}

/** Airtable date field (e.g. recurrence_end_date): `YYYY-MM-DD` only, or omit when empty. */
function toRecurrenceEndDateOnly(raw: string | null | undefined): string | undefined {
  const d = parseFlexibleDateInput(raw);
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** completed_at (and similar): ISO 8601 UTC with ms, or omit when empty. */
function toIsoDateTimeOrOmit(raw: string | null | undefined): string | undefined {
  return toAirtableDateTimeIsoUtc(raw);
}

type Fields = {
  title?: string;
  description?: string;
  assigned_to?: string | string[];
  assigned_by?: string | string[];
  assigned_model_ids?: string;
  assigned_model_names?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_days?: string | string[];
  recurrence_interval?: number;
  recurrence_end_date?: string;
  reminder_minutes_before?: number;
  completed_at?: string;
  completed_notes?: string;
  overdue_notified_at?: string;
  created_at?: string;
};

function parseStatus(raw: unknown): VaTaskStatus {
  const s = typeof raw === "string" ? raw : "";
  if (s === "pending" || s === "in_progress" || s === "done" || s === "skipped") return s;
  return "pending";
}

function parsePriority(raw: unknown): VaTaskPriority {
  const p = typeof raw === "string" ? raw : "";
  if (p === "low" || p === "normal" || p === "high" || p === "urgent") return p;
  return "normal";
}

function parseRecurrenceType(raw: unknown): VaRecurrenceType | "" {
  const t = typeof raw === "string" ? raw : "";
  if (t === "daily" || t === "weekly" || t === "monthly" || t === "custom") return t;
  return "";
}

function parseCommaList(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseRecurrenceDays(raw: unknown): VaRecurrenceDay[] {
  const allowed = new Set<VaRecurrenceDay>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return arr.filter((d): d is VaRecurrenceDay => typeof d === "string" && allowed.has(d as VaRecurrenceDay));
}

function mapRecord(rec: AirtableRecord<Fields>): VaTaskRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    title: snapshotText(f.title, ""),
    description: snapshotText(f.description, ""),
    assigned_to_ids: linkedRecordIds(f.assigned_to),
    assigned_by_ids: linkedRecordIds(f.assigned_by),
    assigned_model_ids: parseCommaList(f.assigned_model_ids),
    assigned_model_names: parseCommaList(f.assigned_model_names),
    status: parseStatus(f.status),
    priority: parsePriority(f.priority),
    due_date: readRawDueDateFromFields(f) ?? null,
    is_recurring: Boolean(f.is_recurring),
    recurrence_type: parseRecurrenceType(f.recurrence_type),
    recurrence_days: parseRecurrenceDays(f.recurrence_days),
    recurrence_interval: typeof f.recurrence_interval === "number" && Number.isFinite(f.recurrence_interval)
      ? f.recurrence_interval
      : null,
    recurrence_end_date: f.recurrence_end_date?.trim() ? f.recurrence_end_date.trim() : null,
    reminder_minutes_before:
      typeof f.reminder_minutes_before === "number" && Number.isFinite(f.reminder_minutes_before)
        ? f.reminder_minutes_before
        : null,
    completed_at: f.completed_at?.trim() ? f.completed_at.trim() : null,
    completed_notes: snapshotText(f.completed_notes, ""),
    overdue_notified_at: f.overdue_notified_at?.trim() ? f.overdue_notified_at.trim() : null,
    created_at: f.created_at?.trim() ? f.created_at.trim() : null,
  };
}

function taskVisibleToVa(task: VaTaskRecord, vaUserId: string): boolean {
  if (task.assigned_to_ids.length === 0) return true;
  return task.assigned_to_ids.includes(vaUserId);
}

/** Tasks assigned to this VA (including “all VAs” when assigned_to is empty). */
export async function getVaTasksForUser(userId: string): Promise<VaTaskRecord[]> {
  const all = await listAllRecords<Fields>(TABLE, {});
  return all.map(mapRecord).filter((t) => taskVisibleToVa(t, userId));
}

export async function getAllVaTasks(): Promise<VaTaskRecord[]> {
  const records = await listAllRecords<Fields>(TABLE, {});
  return records.map(mapRecord);
}

/** Escape a string for use inside an Airtable formula literal. */
function airtableFormulaString(value: string): string {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Completed recurring instances with the same title (`is_recurring` = true). */
export async function getRecurringTaskHistory(title: string, _assignedToIds: string[]): Promise<VaTaskRecord[]> {
  const escaped = airtableFormulaString(title);
  const records = await listAllRecords<Fields>(TABLE, {
    filterByFormula: `AND({title} = "${escaped}", {is_recurring} = TRUE(), {status} = "done")`,
    sort: [{ field: "due_date", direction: "desc" }],
  });
  return records.map(mapRecord);
}

export async function getVaTaskById(id: string): Promise<VaTaskRecord | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, id);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

export type VaTaskCreateInput = {
  title: string;
  description?: string;
  assigned_to_ids: string[];
  assigned_by_ids?: string[];
  assigned_model_ids?: string[];
  assigned_model_names?: string[];
  status?: VaTaskStatus;
  priority?: VaTaskPriority;
  due_date?: string | null;
  is_recurring?: boolean;
  recurrence_type?: VaRecurrenceType | "" | null;
  recurrence_days?: VaRecurrenceDay[];
  recurrence_interval?: number | null;
  recurrence_end_date?: string | null;
  reminder_minutes_before?: number | null;
};

export type VaTaskUpdateInput = Partial<
  Omit<VaTaskCreateInput, "title"> & {
    title?: string;
    completed_at?: string | null;
    completed_notes?: string;
    overdue_notified_at?: string | null;
  }
>;

export async function createVaTask(data: VaTaskCreateInput): Promise<VaTaskRecord> {
  const payload: Record<string, unknown> = {
    title: data.title.trim(),
    description: (data.description ?? "").trim(),
    assigned_to: data.assigned_to_ids.length ? data.assigned_to_ids : [],
    assigned_by: data.assigned_by_ids?.length ? data.assigned_by_ids : [],
    assigned_model_ids: (data.assigned_model_ids ?? []).join(","),
    assigned_model_names: (data.assigned_model_names ?? []).join(","),
    status: data.status ?? "pending",
    priority: data.priority ?? "normal",
    is_recurring: Boolean(data.is_recurring),
    recurrence_type: data.recurrence_type?.trim() || undefined,
    recurrence_days: data.recurrence_days?.length ? data.recurrence_days : undefined,
    recurrence_interval: data.recurrence_interval ?? undefined,
    reminder_minutes_before: data.reminder_minutes_before ?? undefined,
  };
  const due = toAirtableDateTimeIsoUtc(data.due_date ?? undefined);
  if (due) payload[AIRTABLE_FIELD_DUE_DATE] = due;
  const recEnd = toRecurrenceEndDateOnly(data.recurrence_end_date ?? undefined);
  if (recEnd) payload.recurrence_end_date = recEnd;
  logOutgoingPayload("create", undefined, payload);
  const rec = await createRecord<Fields>(TABLE, payload);
  const task = mapRecord(rec as AirtableRecord<Fields>);
  try {
    const { createModelScheduleItemsForVaTask } = await import("@/services/model-schedule");
    await createModelScheduleItemsForVaTask({
      taskId: task.id,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      assigned_to_ids: task.assigned_to_ids,
      assigned_model_ids: task.assigned_model_ids,
      assigned_model_names: task.assigned_model_names,
      status: task.status,
      assigned_by_ids: data.assigned_by_ids,
    });
  } catch (err) {
    devLog(`${VA_TASKS_LOG} model_schedule sync error`, err);
  }
  return task;
}

export async function updateVaTask(id: string, data: VaTaskUpdateInput): Promise<VaTaskRecord> {
  const payload: Record<string, unknown> = {};
  if (data.title !== undefined) payload.title = data.title.trim();
  if (data.description !== undefined) payload.description = data.description.trim();
  if (data.assigned_to_ids !== undefined) payload.assigned_to = data.assigned_to_ids.length ? data.assigned_to_ids : [];
  if (data.assigned_by_ids !== undefined) payload.assigned_by = data.assigned_by_ids.length ? data.assigned_by_ids : [];
  if (data.assigned_model_ids !== undefined) payload.assigned_model_ids = (data.assigned_model_ids ?? []).join(",");
  if (data.assigned_model_names !== undefined) payload.assigned_model_names = (data.assigned_model_names ?? []).join(",");
  if (data.status !== undefined) payload.status = data.status;
  if (data.priority !== undefined) payload.priority = data.priority;
  if (data.due_date !== undefined) {
    const due = toAirtableDateTimeIsoUtc(data.due_date === null ? undefined : data.due_date);
    if (due) payload[AIRTABLE_FIELD_DUE_DATE] = due;
  }
  if (data.is_recurring !== undefined) payload.is_recurring = data.is_recurring;
  if (data.recurrence_type !== undefined) payload.recurrence_type = data.recurrence_type?.trim() || null;
  if (data.recurrence_days !== undefined) payload.recurrence_days = data.recurrence_days.length ? data.recurrence_days : [];
  if (data.recurrence_interval !== undefined) payload.recurrence_interval = data.recurrence_interval;
  if (data.recurrence_end_date !== undefined) {
    const recEnd = toRecurrenceEndDateOnly(
      data.recurrence_end_date === null ? undefined : data.recurrence_end_date
    );
    if (recEnd) payload.recurrence_end_date = recEnd;
  }
  if (data.reminder_minutes_before !== undefined) payload.reminder_minutes_before = data.reminder_minutes_before;
  if (data.completed_at !== undefined) {
    const doneAt = toIsoDateTimeOrOmit(
      data.completed_at === null ? undefined : data.completed_at
    );
    if (doneAt) payload.completed_at = doneAt;
  }
  if (data.completed_notes !== undefined) payload.completed_notes = data.completed_notes.trim();
  if (data.overdue_notified_at !== undefined) {
    const notifiedAt = toIsoDateTimeOrOmit(
      data.overdue_notified_at === null ? undefined : data.overdue_notified_at
    );
    if (notifiedAt) payload.overdue_notified_at = notifiedAt;
  }

  if (Object.keys(payload).length > 0) {
    logOutgoingPayload("update", id, payload);
  }
  const rec = await updateRecord<Fields>(TABLE, id, payload);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function deleteVaTask(id: string): Promise<void> {
  if (isVirtualVaTaskId(id)) {
    throw new Error(
      "Cannot delete a projected recurring day — it has no Airtable record yet. Delete a real occurrence of the series instead.",
    );
  }
  await deleteRecord(TABLE, id);
}

function parseDueMs(dueDate: string): number | null {
  const s = dueDate.trim();
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

export type VaTaskUpcomingReminder = {
  task: VaTaskRecord;
  /** Minutes from now until due (rounded), for push copy. */
  minutesUntilDue: number;
  /** Scheduled reminder instant (ms); used for stable dedup entity_id. */
  reminderAtMs: number;
  /** Airtable user ids to notify (VAs). */
  recipientUserIds: string[];
};

/**
 * Tasks whose reminder time falls within the next 60 minutes (inclusive of now).
 * Reminder time = due_date − reminder_minutes_before. Only pending / in_progress.
 */
export async function getUpcomingReminders(): Promise<VaTaskUpcomingReminder[]> {
  const now = Date.now();
  const horizon = now + 60 * 60 * 1000;
  const all = await listAllRecords<Fields>(TABLE, {});
  const tasks = all.map(mapRecord).filter((t) => t.status === "pending" || t.status === "in_progress");
  const { listAllUsers } = await import("@/services/users");
  const users = await listAllUsers();
  const activeVaIds = users
    .filter((u) => u.role === "virtual_assistant" && (u.status ?? "").toLowerCase() === "active")
    .map((u) => u.id)
    .filter(Boolean);

  const out: VaTaskUpcomingReminder[] = [];

  for (const task of tasks) {
    if (!task.due_date || task.reminder_minutes_before == null || task.reminder_minutes_before < 0) continue;
    const dueMs = parseDueMs(task.due_date);
    if (dueMs == null) continue;
    const reminderAt = dueMs - task.reminder_minutes_before * 60 * 1000;
    if (reminderAt < now || reminderAt > horizon) continue;

    const minutesUntilDue = Math.max(1, Math.round((dueMs - now) / 60_000));
    const recipientUserIds =
      task.assigned_to_ids.length > 0 ? [...task.assigned_to_ids] : [...activeVaIds];

    out.push({ task, minutesUntilDue, reminderAtMs: reminderAt, recipientUserIds });
  }

  return out;
}
