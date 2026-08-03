import {
  listAllRecords,
  listRecords,
  createRecord,
  updateRecord,
  getRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";

const TABLE_MISTAKES = "chatter_mistakes";
const TABLE_REASONS = "mistake_reasons";

export type MistakeReasonCategory = "Low" | "Medium" | "High";
export type MistakeStatus = "pending" | "approved" | "rejected";

export interface MistakeAttachment {
  url: string;
  filename?: string;
}

export interface MistakeRecord {
  id: string;
  mistake_id: string;
  va_id: string;
  va_name: string;
  chatter_id: string;
  chatter_name: string;
  model_id: string;
  model_name: string;
  sub_username: string;
  mistake_date: string;
  reason_id: string;
  reason_label: string;
  reason_category: MistakeReasonCategory;
  explanation: string;
  screenshot: MistakeAttachment[];
  status: MistakeStatus;
  admin_notes: string;
  admin_id: string;
  reviewed_at: string | null;
  points_deducted: number;
  created_at: string;
  updated_at: string;
}

export interface MistakeReasonRecord {
  id: string;
  reason_id: string;
  label: string;
  category: MistakeReasonCategory;
  points_deduction: number;
  active: boolean;
  sort_order: number;
}

export type MistakeAdminListFilters = {
  status?: string;
  chatter_id?: string;
  model_id?: string;
  reason_category?: string;
  date_from?: string;
  date_to?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function mapReason(rec: AirtableRecord<Record<string, unknown>>): MistakeReasonRecord {
  const f = rec.fields;
  const cat = f.category;
  const category: MistakeReasonCategory =
    cat === "Medium" || cat === "High" ? cat : "Low";
  return {
    id: rec.id,
    reason_id: String(f.reason_id ?? rec.id),
    label: String(f.label ?? ""),
    category,
    points_deduction: Math.floor(Number(f.points_deduction ?? 0)),
    active: f.active === true,
    sort_order: Math.floor(Number(f.sort_order ?? 0)),
  };
}

function mapMistake(rec: AirtableRecord<Record<string, unknown>>): MistakeRecord {
  const f = rec.fields;
  const rawShot = f.screenshot;
  let screenshot: MistakeAttachment[] = [];
  if (Array.isArray(rawShot)) {
    screenshot = rawShot
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
      .map((x) => ({
        url: String((x as { url?: string }).url ?? ""),
        filename: (x as { filename?: string }).filename,
      }))
      .filter((x) => x.url.length > 0);
  }
  const rc = f.reason_category;
  const reason_category: MistakeReasonCategory =
    rc === "Medium" || rc === "High" ? rc : "Low";
  const st = f.status;
  const status: MistakeStatus =
    st === "approved" || st === "rejected" ? st : "pending";
  const reviewed = f.reviewed_at;
  return {
    id: rec.id,
    mistake_id: String(f.mistake_id ?? rec.id),
    va_id: String(f.va_id ?? ""),
    va_name: String(f.va_name ?? ""),
    chatter_id: String(f.chatter_id ?? ""),
    chatter_name: String(f.chatter_name ?? ""),
    model_id: String(f.model_id ?? ""),
    model_name: String(f.model_name ?? ""),
    sub_username: String(f.sub_username ?? ""),
    mistake_date: String(f.mistake_date ?? ""),
    reason_id: String(f.reason_id ?? ""),
    reason_label: String(f.reason_label ?? ""),
    reason_category,
    explanation: String(f.explanation ?? ""),
    screenshot,
    status,
    admin_notes: String(f.admin_notes ?? ""),
    admin_id: String(f.admin_id ?? ""),
    reviewed_at: reviewed != null && String(reviewed).trim() !== "" ? String(reviewed) : null,
    points_deducted: Math.floor(Number(f.points_deducted ?? 0)),
    created_at: String(f.created_at ?? ""),
    updated_at: String(f.updated_at ?? ""),
  };
}

export async function getMistakeReasons(): Promise<MistakeReasonRecord[]> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).getMistakeReasons();
  const records = await listAllRecords<Record<string, unknown>>(TABLE_REASONS, {
    filterByFormula: "{active} = TRUE()",
    sort: [{ field: "sort_order", direction: "asc" }],
    _caller: "getMistakeReasons",
  });
  return records.map(mapReason);
}

export async function getAllMistakeReasons(): Promise<MistakeReasonRecord[]> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).getAllMistakeReasons();
  const records = await listAllRecords<Record<string, unknown>>(TABLE_REASONS, {
    sort: [{ field: "sort_order", direction: "asc" }],
    _caller: "getAllMistakeReasons",
  });
  return records.map(mapReason);
}

