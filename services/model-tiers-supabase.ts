/**
 * Supabase backend for services/model-tiers.ts
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import type { ModelTier, ModelTierRecord } from "./model-tiers";

const TABLE = "model_tiers";

type Row = SbRow & {
  model_name?: string | null;
  tier?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

function coerceTier(v: unknown): ModelTier {
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return "high";
}

function mapRow(row: Row): ModelTierRecord {
  const so = row.sort_order;
  const n = typeof so === "number" && Number.isFinite(so) ? so : 0;
  return {
    id: publicId(row),
    model_name: String(row.model_name ?? ""),
    tier: coerceTier(row.tier),
    is_active: row.is_active !== false,
    sort_order: n,
  };
}

export async function getAllModelTiers(): Promise<ModelTierRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return rows
    .map(mapRow)
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getAllModelTiersAdmin(): Promise<ModelTierRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return rows.map(mapRow).sort((a, b) => a.sort_order - b.sort_order);
}

export async function createModelTier(data: Omit<ModelTierRecord, "id">): Promise<ModelTierRecord> {
  const row = await sbInsert<Row>(TABLE, {
    model_name: data.model_name,
    tier: data.tier,
    is_active: data.is_active,
    sort_order: data.sort_order,
  });
  return mapRow(row);
}

export async function updateModelTier(
  id: string,
  data: Partial<Omit<ModelTierRecord, "id">>
): Promise<ModelTierRecord> {
  const fields: Record<string, unknown> = {};
  if (data.model_name !== undefined) fields.model_name = data.model_name;
  if (data.tier !== undefined) fields.tier = data.tier;
  if (data.is_active !== undefined) fields.is_active = data.is_active;
  if (data.sort_order !== undefined) fields.sort_order = data.sort_order;
  const row = await sbUpdateByPublicId<Row>(TABLE, id, fields);
  return mapRow(row);
}

export async function deleteModelTier(id: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, id);
}
