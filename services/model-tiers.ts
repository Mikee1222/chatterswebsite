import {
  listAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";

export const MODEL_TIERS_TABLE = "model_tiers";

export type ModelTier = "high" | "medium" | "low";

export type ModelTierRecord = {
  id: string;
  model_name: string;
  tier: ModelTier;
  is_active: boolean;
  sort_order: number;
};

type TierFields = {
  model_name?: string;
  tier?: string;
  is_active?: boolean;
  sort_order?: number | string;
};

const SORT = [{ field: "sort_order", direction: "asc" as const }];

function coerceTier(v: unknown): ModelTier {
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return "high";
}

function mapTierRecord(rec: AirtableRecord<TierFields>): ModelTierRecord {
  const f = rec.fields ?? {};
  const so = f.sort_order;
  const n =
    typeof so === "number" && Number.isFinite(so)
      ? so
      : typeof so === "string"? Number.parseInt(so, 10)
        : 0;
  return {
    id: rec.id,
    model_name: String(f.model_name ?? ""),
    tier: coerceTier(f.tier),
    is_active: f.is_active !== false,
    sort_order: Number.isFinite(n) ? n : 0,
  };
}

export async function getAllModelTiers(): Promise<ModelTierRecord[]> {
  const rows = await listAllRecords<TierFields>(MODEL_TIERS_TABLE, {
    filterByFormula: "{is_active} = TRUE()",
    sort: SORT,
    _caller: "getAllModelTiers",
  });
  return rows.map(mapTierRecord);
}

export async function getAllModelTiersAdmin(): Promise<ModelTierRecord[]> {
  const rows = await listAllRecords<TierFields>(MODEL_TIERS_TABLE, {
    sort: SORT,
    _caller: "getAllModelTiersAdmin",
  });
  return rows.map(mapTierRecord);
}

export async function createModelTier(
  data: Omit<ModelTierRecord, "id">
): Promise<ModelTierRecord> {
  const rec = await createRecord<TierFields>(MODEL_TIERS_TABLE, {
    model_name: data.model_name,
    tier: data.tier,
    is_active: data.is_active,
    sort_order: data.sort_order,
  });
  return mapTierRecord(rec);
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
  const rec = await updateRecord<TierFields>(MODEL_TIERS_TABLE, id, fields);
  return mapTierRecord(rec);
}

export async function deleteModelTier(id: string): Promise<void> {
  await deleteRecord(MODEL_TIERS_TABLE, id);
}
