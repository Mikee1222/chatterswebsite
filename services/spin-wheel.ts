import {
  createRecord,
  deleteRecord,
  getRecord,
  listAllRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import { listAllUsers } from "@/services/users";

const PRIZES = "spin_wheel_prizes";
const SPINS = "spin_wheel_spins";

export type SpinPrizeRow = {
  id: string;
  label: string;
  prize_type: string;
  prize_value: string;
  probability: number;
  color: string;
  active: boolean;
  /** Display order on wheel / admin list; lower comes first. */
  sort_order: number;
};

type PrizeFields = {
  label?: string;
  prize_type?: string;
  prize_value?: string;
  probability?: number;
  active?: boolean;
  color?: string;
  sort_order?: number;
};

function mapPrize(rec: AirtableRecord<PrizeFields>): SpinPrizeRow {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    label: String(f.label ?? "").trim() || "Prize",
    prize_type: String(f.prize_type ?? "mystery").trim(),
    prize_value: String(f.prize_value ?? "").trim(),
    probability: Math.max(0, Math.floor(Number(f.probability ?? 0))),
    color: String(f.color ?? "#8b5cf6").trim() || "#8b5cf6",
    active: Boolean(f.active),
    sort_order: Math.max(0, Math.floor(Number(f.sort_order ?? 0))),
  };
}

/** All prize rows for admin CRUD (active and inactive). */
export async function getAllSpinPrizes(): Promise<SpinPrizeRow[]> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).getAllSpinPrizes();
  const records = await listAllRecords<PrizeFields>(PRIZES, { _caller: "spin-wheel.getAllSpinPrizes" });
  return records
    .map((r) => mapPrize(r as AirtableRecord<PrizeFields>))
    .sort((a, b) =>
      a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.label.localeCompare(b.label),
    );
}

/** Active prizes, ordered by sort_order then label so server and wheel UI stay aligned. */
export async function getActiveSpinPrizes(): Promise<SpinPrizeRow[]> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).getActiveSpinPrizes();
  const records = await listAllRecords<PrizeFields>(PRIZES, { _caller: "spin-wheel.getActiveSpinPrizes" });
  return records
    .map((r) => mapPrize(r as AirtableRecord<PrizeFields>))
    .filter((p) => p.active)
    .sort((a, b) =>
      a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.label.localeCompare(b.label),
    );
}

export type SpinHistoryRow = {
  id: string;
  user_id: string;
  prize_id: string;
  prize_label: string;
  created_at: string;
  claimed: boolean;
  claim_note: string;
};

type SpinFields = {
  user_id?: string;
  prize_id?: string;
  prize_label?: string;
  created_at?: string;
  claimed?: boolean;
  claim_note?: string;
};

function mapSpin(rec: AirtableRecord<SpinFields>): SpinHistoryRow {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    user_id: String(f.user_id ?? "").trim(),
    prize_id: String(f.prize_id ?? "").trim(),
    prize_label: String(f.prize_label ?? "").trim(),
    created_at: String(f.created_at ?? "").trim(),
    claimed: Boolean(f.claimed),
    claim_note: String(f.claim_note ?? "").trim(),
  };
}

export async function getRecentSpinsForUser(userId: string, limit = 12): Promise<SpinHistoryRow[]> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).getRecentSpinsForUser(userId, limit);
  if (!userId.trim()) return [];
  const all = await listAllRecords<SpinFields>(SPINS, { _caller: "spin-wheel.getRecentSpinsForUser" });
  const mine = all
    .filter((r) => String((r.fields as SpinFields)?.user_id ?? "").trim() === userId.trim())
    .sort((a, b) => {
      const ta = new Date(String((a.fields as SpinFields)?.created_at ?? "")).getTime();
      const tb = new Date(String((b.fields as SpinFields)?.created_at ?? "")).getTime();
      return tb - ta;
    })
    .slice(0, limit)
    .map((r) => mapSpin(r as AirtableRecord<SpinFields>));
  return mine;
}

export type AdminSpinRow = SpinHistoryRow & {
  chatter_name: string;
  prize_type: string;
  prize_value: string;
};

