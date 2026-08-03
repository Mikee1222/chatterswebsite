/**
 * Supabase backend for services/va-tasks.ts (DATA_BACKEND=supabase).
 *
 * Improvements vs Airtable:
 * - Visibility / date filters use SQL WHERE (no formula + user_id primary-field dance)
 * - assigned_to / assigned_by stored as uuid[]; public API still returns airtable_id strings
 * - assigned_model_ids/names kept as text for dual-run parity; also sync va_task_models join
 */

import { isVirtualVaTaskId } from "@/lib/recurrence";
import type { VaTasksFetchRangeOptions } from "@/lib/va-tasks-airtable-formula";
import { devLog } from "@/lib/dev-log";
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
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type {
  VaRecurrenceDay,
  VaRecurrenceType,
  VaTaskPriority,
  VaTaskRecord,
  VaTaskStatus,
} from "@/types";

const TABLE = "va_tasks";
const VA_TASKS_LOG = "[va_tasks-supabase]";
const ATHENS_TZ = "Europe/Athens";

type Row = SbRow & {
  title?: string | null;
  description?: string | null;
  assigned_to?: string[] | null;
  assigned_by?: string[] | null;
  assigned_model_ids?: string | null;
  assigned_model_names?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  is_recurring?: boolean | null;
  recurrence_type?: string | null;
  recurrence_days?: string[] | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: string | null;
  reminder_minutes_before?: number | null;
  completed_at?: string | null;
  completed_notes?: string | null;
  overdue_notified_at?: string | null;
  created_at?: string | null;
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

function parseFlexibleDateInput(raw: string | null | undefined): Date | null {
  if (raw == null || String(raw).trim() === "") return null;
  const d = new Date(String(raw).trim());
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toIsoDateTimeUtc(raw: string | null | undefined): string | undefined {
  const d = parseFlexibleDateInput(raw);
  if (!d) return undefined;
  return d.toISOString();
}

function toDateOnly(raw: string | null | undefined): string | undefined {
  const d = parseFlexibleDateInput(raw);
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function mapRow(row: Row): Promise<VaTaskRecord> {
  const [assigned_to_ids, assigned_by_ids] = await Promise.all([
    sbAirtableIdsForUuids("users", row.assigned_to),
    sbAirtableIdsForUuids("users", row.assigned_by),
  ]);
  return {
    id: publicId(row),
    title: row.title?.trim() ? String(row.title) : "",
    description: row.description?.trim() ? String(row.description) : "",
    assigned_to_ids,
    assigned_by_ids,
    assigned_model_ids: parseCommaList(row.assigned_model_ids),
    assigned_model_names: parseCommaList(row.assigned_model_names),
    status: parseStatus(row.status),
    priority: parsePriority(row.priority),
    due_date: row.due_date?.trim() ? String(row.due_date) : null,
    is_recurring: Boolean(row.is_recurring),
    recurrence_type: parseRecurrenceType(row.recurrence_type),
    recurrence_days: parseRecurrenceDays(row.recurrence_days),
    recurrence_interval:
      typeof row.recurrence_interval === "number" && Number.isFinite(row.recurrence_interval)
        ? Number(row.recurrence_interval)
        : null,
    recurrence_end_date: row.recurrence_end_date?.trim() ? String(row.recurrence_end_date).slice(0, 10) : null,
    reminder_minutes_before:
      typeof row.reminder_minutes_before === "number" && Number.isFinite(row.reminder_minutes_before)
        ? Number(row.reminder_minutes_before)
        : null,
    completed_at: row.completed_at?.trim() ? String(row.completed_at) : null,
    completed_notes: row.completed_notes?.trim() ? String(row.completed_notes) : "",
    overdue_notified_at: row.overdue_notified_at?.trim() ? String(row.overdue_notified_at) : null,
    created_at: row.created_at?.trim() ? String(row.created_at) : null,
  };
}

async function syncVaTaskModels(taskUuid: string, modelPublicIds: string[]): Promise<void> {
  const sb = getSupabaseServiceClient();
  await sb.from("va_task_models").delete().eq("task_id", taskUuid);
  if (!modelPublicIds.length) return;
  const modelUuids = await sbUuidsForAirtableIds("modelss", modelPublicIds);
  if (!modelUuids.length) return;
  const rows = modelUuids.map((model_id) => ({ task_id: taskUuid, model_id }));
  const { error } = await sb.from("va_task_models").upsert(rows, { onConflict: "task_id,model_id" });
  if (error) console.error(VA_TASKS_LOG, "va_task_models sync", error.message);
}

async function syncVaTaskAssignees(taskUuid: string, userPublicIds: string[]): Promise<void> {
  const sb = getSupabaseServiceClient();
  await sb.from("va_task_assignees").delete().eq("task_id", taskUuid);
  if (!userPublicIds.length) return;
  const userUuids = await sbUuidsForAirtableIds("users", userPublicIds);
  if (!userUuids.length) return;
  const rows = userUuids.map((user_id) => ({ task_id: taskUuid, user_id }));
  const { error } = await sb.from("va_task_assignees").upsert(rows, { onConflict: "task_id,user_id" });
  if (error) console.error(VA_TASKS_LOG, "va_task_assignees sync", error.message);
}

export async function getVaTasksForUser(userRecordId: string): Promise<VaTaskRecord[]> {
  const recordId = userRecordId.trim();
  if (!recordId) return [];

  // Resolve to Postgres PK — no Airtable primary-field formula needed
  const userUuids = await sbUuidsForAirtableIds("users", [recordId]);
  const userUuid = userUuids[0];
  if (!userUuid) {
    devLog(VA_TASKS_LOG, "getVaTasksForUser: no uuid for", recordId);
    return [];
  }

  const sb = getSupabaseServiceClient();
  // Unassigned (null/empty) OR contains this user uuid
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .or(`assigned_to.is.null,assigned_to.eq.{},assigned_to.cs.{${userUuid}}`);
  if (error) throw new Error(`getVaTasksForUser: ${error.message}`);
  return Promise.all(((data as Row[]) ?? []).map(mapRow));
}

export async function getAllVaTasks(options?: VaTasksFetchRangeOptions): Promise<VaTaskRecord[]> {
  if (!options) {
    const rows = await sbSelectAll<Row>(TABLE);
    return Promise.all(rows.map(mapRow));
  }

  const start = options.athensStartYmd.trim().slice(0, 10);
  const end = options.athensEndYmd.trim().slice(0, 10);
  const includeBucketDates = options.includeBucketDates === true;
  const includeRecurring = options.includeRecurring !== false && !includeBucketDates;

  const sb = getSupabaseServiceClient();
  // Athens calendar bucketing via timezone conversion
  const dueInRange = `and(due_date.not.is.null,due_date.gte.${start}T00:00:00+03:00,due_date.lt.${end}T23:59:59.999+03:00)`;
  // PostgREST can't easily do SET_TIMEZONE; filter broader in UTC then refine in JS with Athens YMD
  const { data, error } = await sb.from(TABLE).select("*");
  if (error) throw new Error(`getAllVaTasks: ${error.message}`);
  void dueInRange;

  const athensYmd = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: ATHENS_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(iso));
    } catch {
      return null;
    }
  };

  const inRange = (ymd: string | null) => ymd != null && ymd >= start && ymd <= end;

  const filtered = ((data as Row[]) ?? []).filter((row) => {
    if (includeRecurring && row.is_recurring) return true;
    if (includeBucketDates) {
      return (
        inRange(athensYmd(row.due_date)) ||
        inRange(athensYmd(row.completed_at)) ||
        inRange(athensYmd(row.created_at))
      );
    }
    return inRange(athensYmd(row.due_date));
  });

  return Promise.all(filtered.map(mapRow));
}

