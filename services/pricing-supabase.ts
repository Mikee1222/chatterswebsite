/**
 * Supabase backend for services/pricing.ts
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
import type { ModelTier } from "@/services/model-tiers";
import type { PricingRow, PricingSpecial, SpenderTier } from "./pricing";

const PRICING_ROWS_TABLE = "pricing_rows";
const PRICING_SPECIALS_TABLE = "pricing_specials";

type RowFields = SbRow & {
  row_key?: string | null;
  model_tier?: string | null;
  spender_tier?: string | null;
  video_number?: number | string | null;
  price_normal?: string | null;
  price_negotiation?: string | null;
  description?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
  sort_order?: number | string | null;
};

type SpecialFields = SbRow & {
  label?: string | null;
  price_normal?: string | null;
  price_negotiation?: string | null;
  description?: string | null;
  models_applicable?: string | null;
  is_active?: boolean | null;
  sort_order?: number | string | null;
};

function coerceModelTier(v: unknown): ModelTier {
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return "high";
}

function coerceSpenderTier(v: unknown): SpenderTier {
  if (v === "medium_low") return "medium_low";
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return "high";
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function pricingRowKey(model_tier: ModelTier, spender_tier: SpenderTier, video_number: number): string {
  return `${model_tier}|${spender_tier}|v${video_number}`;
}

function mapPricingRow(row: RowFields): PricingRow {
  return {
    id: publicId(row),
    model_tier: coerceModelTier(row.model_tier),
    spender_tier: coerceSpenderTier(row.spender_tier),
    video_number: num(row.video_number),
    price_normal: String(row.price_normal ?? ""),
    price_negotiation: String(row.price_negotiation ?? ""),
    description: String(row.description ?? ""),
    notes: String(row.notes ?? ""),
    is_active: row.is_active !== false,
    sort_order: num(row.sort_order),
  };
}

function mapPricingSpecial(row: SpecialFields): PricingSpecial {
  return {
    id: publicId(row),
    label: String(row.label ?? ""),
    price_normal: String(row.price_normal ?? ""),
    price_negotiation: String(row.price_negotiation ?? ""),
    description: String(row.description ?? ""),
    models_applicable: String(row.models_applicable ?? ""),
    is_active: row.is_active !== false,
    sort_order: num(row.sort_order),
  };
}

export async function getAllPricingRows(): Promise<PricingRow[]> {
  const rows = await sbSelectAll<RowFields>(PRICING_ROWS_TABLE);
  return rows.filter((r) => r.is_active !== false).map(mapPricingRow).sort((a, b) => a.sort_order - b.sort_order);
}

export async function getAllPricingRowsAdmin(): Promise<PricingRow[]> {
  const rows = await sbSelectAll<RowFields>(PRICING_ROWS_TABLE);
  return rows.map(mapPricingRow).sort((a, b) => a.sort_order - b.sort_order);
}

export async function createPricingRow(data: Omit<PricingRow, "id">): Promise<PricingRow> {
  const row = await sbInsert<RowFields>(PRICING_ROWS_TABLE, {
    row_key: pricingRowKey(data.model_tier, data.spender_tier, data.video_number),
    model_tier: data.model_tier,
    spender_tier: data.spender_tier,
    video_number: data.video_number,
    price_normal: data.price_normal,
    price_negotiation: data.price_negotiation,
    description: data.description,
    notes: data.notes,
    is_active: data.is_active,
    sort_order: data.sort_order,
  });
  return mapPricingRow(row);
}

export async function updatePricingRow(
  id: string,
  data: Partial<Omit<PricingRow, "id">>
): Promise<PricingRow> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.model_tier !== undefined) patch.model_tier = data.model_tier;
  if (data.spender_tier !== undefined) patch.spender_tier = data.spender_tier;
  if (data.video_number !== undefined) patch.video_number = data.video_number;
  if (data.price_normal !== undefined) patch.price_normal = data.price_normal;
  if (data.price_negotiation !== undefined) patch.price_negotiation = data.price_negotiation;
  if (data.description !== undefined) patch.description = data.description;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.is_active !== undefined) patch.is_active = data.is_active;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  if (
    data.model_tier !== undefined ||
    data.spender_tier !== undefined ||
    data.video_number !== undefined
  ) {
    const existing = await sbSelectByPublicId<RowFields>(PRICING_ROWS_TABLE, id);
    const mt = data.model_tier ?? coerceModelTier(existing?.model_tier);
    const st = data.spender_tier ?? coerceSpenderTier(existing?.spender_tier);
    const vn = data.video_number !== undefined ? data.video_number : num(existing?.video_number);
    patch.row_key = pricingRowKey(mt, st, vn);
  }
  const row = await sbUpdateByPublicId<RowFields>(PRICING_ROWS_TABLE, id, patch);
  return mapPricingRow(row);
}

export async function deletePricingRow(id: string): Promise<void> {
  await sbDeleteByPublicId(PRICING_ROWS_TABLE, id);
}

export async function getAllPricingSpecials(): Promise<PricingSpecial[]> {
  const rows = await sbSelectAll<SpecialFields>(PRICING_SPECIALS_TABLE);
  return rows.filter((r) => r.is_active !== false).map(mapPricingSpecial).sort((a, b) => a.sort_order - b.sort_order);
}

export async function getAllPricingSpecialsAdmin(): Promise<PricingSpecial[]> {
  const rows = await sbSelectAll<SpecialFields>(PRICING_SPECIALS_TABLE);
  return rows.map(mapPricingSpecial).sort((a, b) => a.sort_order - b.sort_order);
}

export async function createPricingSpecial(data: Omit<PricingSpecial, "id">): Promise<PricingSpecial> {
  const row = await sbInsert<SpecialFields>(PRICING_SPECIALS_TABLE, {
    label: data.label,
    price_normal: data.price_normal,
    price_negotiation: data.price_negotiation,
    description: data.description,
    models_applicable: data.models_applicable,
    is_active: data.is_active,
    sort_order: data.sort_order,
  });
  return mapPricingSpecial(row);
}

export async function updatePricingSpecial(
  id: string,
  data: Partial<Omit<PricingSpecial, "id">>
): Promise<PricingSpecial> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.label !== undefined) patch.label = data.label;
  if (data.price_normal !== undefined) patch.price_normal = data.price_normal;
  if (data.price_negotiation !== undefined) patch.price_negotiation = data.price_negotiation;
  if (data.description !== undefined) patch.description = data.description;
  if (data.models_applicable !== undefined) patch.models_applicable = data.models_applicable;
  if (data.is_active !== undefined) patch.is_active = data.is_active;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  const row = await sbUpdateByPublicId<SpecialFields>(PRICING_SPECIALS_TABLE, id, patch);
  return mapPricingSpecial(row);
}

export async function deletePricingSpecial(id: string): Promise<void> {
  await sbDeleteByPublicId(PRICING_SPECIALS_TABLE, id);
}
