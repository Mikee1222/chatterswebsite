/**
 * Supabase backend for services/fines-bonuses.ts
 */

import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";

const SPIN_WHEEL_REASON_PREFIX = "Spin wheel reward:";
const SPIN_WHEEL_NOTES_SPIN_ID_MARKER = "Spin ID:";

type FineBonusUserRole = "chatter" | "va";
type FineBonusType = "bonus" | "fine";
type FineBonusCategory = "extra_revenue" | "standard";
type FineBonusReviewStatus = "pending_review" | "approved" | "rejected";
type FineBonusSource = "chatter_submission" | "admin" | "spin_wheel";
type FineBonusPaymentMethod = "PayPal" | "Revolut" | "Other";

type FineBonusRecord = {
  id: string;
  entry_id: string;
  user_id: string;
  user_name: string;
  user_role: FineBonusUserRole;
  type: FineBonusType;
  amount: number;
  reason: string;
  notes: string;
  month: string;
  admin_id: string;
  admin_name: string;
  created_at: string;
  category?: FineBonusCategory | "";
  status?: FineBonusReviewStatus | "";
  source?: FineBonusSource | "";
  payment_method?: FineBonusPaymentMethod | "";
  payment_source?: string;
  model_id?: string;
  model_name?: string;
  screenshot_url?: string;
  sub_username?: string;
};

type FinesBonusesListFilters = {
  user_id?: string;
  type?: FineBonusType;
  month?: string;
  source?: FineBonusSource;
  status?: FineBonusReviewStatus;
};

type CreateFineBonusInput = {
  user_id: string;
  user_name: string;
  user_role: FineBonusUserRole;
  type: FineBonusType;
  amount: number;
  reason: string;
  notes: string;
  month: string;
  admin_id: string;
  admin_name: string;
};

type CreateExtraRevenueInput = {
  user_id: string;
  user_name: string;
  model_id: string;
  model_name: string;
  amount: number;
  payment_method: FineBonusPaymentMethod;
  payment_source?: string;
  screenshot_url: string;
  notes?: string;
  month: string;
  sub_username: string;
};

type CreateSpinWheelCashBonusInput = {
  spinId: string;
  spinCreatedAt?: string;
  user_id: string;
  user_name: string;
  prize_label: string;
  amount: number;
  admin_id: string;
  admin_name: string;
};

type UpdateFineBonusInput = {
  type?: FineBonusType;
  amount?: number;
  reason?: string;
  notes?: string;
  month?: string;
};

type Row = SbRow & {
  entry_id?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  user_role?: string | null;
  type?: string | null;
  amount?: number | null;
  reason?: string | null;
  notes?: string | null;
  month?: string | null;
  admin_id?: string | null;
  admin_name?: string | null;
  created_at?: string | null;
  category?: string | null;
  status?: string | null;
  source?: string | null;
  payment_method?: string | null;
  payment_source?: string | null;
  model_id?: string | null;
  model_name?: string | null;
  screenshot_url?: string | null;
  sub_username?: string | null;
};

const TABLE = "fines_and_bonuses";