export async function getRecurringTaskHistory(title: string): Promise<VaTaskRecord[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("title", title)
    .eq("is_recurring", true)
    .eq("status", "done")
    .order("due_date", { ascending: false });
  if (error) throw new Error(`getRecurringTaskHistory: ${error.message}`);
  return Promise.all(((data as Row[]) ?? []).map(mapRow));
}

export async function getVaTaskById(id: string): Promise<VaTaskRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, id);
  if (!row) return null;
  return mapRow(row);
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
  const assignedTo = await sbUuidsForAirtableIds("users", data.assigned_to_ids);
  const assignedBy = await sbUuidsForAirtableIds("users", data.assigned_by_ids ?? []);
  const payload: Record<string, unknown> = {
    title: data.title.trim(),
    description: (data.description ?? "").trim(),
    assigned_to: assignedTo,
    assigned_by: assignedBy,
    assigned_model_ids: (data.assigned_model_ids ?? []).join(","),
    assigned_model_names: (data.assigned_model_names ?? []).join(","),
    status: data.status ?? "pending",
    priority: data.priority ?? "normal",
    is_recurring: Boolean(data.is_recurring),
    created_at: new Date().toISOString(),
  };
  if (data.recurrence_type?.trim()) payload.recurrence_type = data.recurrence_type.trim();
  if (data.recurrence_days?.length) payload.recurrence_days = data.recurrence_days;
  if (data.recurrence_interval != null) payload.recurrence_interval = data.recurrence_interval;
  if (data.reminder_minutes_before != null) payload.reminder_minutes_before = data.reminder_minutes_before;
  const due = toIsoDateTimeUtc(data.due_date ?? undefined);
  if (due) payload.due_date = due;
  const recEnd = toDateOnly(data.recurrence_end_date ?? undefined);
  if (recEnd) payload.recurrence_end_date = recEnd;

  const row = await sbInsert<Row>(TABLE, payload);
  await Promise.all([
    syncVaTaskAssignees(row.id, data.assigned_to_ids),
    syncVaTaskModels(row.id, data.assigned_model_ids ?? []),
  ]);
  return mapRow(row);
}

