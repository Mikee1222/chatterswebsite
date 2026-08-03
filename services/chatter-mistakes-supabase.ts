/**
 * Supabase backend for services/chatter-mistakes.ts
 */
import {
  publicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import type {
  CreateMistakeInput,
  CreateReasonInput,
  MistakeAdminListFilters,
  MistakeAttachment,
  MistakeReasonCategory,
  MistakeReasonRecord,
  MistakeRecord,
  MistakeStatus,
} from "./chatter-mistakes";

const TABLE_MISTAKES = "chatter_mistakes";
const TABLE_REASONS = "mistake_reasons";

type ReasonRow = SbRow & {
  reason_id?: string | null;
  label?: string | null;
  category?: string | null;
  points_deduction?: number | string | null;
  active?: boolean | null;
  sort_order?: number | string | null;
};

type MistakeRow = SbRow & {
  mistake_id?: string | null;
  va_id?: string | null;
  va_name?: string | null;
  chatter_id?: string | null;
  chatter_name?: string | null;
  model_id?: string | null;
  model_name?: string | null;
  sub_username?: string | null;
  mistake_date?: string | null;
  reason_id?: string | null;
  reason_label?: string | null;
  reason_category?: string | null;
  explanation?: string | null;
  screenshot?: unknown;
  status?: string | null;
  admin_notes?: string | null;
  admin_id?: string | null;
  reviewed_at?: string | null;
  points_deducted?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function mapReason(row: ReasonRow): MistakeReasonRecord {
  const cat = row.category;
  const category: MistakeReasonCategory =
    cat === "Medium" || cat === "High" ? cat : "Low";
  return {
    id: publicId(row),
    reason_id: String(row.reason_id ?? publicId(row)),
    label: String(row.label ?? ""),
    category,
    points_deduction: Math.floor(Number(row.points_deduction ?? 0)),
    active: row.active === true,
    sort_order: Math.floor(Number(row.sort_order ?? 0)),
  };
}

function mapMistake(row: MistakeRow): MistakeRecord {
  const rawShot = row.screenshot;
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
  const rc = row.reason_category;
  const reason_category: MistakeReasonCategory =
    rc === "Medium" || rc === "High" ? rc : "Low";
  const st = row.status;
  const status: MistakeStatus =
    st === "approved" || st === "rejected" ? st : "pending";
  return {
    id: publicId(row),
    mistake_id: String(row.mistake_id ?? publicId(row)),
    va_id: String(row.va_id ?? ""),
    va_name: String(row.va_name ?? ""),
    chatter_id: String(row.chatter_id ?? ""),
    chatter_name: String(row.chatter_name ?? ""),
    model_id: String(row.model_id ?? ""),
    model_name: String(row.model_name ?? ""),
    sub_username: String(row.sub_username ?? ""),
    mistake_date: String(row.mistake_date ?? ""),
    reason_id: String(row.reason_id ?? ""),
    reason_label: String(row.reason_label ?? ""),
    reason_category,
    explanation: String(row.explanation ?? ""),
    screenshot,
    status,
    admin_notes: String(row.admin_notes ?? ""),
    admin_id: String(row.admin_id ?? ""),
    reviewed_at: row.reviewed_at != null && String(row.reviewed_at).trim() !== ""
      ? String(row.reviewed_at)
      : null,
    points_deducted: Math.floor(Number(row.points_deducted ?? 0)),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function getMistakeReasons(): Promise<MistakeReasonRecord[]> {
  const rows = await sbSelectAll<ReasonRow>(TABLE_REASONS);
  return rows
    .filter((r) => r.active === true)
    .map(mapReason)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getAllMistakeReasons(): Promise<MistakeReasonRecord[]> {
  const rows = await sbSelectAll<ReasonRow>(TABLE_REASONS);
  return rows.map(mapReason).sort((a, b) => a.sort_order - b.sort_order);
}

export async function getMistakeReasonByReasonId(reasonId: string): Promise<MistakeReasonRecord | null> {
  const id = reasonId.trim();
  if (!id) return null;
  const rows = await sbSelectAll<ReasonRow>(TABLE_REASONS);
  const hit = rows.find((r) => String(r.reason_id ?? "") === id);
  return hit ? mapReason(hit) : null;
}

export async function getActiveMistakeReasonByReasonId(reasonId: string): Promise<MistakeReasonRecord | null> {
  const r = await getMistakeReasonByReasonId(reasonId);
  return r?.active ? r : null;
}

export async function getMistakesByVA(vaId: string): Promise<MistakeRecord[]> {
  const id = vaId.trim();
  if (!id) return [];
  const rows = await sbSelectAll<MistakeRow>(TABLE_MISTAKES);
  return rows
    .filter((r) => String(r.va_id ?? "") === id)
    .map(mapMistake)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getMistakesByChatter(chatterId: string): Promise<MistakeRecord[]> {
  const id = chatterId.trim();
  if (!id) return [];
  const rows = await sbSelectAll<MistakeRow>(TABLE_MISTAKES);
  return rows
    .filter((r) => String(r.chatter_id ?? "") === id && String(r.status ?? "") === "approved")
    .map(mapMistake)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function mistakeDateMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export async function countPendingMistakes(): Promise<number> {
  try {
    const rows = await sbSelectAll<MistakeRow>(TABLE_MISTAKES);
    return rows.filter((r) => String(r.status ?? "") === "pending").length;
  } catch {
    return 0;
  }
}

export async function listMistakesForAdmin(filters: MistakeAdminListFilters): Promise<MistakeRecord[]> {
  const rows = await sbSelectAll<MistakeRow>(TABLE_MISTAKES);
  let mapped = rows.map(mapMistake);
  if (filters.status?.trim()) mapped = mapped.filter((m) => m.status === filters.status?.trim());
  if (filters.chatter_id?.trim()) mapped = mapped.filter((m) => m.chatter_id === filters.chatter_id?.trim());
  if (filters.model_id?.trim()) mapped = mapped.filter((m) => m.model_id === filters.model_id?.trim());
  if (filters.reason_category?.trim())
    mapped = mapped.filter((m) => m.reason_category === filters.reason_category?.trim());
  const from = filters.date_from?.trim();
  const to = filters.date_to?.trim();
  if (from) {
    const fromMs = new Date(`${from}T00:00:00.000Z`).getTime();
    if (Number.isFinite(fromMs)) {
      mapped = mapped.filter((r) => {
        const ms = mistakeDateMs(r.mistake_date);
        return Number.isFinite(ms) && ms >= fromMs;
      });
    }
  }
  if (to) {
    const toMs = new Date(`${to}T23:59:59.999Z`).getTime();
    if (Number.isFinite(toMs)) {
      mapped = mapped.filter((r) => {
        const ms = mistakeDateMs(r.mistake_date);
        return Number.isFinite(ms) && ms <= toMs;
      });
    }
  }
  return mapped.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getMistakeById(recordId: string): Promise<MistakeRecord | null> {
  const row = await sbSelectByPublicId<MistakeRow>(TABLE_MISTAKES, recordId);
  return row ? mapMistake(row) : null;
}

export async function createMistakeRow(
  input: CreateMistakeInput
): Promise<{ id: string; mistake_id: string }> {
  const mistake_id = `mistake_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const row = await sbInsert<MistakeRow>(TABLE_MISTAKES, {
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
  return { id: publicId(row), mistake_id };
}

export async function updateMistakeRow(
  recordId: string,
  fields: Record<string, unknown>
): Promise<MistakeRecord> {
  const now = new Date().toISOString();
  const row = await sbUpdateByPublicId<MistakeRow>(TABLE_MISTAKES, recordId, {
    ...fields,
    updated_at: now,
  });
  return mapMistake(row);
}

export async function createMistakeReason(input: CreateReasonInput): Promise<MistakeReasonRecord> {
  const reason_id =
    input.reason_id?.trim() ||
    `mr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const row = await sbInsert<ReasonRow>(TABLE_REASONS, {
    reason_id,
    label: input.label.trim(),
    category: input.category,
    points_deduction: Math.floor(input.points_deduction),
    active: input.active,
    sort_order: Math.floor(input.sort_order),
  });
  return mapReason(row);
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
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.label !== undefined) payload.label = fields.label;
  if (fields.category !== undefined) payload.category = fields.category;
  if (fields.points_deduction !== undefined) payload.points_deduction = Math.floor(fields.points_deduction);
  if (fields.active !== undefined) payload.active = fields.active;
  if (fields.sort_order !== undefined) payload.sort_order = Math.floor(fields.sort_order);
  const row = await sbUpdateByPublicId<ReasonRow>(TABLE_REASONS, recordId, payload);
  return mapReason(row);
}

export async function softDeleteMistakeReason(recordId: string): Promise<MistakeReasonRecord> {
  return updateMistakeReasonRow(recordId, { active: false });
}