function mapRow(row: Row): FineBonusRecord {
  const role: FineBonusUserRole = row.user_role === "va" ? "va" : "chatter";
  const typ: FineBonusType = row.type === "fine" ? "fine" : "bonus";
  const amount = Number(row.amount ?? 0);
  return {
    id: publicId(row),
    entry_id: String(row.entry_id ?? publicId(row)),
    user_id: String(row.user_id ?? ""),
    user_name: String(row.user_name ?? ""),
    user_role: role,
    type: typ,
    amount: Number.isFinite(amount) ? amount : 0,
    reason: String(row.reason ?? ""),
    notes: String(row.notes ?? ""),
    month: String(row.month ?? "").trim(),
    admin_id: String(row.admin_id ?? ""),
    admin_name: String(row.admin_name ?? ""),
    created_at: String(row.created_at ?? ""),
    category: (row.category === "extra_revenue"
      ? "extra_revenue"
      : row.category === "standard"
        ? "standard"
        : "") as FineBonusRecord["category"],
    status: (row.status === "pending_review" ||
    row.status === "approved" ||
    row.status === "rejected"
      ? row.status
      : "") as FineBonusRecord["status"],
    source: (row.source === "chatter_submission" ||
    row.source === "admin" ||
    row.source === "spin_wheel"
      ? row.source
      : "") as FineBonusRecord["source"],
    payment_method: (row.payment_method === "PayPal" ||
    row.payment_method === "Revolut" ||
    row.payment_method === "Other"
      ? row.payment_method
      : "") as FineBonusRecord["payment_method"],
    payment_source: typeof row.payment_source === "string" ? row.payment_source : "",
    model_id: typeof row.model_id === "string" ? row.model_id : "",
    model_name: typeof row.model_name === "string" ? row.model_name : "",
    screenshot_url: typeof row.screenshot_url === "string" ? row.screenshot_url : "",
    sub_username: typeof row.sub_username === "string" ? row.sub_username : "",
  };
}

function isVisibleToChatter(entry: FineBonusRecord): boolean {
  if (entry.source === "chatter_submission" && entry.status !== "approved") return false;
  return true;
}

function matchesFilters(entry: FineBonusRecord, filters: FinesBonusesListFilters): boolean {
  if (filters.user_id?.trim() && entry.user_id !== filters.user_id.trim()) return false;
  if (filters.type && entry.type !== filters.type) return false;
  if (filters.month?.trim() && entry.month !== filters.month.trim()) return false;
  if (filters.source && entry.source !== filters.source) return false;
  if (filters.status && entry.status !== filters.status) return false;
  return true;
}

