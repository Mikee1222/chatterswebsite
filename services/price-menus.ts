import { isSupabaseBackend } from "@/lib/data-backend";
import type { SpenderTier } from "@/services/pricing";

export type PriceMarket = "greece" | "usa";

export type PriceMenu = {
  id: string;
  name: string;
  market: PriceMarket;
  description: string;
  is_active: boolean;
  sort_order: number;
  legacy_model_tier: string | null;
  source_menu_id: string | null;
  model_count: number;
  models: PriceMenuModelLink[];
};

export type PriceMenuModelLink = {
  model_id: string;
  model_name: string;
  status: string;
};

export type PriceMenuRow = {
  id: string;
  menu_id: string;
  spender_tier: SpenderTier;
  level: number;
  price_min: number | null;
  price_max: number | null;
  price_plus: boolean;
  neg_min: number | null;
  neg_max: number | null;
  neg_text: string | null;
  description: string;
  notes: string;
  raw_price_normal: string;
  raw_price_negotiation: string;
  is_active: boolean;
  sort_order: number;
};

export type PriceMenuSpecial = {
  id: string;
  label: string;
  price_min: number | null;
  price_max: number | null;
  price_plus: boolean;
  neg_min: number | null;
  neg_max: number | null;
  neg_text: string | null;
  description: string;
  raw_price_normal: string;
  raw_price_negotiation: string;
  applies_to_all: boolean;
  is_active: boolean;
  sort_order: number;
  market: "greece" | "usa" | "all";
  model_ids: string[];
  model_names: string[];
};

export type PriceMenuChange = {
  id: string;
  bulk_operation_id: string | null;
  actor_id: string;
  actor_name: string;
  menu_id: string | null;
  row_id: string | null;
  special_id: string | null;
  entity_type: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
  note: string;
  created_at: string;
};

export type LinkSuggestion = {
  id: string;
  legacy_name: string;
  suggested_model_id: string | null;
  suggested_model_name: string;
  tier: string | null;
  distance: number | null;
  score: number | null;
  status: "pending" | "accepted" | "dismissed";
};

export type UnlinkedModel = {
  id: string;
  model_name: string;
  status: string;
};

export type PriceMenusBundle = {
  menus: PriceMenu[];
  rowsByMenuId: Record<string, PriceMenuRow[]>;
  specials: PriceMenuSpecial[];
  suggestions: LinkSuggestion[];
  unlinkedActiveModels: UnlinkedModel[];
  allModels: UnlinkedModel[];
};

export type ActorRef = { id: string; name: string };

export type BulkAdjustParams = {
  menu_id: string;
  mode: "percent" | "add" | "subtract";
  amount: number;
  round_to?: 1 | 5 | 10 | null;
  target: "normal" | "neg" | "both";
  preview?: boolean;
  actor: ActorRef;
};

export type DuplicateMenuParams = {
  source_menu_id: string;
  target_market: PriceMarket;
  name?: string;
  multiplier?: number;
  round_to?: 1 | 5 | 10 | null;
  translate_en?: boolean;
  actor: ActorRef;
};

async function backend() {
  if (!isSupabaseBackend()) {
    throw new Error("Price menus require Supabase backend");
  }
  return import("./price-menus-supabase");
}

export async function getPriceMenusBundle(opts?: {
  includeInactive?: boolean;
}): Promise<PriceMenusBundle> {
  return (await backend()).getPriceMenusBundle(opts);
}

export async function getMenuForModel(modelId: string): Promise<{
  menu: PriceMenu | null;
  rows: PriceMenuRow[];
  specials: PriceMenuSpecial[];
} | null> {
  return (await backend()).getMenuForModel(modelId);
}

export async function updateMenu(
  id: string,
  patch: Partial<Pick<PriceMenu, "name" | "description" | "is_active" | "sort_order" | "market">>,
  actor: ActorRef
): Promise<PriceMenu> {
  return (await backend()).updateMenu(id, patch, actor);
}

