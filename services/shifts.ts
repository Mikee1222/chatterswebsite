"use server";

import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  getBaseSchema,
  getSampleRecordFields,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { firstLinkedId, snapshotText, formulaLinkedContains } from "@/lib/airtable-linked";
import { formatRelativeTime } from "@/lib/format";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { isSupabaseBackend } from "@/lib/data-backend";
import type { Shift, ShiftModel } from "@/types";
import { devLog } from "@/lib/dev-log";

const SHIFTS_TABLE = "shifts";

/** Discover exact status field name from Airtable (case-sensitive). Cached for process lifetime. */
let cachedStatusFieldName: string | null = null;

async function getShiftsStatusFieldName(): Promise<string> {
  if (cachedStatusFieldName) return cachedStatusFieldName;
  try {
    const schema = await getBaseSchema();
    const shiftsTable = schema.tables?.find((t) => t.name === "shifts" || t.name === "Shifts");
    const statusField = shiftsTable?.fields?.find((f) => f.name.toLowerCase() === "status");
    if (statusField?.name) {
      cachedStatusFieldName = statusField.name;
      if (process.env.NODE_ENV !== "production") {
        devLog("[shifts] status field from schema", {
          fieldName: cachedStatusFieldName,
          options: statusField.options?.choices?.map((c) => c.name),
        });
      }
      return cachedStatusFieldName;
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[shifts] getBaseSchema failed, using sample record", err);
    }
  }
  try {
    const sample = await getSampleRecordFields(SHIFTS_TABLE);
    if (sample) {
      const key = Object.keys(sample).find((k) => k.toLowerCase() === "status");
      if (key) {
        cachedStatusFieldName = key;
        if (process.env.NODE_ENV !== "production") {
          devLog("[shifts] status field from sample record", {
            fieldName: cachedStatusFieldName,
            value: sample[key],
          });
        }
        return cachedStatusFieldName;
      }
    }
  } catch (_) {
    // ignore
  }
  cachedStatusFieldName = "status";
  return cachedStatusFieldName;
}
const SHIFT_MODELS_TABLE = "shift_models";