export async function getMistakeReasonByReasonId(reasonId: string): Promise<MistakeReasonRecord | null> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).getMistakeReasonByReasonId(reasonId);
  const id = reasonId.trim();
  if (!id) return null;
  const { records } = await listRecords<Record<string, unknown>>(TABLE_REASONS, {
    filterByFormula: `{reason_id} = "${escapeFormulaString(id)}"`,
    pageSize: 1,
    _caller: "getMistakeReasonByReasonId",
  });
  const first = records[0];
  return first ? mapReason(first as AirtableRecord<Record<string, unknown>>) : null;
}

/** Reason must exist and be active (VA submit). */
export async function getActiveMistakeReasonByReasonId(reasonId: string): Promise<MistakeReasonRecord | null> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).getActiveMistakeReasonByReasonId(reasonId);
  const r = await getMistakeReasonByReasonId(reasonId);
  if (!r?.active) return null;
  return r;
}

export async function getMistakesByVA(vaId: string): Promise<MistakeRecord[]> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).getMistakesByVA(vaId);
  const id = vaId.trim();
  if (!id) return [];
  const records = await listAllRecords<Record<string, unknown>>(TABLE_MISTAKES, {
    filterByFormula: `{va_id} = "${escapeFormulaString(id)}"`,
    sort: [{ field: "created_at", direction: "desc" }],
    _caller: "getMistakesByVA",
  });
  return records.map((r) => mapMistake(r as AirtableRecord<Record<string, unknown>>));
}

export async function getMistakesByChatter(chatterId: string): Promise<MistakeRecord[]> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).getMistakesByChatter(chatterId);
  const id = chatterId.trim();
  if (!id) return [];
  const records = await listAllRecords<Record<string, unknown>>(TABLE_MISTAKES, {
    filterByFormula: `AND({chatter_id} = "${escapeFormulaString(id)}", {status} = "approved")`,
    sort: [{ field: "created_at", direction: "desc" }],
    _caller: "getMistakesByChatter",
  });
  return records.map((r) => mapMistake(r as AirtableRecord<Record<string, unknown>>));
}

function buildAdminFilterFormula(filters: MistakeAdminListFilters): string | undefined {
  const parts: string[] = [];
  if (filters.status?.trim()) {
    parts.push(`{status} = "${escapeFormulaString(filters.status.trim())}"`);
  }
  if (filters.chatter_id?.trim()) {
    parts.push(`{chatter_id} = "${escapeFormulaString(filters.chatter_id.trim())}"`);
  }
  if (filters.model_id?.trim()) {
    parts.push(`{model_id} = "${escapeFormulaString(filters.model_id.trim())}"`);
  }
  if (filters.reason_category?.trim()) {
    parts.push(`{reason_category} = "${escapeFormulaString(filters.reason_category.trim())}"`);
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return `AND(${parts.join(",")})`;
}

function mistakeDateMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/** Unreviewed (pending) mistakes count for admin nav badge (fields-only read). */
export async function countPendingMistakes(): Promise<number> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).countPendingMistakes();
  try {
    const records = await listAllRecords<Record<string, unknown>>(TABLE_MISTAKES, {
      filterByFormula: `{status} = "pending"`,
      fields: ["status"],
      _caller: "countPendingMistakes",
    });
    return records.length;
  } catch {
    return 0;
  }
}

export async function listMistakesForAdmin(filters: MistakeAdminListFilters): Promise<MistakeRecord[]> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).listMistakesForAdmin(filters);
  const formula = buildAdminFilterFormula(filters);
  const records = await listAllRecords<Record<string, unknown>>(TABLE_MISTAKES, {
    ...(formula ? { filterByFormula: formula, _caller: "listMistakesForAdmin" } : { _caller: "listMistakesForAdmin_all" }),
    sort: [{ field: "created_at", direction: "desc" }],
  });
  let rows = records.map((r) => mapMistake(r as AirtableRecord<Record<string, unknown>>));
  const from = filters.date_from?.trim();
  const to = filters.date_to?.trim();
  if (from) {
    const fromMs = new Date(`${from}T00:00:00.000Z`).getTime();
    if (Number.isFinite(fromMs)) {
      rows = rows.filter((r) => {
        const ms = mistakeDateMs(r.mistake_date);
        return Number.isFinite(ms) && ms >= fromMs;
      });
    }
  }
  if (to) {
    const toMs = new Date(`${to}T23:59:59.999Z`).getTime();
    if (Number.isFinite(toMs)) {
      rows = rows.filter((r) => {
        const ms = mistakeDateMs(r.mistake_date);
        return Number.isFinite(ms) && ms <= toMs;
      });
    }
  }
  return rows;
}

