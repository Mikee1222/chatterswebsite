import {
  listAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  getRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import type { ModelTier } from "@/services/model-tiers";

export const PRICING_ROWS_TABLE = "pricing_rows";
export const PRICING_SPECIALS_TABLE = "pricing_specials";

export type SpenderTier = "high" | "medium" | "low" | "medium_low";

export type PricingRow = {
  id: string;
  model_tier: ModelTier;
  spender_tier: SpenderTier;
  video_number: number;
  price_normal: string;
  price_negotiation: string;
  description: string;
  notes: string;
  is_active: boolean;
  sort_order: number;
};

export type PricingSpecial = {
  id: string;
  label: string;
  price_normal: string;
  price_negotiation: string;
  description: string;
  models_applicable: string;
  is_active: boolean;
  sort_order: number;
};

type RowFields = {
  row_key?: string;
  model_tier?: string;
  spender_tier?: string;
  video_number?: number | string;
  price_normal?: string;
  price_negotiation?: string;
  description?: string;
  notes?: string;
  is_active?: boolean;
  sort_order?: number | string;
};

type SpecialFields = {
  label?: string;
  price_normal?: string;
  price_negotiation?: string;
  description?: string;
  models_applicable?: string;
  is_active?: boolean;
  sort_order?: number | string;
};

const ROW_SORT = [{ field: "sort_order", direction: "asc" as const }];
const SPECIAL_SORT = [{ field: "sort_order", direction: "asc" as const }];

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

function mapPricingRow(rec: AirtableRecord<RowFields>): PricingRow {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    model_tier: coerceModelTier(f.model_tier),
    spender_tier: coerceSpenderTier(f.spender_tier),
    video_number: num(f.video_number),
    price_normal: String(f.price_normal ?? ""),
    price_negotiation: String(f.price_negotiation ?? ""),
    description: String(f.description ?? ""),
    notes: String(f.notes ?? ""),
    is_active: f.is_active !== false,
    sort_order: num(f.sort_order),
  };
}

function mapPricingSpecial(rec: AirtableRecord<SpecialFields>): PricingSpecial {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    label: String(f.label ?? ""),
    price_normal: String(f.price_normal ?? ""),
    price_negotiation: String(f.price_negotiation ?? ""),
    description: String(f.description ?? ""),
    models_applicable: String(f.models_applicable ?? ""),
    is_active: f.is_active !== false,
    sort_order: num(f.sort_order),
  };
}

export async function getAllPricingRows(): Promise<PricingRow[]> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).getAllPricingRows();
  const rows = await listAllRecords<RowFields>(PRICING_ROWS_TABLE, {
    filterByFormula: "{is_active} = TRUE()",
    sort: ROW_SORT,
    _caller: "getAllPricingRows",
  });
  return rows.map(mapPricingRow);
}

export async function getAllPricingRowsAdmin(): Promise<PricingRow[]> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).getAllPricingRowsAdmin();
  const rows = await listAllRecords<RowFields>(PRICING_ROWS_TABLE, {
    sort: ROW_SORT,
    _caller: "getAllPricingRowsAdmin",
  });
  return rows.map(mapPricingRow);
}

export async function createPricingRow(data: Omit<PricingRow, "id">): Promise<PricingRow> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).createPricingRow(data);
  const rec = await createRecord<RowFields>(PRICING_ROWS_TABLE, {
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
  return mapPricingRow(rec);
}

export async function updatePricingRow(id: string, data: Partial<Omit<PricingRow, "id">>): Promise<PricingRow> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).updatePricingRow(id, data);
  const fields: Record<string, unknown> = {};
  if (data.model_tier !== undefined) fields.model_tier = data.model_tier;
  if (data.spender_tier !== undefined) fields.spender_tier = data.spender_tier;
  if (data.video_number !== undefined) fields.video_number = data.video_number;
  if (data.price_normal !== undefined) fields.price_normal = data.price_normal;
  if (data.price_negotiation !== undefined) fields.price_negotiation = data.price_negotiation;
  if (data.description !== undefined) fields.description = data.description;
  if (data.notes !== undefined) fields.notes = data.notes;
  if (data.is_active !== undefined) fields.is_active = data.is_active;
  if (data.sort_order !== undefined) fields.sort_order = data.sort_order;
  if (
    data.model_tier !== undefined ||
    data.spender_tier !== undefined ||
    data.video_number !== undefined
  ) {
    const existing = await getRecord<RowFields>(PRICING_ROWS_TABLE, id);
    const ef = existing.fields ?? {};
    const mt = data.model_tier ?? coerceModelTier(ef.model_tier);
    const st = data.spender_tier ?? coerceSpenderTier(ef.spender_tier);
    const vn = data.video_number !== undefined ? data.video_number : num(ef.video_number);
    fields.row_key = pricingRowKey(mt, st, vn);
  }
  const rec = await updateRecord<RowFields>(PRICING_ROWS_TABLE, id, fields);
  return mapPricingRow(rec);
}

export async function deletePricingRow(id: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).deletePricingRow(id);
  await deleteRecord(PRICING_ROWS_TABLE, id);
}

export async function getAllPricingSpecials(): Promise<PricingSpecial[]> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).getAllPricingSpecials();
  const rows = await listAllRecords<SpecialFields>(PRICING_SPECIALS_TABLE, {
    filterByFormula: "{is_active} = TRUE()",
    sort: SPECIAL_SORT,
    _caller: "getAllPricingSpecials",
  });
  return rows.map(mapPricingSpecial);
}

export async function getAllPricingSpecialsAdmin(): Promise<PricingSpecial[]> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).getAllPricingSpecialsAdmin();
  const rows = await listAllRecords<SpecialFields>(PRICING_SPECIALS_TABLE, {
    sort: SPECIAL_SORT,
    _caller: "getAllPricingSpecialsAdmin",
  });
  return rows.map(mapPricingSpecial);
}

export async function createPricingSpecial(data: Omit<PricingSpecial, "id">): Promise<PricingSpecial> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).createPricingSpecial(data);
  const rec = await createRecord<SpecialFields>(PRICING_SPECIALS_TABLE, {
    label: data.label,
    price_normal: data.price_normal,
    price_negotiation: data.price_negotiation,
    description: data.description,
    models_applicable: data.models_applicable,
    is_active: data.is_active,
    sort_order: data.sort_order,
  });
  return mapPricingSpecial(rec);
}

export async function updatePricingSpecial(
  id: string,
  data: Partial<Omit<PricingSpecial, "id">>
): Promise<PricingSpecial> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).updatePricingSpecial(id, data);
  const fields: Record<string, unknown> = {};
  if (data.label !== undefined) fields.label = data.label;
  if (data.price_normal !== undefined) fields.price_normal = data.price_normal;
  if (data.price_negotiation !== undefined) fields.price_negotiation = data.price_negotiation;
  if (data.description !== undefined) fields.description = data.description;
  if (data.models_applicable !== undefined) fields.models_applicable = data.models_applicable;
  if (data.is_active !== undefined) fields.is_active = data.is_active;
  if (data.sort_order !== undefined) fields.sort_order = data.sort_order;
  const rec = await updateRecord<SpecialFields>(PRICING_SPECIALS_TABLE, id, fields);
  return mapPricingSpecial(rec);
}

export async function deletePricingSpecial(id: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./pricing-supabase")).deletePricingSpecial(id);
  await deleteRecord(PRICING_SPECIALS_TABLE, id);
}