export async function getAllSpinsForAdmin(): Promise<AdminSpinRow[]> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).getAllSpinsForAdmin();
  const [spins, prizes, users] = await Promise.all([
    listAllRecords<SpinFields>(SPINS, { _caller: "spin-wheel.getAllSpinsForAdmin" }),
    listAllRecords<PrizeFields>(PRIZES, { _caller: "spin-wheel.getAllSpinsForAdmin.prizes" }),
    listAllUsers().catch(() => []),
  ]);
  const prizeById = new Map<string, SpinPrizeRow>();
  for (const r of prizes) {
    const p = mapPrize(r as AirtableRecord<PrizeFields>);
    prizeById.set(p.id, p);
  }
  const nameById = new Map<string, string>();
  for (const u of users) {
    if (u.role === "chatter") nameById.set(u.id, u.full_name?.trim() || u.email || u.id);
  }
  const rows: AdminSpinRow[] = spins.map((r) => {
    const s = mapSpin(r as AirtableRecord<SpinFields>);
    const p = prizeById.get(s.prize_id);
    return {
      ...s,
      chatter_name: nameById.get(s.user_id) ?? s.user_id,
      prize_type: p?.prize_type ?? "mystery",
      prize_value: p?.prize_value ?? "",
    };
  });
  rows.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return tb - ta;
  });
  return rows;
}

export function pickWeightedPrizeIndex(prizes: SpinPrizeRow[]): number {
  if (prizes.length === 0) return 0;
  const totalWeight = prizes.reduce((sum, p) => sum + Math.max(0, p.probability), 0);
  if (totalWeight <= 0) return Math.floor(Math.random() * prizes.length);
  const random = Math.random() * totalWeight;
  let cumulative = 0;
  for (let i = 0; i < prizes.length; i++) {
    cumulative += Math.max(0, prizes[i].probability);
    if (random < cumulative) return i;
  }
  return prizes.length - 1;
}

export function computeSpinRotationDelta(winIndex: number, prizeCount: number): number {
  const n = Math.max(1, prizeCount);
  const arc = 360 / n;
  const fullTurns = 5 + Math.floor(Math.random() * 4);
  return fullTurns * 360 - (winIndex + 0.5) * arc;
}

export async function createSpinRecord(fields: {
  user_id: string;
  prize_id: string;
  prize_label: string;
  created_at: string;
  claimed: boolean;
}): Promise<{ id: string }> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).createSpinRecord(fields);
  const created = await createRecord(SPINS, fields);
  return { id: created.id };
}

export async function getSpinById(id: string): Promise<SpinHistoryRow | null> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).getSpinById(id);
  try {
    const rec = await getRecord<SpinFields>(SPINS, id);
    return mapSpin(rec as AirtableRecord<SpinFields>);
  } catch {
    return null;
  }
}

export async function getPrizeById(id: string): Promise<SpinPrizeRow | null> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).getPrizeById(id);
  try {
    const rec = await getRecord<PrizeFields>(PRIZES, id);
    return mapPrize(rec as AirtableRecord<PrizeFields>);
  } catch {
    return null;
  }
}

export async function markSpinClaimed(id: string, claimNote: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).markSpinClaimed(id, claimNote);
  await updateRecord(SPINS, id, { claimed: true, claim_note: claimNote });
}

const SORT_ORDER_FALLBACK_WARNING =
  "Some rows were saved without `sort_order` (add a number field `sort_order` in Airtable to persist wheel order).";

export async function createSpinPrize(
  fields: Record<string, unknown>
): Promise<{ id: string; warning?: string }> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).createSpinPrize(fields);
  try {
    const created = await createRecord(PRIZES, fields);
    return { id: created.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/sort_order|UNKNOWN_FIELD_NAME/i.test(msg)) {
      const { sort_order: _s, ...rest } = fields;
      const created = await createRecord(PRIZES, rest);
      return { id: created.id, warning: SORT_ORDER_FALLBACK_WARNING };
    }
    throw e;
  }
}

export async function updateSpinPrize(
  id: string,
  fields: Record<string, unknown>
): Promise<{ warning?: string }> {
  if (isSupabaseBackend()) {
    await (await import("./spin-wheel-supabase")).updateSpinPrize(id, fields);
    return {};
  }
  try {
    await updateRecord(PRIZES, id, fields);
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/sort_order|UNKNOWN_FIELD_NAME/i.test(msg)) {
      const { sort_order: _s, ...rest } = fields;
      await updateRecord(PRIZES, id, rest);
      return { warning: SORT_ORDER_FALLBACK_WARNING };
    }
    throw e;
  }
}

export async function deleteSpinPrize(id: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./spin-wheel-supabase")).deleteSpinPrize(id);
  await deleteRecord(PRIZES, id);
}
