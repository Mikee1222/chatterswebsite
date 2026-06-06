import {
  listAllRecords,
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";

const TABLE = "fines_and_bonuses";

export const SPIN_WHEEL_REASON_PREFIX = "Spin wheel reward:";
const SPIN_WHEEL_NOTES_SPIN_ID_MARKER = "Spin ID:";

export type FineBonusUserRole = "chatter" | "va";
export type FineBonusType = "bonus" | "fine";
export type FineBonusCategory = "extra_revenue" | "standard";
export type FineBonusReviewStatus = "pending_review" | "approved" | "rejected";
export type FineBonusSource = "chatter_submission" | "admin" | "spin_wheel";
export type FineBonusPaymentMethod = "PayPal" | "Revolut" | "Other";

export interface FineBonusRecord {
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
}

export type FinesBonusesListFilters = {
  user_id?: string;
  type?: FineBonusType;
  month?: string;
  source?: FineBonusSource;
  status?: FineBonusReviewStatus;
};

function escapeFormulaString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function mapRecord(rec: AirtableRecord<Record<string, unknown>>): FineBonusRecord {
  const f = rec.fields;
  const role = f.user_role === "va" ? "va" : "chatter";
  const typ = f.type === "fine" ? "fine" : "bonus";
  const rawAmount = f.amount;
  const amount =
    typeof rawAmount === "number"? rawAmount
      : typeof rawAmount === "string"? Number.parseFloat(rawAmount) || 0
        : Number(rawAmount ?? 0);
  return {
    id: rec.id,
    entry_id: String(f.entry_id ?? rec.id),
    user_id: String(f.user_id ?? ""),
    user_name: String(f.user_name ?? ""),
    user_role: role,
    type: typ,
    amount: Number.isFinite(amount) ? amount : 0,
    reason: String(f.reason ?? ""),
    notes: String(f.notes ?? ""),
    month: String(f.month ?? "").trim(),
    admin_id: String(f.admin_id ?? ""),
    admin_name: String(f.admin_name ?? ""),
    created_at: String(f.created_at ?? ""),
    category: (f.category === "extra_revenue" ? "extra_revenue" : f.category === "standard" ? "standard" : "") as FineBonusRecord["category"],
    status: (f.status === "pending_review" || f.status === "approved" || f.status === "rejected"
      ? f.status
      : "") as FineBonusRecord["status"],
    source: (f.source === "chatter_submission" || f.source === "admin" || f.source === "spin_wheel"
      ? f.source
      : "") as FineBonusRecord["source"],
    payment_method: (f.payment_method === "PayPal" || f.payment_method === "Revolut" || f.payment_method === "Other"
      ? f.payment_method
      : "") as FineBonusRecord["payment_method"],
    payment_source: typeof f.payment_source === "string" ? f.payment_source : "",
    model_id: typeof f.model_id === "string" ? f.model_id : "",
    model_name: typeof f.model_name === "string" ? f.model_name : "",
    screenshot_url: typeof f.screenshot_url === "string" ? f.screenshot_url : "",
  };
}

function buildListFormula(filters: FinesBonusesListFilters): string | undefined {
  const parts: string[] = [];
  if (filters.user_id?.trim()) {
    parts.push(`{user_id} = "${escapeFormulaString(filters.user_id.trim())}"`);
  }
  if (filters.type === "bonus" || filters.type === "fine") {
    parts.push(`{type} = "${filters.type}"`);
  }
  if (filters.month?.trim()) {
    parts.push(`{month} = "${escapeFormulaString(filters.month.trim())}"`);
  }
  if (filters.source === "chatter_submission" || filters.source === "admin" || filters.source === "spin_wheel") {
    parts.push(`{source} = "${filters.source}"`);
  }
  if (filters.status === "pending_review" || filters.status === "approved" || filters.status === "rejected") {
    parts.push(`{status} = "${filters.status}"`);
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return `AND(${parts.join(",")})`;
}

function isVisibleToChatter(entry: FineBonusRecord): boolean {
  if (entry.source === "chatter_submission" && entry.status !== "approved") return false;
  return true;
}

export async function getFinesBonusesForUser(userId: string): Promise<FineBonusRecord[]> {
  const id = userId.trim();
  if (!id) return [];
  const records = await listAllRecords<Record<string, unknown>>(TABLE, {
    filterByFormula: `{user_id} = "${escapeFormulaString(id)}"`,
    sort: [{ field: "created_at", direction: "desc" }],
    _caller: "getFinesBonusesForUser",
  });
  return records
    .map((r) => mapRecord(r as AirtableRecord<Record<string, unknown>>))
    .filter(isVisibleToChatter);
}

export async function listFinesBonuses(filters: FinesBonusesListFilters = {}): Promise<FineBonusRecord[]> {
  const formula = buildListFormula(filters);
  const records = await listAllRecords<Record<string, unknown>>(TABLE, {
    ...(formula ? { filterByFormula: formula, _caller: "listFinesBonuses" } : { _caller: "listFinesBonuses_all" }),
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map((r) => mapRecord(r as AirtableRecord<Record<string, unknown>>));
}

export type CreateFineBonusInput = {
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

export type CreateExtraRevenueInput = {
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
};

export function isSpinWheelFineBonus(entry: Pick<FineBonusRecord, "reason" | "notes" | "source">): boolean {
  if (entry.source === "spin_wheel") return true;
  if (entry.reason.toLowerCase().includes("spin wheel")) return true;
  return entry.notes.includes(SPIN_WHEEL_NOTES_SPIN_ID_MARKER);
}

export function isChatterExtraRevenueSubmission(
  entry: Pick<FineBonusRecord, "source" | "category">
): boolean {
  return entry.source === "chatter_submission" || entry.category === "extra_revenue";
}

export function isPendingExtraRevenueReview(entry: FineBonusRecord): boolean {
  return isChatterExtraRevenueSubmission(entry) && entry.status === "pending_review";
}

export async function hasFineBonusForSpin(spinId: string): Promise<boolean> {
  const id = spinId.trim();
  if (!id) return false;
  const { records } = await listRecords<Record<string, unknown>>(TABLE, {
    filterByFormula: `FIND("${escapeFormulaString(id)}", {notes})`,
    pageSize: 1,
    _caller: "hasFineBonusForSpin",
  });
  return records.length > 0;
}

export type CreateSpinWheelCashBonusInput = {
  spinId: string;
  /** ISO timestamp from spin_wheel_spins.created_at — determines bonus month. */
  spinCreatedAt?: string;
  user_id: string;
  user_name: string;
  prize_label: string;
  amount: number;
  admin_id: string;
  admin_name: string;
};

/** Creates a fines_and_bonuses row for a paid cash spin; skips if one already exists for this spin. */
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

  const created = await createRecord<Record<string, unknown>>(TABLE, payload);
  return { id: created.id, record: mapRecord(created as AirtableRecord<Record<string, unknown>>) };
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
    screenshot_url: data.screenshot_url,
  });
}

export type UpdateFineBonusInput = {
  type?: FineBonusType;
  amount?: number;
  reason?: string;
  notes?: string;
  month?: string;
};

export async function updateFineBonus(recordId: string, data: UpdateFineBonusInput): Promise<FineBonusRecord> {
  const fields: Record<string, unknown> = {};
  if (data.type !== undefined) fields.type = data.type;
  if (data.amount !== undefined) {
    fields.amount = Math.round(Math.max(0, data.amount) * 100) / 100;
  }
  if (data.reason !== undefined) fields.reason = data.reason.trim();
  if (data.notes !== undefined) fields.notes = data.notes.trim();
  if (data.month !== undefined) fields.month = data.month.trim();
  const updated = await updateRecord<Record<string, unknown>>(TABLE, recordId, fields);
  return mapRecord(updated as AirtableRecord<Record<string, unknown>>);
}

export async function deleteFineBonus(recordId: string): Promise<void> {
  await deleteRecord(TABLE, recordId);
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
  };
  if (action === "reject" && rejectReason?.trim()) {
    fields.notes = rejectReason.trim();
  }
  const updated = await updateRecord<Record<string, unknown>>(TABLE, recordId, fields);
  return mapRecord(updated as AirtableRecord<Record<string, unknown>>);
}