type ShiftFields = {
  shift_id?: string;
  chatter?: string | string[];
  chatter_name?: string;
  week_start?: string;
  date?: string;
  scheduled_shift?: string;
  start_time?: string;
  end_time?: string;
  break_started_at?: string;
  break_reminder_at?: string;
  break_minutes?: number;
  paused_seconds?: number;
  worked_minutes?: number;
  status?: string;
  models_count?: number;
  total_minutes?: number;
  staff_role?: string;
  shift_type?: string;
  task_label?: string;
  total_hours_decimal?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

type ShiftModelFields = {
  shift_model_id?: string;
  shift?: string | string[];
  chatter?: string | string[];
  chatter_name?: string;
  model?: string | string[];
  model_name?: string;
  entered_at?: string;
  left_at?: string;
  status?: string;
  session_minutes?: number;
  notes?: string;
  created_at?: string;
};

/** Read status from record fields; Airtable may use "status" or "Status".
 * Single-select returns the choice display name, e.g. "On break" (with space), not "on_break". */
function getShiftStatus(f: Record<string, unknown>): Shift["status"] {
  const raw = (f.status ?? f["Status"] ?? "") as string;
  const v = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (v === "on_break") return "on_break";
  if (v === "completed") return "completed";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return "active";
}

/** Read break_started_at; Airtable may use different labels (e.g. "Break started at", "break_started_at"). */
function getBreakStartedAt(f: Record<string, unknown>): string | null {
  const direct =
    f.break_started_at ??
    f["Break started at"] ??
    f["break_started_at"] ??
    (f["Break start"] as string | undefined);
  if (direct != null && typeof direct === "string") {
    const s = String(direct).trim();
    if (s) return s;
  }
  const key = Object.keys(f).find(
    (k) => /break/i.test(k) && /start/i.test(k)
  );
  if (key) {
    const v = (f[key] as string | undefined);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Read break_reminder_at (ISO); Airtable may label e.g. "Break reminder at". */
function getBreakReminderAt(f: Record<string, unknown>): string | null {
  const direct =
    f.break_reminder_at ??
    f["Break reminder at"] ??
    f["break_reminder_at"] ??
    f["Break reminder"];
  if (direct != null && typeof direct === "string") {
    const s = String(direct).trim();
    if (s) return s;
  }
  const key = Object.keys(f).find((k) => /break/i.test(k) && /remind/i.test(k));
  if (key) {
    const v = f[key] as string | undefined;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Read break_minutes; Airtable may use "break_minutes" or "Break minutes". */
function getBreakMinutes(f: Record<string, unknown>): number {
  const v = f.break_minutes ?? f["Break minutes"] ?? f["break_minutes"];
  if (typeof v === "number" && !Number.isNaN(v)) return Math.max(0, v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return Math.max(0, n);
  }
  return 0;
}

function mapShift(rec: AirtableRecord<ShiftFields>): Shift {
  const f = rec.fields as unknown as Record<string, unknown>;
  const break_started_at = getBreakStartedAt(f);
  const break_reminder_at = getBreakReminderAt(f);
  let status = getShiftStatus(f);
  if (status === "active" && break_started_at) status = "on_break";
  return {
    id: rec.id,
    shift_id: (f.shift_id ?? "") as string,
    chatter_id: firstLinkedId(f.chatter) ?? "",
    chatter_name: snapshotText(f.chatter_name),
    week_start: (f.week_start ?? "") as string,
    date: (f.date ?? "") as string,
    scheduled_shift: (f.scheduled_shift ?? "") as string,
    start_time: (f.start_time as string | null) ?? null,
    end_time: (f.end_time as string | null) ?? null,
    break_started_at,
    break_reminder_at,
    break_minutes: getBreakMinutes(f),
    paused_seconds: ((): number => {
      const v = f.paused_seconds ?? f["Paused seconds"] ?? f["paused_seconds"];
      if (typeof v === "number" && !Number.isNaN(v)) return Math.max(0, Math.floor(v));
      if (typeof v === "string") {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) return Math.max(0, n);
      }
      return 0;
    })(),
    /** Base may omit worked_minutes; derive from total_minutes when absent. */
    worked_minutes: ((): number | null => {
      const w = f.worked_minutes;
      if (typeof w === "number" && !Number.isNaN(w)) return w;
      const t = f.total_minutes;
      if (typeof t === "number" && !Number.isNaN(t)) return t;
      return null;
    })(),
    status,
    models_count: (f.models_count as number) ?? 0,
    total_minutes: (f.total_minutes as number | null) ?? null,
    staff_role: (f.staff_role as Shift["staff_role"]) ?? "chatter",
    shift_type: (f.shift_type as Shift["shift_type"]) ?? "chatting",
    task_label: (f.task_label ?? "") as string,
    total_hours_decimal: (f.total_hours_decimal as number | null) ?? null,
    notes: (f.notes ?? "") as string,
    created_at: (f.created_at ?? "") as string,
    updated_at: (f.updated_at ?? "") as string,
  };
}

function mapShiftModel(rec: AirtableRecord<ShiftModelFields>): ShiftModel {
  const f = rec.fields;
  return {
    id: rec.id,
    shift_model_id: f.shift_model_id ?? "",
    shift_id: firstLinkedId(f.shift) ?? "",
    chatter_id: firstLinkedId(f.chatter) ?? "",
    chatter_name: snapshotText(f.chatter_name),
    model_id: firstLinkedId(f.model) ?? "",
    model_name: snapshotText(f.model_name),
    entered_at: f.entered_at ?? null,
    left_at: f.left_at ?? null,
    status: f.status ?? "",
    session_minutes: f.session_minutes ?? null,
    notes: f.notes ?? "",
    created_at: f.created_at ?? "",
  };
}

export async function listShifts(params: ListParams & { filterByFormula?: string } = {}) {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).listShifts();
  const { records, offset } = await listRecords<ShiftFields>(SHIFTS_TABLE, params);
  return { shifts: records.map(mapShift), offset };
}

export async function listAllShifts(filterByFormula?: string, caller = "shifts.listAllShifts") {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).listAllShifts(filterByFormula, caller);
  const records = await listAllRecords<ShiftFields>(
    SHIFTS_TABLE,
    filterByFormula ? { filterByFormula, _caller: caller } : { _caller: caller }
  );
  return records.map(mapShift);
}

/** Resolved Airtable status column name (case-sensitive) for formula filters. */
export async function getShiftStatusFieldName(): Promise<string> {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).getShiftStatusFieldName();
  return getShiftsStatusFieldName();
}

export async function getActiveShifts(staffRole?: "chatter" | "virtual_assistant") {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).getActiveShifts(staffRole);
  const statusField = await getShiftsStatusFieldName();
  const statusPart = `OR({${statusField}} = "active", {${statusField}} = "on_break")`;
  const formula = staffRole
    ? `AND(${statusPart}, {staff_role} = "${staffRole.replace(/"/g, '""')}")`
    : statusPart;
  return listAllShifts(formula);
}