export async function createMenu(
  data: Omit<PriceMenu, "id" | "model_count" | "models" | "legacy_model_tier" | "source_menu_id"> & {
    legacy_model_tier?: string | null;
  },
  actor: ActorRef
): Promise<PriceMenu> {
  return (await backend()).createMenu(data, actor);
}

export async function archiveMenu(id: string, actor: ActorRef): Promise<PriceMenu> {
  return (await backend()).archiveMenu(id, actor);
}

export async function upsertRow(
  data: Partial<PriceMenuRow> & { menu_id: string; spender_tier: SpenderTier; level: number },
  actor: ActorRef
): Promise<PriceMenuRow> {
  return (await backend()).upsertRow(data, actor);
}

export async function deleteRow(id: string, actor: ActorRef): Promise<void> {
  return (await backend()).deleteRow(id, actor);
}

export async function reorderRows(
  menuId: string,
  orderedIds: string[],
  actor: ActorRef
): Promise<PriceMenuRow[]> {
  return (await backend()).reorderRows(menuId, orderedIds, actor);
}

export async function linkModels(
  menuId: string,
  modelIds: string[],
  actor: ActorRef,
  opts?: { forceMove?: boolean }
): Promise<{ linked: string[]; conflicts: { model_id: string; model_name: string; other_menu_id: string; other_menu_name: string }[] }> {
  return (await backend()).linkModels(menuId, modelIds, actor, opts);
}

export async function unlinkModel(modelId: string, actor: ActorRef): Promise<void> {
  return (await backend()).unlinkModel(modelId, actor);
}

export async function acceptLinkSuggestion(
  suggestionId: string,
  actor: ActorRef
): Promise<void> {
  return (await backend()).acceptLinkSuggestion(suggestionId, actor);
}

export async function dismissLinkSuggestion(suggestionId: string, actor: ActorRef): Promise<void> {
  return (await backend()).dismissLinkSuggestion(suggestionId, actor);
}

export async function bulkAdjustPrices(params: BulkAdjustParams): Promise<{
  preview: { row_id: string; field: string; before: string; after: string }[];
  applied: boolean;
  bulk_operation_id?: string;
}> {
  return (await backend()).bulkAdjustPrices(params);
}

export async function fillNegotiationFromNormal(
  menuId: string,
  percent: number,
  actor: ActorRef,
  preview?: boolean
): Promise<{ preview: { row_id: string; before: string; after: string }[]; applied: boolean; bulk_operation_id?: string }> {
  return (await backend()).fillNegotiationFromNormal(menuId, percent, actor, preview);
}

export async function duplicateMenu(params: DuplicateMenuParams): Promise<PriceMenu> {
  return (await backend()).duplicateMenu(params);
}

export async function undoLastChange(actor: ActorRef, menuId?: string): Promise<{ undone: boolean; change?: PriceMenuChange }> {
  return (await backend()).undoLastChange(actor, menuId);
}

export async function listChanges(menuId?: string, limit = 50): Promise<PriceMenuChange[]> {
  return (await backend()).listChanges(menuId, limit);
}

export async function upsertSpecial(
  data: Partial<PriceMenuSpecial> & { label: string },
  actor: ActorRef
): Promise<PriceMenuSpecial> {
  return (await backend()).upsertSpecial(data, actor);
}

export async function deleteSpecial(id: string, actor: ActorRef): Promise<void> {
  return (await backend()).deleteSpecial(id, actor);
}

/** Compatibility: flatten Greece menus into legacy PricingRow shape. */
export async function getLegacyCompatiblePricingRows(includeInactive = false) {
  return (await backend()).getLegacyCompatiblePricingRows(includeInactive);
}

export async function getLegacyCompatibleSpecials(includeInactive = false) {
  return (await backend()).getLegacyCompatibleSpecials(includeInactive);
}