export async function getFinesBonusesForUser(userId: string): Promise<FineBonusRecord[]> {
  const id = userId.trim();
  if (!id) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  return rows
    .map(mapRow)
    .filter((r) => r.user_id === id)
    .filter(isVisibleToChatter)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function listFinesBonuses(
  filters: FinesBonusesListFilters = {}
): Promise<FineBonusRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return rows
    .map(mapRow)
    .filter((r) => matchesFilters(r, filters))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function countPendingReviewFinesBonuses(): Promise<number> {
  try {
    const rows = await sbSelectAll<Row>(TABLE);
    return rows.map(mapRow).filter((r) => r.status === "pending_review").length;
  } catch {
    return 0;
  }
}

export async function hasFineBonusForSpin(spinId: string): Promise<boolean> {
  const id = spinId.trim();
  if (!id) return false;
  const rows = await sbSelectAll<Row>(TABLE);
  return rows.some((r) => String(r.notes ?? "").includes(id));
}

export async function createFineBonus(
  data: CreateFineBonusInput & {
    category?: FineBonusCategory;
    status?: FineBonusReviewStatus;
    source?: FineBonusSource;
    payment_method?: FineBonusPaymentMethod;
    payment_source?: string;
    model_id?: string;
    model_name?: string;
    screenshot_url?: string;
    sub_username?: string;
  }
): Promise<{ id: string; record: FineBonusRecord }> {
  const entry_id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const created_at = new Date().toISOString();
  const amount = Math.round(Math.max(0, data.amount) * 100) / 100;
  const payload: Record<string, unknown> = {
    entry_id,
    user_id: data.user_id.trim(),
    user_name: data.user_name.trim(),
    user_role: data.user_role,
    type: data.type,
    amount,
    reason: data.reason.trim(),
    notes: (data.notes ?? "").trim(),
    month: data.month.trim(),
    admin_id: data.admin_id.trim(),
    admin_name: data.admin_name.trim(),
    created_at,
  };
  if (data.category) payload.category = data.category;
  if (data.status) payload.status = data.status;
  if (data.source) payload.source = data.source;
  if (data.payment_method) payload.payment_method = data.payment_method;
  if (data.payment_source?.trim()) payload.payment_source = data.payment_source.trim();
  if (data.model_id?.trim()) payload.model_id = data.model_id.trim();
  if (data.model_name?.trim()) payload.model_name = data.model_name.trim();
  if (data.screenshot_url?.trim()) payload.screenshot_url = data.screenshot_url.trim();
  if (data.sub_username?.trim()) payload.sub_username = data.sub_username.trim();

  const created = await sbInsert<Row>(TABLE, payload);
  const record = mapRow(created);
  return { id: record.id, record };
}

export async function createSpinWheelCashBonus(
  data: CreateSpinWheelCashBonusInput
): Promise<{ id: string; record: FineBonusRecord } | null> {
  if (await hasFineBonusForSpin(data.spinId)) return null;
  const spinDate = data.spinCreatedAt ? new Date(data.spinCreatedAt) : new Date();
  const month = `${spinDate.getFullYear()}-${String(spinDate.getMonth() + 1).padStart(2, "0")}`;
  return createFineBonus({
    user_id: data.user_id,
    user_name: data.user_name,
    user_role: "chatter",
    type: "bonus",
    amount: data.amount,
    reason: `${SPIN_WHEEL_REASON_PREFIX} ${data.prize_label.trim() || "prize"}`,
    notes: `Auto-created from spin wheel. ${SPIN_WHEEL_NOTES_SPIN_ID_MARKER} ${data.spinId.trim()}`,
    month,
    admin_id: data.admin_id,
    admin_name: data.admin_name,
    source: "spin_wheel",
    status: "approved",
  });
}

export async function createExtraRevenueSubmission(
  data: CreateExtraRevenueInput
): Promise<{ id: string; record: FineBonusRecord }> {
  const paymentLabel =
    data.payment_method === "Other" && data.payment_source?.trim()
      ? data.payment_source.trim()
      : data.payment_method;
  return createFineBonus({
    user_id: data.user_id,
    user_name: data.user_name,
    user_role: "chatter",
    type: "bonus",
    amount: data.amount,
    reason: `Extra revenue - ${data.model_name.trim()} via ${paymentLabel}`,
    notes: (data.notes ?? "").trim(),
    month: data.month.trim(),
    admin_id: "",
    admin_name: "Pending review",
    category: "extra_revenue",
    status: "pending_review",
    source: "chatter_submission",
    payment_method: data.payment_method,
    payment_source: data.payment_source?.trim() ?? "",
    model_id: data.model_id,
    model_name: data.model_name,
    sub_username: data.sub_username,
    screenshot_url: data.screenshot_url,
  });
}

export async function updateFineBonus(
  recordId: string,
  data: UpdateFineBonusInput
): Promise<FineBonusRecord> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.type !== undefined) fields.type = data.type;
  if (data.amount !== undefined) {
    fields.amount = Math.round(Math.max(0, data.amount) * 100) / 100;
  }
  if (data.reason !== undefined) fields.reason = data.reason.trim();
  if (data.notes !== undefined) fields.notes = data.notes.trim();
  if (data.month !== undefined) fields.month = data.month.trim();
  const updated = await sbUpdateByPublicId<Row>(TABLE, recordId, fields);
  return mapRow(updated);
}

export async function deleteFineBonus(recordId: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, recordId);
}

export async function reviewExtraRevenueSubmission(
  recordId: string,
  action: "approve" | "reject",
  admin: { admin_id: string; admin_name: string },
  rejectReason?: string
): Promise<FineBonusRecord> {
  const fields: Record<string, unknown> = {
    status: action === "approve" ? "approved" : "rejected",
    admin_id: admin.admin_id,
    admin_name: admin.admin_name,
    updated_at: new Date().toISOString(),
  };
  if (action === "reject" && rejectReason?.trim()) {
    fields.notes = rejectReason.trim();
  }
  const updated = await sbUpdateByPublicId<Row>(TABLE, recordId, fields);
  return mapRow(updated);
}