/** Active/on-break chatter shifts that include this model (via `shift_models.model`, session not left). */
export async function getActiveShiftsWithModel(modelId: string): Promise<Shift[]> {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).getActiveShiftsWithModel(modelId);
  const trimmed = modelId.trim();
  if (!trimmed) return [];
  const activeShifts = await getActiveShifts("chatter");
  if (activeShifts.length === 0) return [];
  const shiftModels = await listShiftModelsForShifts(activeShifts.map((s) => s.id));
  const shiftIdsWithModel = new Set(
    shiftModels
      .filter((sm) => sm.model_id === trimmed && !sm.left_at)
      .map((sm) => sm.shift_id)
  );
  return activeShifts.filter((s) => shiftIdsWithModel.has(s.id));
}

/** Chatter user ids with an open `shift_models` row for this model (`left_at` empty). */
export async function getChatterIdsFromOpenShiftModels(modelId: string): Promise<string[]> {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).getChatterIdsFromOpenShiftModels(modelId);
  }
  const trimmed = modelId.trim();
  if (!trimmed) return [];
  const records = await listAllRecords<ShiftModelFields>(SHIFT_MODELS_TABLE, {
    _caller: "shifts.getChatterIdsFromOpenShiftModels",
  });
  const ids = new Set<string>();
  for (const rec of records) {
    const sm = mapShiftModel(rec as AirtableRecord<ShiftModelFields>);
    if (sm.model_id === trimmed && !sm.left_at && sm.chatter_id.trim()) {
      ids.add(sm.chatter_id.trim());
    }
  }
  return [...ids];
}

/** All currently live shifts (chatter + VA). For live-shifts page. */
export async function getLiveShifts(): Promise<Shift[]> {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).getLiveShifts();
  const statusField = await getShiftsStatusFieldName();
  const formula = `OR({${statusField}} = "active", {${statusField}} = "on_break")`;
  return listAllShifts(formula, "shifts.getLiveShifts");
}

/** Shifts currently on break (for break-reminder cron). */
export async function listShiftsOnBreak(): Promise<Shift[]> {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).listShiftsOnBreak();
  const statusField = await getShiftsStatusFieldName();
  const formula = `{${statusField}} = "on_break"`;
  return listAllShifts(formula, "shifts.listShiftsOnBreak");
}

/** Shifts that fall in the given month (yearMonth = "YYYY-MM"). Uses date field. */
export async function getShiftsForMonth(yearMonth: string): Promise<Shift[]> {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).getShiftsForMonth(yearMonth);
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return [];
  const start = `${yearMonth}-01`;
  const endDate = new Date(`${yearMonth}-01T12:00:00.000Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  endDate.setUTCDate(0);
  const end = endDate.toISOString().split("T")[0];
  const formula = `AND(DATESTR({date}) >= "${start}", DATESTR({date}) <= "${end}")`;
  return listAllShifts(formula, "shifts.getShiftsForMonth");
}

/**
 * Shifts for a single calendar date (YYYY-MM-DD).
 * For “today” on the server, pass {@link getTodayYmdAthens} so DATESTR matches Greece (UTC+3) day.
 */
export async function getShiftsForDate(dateYmd: string): Promise<Shift[]> {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).getShiftsForDate(dateYmd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return [];
  const formula = `DATESTR({date}) = "${dateYmd.replace(/"/g, '""')}"`;
  return listAllShifts(formula, "shifts.getShiftsForDate");
}

export { getTodayYmdAthens };

/** Shifts where chatter linked field contains chatterRecordId (users table record id). Uses linked relation, not text snapshot. */
export async function getShiftsByChatter(chatterRecordId: string, staffRole?: "chatter" | "virtual_assistant") {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).getShiftsByChatter(chatterRecordId, staffRole);
  }
  const formula = formulaLinkedContains("chatter", chatterRecordId);
  const shifts = await listAllShifts(formula);
  if (staffRole) return shifts.filter((s) => s.staff_role === staffRole);
  return shifts;
}

