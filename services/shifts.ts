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
import type { Shift, ShiftModel } from "@/types";

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
        console.log("[shifts] status field from schema", {
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
          console.log("[shifts] status field from sample record", {
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
  break_minutes?: number;
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
    break_minutes: getBreakMinutes(f),
    worked_minutes: (f.worked_minutes as number | null) ?? null,
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
  const { records, offset } = await listRecords<ShiftFields>(SHIFTS_TABLE, params);
  return { shifts: records.map(mapShift), offset };
}

export async function listAllShifts(filterByFormula?: string, caller = "shifts.listAllShifts") {
  const records = await listAllRecords<ShiftFields>(
    SHIFTS_TABLE,
    filterByFormula ? { filterByFormula, _caller: caller } : {}
  );
  return records.map(mapShift);
}

export async function getActiveShifts(staffRole?: "chatter" | "virtual_assistant") {
  const statusField = await getShiftsStatusFieldName();
  const statusPart = `OR({${statusField}} = "active", {${statusField}} = "on_break")`;
  const formula = staffRole
    ? `AND(${statusPart}, {staff_role} = "${staffRole.replace(/"/g, '""')}")`
    : statusPart;
  return listAllShifts(formula);
}

/** All currently live shifts (chatter + VA). For live-shifts page. */
export async function getLiveShifts(): Promise<Shift[]> {
  const statusField = await getShiftsStatusFieldName();
  const formula = `OR({${statusField}} = "active", {${statusField}} = "on_break")`;
  return listAllShifts(formula, "shifts.getLiveShifts");
}

/** Shifts that fall in the given month (yearMonth = "YYYY-MM"). Uses date field. */
export async function getShiftsForMonth(yearMonth: string): Promise<Shift[]> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return [];
  const start = `${yearMonth}-01`;
  const endDate = new Date(`${yearMonth}-01T12:00:00.000Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  endDate.setUTCDate(0);
  const end = endDate.toISOString().split("T")[0];
  const formula = `AND(DATESTR({date}) >= "${start}", DATESTR({date}) <= "${end}")`;
  return listAllShifts(formula, "shifts.getShiftsForMonth");
}

/** Shifts where chatter linked field contains chatterRecordId (users table record id). Uses linked relation, not text snapshot. */
export async function getShiftsByChatter(chatterRecordId: string, staffRole?: "chatter" | "virtual_assistant") {
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
  const statusField = await getShiftsStatusFieldName();
  const statusPart = `OR({${statusField}} = "active", {${statusField}} = "on_break")`;
  const formula = `AND(${statusPart}, {staff_role} = "${staffRole.replace(/"/g, '""')}")`;
  const shifts = await listAllShifts(formula, "shifts.getActiveShiftByStaff");
  const found = shifts.find((s) => s.chatter_id === userRecordId) ?? null;
  if (process.env.NODE_ENV !== "production" && found) {
    console.log("[getActiveShiftByStaff]", { userRecordId, staffRole, shiftId: found.id });
  }
  return found;
}

export async function getShiftById(recordId: string): Promise<Shift | null> {
  try {
    const rec = await getRecord<ShiftFields>(SHIFTS_TABLE, recordId);
    return mapShift(rec);
  } catch {
    return null;
  }
}

export async function getActiveShiftByChatter(chatterRecordId: string) {
  return getActiveShiftByStaff(chatterRecordId, "chatter");
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
  break_started_at: string;
  break_minutes: number;
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
  const rec = await createRecord(SHIFTS_TABLE, fields as Record<string, unknown>) as AirtableRecord<ShiftFields>;
  if (process.env.NODE_ENV !== "production") {
    const f = rec.fields;
    console.log("[createShift] created record", {
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
  const rec = await updateRecord(SHIFTS_TABLE, recordId, fields as Partial<ShiftFields>);
  return mapShift(rec as AirtableRecord<ShiftFields>);
}

/** Shift models for this shift. No formula (linked-field formula can 422); fetch and filter in code. */
export async function listShiftModels(shiftRecordId: string) {
  const records = await listAllRecords<ShiftModelFields>(SHIFT_MODELS_TABLE, {});
  const filtered = records.filter((r) => {
    const raw = (r.fields as Record<string, unknown>).shift ?? (r.fields as Record<string, unknown>).Shift;
    const ids = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return ids.includes(shiftRecordId);
  });
  return filtered.map((r) => mapShiftModel(r as AirtableRecord<ShiftModelFields>));
}

export async function getActiveShiftModels(shiftRecordId: string) {
  const all = await listShiftModels(shiftRecordId);
  return all.filter((sm) => !sm.left_at);
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
  const rec = await createRecord(SHIFT_MODELS_TABLE, fields as Record<string, unknown>);
  return mapShiftModel(rec as AirtableRecord<ShiftModelFields>);
}

export async function updateShiftModel(recordId: string, fields: Partial<ShiftModelWriteFields>) {
  const rec = await updateRecord(SHIFT_MODELS_TABLE, recordId, fields as Partial<ShiftModelFields>);
  return mapShiftModel(rec as AirtableRecord<ShiftModelFields>);
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
