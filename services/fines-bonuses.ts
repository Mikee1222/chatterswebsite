import {
  listAllRecords,
  listRecords,
  createRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";

const TABLE = "fines_and_bonuses";

export const SPIN_WHEEL_REASON_PREFIX = "Spin wheel reward:";
const SPIN_WHEEL_NOTES_SPIN_ID_MARKER = "Spin ID:";

export type FineBonusUserRole = "chatter" | "va";
export type FineBonusType = "bonus" | "fine";

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
}

export type FinesBonusesListFilters = {
  user_id?: string;
  type?: FineBonusType;
  month?: string;
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
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return `AND(${parts.join(",")})`;
}

export async function getFinesBonusesForUser(userId: string): Promise<FineBonusRecord[]> {
  const id = userId.trim();
  if (!id) return [];
  const records = await listAllRecords<Record<string, unknown>>(TABLE, {
    filterByFormula: `{user_id} = "${escapeFormulaString(id)}"`,
    sort: [{ field: "created_at", direction: "desc" }],
    _caller: "getFinesBonusesForUser",
  });
  return records.map((r) => mapRecord(r as AirtableRecord<Record<string, unknown>>));
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

export function isSpinWheelFineBonus(entry: Pick<FineBonusRecord, "reason" | "notes">): boolean {
  if (entry.reason.toLowerCase().includes("spin wheel")) return true;
  return entry.notes.includes(SPIN_WHEEL_NOTES_SPIN_ID_MARKER);
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
  });
}

export async function createFineBonus(data: CreateFineBonusInput): Promise<{ id: string; record: FineBonusRecord }> {
  const entry_id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const created_at = new Date().toISOString();
  const amount = Math.round(Math.max(0, data.amount) * 100) / 100;
  const created = await createRecord<Record<string, unknown>>(TABLE, {
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
  });
  return { id: created.id, record: mapRecord(created as AirtableRecord<Record<string, unknown>>) };
}