/** Active (active or on_break) shift for this user and role. Used for chatter shift and VA mistake shift. */
export async function getActiveShiftByStaff(
  userRecordId: string,
  staffRole: "chatter" | "virtual_assistant"
): Promise<Shift | null> {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).getActiveShiftByStaff(userRecordId, staffRole);
  }
  const statusField = await getShiftsStatusFieldName();
  const statusPart = `OR({${statusField}} = "active", {${statusField}} = "on_break")`;
  const formula = `AND(${statusPart}, {staff_role} = "${staffRole.replace(/"/g, '""')}")`;
  const shifts = await listAllShifts(formula, "shifts.getActiveShiftByStaff");
  const found = shifts.find((s) => s.chatter_id === userRecordId) ?? null;
  if (process.env.NODE_ENV !== "production" && found) {
    devLog("[getActiveShiftByStaff]", { userRecordId, staffRole, shiftId: found.id });
  }
  return found;
}

export async function getShiftById(recordId: string): Promise<Shift | null> {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).getShiftById(recordId);
  try {
    const rec = await getRecord<ShiftFields>(SHIFTS_TABLE, recordId);
    return mapShift(rec);
  } catch {
    return null;
  }
}

export async function getActiveShiftByChatter(chatterRecordId: string) {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).getActiveShiftByChatter(chatterRecordId);
  }
  return getActiveShiftByStaff(chatterRecordId, "chatter");
}

/**
 * Normalize session / API user id to the Airtable `users` record id linked on `shifts.chatter`.
 * Accepts `rec…` ids or stable `user_…` primary-field values.
 */
export async function resolveShiftChatterRecordId(userIdOrRecordId: string): Promise<string | null> {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).resolveShiftChatterRecordId(userIdOrRecordId);
  }
  const trimmed = userIdOrRecordId.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("rec")) return trimmed;
  try {
    const { getUserByUserId, getUserByAirtableId } = await import("@/services/users");
    const byUserId = await getUserByUserId(trimmed);
    if (byUserId?.id) return byUserId.id;
    const byRec = await getUserByAirtableId(trimmed);
    return byRec?.id ?? null;
  } catch {
    return null;
  }
}

/** Active VA tasks shift for this user (`shift_type` = task). */
export async function getActiveVaTaskShift(userRecordId: string): Promise<Shift | null> {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).getActiveVaTaskShift(userRecordId);
  }
  const { selectPreferredVaTaskShift } = await import("./shifts-supabase");
  const chatterRecordId = await resolveShiftChatterRecordId(userRecordId);
  if (!chatterRecordId) return null;
  const shifts = await getActiveShifts("virtual_assistant");
  return selectPreferredVaTaskShift(
    shifts.filter((s) => s.chatter_id === chatterRecordId),
  );
}

export async function listOpenVaTaskShiftsForChatter(chatterRecordId: string): Promise<Shift[]> {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).listOpenVaTaskShiftsForChatter(chatterRecordId);
  }
  const shifts = await getActiveShifts("virtual_assistant");
  return shifts.filter(
    (s) =>
      s.chatter_id === chatterRecordId &&
      (s.shift_type === "task" || s.shift_type === "va_tasks"),
  );
}

export async function closeOtherOpenVaTaskShifts(
  chatterRecordId: string,
  keepShiftId: string,
): Promise<number> {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).closeOtherOpenVaTaskShifts(
      chatterRecordId,
      keepShiftId,
    );
  }
  const open = await listOpenVaTaskShiftsForChatter(chatterRecordId);
  const keep = open.find((s) => s.id === keepShiftId) ?? null;
  const keepStart = keep?.start_time?.trim() || "";
  const keepHealthy =
    !!keep && keep.status === "active" && !keep.break_started_at?.trim();
  const endIso = new Date().toISOString();
  let closed = 0;
  for (const s of open) {
    if (s.id === keepShiftId) continue;
    const sPaused = s.status === "on_break" || Boolean(s.break_started_at?.trim());
    if (!(keepHealthy && sPaused)) {
      const sStart = s.start_time?.trim() || "";
      if (keepStart && sStart && sStart > keepStart) continue;
    }
    await updateShift(s.id, {
      status: "completed",
      end_time: endIso,
      break_started_at: null,
      break_reminder_at: null,
    });
    closed += 1;
  }
  return closed;
}

export type ShiftWriteFields = Partial<{
  shift_id: string;
  chatter: string[];
  chatter_name: string;
  week_start: string;
  date: string;
  scheduled_shift: string;
  start_time: string;
  end_time: string;
  status: string;
  /** Empty string or null clears the open pause/break timestamp. */
  break_started_at: string | null;
  break_reminder_at: string | null;
  break_minutes: number;
  paused_seconds: number;
  staff_role: string;
  shift_type: string;
  task_label: string;
  notes: string;
  models_count: number;
  total_minutes: number;
  total_hours_decimal: number;
  updated_at: string;
}>;

