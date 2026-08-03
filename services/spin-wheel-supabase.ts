/**
 * Supabase backend for services/spin-wheel.ts
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
import { listAllUsers } from "@/services/users";
import type { AdminSpinRow, SpinHistoryRow, SpinPrizeRow } from "./spin-wheel";

const PRIZES = "spin_wheel_prizes";
const SPINS = "spin_wheel_spins";

type PrizeRow = SbRow & {
  label?: string | null;
  prize_type?: string | null;
  prize_value?: string | null;
  probability?: number | null;
  active?: boolean | null;
  color?: string | null;
  sort_order?: number | null;
};

type SpinRow = SbRow & {
  user_id?: string | null;
  prize_id?: string | null;
  prize_label?: string | null;
  created_at?: string | null;
  claimed?: boolean | null;
  claim_note?: string | null;
};

function mapPrize(row: PrizeRow): SpinPrizeRow {
  return {
    id: publicId(row),
    label: String(row.label ?? "").trim() || "Prize",
    prize_type: String(row.prize_type ?? "mystery").trim(),
    prize_value: String(row.prize_value ?? "").trim(),
    probability: Math.max(0, Math.floor(Number(row.probability ?? 0))),
    color: String(row.color ?? "#8b5cf6").trim() || "#8b5cf6",
    active: Boolean(row.active),
    sort_order: Math.max(0, Math.floor(Number(row.sort_order ?? 0))),
  };
}

function mapSpin(row: SpinRow): SpinHistoryRow {
  return {
    id: publicId(row),
    user_id: String(row.user_id ?? "").trim(),
    prize_id: String(row.prize_id ?? "").trim(),
    prize_label: String(row.prize_label ?? "").trim(),
    created_at: String(row.created_at ?? "").trim(),
    claimed: Boolean(row.claimed),
    claim_note: String(row.claim_note ?? "").trim(),
  };
}

export async function getAllSpinPrizes(): Promise<SpinPrizeRow[]> {
  const rows = await sbSelectAll<PrizeRow>(PRIZES);
  return rows
    .map(mapPrize)
    .sort((a, b) =>
      a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.label.localeCompare(b.label),
    );
}

export async function getActiveSpinPrizes(): Promise<SpinPrizeRow[]> {
  return (await getAllSpinPrizes()).filter((p) => p.active);
}

export async function getRecentSpinsForUser(userId: string, limit = 12): Promise<SpinHistoryRow[]> {
  if (!userId.trim()) return [];
  const rows = await sbSelectAll<SpinRow>(SPINS);
  return rows
    .map(mapSpin)
    .filter((s) => s.user_id === userId.trim())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export async function getAllSpinsForAdmin(): Promise<AdminSpinRow[]> {
  const [spins, prizes, users] = await Promise.all([
    sbSelectAll<SpinRow>(SPINS),
    sbSelectAll<PrizeRow>(PRIZES),
    listAllUsers().catch(() => []),
  ]);
  const prizeById = new Map(prizes.map((r) => {
    const p = mapPrize(r);
    return [p.id, p] as const;
  }));
  const nameById = new Map<string, string>();
  for (const u of users) {
    if (u.role === "chatter") nameById.set(u.id, u.full_name?.trim() || u.email || u.id);
  }
  const rows: AdminSpinRow[] = spins.map((r) => {
    const s = mapSpin(r);
    const p = prizeById.get(s.prize_id);
    return {
      ...s,
      chatter_name: nameById.get(s.user_id) ?? s.user_id,
      prize_type: p?.prize_type ?? "mystery",
      prize_value: p?.prize_value ?? "",
    };
  });
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return rows;
}

export async function createSpinRecord(fields: {
  user_id: string;
  prize_id: string;
  prize_label: string;
  created_at: string;
  claimed: boolean;
}): Promise<{ id: string }> {
  const inserted = await sbInsert<SpinRow>(SPINS, fields);
  return { id: publicId(inserted) };
}

export async function getSpinById(id: string): Promise<SpinHistoryRow | null> {
  const row = await sbSelectByPublicId<SpinRow>(SPINS, id);
  return row ? mapSpin(row) : null;
}

export async function getPrizeById(id: string): Promise<SpinPrizeRow | null> {
  const row = await sbSelectByPublicId<PrizeRow>(PRIZES, id);
  return row ? mapPrize(row) : null;
}

export async function markSpinClaimed(id: string, claimNote: string): Promise<void> {
  await sbUpdateByPublicId(SPINS, id, { claimed: true, claim_note: claimNote });
}

export async function createSpinPrize(
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  const inserted = await sbInsert<PrizeRow>(PRIZES, fields);
  return { id: publicId(inserted) };
}

export async function updateSpinPrize(
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  await sbUpdateByPublicId(PRIZES, id, fields);
}

export async function deleteSpinPrize(id: string): Promise<void> {
  await sbDeleteByPublicId(PRIZES, id);
}