export async function updateVaTask(id: string, data: VaTaskUpdateInput): Promise<VaTaskRecord> {
  const payload: Record<string, unknown> = {};
  if (data.title !== undefined) payload.title = data.title.trim();
  if (data.description !== undefined) payload.description = data.description.trim();
  if (data.assigned_to_ids !== undefined) {
    payload.assigned_to = await sbUuidsForAirtableIds("users", data.assigned_to_ids);
  }
  if (data.assigned_by_ids !== undefined) {
    payload.assigned_by = await sbUuidsForAirtableIds("users", data.assigned_by_ids);
  }
  if (data.assigned_model_ids !== undefined) {
    payload.assigned_model_ids = (data.assigned_model_ids ?? []).join(",");
  }
  if (data.assigned_model_names !== undefined) {
    payload.assigned_model_names = (data.assigned_model_names ?? []).join(",");
  }
  if (data.status !== undefined) payload.status = data.status;
  if (data.priority !== undefined) payload.priority = data.priority;
  if (data.due_date !== undefined) {
    const due = toIsoDateTimeUtc(data.due_date === null ? undefined : data.due_date);
    if (due) payload.due_date = due;
  }
  if (data.is_recurring !== undefined) payload.is_recurring = data.is_recurring;
  if (data.recurrence_type !== undefined) payload.recurrence_type = data.recurrence_type?.trim() || null;
  if (data.recurrence_days !== undefined) {
    payload.recurrence_days = data.recurrence_days.length ? data.recurrence_days : [];
  }
  if (data.recurrence_interval !== undefined) payload.recurrence_interval = data.recurrence_interval;
  if (data.recurrence_end_date !== undefined) {
    const recEnd = toDateOnly(data.recurrence_end_date === null ? undefined : data.recurrence_end_date);
    if (recEnd) payload.recurrence_end_date = recEnd;
  }
  if (data.reminder_minutes_before !== undefined) {
    payload.reminder_minutes_before = data.reminder_minutes_before;
  }
  if (data.completed_at !== undefined) {
    const doneAt = toIsoDateTimeUtc(data.completed_at === null ? undefined : data.completed_at);
    if (doneAt) payload.completed_at = doneAt;
  }
  if (data.completed_notes !== undefined) payload.completed_notes = data.completed_notes.trim();
  if (data.overdue_notified_at !== undefined) {
    const notifiedAt = toIsoDateTimeUtc(
      data.overdue_notified_at === null ? undefined : data.overdue_notified_at
    );
    if (notifiedAt) payload.overdue_notified_at = notifiedAt;
  }

  const row =
    Object.keys(payload).length > 0
      ? await sbUpdateByPublicId<Row>(TABLE, id, payload)
      : await sbSelectByPublicId<Row>(TABLE, id);
  if (!row) throw new Error("VA task not found");

  if (data.assigned_to_ids !== undefined) {
    await syncVaTaskAssignees(row.id, data.assigned_to_ids);
  }
  if (data.assigned_model_ids !== undefined) {
    await syncVaTaskModels(row.id, data.assigned_model_ids);
  }
  return mapRow(row);
}

export async function deleteVaTask(id: string): Promise<void> {
  if (isVirtualVaTaskId(id)) {
    throw new Error(
      "Cannot delete a projected recurring day — it has no record yet. Delete a real occurrence of the series instead."
    );
  }
  await sbDeleteByPublicId(TABLE, id);
}

export type VaTaskUpcomingReminder = {
  task: VaTaskRecord;
  minutesUntilDue: number;
  reminderAtMs: number;
  recipientUserIds: string[];
};

export async function getUpcomingReminders(): Promise<VaTaskUpcomingReminder[]> {
  const now = Date.now();
  const horizon = now + 60 * 60 * 1000;
  const all = await getAllVaTasks();
  const tasks = all.filter((t) => t.status === "pending" || t.status === "in_progress");
  const { listAllUsers } = await import("@/services/users");
  const users = await listAllUsers();
  const activeVaIds = users
    .filter((u) => u.role === "virtual_assistant" && (u.status ?? "").toLowerCase() === "active")
    .map((u) => u.id)
    .filter(Boolean);

  const out: VaTaskUpcomingReminder[] = [];
  for (const task of tasks) {
    if (!task.due_date || task.reminder_minutes_before == null || task.reminder_minutes_before < 0) continue;
    const dueMs = new Date(task.due_date).getTime();
    if (Number.isNaN(dueMs)) continue;
    const reminderAt = dueMs - task.reminder_minutes_before * 60 * 1000;
    if (reminderAt < now || reminderAt > horizon) continue;
    const minutesUntilDue = Math.max(1, Math.round((dueMs - now) / 60_000));
    const recipientUserIds =
      task.assigned_to_ids.length > 0 ? [...task.assigned_to_ids] : [...activeVaIds];
    out.push({ task, minutesUntilDue, reminderAtMs: reminderAt, recipientUserIds });
  }
  return out;
}