export async function createShift(fields: ShiftWriteFields) {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).createShift(fields);
  const rec = await createRecord(SHIFTS_TABLE, fields as Record<string, unknown>) as AirtableRecord<ShiftFields>;
  if (process.env.NODE_ENV !== "production") {
    const f = rec.fields;
    devLog("[createShift] created record", {
      airtableRecordId: rec.id,
      shift_id: f.shift_id,
      chatterLinkedFieldValue: f.chatter,
      chatter_name: f.chatter_name,
      start_time: f.start_time,
      end_time: f.end_time ?? "(empty)",
      status: f.status,
      break_minutes: f.break_minutes,
    });
  }
  return mapShift(rec);
}

export async function updateShift(recordId: string, fields: Partial<ShiftWriteFields>) {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).updateShift(recordId, fields);
  const rec = await updateRecord(SHIFTS_TABLE, recordId, fields as Partial<ShiftFields>);
  return mapShift(rec as AirtableRecord<ShiftFields>);
}

/** Shift models for this shift. No formula (linked-field formula can 422); fetch and filter in code. */
export async function listShiftModels(shiftRecordId: string) {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).listShiftModels(shiftRecordId);
  const records = await listAllRecords<ShiftModelFields>(SHIFT_MODELS_TABLE, {});
  const filtered = records.filter((r) => {
    const raw = (r.fields as Record<string, unknown>).shift ?? (r.fields as Record<string, unknown>).Shift;
    const ids = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return ids.includes(shiftRecordId);
  });
  return filtered.map((r) => mapShiftModel(r as AirtableRecord<ShiftModelFields>));
}

export async function getShiftModelById(recordId: string): Promise<ShiftModel | null> {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).getShiftModelById(recordId);
  try {
    const { getRecord } = await import("@/lib/airtable-server");
    const rec = await getRecord<ShiftModelFields>(SHIFT_MODELS_TABLE, recordId);
    return mapShiftModel(rec as AirtableRecord<ShiftModelFields>);
  } catch {
    return null;
  }
}

/** Single bulk read: shift_models linked to any of the given shift record IDs. */
export async function listShiftModelsForShifts(shiftRecordIds: string[]): Promise<ShiftModel[]> {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).listShiftModelsForShifts(shiftRecordIds);
  }
  if (shiftRecordIds.length === 0) return [];
  const set = new Set(shiftRecordIds);
  const records = await listAllRecords<ShiftModelFields>(SHIFT_MODELS_TABLE, {
    _caller: "shifts.listShiftModelsForShifts",
  });
  const filtered = records.filter((r) => {
    const raw = (r.fields as Record<string, unknown>).shift ?? (r.fields as Record<string, unknown>).Shift;
    const ids = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);
    return ids.some((id) => set.has(id));
  });
  return filtered.map((r) => mapShiftModel(r as AirtableRecord<ShiftModelFields>));
}

export async function getActiveShiftModels(shiftRecordId: string) {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).getActiveShiftModels(shiftRecordId);
  }
  const all = await listShiftModels(shiftRecordId);
  return all.filter((sm) => !sm.left_at);
}

/** Batch active shift-model rows by shift id (avoids N+1 per-shift lookups). */
export async function getActiveShiftModelsForShiftIds(
  shiftIds: string[]
): Promise<Record<string, ShiftModel[]>> {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).getActiveShiftModelsForShiftIds(shiftIds);
  }
  const normalized = Array.from(new Set(shiftIds.map((id) => id.trim()).filter(Boolean)));
  if (normalized.length === 0) return {};
  const all = await listShiftModelsForShifts(normalized);
  const byShiftId: Record<string, ShiftModel[]> = {};
  for (const shiftId of normalized) byShiftId[shiftId] = [];
  for (const sm of all) {
    if (sm.left_at || !sm.shift_id) continue;
    if (!byShiftId[sm.shift_id]) byShiftId[sm.shift_id] = [];
    byShiftId[sm.shift_id].push(sm);
  }
  return byShiftId;
}

export type ShiftModelWriteFields = Partial<{
  shift: string[];
  model: string[];
  model_name: string;
  chatter: string[];
  chatter_name: string;
  entered_at: string;
  left_at: string;
  status: string;
  session_minutes: number;
}>;