export async function getMistakeById(recordId: string): Promise<MistakeRecord | null> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).getMistakeById(recordId);
  try {
    const rec = await getRecord<Record<string, unknown>>(TABLE_MISTAKES, recordId);
    return mapMistake(rec as AirtableRecord<Record<string, unknown>>);
  } catch {
    return null;
  }
}

export type CreateMistakeInput = {
  va_id: string;
  va_name: string;
  chatter_id: string;
  chatter_name: string;
  model_id: string;
  model_name: string;
  sub_username: string;
  mistake_date: string;
  reason_id: string;
  reason_label: string;
  reason_category: MistakeReasonCategory;
  explanation: string;
};

export async function createMistakeRow(input: CreateMistakeInput): Promise<{ id: string; mistake_id: string }> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).createMistakeRow(input);
  const mistake_id = `mistake_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const created = await createRecord<Record<string, unknown>>(TABLE_MISTAKES, {
    mistake_id,
    va_id: input.va_id,
    va_name: input.va_name,
    chatter_id: input.chatter_id,
    chatter_name: input.chatter_name,
    model_id: input.model_id,
    model_name: input.model_name,
    sub_username: input.sub_username,
    mistake_date: input.mistake_date,
    reason_id: input.reason_id,
    reason_label: input.reason_label,
    reason_category: input.reason_category,
    explanation: input.explanation,
    status: "pending",
    admin_notes: "",
    points_deducted: 0,
    created_at: now,
    updated_at: now,
  });
  return { id: created.id, mistake_id };
}

export async function uploadMistakeScreenshot(
  recordId: string,
  file: { name: string; type: string; bytes: Uint8Array }
): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./chatter-mistakes-supabase")).uploadMistakeScreenshot(recordId, file);
  }
  const { uploadAirtableAttachment } = await import("@/lib/airtable-upload-attachment");
  await uploadAirtableAttachment({
    recordId,
    fieldName: "screenshot",
    filename: file.name,
    contentType: file.type,
    bytes: file.bytes,
  });
}

export async function updateMistakeRow(recordId: string, fields: Record<string, unknown>): Promise<MistakeRecord> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).updateMistakeRow(recordId, fields);
  const now = new Date().toISOString();
  const updated = await updateRecord<Record<string, unknown>>(TABLE_MISTAKES, recordId, {
    ...fields,
    updated_at: now,
  });
  return mapMistake(updated as AirtableRecord<Record<string, unknown>>);
}

export type CreateReasonInput = {
  label: string;
  category: MistakeReasonCategory;
  points_deduction: number;
  active: boolean;
  sort_order: number;
  reason_id?: string;
};

export async function createMistakeReason(input: CreateReasonInput): Promise<MistakeReasonRecord> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).createMistakeReason(input);
  const reason_id =
    input.reason_id?.trim() ||
    `mr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const created = await createRecord<Record<string, unknown>>(TABLE_REASONS, {
    reason_id,
    label: input.label.trim(),
    category: input.category,
    points_deduction: Math.floor(input.points_deduction),
    active: input.active,
    sort_order: Math.floor(input.sort_order),
  });
  return mapReason(created as AirtableRecord<Record<string, unknown>>);
}

export async function updateMistakeReasonRow(
  recordId: string,
  fields: Partial<{
    label: string;
    category: MistakeReasonCategory;
    points_deduction: number;
    active: boolean;
    sort_order: number;
  }>
): Promise<MistakeReasonRecord> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).updateMistakeReasonRow(recordId, fields);
  const payload: Record<string, unknown> = {};
  if (fields.label !== undefined) payload.label = fields.label;
  if (fields.category !== undefined) payload.category = fields.category;
  if (fields.points_deduction !== undefined) payload.points_deduction = Math.floor(fields.points_deduction);
  if (fields.active !== undefined) payload.active = fields.active;
  if (fields.sort_order !== undefined) payload.sort_order = Math.floor(fields.sort_order);
  const updated = await updateRecord<Record<string, unknown>>(TABLE_REASONS, recordId, payload);
  return mapReason(updated as AirtableRecord<Record<string, unknown>>);
}

export async function softDeleteMistakeReason(recordId: string): Promise<MistakeReasonRecord> {
  if (isSupabaseBackend()) return (await import("./chatter-mistakes-supabase")).softDeleteMistakeReason(recordId);
  return updateMistakeReasonRow(recordId, { active: false });
}
