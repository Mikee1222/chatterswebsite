/**
 * Supabase backend for services/shifts.ts (DATA_BACKEND=supabase).
 */

import { formatRelativeTime } from "@/lib/format";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { devLog } from "@/lib/dev-log";
import {
  publicId,
  sbDeleteByPublicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import type { Shift, ShiftModel } from "@/types";

const SHIFTS_TABLE = "shifts";
const SHIFT_MODELS_TABLE = "shift_models";

type ShiftRow = SbRow & {
  shift_id?: string | null;
  chatter?: string[] | null;
  chatter_name?: string | null;
  week_start?: string | null;
  date?: string | null;
  scheduled_shift?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  break_started_at?: string | null;
  break_reminder_at?: string | null;
  break_minutes?: number | null;
  worked_minutes?: number | null;
  status?: string | null;
  models_count?: number | null;
  total_minutes?: number | null;
  staff_role?: string | null;
  shift_type?: string | null;
  task_label?: string | null;
  total_hours_decimal?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ShiftModelRow = SbRow & {
  shift_model_id?: string | null;
  shift?: string[] | null;
  chatter?: string[] | null;
  chatter_name?: string | null;
  model?: string[] | null;
  model_name?: string | null;
  entered_at?: string | null;
  left_at?: string | null;
  status?: string | null;
  session_minutes?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

function getShiftStatus(raw: unknown): Shift["status"] {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (v === "on_break") return "on_break";
  if (v === "completed") return "completed";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return "active";
}

async function mapShift(row: ShiftRow): Promise<Shift> {
  const break_started_at = row.break_started_at?.trim() || null;
  const break_reminder_at = row.break_reminder_at?.trim() || null;
  let status = getShiftStatus(row.status);
  if (status === "active" && break_started_at) status = "on_break";
  const worked =
    typeof row.worked_minutes === "number" && !Number.isNaN(Number(row.worked_minutes))
      ? Number(row.worked_minutes)
      : typeof row.total_minutes === "number" && !Number.isNaN(Number(row.total_minutes))
        ? Number(row.total_minutes)
        : null;
  return {
    id: publicId(row),
    shift_id: row.shift_id ?? "",
    chatter_id: (await sbFirstLinkedAirtableId("users", row.chatter)) ?? "",
    chatter_name: row.chatter_name ?? "",
    week_start: row.week_start ?? "",
    date: row.date ?? "",
    scheduled_shift: row.scheduled_shift ?? "",
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    break_started_at,
    break_reminder_at,
    break_minutes:
      typeof row.break_minutes === "number" && !Number.isNaN(Number(row.break_minutes))
        ? Math.max(0, Number(row.break_minutes))
        : 0,
    worked_minutes: worked,
    status,
    models_count: Number(row.models_count ?? 0),
    total_minutes:
      typeof row.total_minutes === "number" && !Number.isNaN(Number(row.total_minutes))
        ? Number(row.total_minutes)
        : null,
    staff_role: (row.staff_role as Shift["staff_role"]) ?? "chatter",
    shift_type: (row.shift_type as Shift["shift_type"]) ?? "chatting",
    task_label: row.task_label ?? "",
    total_hours_decimal:
      typeof row.total_hours_decimal === "number" && !Number.isNaN(Number(row.total_hours_decimal))
        ? Number(row.total_hours_decimal)
        : null,
    notes: row.notes ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

async function mapShiftModel(row: ShiftModelRow): Promise<ShiftModel> {
  return {
    id: publicId(row),
    shift_model_id: row.shift_model_id ?? "",
    shift_id: (await sbFirstLinkedAirtableId("shifts", row.shift)) ?? "",
    chatter_id: (await sbFirstLinkedAirtableId("users", row.chatter)) ?? "",
    chatter_name: row.chatter_name ?? "",
    model_id: (await sbFirstLinkedAirtableId("modelss", row.model)) ?? "",
    model_name: row.model_name ?? "",
    entered_at: row.entered_at ?? null,
    left_at: row.left_at ?? null,
    status: row.status ?? "",
    session_minutes:
      typeof row.session_minutes === "number" && !Number.isNaN(Number(row.session_minutes))
        ? Number(row.session_minutes)
        : null,
    notes: row.notes ?? "",
    created_at: row.created_at ?? "",
  };
}

export async function listShifts(): Promise<{ shifts: Shift[]; offset?: string }> {
  const rows = await sbSelectAll<ShiftRow>(SHIFTS_TABLE);
  return { shifts: await Promise.all(rows.map(mapShift)) };
}

export async function listAllShifts(
  filterByFormula?: string,
  _caller = "shifts.listAllShifts"
): Promise<Shift[]> {
  void _caller;
  let rows = await sbSelectAll<ShiftRow>(SHIFTS_TABLE);
  if (filterByFormula) {
    const f = filterByFormula;
    // Common formulas used by the Airtable service — filter in memory.
    const wantsActive =
      f.includes('"active"') && f.includes('"on_break"') && f.includes("OR");
    const wantsOnBreakOnly = /=\s*"on_break"/.test(f) && !f.includes('"active"');
    const staffMatch = f.match(/\{staff_role\}\s*=\s*"([^"]+)"/);
    const dateEq = f.match(/DATESTR\(\{date\}\)\s*=\s*"(\d{4}-\d{2}-\d{2})"/);
    const dateGte = f.match(/DATESTR\(\{date\}\)\s*>=\s*"(\d{4}-\d{2}-\d{2})"/);
    const dateLte = f.match(/DATESTR\(\{date\}\)\s*<=\s*"(\d{4}-\d{2}-\d{2})"/);

    rows = rows.filter((r) => {
      const status = getShiftStatus(r.status);
      const effective =
        status === "active" && r.break_started_at?.trim() ? "on_break" : status;
      if (wantsOnBreakOnly && effective !== "on_break") return false;
      if (wantsActive && effective !== "active" && effective !== "on_break") return false;
      if (staffMatch && (r.staff_role ?? "") !== staffMatch[1]) return false;
      if (dateEq && (r.date ?? "") !== dateEq[1]) return false;
      if (dateGte && (r.date ?? "") < dateGte[1]) return false;
      if (dateLte && (r.date ?? "") > dateLte[1]) return false;
      return true;
    });
  }
  return Promise.all(rows.map(mapShift));
}

export async function getShiftStatusFieldName(): Promise<string> {
  return "status";
}

export async function getActiveShifts(staffRole?: "chatter" | "virtual_assistant") {
  const shifts = await listAllShifts(
    staffRole
      ? `AND(OR({status} = "active", {status} = "on_break"), {staff_role} = "${staffRole}")`
      : `OR({status} = "active", {status} = "on_break")`
  );
  return shifts;
}

export async function getActiveShiftsWithModel(modelId: string): Promise<Shift[]> {
  const trimmed = modelId.trim();
  if (!trimmed) return [];
  const activeShifts = await getActiveShifts("chatter");
  if (activeShifts.length === 0) return [];
  const shiftModels = await listShiftModelsForShifts(activeShifts.map((s) => s.id));
  const shiftIdsWithModel = new Set(
    shiftModels.filter((sm) => sm.model_id === trimmed && !sm.left_at).map((sm) => sm.shift_id)
  );
  return activeShifts.filter((s) => shiftIdsWithModel.has(s.id));
}

export async function getChatterIdsFromOpenShiftModels(modelId: string): Promise<string[]> {
  const trimmed = modelId.trim();
  if (!trimmed) return [];
  const rows = await sbSelectAll<ShiftModelRow>(SHIFT_MODELS_TABLE);
  const mapped = await Promise.all(rows.map(mapShiftModel));
  const ids = new Set<string>();
  for (const sm of mapped) {
    if (sm.model_id === trimmed && !sm.left_at && sm.chatter_id.trim()) {
      ids.add(sm.chatter_id.trim());
    }
  }
  return [...ids];
}

export async function getLiveShifts(): Promise<Shift[]> {
  return getActiveShifts();
}

export async function listShiftsOnBreak(): Promise<Shift[]> {
  return listAllShifts(`{status} = "on_break"`);
}

export async function getShiftsForMonth(yearMonth: string): Promise<Shift[]> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return [];
  const start = `${yearMonth}-01`;
  const endDate = new Date(`${yearMonth}-01T12:00:00.000Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  endDate.setUTCDate(0);
  const end = endDate.toISOString().split("T")[0];
  return listAllShifts(`AND(DATESTR({date}) >= "${start}", DATESTR({date}) <= "${end}")`);
}

export async function getShiftsForDate(dateYmd: string): Promise<Shift[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return [];
  return listAllShifts(`DATESTR({date}) = "${dateYmd}"`);
}

export { getTodayYmdAthens };

export async function getShiftsByChatter(
  chatterRecordId: string,
  staffRole?: "chatter" | "virtual_assistant"
) {
  const all = await listAllShifts();
  const shifts = all.filter((s) => s.chatter_id === chatterRecordId);
  if (staffRole) return shifts.filter((s) => s.staff_role === staffRole);
  return shifts;
}

export async function getActiveShiftByStaff(
  userRecordId: string,
  staffRole: "chatter" | "virtual_assistant"
): Promise<Shift | null> {
  const shifts = await getActiveShifts(staffRole);
  return shifts.find((s) => s.chatter_id === userRecordId) ?? null;
}

export async function getShiftById(recordId: string): Promise<Shift | null> {
  const row = await sbSelectByPublicId<ShiftRow>(SHIFTS_TABLE, recordId);
  if (!row) return null;
  return mapShift(row);
}

export async function getActiveShiftByChatter(chatterRecordId: string) {
  return getActiveShiftByStaff(chatterRecordId, "chatter");
}

export async function resolveShiftChatterRecordId(userIdOrRecordId: string): Promise<string | null> {
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

export async function getActiveVaTaskShift(userRecordId: string): Promise<Shift | null> {
  const chatterRecordId = await resolveShiftChatterRecordId(userRecordId);
  if (!chatterRecordId) return null;
  const shifts = await getActiveShifts("virtual_assistant");
  return (
    shifts.find(
      (s) =>
        s.chatter_id === chatterRecordId &&
        (s.shift_type === "task" || s.shift_type === "va_tasks")
    ) ?? null
  );
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
  break_reminder_at: string;
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

async function shiftWriteToPg(fields: ShiftWriteFields): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = { ...fields };
  if (fields.chatter !== undefined) {
    patch.chatter = await sbUuidsForAirtableIds("users", fields.chatter);
  }
  return patch;
}

export async function createShift(fields: ShiftWriteFields) {
  const row = await shiftWriteToPg(fields);
  row.created_at = row.created_at ?? new Date().toISOString();
  row.updated_at = new Date().toISOString();
  const created = await sbInsert<ShiftRow>(SHIFTS_TABLE, row);
  if (process.env.NODE_ENV !== "production") {
    devLog("[createShift/supabase] created", { id: publicId(created), shift_id: created.shift_id });
  }
  return mapShift(created);
}

export async function updateShift(recordId: string, fields: Partial<ShiftWriteFields>) {
  const patch = await shiftWriteToPg(fields);
  patch.updated_at = new Date().toISOString();
  const updated = await sbUpdateByPublicId<ShiftRow>(SHIFTS_TABLE, recordId, patch);
  return mapShift(updated);
}

export async function listShiftModels(shiftRecordId: string) {
  return (await listShiftModelsForShifts([shiftRecordId]));
}

export async function getShiftModelById(recordId: string): Promise<ShiftModel | null> {
  const row = await sbSelectByPublicId<ShiftModelRow>(SHIFT_MODELS_TABLE, recordId);
  if (!row) return null;
  return mapShiftModel(row);
}

export async function listShiftModelsForShifts(shiftRecordIds: string[]): Promise<ShiftModel[]> {
  if (shiftRecordIds.length === 0) return [];
  const set = new Set(shiftRecordIds);
  const rows = await sbSelectAll<ShiftModelRow>(SHIFT_MODELS_TABLE);
  const mapped = await Promise.all(rows.map(mapShiftModel));
  return mapped.filter((sm) => set.has(sm.shift_id));
}

export async function getActiveShiftModels(shiftRecordId: string) {
  const all = await listShiftModels(shiftRecordId);
  return all.filter((sm) => !sm.left_at);
}

export async function getActiveShiftModelsForShiftIds(
  shiftIds: string[]
): Promise<Record<string, ShiftModel[]>> {
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

async function shiftModelWriteToPg(fields: ShiftModelWriteFields): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = { ...fields };
  if (fields.shift !== undefined) {
    patch.shift = await sbUuidsForAirtableIds("shifts", fields.shift);
  }
  if (fields.model !== undefined) {
    patch.model = await sbUuidsForAirtableIds("modelss", fields.model);
  }
  if (fields.chatter !== undefined) {
    patch.chatter = await sbUuidsForAirtableIds("users", fields.chatter);
  }
  return patch;
}

export async function createShiftModel(fields: ShiftModelWriteFields) {
  const row = await shiftModelWriteToPg(fields);
  row.created_at = new Date().toISOString();
  const created = await sbInsert<ShiftModelRow>(SHIFT_MODELS_TABLE, row);
  return mapShiftModel(created);
}

export async function batchCreateShiftModels(
  rows: ShiftModelWriteFields[]
): Promise<{ id: string }[]> {
  if (rows.length === 0) return [];
  const created = await Promise.all(rows.map((fields) => createShiftModel(fields)));
  return created.map((r) => ({ id: r.id }));
}

export async function updateShiftModel(recordId: string, fields: Partial<ShiftModelWriteFields>) {
  const patch = await shiftModelWriteToPg(fields);
  const updated = await sbUpdateByPublicId<ShiftModelRow>(SHIFT_MODELS_TABLE, recordId, patch);
  return mapShiftModel(updated);
}

export async function batchUpdateShiftModels(
  updates: { id: string; fields: Partial<ShiftModelWriteFields> }[]
): Promise<void> {
  if (updates.length === 0) return;
  await Promise.all(updates.map((u) => updateShiftModel(u.id, u.fields)));
}

export async function deleteShiftModel(recordId: string): Promise<void> {
  await sbDeleteByPublicId(SHIFT_MODELS_TABLE, recordId);
}

export type LastAssignmentInfo = {
  date: string;
  dateTime: string;
  relative: string;
};

export async function getLastAssignmentBatch(
  pairs: { chatterId: string; modelId: string }[]
): Promise<Record<string, LastAssignmentInfo>> {
  if (pairs.length === 0) return {};
  const pairsSet = new Set(pairs.map((p) => `${p.chatterId}:${p.modelId}`));
  const [shiftModels, shifts] = await Promise.all([
    sbSelectAll<ShiftModelRow>(SHIFT_MODELS_TABLE),
    sbSelectAll<ShiftRow>(SHIFTS_TABLE),
  ]);
  const mappedShifts = await Promise.all(shifts.map(mapShift));
  const shiftIdToInfo: Record<string, { date: string; dateTime: string }> = {};
  for (const s of mappedShifts) {
    const date = s.date ?? "";
    const start = s.start_time ?? undefined;
    const dateTime =
      date && start && String(start).length >= 16
        ? `${date}T${String(start).slice(11, 19)}`
        : date
          ? `${date}T12:00:00.000Z`
          : "";
    shiftIdToInfo[s.id] = { date, dateTime };
  }
  const mappedSms = await Promise.all(shiftModels.map(mapShiftModel));
  const result: Record<string, LastAssignmentInfo> = {};
  for (const sm of mappedSms) {
    const key = `${sm.chatter_id}:${sm.model_id}`;
    if (!pairsSet.has(key) || !sm.shift_id) continue;
    const info = shiftIdToInfo[sm.shift_id];
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