export async function createShiftModel(fields: ShiftModelWriteFields) {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).createShiftModel(fields);
  const rec = await createRecord(SHIFT_MODELS_TABLE, fields as Record<string, unknown>);
  return mapShiftModel(rec as AirtableRecord<ShiftModelFields>);
}

/** Batch-create shift_models (Airtable batch API or parallel Supabase inserts). */
export async function batchCreateShiftModels(
  rows: ShiftModelWriteFields[]
): Promise<{ id: string }[]> {
  if (rows.length === 0) return [];
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).batchCreateShiftModels(rows);
  }
  const { batchCreateRecords } = await import("@/lib/airtable-server");
  const created = await batchCreateRecords(SHIFT_MODELS_TABLE, rows as Record<string, unknown>[]);
  return created.map((r) => ({ id: r.id }));
}

export async function updateShiftModel(recordId: string, fields: Partial<ShiftModelWriteFields>) {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).updateShiftModel(recordId, fields);
  }
  const rec = await updateRecord(SHIFT_MODELS_TABLE, recordId, fields as Partial<ShiftModelFields>);
  return mapShiftModel(rec as AirtableRecord<ShiftModelFields>);
}

/** Batch-update shift_models (Airtable batch API or parallel Supabase updates). */
export async function batchUpdateShiftModels(
  updates: { id: string; fields: Partial<ShiftModelWriteFields> }[]
): Promise<void> {
  if (updates.length === 0) return;
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).batchUpdateShiftModels(updates);
  }
  const { batchUpdateRecords } = await import("@/lib/airtable-server");
  await batchUpdateRecords(
    SHIFT_MODELS_TABLE,
    updates.map((u) => ({ id: u.id, fields: u.fields as Record<string, unknown> }))
  );
}

export async function deleteShiftModel(recordId: string): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./shifts-supabase")).deleteShiftModel(recordId);
  }
  const { deleteRecord } = await import("@/lib/airtable-server");
  await deleteRecord(SHIFT_MODELS_TABLE, recordId);
}

export type LastAssignmentInfo = {
  date: string;
  dateTime: string;
  relative: string;
};

/**
 * Returns the last assignment date for each (chatterId, modelId) pair from historical shifts + shift_models.
 * Uses two bulk reads (shift_models, shifts) then computes max date per pair.
 */
export async function getLastAssignmentBatch(
  pairs: { chatterId: string; modelId: string }[]
): Promise<Record<string, LastAssignmentInfo>> {
  if (isSupabaseBackend()) return (await import("./shifts-supabase")).getLastAssignmentBatch(pairs);
  if (pairs.length === 0) return {};
  const pairsSet = new Set(pairs.map((p) => `${p.chatterId}:${p.modelId}`));
  const [shiftModelRecords, shiftRecords] = await Promise.all([
    listAllRecords<ShiftModelFields>(SHIFT_MODELS_TABLE, { _caller: "shifts.getLastAssignmentBatch_shift_models" }),
    listAllRecords<ShiftFields>(SHIFTS_TABLE, { _caller: "shifts.getLastAssignmentBatch_shifts" }),
  ]);
  const shiftIdToInfo: Record<string, { date: string; dateTime: string }> = {};
  for (const rec of shiftRecords as AirtableRecord<ShiftFields>[]) {
    const f = rec.fields;
    const date = (f.date ?? "") as string;
    const start = f.start_time as string | undefined;
    const dateTime = date && start && String(start).length >= 16 ? `${date}T${String(start).slice(11, 19)}` : date ? `${date}T12:00:00.000Z` : "";
    shiftIdToInfo[rec.id] = { date, dateTime };
  }
  const result: Record<string, LastAssignmentInfo> = {};
  for (const rec of shiftModelRecords as AirtableRecord<ShiftModelFields>[]) {
    const f = rec.fields;
    const shiftId = firstLinkedId(f.shift) ?? "";
    const chatterId = firstLinkedId(f.chatter) ?? "";
    const modelId = firstLinkedId(f.model) ?? "";
    const key = `${chatterId}:${modelId}`;
    if (!pairsSet.has(key) || !shiftId) continue;
    const info = shiftIdToInfo[shiftId];
    if (!info?.date) continue;
    const existing = result[key];
    if (!existing || info.date > existing.date) {
      result[key] = {
        date: info.date,
        dateTime: info.dateTime,
        relative: formatRelativeTime(info.dateTime),
      };
    }
  }
  return result;
}
