/**
 * Supabase backend for price menus.
 */
import { randomUUID } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  EL_TO_EN_DESCRIPTION,
  EL_TO_EN_NOTES,
  formatPriceDisplay,
  translateElToEn,
} from "@/lib/price-parse";
import type { PricingRow, PricingSpecial, SpenderTier } from "@/services/pricing";
import type {
  ActorRef,
  BulkAdjustParams,
  DuplicateMenuParams,
  LinkSuggestion,
  PriceMarket,
  PriceMenu,
  PriceMenuChange,
  PriceMenuRow,
  PriceMenusBundle,
  PriceMenuSpecial,
  UnlinkedModel,
} from "./price-menus";

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function coerceSpender(v: unknown): SpenderTier {
  if (v === "medium_low") return "medium_low";
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return "high";
}

function coerceMarket(v: unknown): PriceMarket {
  return v === "usa" ? "usa" : "greece";
}

function mapRow(r: Record<string, unknown>): PriceMenuRow {
  return {
    id: String(r.id),
    menu_id: String(r.menu_id),
    spender_tier: coerceSpender(r.spender_tier),
    level: Number(r.level) || 1,
    price_min: numOrNull(r.price_min),
    price_max: numOrNull(r.price_max),
    price_plus: r.price_plus === true,
    neg_min: numOrNull(r.neg_min),
    neg_max: numOrNull(r.neg_max),
    neg_text: r.neg_text != null ? String(r.neg_text) : null,
    description: String(r.description ?? ""),
    notes: String(r.notes ?? ""),
    raw_price_normal: String(r.raw_price_normal ?? ""),
    raw_price_negotiation: String(r.raw_price_negotiation ?? ""),
    is_active: r.is_active !== false,
    sort_order: Number(r.sort_order) || 0,
  };
}

function mapSpecial(
  r: Record<string, unknown>,
  modelIds: string[],
  modelNames: string[]
): PriceMenuSpecial {
  return {
    id: String(r.id),
    label: String(r.label ?? ""),
    price_min: numOrNull(r.price_min),
    price_max: numOrNull(r.price_max),
    price_plus: r.price_plus === true,
    neg_min: numOrNull(r.neg_min),
    neg_max: numOrNull(r.neg_max),
    neg_text: r.neg_text != null ? String(r.neg_text) : null,
    description: String(r.description ?? ""),
    raw_price_normal: String(r.raw_price_normal ?? ""),
    raw_price_negotiation: String(r.raw_price_negotiation ?? ""),
    applies_to_all: r.applies_to_all === true,
    is_active: r.is_active !== false,
    sort_order: Number(r.sort_order) || 0,
    market: r.market === "usa" ? "usa" : r.market === "all" ? "all" : "greece",
    model_ids: modelIds,
    model_names: modelNames,
  };
}

function mapChange(r: Record<string, unknown>): PriceMenuChange {
  return {
    id: String(r.id),
    bulk_operation_id: r.bulk_operation_id ? String(r.bulk_operation_id) : null,
    actor_id: String(r.actor_id ?? ""),
    actor_name: String(r.actor_name ?? ""),
    menu_id: r.menu_id ? String(r.menu_id) : null,
    row_id: r.row_id ? String(r.row_id) : null,
    special_id: r.special_id ? String(r.special_id) : null,
    entity_type: String(r.entity_type ?? "row"),
    field: String(r.field ?? ""),
    before_value: r.before_value != null ? String(r.before_value) : null,
    after_value: r.after_value != null ? String(r.after_value) : null,
    note: String(r.note ?? ""),
    created_at: String(r.created_at ?? ""),
  };
}

async function logChange(
  entry: Omit<PriceMenuChange, "id" | "created_at"> & { created_at?: string }
): Promise<void> {
  const sb = getSupabaseServiceClient();
  await sb.from("price_menu_changes").insert({
    bulk_operation_id: entry.bulk_operation_id,
    actor_id: entry.actor_id,
    actor_name: entry.actor_name,
    menu_id: entry.menu_id,
    row_id: entry.row_id,
    special_id: entry.special_id,
    entity_type: entry.entity_type,
    field: entry.field,
    before_value: entry.before_value,
    after_value: entry.after_value,
    note: entry.note,
  });
}

function roundTo(n: number, step: 1 | 5 | 10 | null | undefined): number {
  if (!step || step <= 1) return Math.round(n);
  return Math.round(n / step) * step;
}

function adjustNum(
  value: number | null,
  mode: "percent" | "add" | "subtract",
  amount: number,
  round_to?: 1 | 5 | 10 | null
): number | null {
  if (value == null) return null;
  let next = value;
  if (mode === "percent") next = value * (1 + amount / 100);
  else if (mode === "add") next = value + amount;
  else next = value - amount;
  return roundTo(next, round_to);
}

function displayNormal(row: PriceMenuRow): string {
  return formatPriceDisplay({
    min: row.price_min,
    max: row.price_max,
    plus: row.price_plus,
    raw: row.raw_price_normal,
  });
}

function displayNeg(row: PriceMenuRow): string {
  return formatPriceDisplay({
    min: row.neg_min,
    max: row.neg_max,
    text: row.neg_text,
    raw: row.raw_price_negotiation,
  });
}

export async function getPriceMenusBundle(opts?: {
  includeInactive?: boolean;
}): Promise<PriceMenusBundle> {
  const sb = getSupabaseServiceClient();
  const includeInactive = opts?.includeInactive === true;

  let menusQ = sb.from("price_menus").select("*").order("sort_order");
  if (!includeInactive) menusQ = menusQ.eq("is_active", true);
  const { data: menusRaw, error: mErr } = await menusQ;
  if (mErr) throw mErr;

  const { data: links, error: lErr } = await sb.from("price_menu_models").select("menu_id, model_id");
  if (lErr) throw lErr;

  const { data: models, error: moErr } = await sb
    .from("modelss")
    .select("id, model_name, status")
    .order("model_name");
  if (moErr) throw moErr;

  const modelById = new Map(
    (models ?? []).map((m) => [
      String(m.id),
      { id: String(m.id), model_name: String(m.model_name ?? ""), status: String(m.status ?? "") },
    ])
  );

  const linksByMenu = new Map<string, { model_id: string; model_name: string; status: string }[]>();
  const linkedModelIds = new Set<string>();
  for (const link of links ?? []) {
    const mid = String(link.model_id);
    const menuId = String(link.menu_id);
    linkedModelIds.add(mid);
    const m = modelById.get(mid);
    if (!m) continue;
    const arr = linksByMenu.get(menuId) ?? [];
    arr.push({ model_id: m.id, model_name: m.model_name, status: m.status });
    linksByMenu.set(menuId, arr);
  }

  const menus: PriceMenu[] = (menusRaw ?? []).map((m) => {
    const modelsFor = linksByMenu.get(String(m.id)) ?? [];
    return {
      id: String(m.id),
      name: String(m.name ?? ""),
      market: coerceMarket(m.market),
      description: String(m.description ?? ""),
      is_active: m.is_active !== false,
      sort_order: Number(m.sort_order) || 0,
      legacy_model_tier: m.legacy_model_tier != null ? String(m.legacy_model_tier) : null,
      source_menu_id: m.source_menu_id ? String(m.source_menu_id) : null,
      model_count: modelsFor.length,
      models: modelsFor,
    };
  });

  let rowsQ = sb.from("price_menu_rows").select("*").order("sort_order");
  if (!includeInactive) rowsQ = rowsQ.eq("is_active", true);
  const { data: rowsRaw, error: rErr } = await rowsQ;
  if (rErr) throw rErr;

  const rowsByMenuId: Record<string, PriceMenuRow[]> = {};
  for (const r of rowsRaw ?? []) {
    const mapped = mapRow(r as Record<string, unknown>);
    (rowsByMenuId[mapped.menu_id] ??= []).push(mapped);
  }

  let spQ = sb.from("price_menu_specials").select("*").order("sort_order");
  if (!includeInactive) spQ = spQ.eq("is_active", true);
  const { data: specialsRaw, error: sErr } = await spQ;
  if (sErr) throw sErr;

  const { data: spLinks, error: slErr } = await sb
    .from("price_menu_special_models")
    .select("special_id, model_id");
  if (slErr) throw slErr;
  const spModelMap = new Map<string, string[]>();
  for (const l of spLinks ?? []) {
    const sid = String(l.special_id);
    const arr = spModelMap.get(sid) ?? [];
    arr.push(String(l.model_id));
    spModelMap.set(sid, arr);
  }

  const specials = (specialsRaw ?? []).map((s) => {
    const ids = spModelMap.get(String(s.id)) ?? [];
    const names = ids.map((id) => modelById.get(id)?.model_name ?? id);
    return mapSpecial(s as Record<string, unknown>, ids, names);
  });

  const { data: suggestionsRaw, error: sugErr } = await sb
    .from("price_menu_link_suggestions")
    .select("*")
    .eq("status", "pending")
    .order("score", { ascending: false });
  if (sugErr) throw sugErr;

  const suggestions: LinkSuggestion[] = (suggestionsRaw ?? []).map((s) => ({
    id: String(s.id),
    legacy_name: String(s.legacy_name ?? ""),
    suggested_model_id: s.suggested_model_id ? String(s.suggested_model_id) : null,
    suggested_model_name: String(s.suggested_model_name ?? ""),
    tier: s.tier != null ? String(s.tier) : null,
    distance: s.distance != null ? Number(s.distance) : null,
    score: s.score != null ? Number(s.score) : null,
    status: "pending",
  }));

  const allModels: UnlinkedModel[] = (models ?? []).map((m) => ({
    id: String(m.id),
    model_name: String(m.model_name ?? ""),
    status: String(m.status ?? ""),
  }));

  const unlinkedActiveModels = allModels.filter(
    (m) => m.status === "active" && !linkedModelIds.has(m.id)
  );

  return { menus, rowsByMenuId, specials, suggestions, unlinkedActiveModels, allModels };
}

export async function getMenuForModel(modelId: string) {
  const sb = getSupabaseServiceClient();
  const { data: link } = await sb
    .from("price_menu_models")
    .select("menu_id")
    .eq("model_id", modelId)
    .maybeSingle();
  if (!link?.menu_id) {
    return { menu: null, rows: [] as PriceMenuRow[], specials: [] as PriceMenuSpecial[] };
  }
  const bundle = await getPriceMenusBundle({ includeInactive: false });
  const menu = bundle.menus.find((m) => m.id === link.menu_id) ?? null;
  const rows = bundle.rowsByMenuId[link.menu_id] ?? [];
  const specials = bundle.specials.filter(
    (s) =>
      s.applies_to_all ||
      s.model_ids.includes(modelId) ||
      (menu && s.market === menu.market)
  );
  return { menu, rows, specials };
}

async function hydrateMenu(id: string): Promise<PriceMenu> {
  const bundle = await getPriceMenusBundle({ includeInactive: true });
  const menu = bundle.menus.find((m) => m.id === id);
  if (!menu) throw new Error("Menu not found");
  return menu;
}

export async function createMenu(
  data: {
    name: string;
    market: PriceMarket;
    description: string;
    is_active: boolean;
    sort_order: number;
    legacy_model_tier?: string | null;
  },
  actor: ActorRef
): Promise<PriceMenu> {
  const sb = getSupabaseServiceClient();
  const { data: created, error } = await sb
    .from("price_menus")
    .insert({
      name: data.name,
      market: data.market,
      description: data.description,
      is_active: data.is_active,
      sort_order: data.sort_order,
      legacy_model_tier: data.legacy_model_tier ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await logChange({
    bulk_operation_id: null,
    actor_id: actor.id,
    actor_name: actor.name,
    menu_id: created.id,
    row_id: null,
    special_id: null,
    entity_type: "menu",
    field: "create",
    before_value: null,
    after_value: data.name,
    note: "",
  });
  return hydrateMenu(created.id);
}

export async function updateMenu(
  id: string,
  patch: Partial<Pick<PriceMenu, "name" | "description" | "is_active" | "sort_order" | "market">>,
  actor: ActorRef
): Promise<PriceMenu> {
  const sb = getSupabaseServiceClient();
  const { data: before } = await sb.from("price_menus").select("*").eq("id", id).maybeSingle();
  if (!before) throw new Error("Menu not found");
  const { error } = await sb
    .from("price_menus")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    await logChange({
      bulk_operation_id: null,
      actor_id: actor.id,
      actor_name: actor.name,
      menu_id: id,
      row_id: null,
      special_id: null,
      entity_type: "menu",
      field: String(key),
      before_value: String((before as Record<string, unknown>)[key] ?? ""),
      after_value: String(patch[key] ?? ""),
      note: "",
    });
  }
  return hydrateMenu(id);
}

export async function archiveMenu(id: string, actor: ActorRef): Promise<PriceMenu> {
  return updateMenu(id, { is_active: false }, actor);
}

export async function upsertRow(
  data: Partial<PriceMenuRow> & { menu_id: string; spender_tier: SpenderTier; level: number },
  actor: ActorRef
): Promise<PriceMenuRow> {
  const sb = getSupabaseServiceClient();
  if (data.price_min != null && data.price_max != null && data.price_min > data.price_max) {
    throw new Error("price_min must be <= price_max");
  }
  if (data.neg_min != null && data.neg_max != null && data.neg_min > data.neg_max) {
    throw new Error("neg_min must be <= neg_max");
  }

  const payload: Record<string, unknown> = {
    menu_id: data.menu_id,
    spender_tier: data.spender_tier,
    level: data.level,
    updated_at: new Date().toISOString(),
  };
  for (const k of [
    "price_min",
    "price_max",
    "price_plus",
    "neg_min",
    "neg_max",
    "neg_text",
    "description",
    "notes",
    "raw_price_normal",
    "raw_price_negotiation",
    "is_active",
    "sort_order",
  ] as const) {
    if (k in data && data[k] !== undefined) payload[k] = data[k];
  }

  // Keep raw in sync when structured fields change and raw not explicitly set
  if (
    ("price_min" in data || "price_max" in data || "price_plus" in data) &&
    data.raw_price_normal === undefined
  ) {
    payload.raw_price_normal = formatPriceDisplay({
      min: data.price_min ?? null,
      max: data.price_max ?? null,
      plus: data.price_plus,
    });
  }
  if (
    ("neg_min" in data || "neg_max" in data || "neg_text" in data) &&
    data.raw_price_negotiation === undefined
  ) {
    payload.raw_price_negotiation = formatPriceDisplay({
      min: data.neg_min ?? null,
      max: data.neg_max ?? null,
      text: data.neg_text,
    });
  }

  if (data.id) {
    const { data: before } = await sb.from("price_menu_rows").select("*").eq("id", data.id).maybeSingle();
    const { data: updated, error } = await sb
      .from("price_menu_rows")
      .update(payload)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    if (before) {
      for (const key of Object.keys(payload)) {
        if (key === "updated_at") continue;
        const b = String((before as Record<string, unknown>)[key] ?? "");
        const a = String(payload[key] ?? "");
        if (b !== a) {
          await logChange({
            bulk_operation_id: null,
            actor_id: actor.id,
            actor_name: actor.name,
            menu_id: data.menu_id,
            row_id: data.id,
            special_id: null,
            entity_type: "row",
            field: key,
            before_value: b,
            after_value: a,
            note: "",
          });
        }
      }
    }
    return mapRow(updated as Record<string, unknown>);
  }

  if (payload.sort_order == null) {
    const { data: maxRow } = await sb
      .from("price_menu_rows")
      .select("sort_order")
      .eq("menu_id", data.menu_id)
      .eq("spender_tier", data.spender_tier)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    payload.sort_order = (Number(maxRow?.sort_order) || 0) + 1;
  }
  if (payload.raw_price_normal == null) payload.raw_price_normal = "";
  if (payload.raw_price_negotiation == null) payload.raw_price_negotiation = "";

  const { data: created, error } = await sb.from("price_menu_rows").insert(payload).select("*").single();
  if (error) throw error;
  await logChange({
    bulk_operation_id: null,
    actor_id: actor.id,
    actor_name: actor.name,
    menu_id: data.menu_id,
    row_id: created.id,
    special_id: null,
    entity_type: "row",
    field: "create",
    before_value: null,
    after_value: JSON.stringify({ level: data.level, spender_tier: data.spender_tier }),
    note: "",
  });
  return mapRow(created as Record<string, unknown>);
}

export async function deleteRow(id: string, actor: ActorRef): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { data: before } = await sb.from("price_menu_rows").select("*").eq("id", id).maybeSingle();
  if (!before) return;
  const { error } = await sb.from("price_menu_rows").delete().eq("id", id);
  if (error) throw error;
  await logChange({
    bulk_operation_id: null,
    actor_id: actor.id,
    actor_name: actor.name,
    menu_id: String(before.menu_id),
    row_id: id,
    special_id: null,
    entity_type: "row",
    field: "delete",
    before_value: JSON.stringify(before),
    after_value: null,
    note: "",
  });
}

export async function reorderRows(
  menuId: string,
  orderedIds: string[],
  actor: ActorRef
): Promise<PriceMenuRow[]> {
  const sb = getSupabaseServiceClient();
  const out: PriceMenuRow[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const { data, error } = await sb
      .from("price_menu_rows")
      .update({ sort_order: i + 1, level: i + 1, updated_at: new Date().toISOString() })
      .eq("id", orderedIds[i])
      .eq("menu_id", menuId)
      .select("*")
      .single();
    if (error) throw error;
    out.push(mapRow(data as Record<string, unknown>));
  }
  await logChange({
    bulk_operation_id: null,
    actor_id: actor.id,
    actor_name: actor.name,
    menu_id: menuId,
    row_id: null,
    special_id: null,
    entity_type: "menu",
    field: "reorder",
    before_value: null,
    after_value: orderedIds.join(","),
    note: "",
  });
  return out;
}

export async function linkModels(
  menuId: string,
  modelIds: string[],
  actor: ActorRef,
  opts?: { forceMove?: boolean }
) {
  const sb = getSupabaseServiceClient();
  const conflicts: {
    model_id: string;
    model_name: string;
    other_menu_id: string;
    other_menu_name: string;
  }[] = [];
  const linked: string[] = [];

  const { data: existing } = await sb
    .from("price_menu_models")
    .select("menu_id, model_id")
    .in("model_id", modelIds);

  const { data: menus } = await sb.from("price_menus").select("id, name");
  const menuName = new Map((menus ?? []).map((m) => [String(m.id), String(m.name)]));

  const { data: models } = await sb.from("modelss").select("id, model_name").in("id", modelIds);
  const modelName = new Map((models ?? []).map((m) => [String(m.id), String(m.model_name)]));

  for (const mid of modelIds) {
    const cur = (existing ?? []).find((e) => String(e.model_id) === mid);
    if (cur && String(cur.menu_id) !== menuId) {
      if (!opts?.forceMove) {
        conflicts.push({
          model_id: mid,
          model_name: modelName.get(mid) ?? mid,
          other_menu_id: String(cur.menu_id),
          other_menu_name: menuName.get(String(cur.menu_id)) ?? "",
        });
        continue;
      }
      await sb.from("price_menu_models").delete().eq("model_id", mid);
    }
    if (cur && String(cur.menu_id) === menuId) {
      linked.push(mid);
      continue;
    }
    const { error } = await sb.from("price_menu_models").insert({
      menu_id: menuId,
      model_id: mid,
      linked_by: actor.id,
    });
    if (error) throw error;
    linked.push(mid);
    await logChange({
      bulk_operation_id: null,
      actor_id: actor.id,
      actor_name: actor.name,
      menu_id: menuId,
      row_id: null,
      special_id: null,
      entity_type: "link",
      field: "model_id",
      before_value: cur ? String(cur.menu_id) : null,
      after_value: mid,
      note: modelName.get(mid) ?? "",
    });
  }
  return { linked, conflicts };
}

export async function unlinkModel(modelId: string, actor: ActorRef): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { data: before } = await sb
    .from("price_menu_models")
    .select("*")
    .eq("model_id", modelId)
    .maybeSingle();
  await sb.from("price_menu_models").delete().eq("model_id", modelId);
  if (before) {
    await logChange({
      bulk_operation_id: null,
      actor_id: actor.id,
      actor_name: actor.name,
      menu_id: String(before.menu_id),
      row_id: null,
      special_id: null,
      entity_type: "link",
      field: "unlink",
      before_value: modelId,
      after_value: null,
      note: "",
    });
  }
}

export async function acceptLinkSuggestion(suggestionId: string, actor: ActorRef): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { data: sug } = await sb
    .from("price_menu_link_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .maybeSingle();
  if (!sug?.suggested_model_id) throw new Error("Suggestion missing model");
  const tier = String(sug.tier ?? "low");
  const { data: menu } = await sb
    .from("price_menus")
    .select("id")
    .eq("market", "greece")
    .eq("legacy_model_tier", tier)
    .eq("is_active", true)
    .maybeSingle();
  if (!menu) throw new Error("No Greece menu for tier " + tier);
  await linkModels(menu.id, [String(sug.suggested_model_id)], actor, { forceMove: true });
  await sb
    .from("price_menu_link_suggestions")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", suggestionId);
  // Dismiss other suggestions for same legacy name
  await sb
    .from("price_menu_link_suggestions")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("legacy_name", sug.legacy_name)
    .eq("status", "pending");
}

export async function dismissLinkSuggestion(suggestionId: string, actor: ActorRef): Promise<void> {
  const sb = getSupabaseServiceClient();
  await sb
    .from("price_menu_link_suggestions")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", suggestionId);
  await logChange({
    bulk_operation_id: null,
    actor_id: actor.id,
    actor_name: actor.name,
    menu_id: null,
    row_id: null,
    special_id: null,
    entity_type: "suggestion",
    field: "dismiss",
    before_value: suggestionId,
    after_value: null,
    note: "",
  });
}

export async function bulkAdjustPrices(params: BulkAdjustParams) {
  const sb = getSupabaseServiceClient();
  const { data: rows, error } = await sb
    .from("price_menu_rows")
    .select("*")
    .eq("menu_id", params.menu_id)
    .eq("is_active", true);
  if (error) throw error;

  const preview: { row_id: string; field: string; before: string; after: string }[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];

  for (const raw of rows ?? []) {
    const row = mapRow(raw as Record<string, unknown>);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (params.target === "normal" || params.target === "both") {
      const before = displayNormal(row);
      const nextMin = adjustNum(row.price_min, params.mode, params.amount, params.round_to);
      const nextMax = adjustNum(row.price_max, params.mode, params.amount, params.round_to);
      patch.price_min = nextMin;
      patch.price_max = nextMax;
      patch.raw_price_normal = formatPriceDisplay({
        min: nextMin,
        max: nextMax,
        plus: row.price_plus,
      });
      preview.push({
        row_id: row.id,
        field: "price_normal",
        before,
        after: String(patch.raw_price_normal),
      });
    }
    if (params.target === "neg" || params.target === "both") {
      if (row.neg_text && row.neg_min == null) {
        // leave text-only negotiation alone
      } else {
        const before = displayNeg(row);
        const nextMin = adjustNum(row.neg_min, params.mode, params.amount, params.round_to);
        const nextMax = adjustNum(row.neg_max, params.mode, params.amount, params.round_to);
        patch.neg_min = nextMin;
        patch.neg_max = nextMax;
        patch.raw_price_negotiation = formatPriceDisplay({
          min: nextMin,
          max: nextMax,
          text: row.neg_text,
        });
        preview.push({
          row_id: row.id,
          field: "price_negotiation",
          before,
          after: String(patch.raw_price_negotiation),
        });
      }
    }
    if (Object.keys(patch).length > 1) updates.push({ id: row.id, patch });
  }

  if (params.preview) {
    return { preview, applied: false };
  }

  const bulkId = randomUUID();
  for (const u of updates) {
    const before = (rows ?? []).find((r) => String(r.id) === u.id);
    const { error: uErr } = await sb.from("price_menu_rows").update(u.patch).eq("id", u.id);
    if (uErr) throw uErr;
    for (const p of preview.filter((x) => x.row_id === u.id)) {
      await logChange({
        bulk_operation_id: bulkId,
        actor_id: params.actor.id,
        actor_name: params.actor.name,
        menu_id: params.menu_id,
        row_id: u.id,
        special_id: null,
        entity_type: "row",
        field: p.field,
        before_value: p.before,
        after_value: p.after,
        note: `bulk_adjust:${params.mode}:${params.amount}`,
      });
    }
    void before;
  }
  return { preview, applied: true, bulk_operation_id: bulkId };
}

export async function fillNegotiationFromNormal(
  menuId: string,
  percent: number,
  actor: ActorRef,
  preview = false
) {
  const sb = getSupabaseServiceClient();
  const { data: rows, error } = await sb
    .from("price_menu_rows")
    .select("*")
    .eq("menu_id", menuId)
    .eq("is_active", true);
  if (error) throw error;

  const previews: { row_id: string; before: string; after: string }[] = [];
  const factor = percent / 100;
  const updates: { id: string; patch: Record<string, unknown>; before: string; after: string }[] = [];

  for (const raw of rows ?? []) {
    const row = mapRow(raw as Record<string, unknown>);
    if (row.price_min == null) continue;
    const negMin = roundTo(row.price_min * factor, 1);
    const negMax =
      row.price_max != null ? roundTo(row.price_max * factor, 1) : row.price_plus ? null : negMin;
    const after = formatPriceDisplay({ min: negMin, max: negMax, plus: row.price_plus && negMax == null });
    const before = displayNeg(row);
    previews.push({ row_id: row.id, before, after });
    updates.push({
      id: row.id,
      before,
      after,
      patch: {
        neg_min: negMin,
        neg_max: negMax,
        neg_text: null,
        raw_price_negotiation: after,
        updated_at: new Date().toISOString(),
      },
    });
  }

  if (preview) return { preview: previews, applied: false };

  const bulkId = randomUUID();
  for (const u of updates) {
    const { error: uErr } = await sb.from("price_menu_rows").update(u.patch).eq("id", u.id);
    if (uErr) throw uErr;
    await logChange({
      bulk_operation_id: bulkId,
      actor_id: actor.id,
      actor_name: actor.name,
      menu_id: menuId,
      row_id: u.id,
      special_id: null,
      entity_type: "row",
      field: "price_negotiation",
      before_value: u.before,
      after_value: u.after,
      note: `fill_neg_from_normal:${percent}%`,
    });
  }
  return { preview: previews, applied: true, bulk_operation_id: bulkId };
}

export async function duplicateMenu(params: DuplicateMenuParams): Promise<PriceMenu> {
  const sb = getSupabaseServiceClient();
  const source = await hydrateMenu(params.source_menu_id);
  const { data: rows } = await sb
    .from("price_menu_rows")
    .select("*")
    .eq("menu_id", params.source_menu_id)
    .order("sort_order");

  const name =
    params.name?.trim() ||
    (params.target_market === "usa" ? `USA - ${source.name.replace(/^USA -\s*/i, "")}` : `${source.name} copy`);

  const created = await createMenu(
    {
      name,
      market: params.target_market,
      description: source.description,
      is_active: true,
      sort_order: source.sort_order + 100,
      legacy_model_tier: source.legacy_model_tier,
    },
    params.actor
  );

  await sb
    .from("price_menus")
    .update({ source_menu_id: params.source_menu_id })
    .eq("id", created.id);

  const mult = params.multiplier ?? 1;
  for (const raw of rows ?? []) {
    const row = mapRow(raw as Record<string, unknown>);
    let desc = row.description;
    let notes = row.notes;
    if (params.translate_en) {
      desc = translateElToEn(desc, EL_TO_EN_DESCRIPTION).translated;
      notes = translateElToEn(notes, EL_TO_EN_NOTES).translated;
    }
    const price_min =
      row.price_min != null ? roundTo(row.price_min * mult, params.round_to ?? null) : null;
    const price_max =
      row.price_max != null ? roundTo(row.price_max * mult, params.round_to ?? null) : null;
    const neg_min =
      row.neg_min != null ? roundTo(row.neg_min * mult, params.round_to ?? null) : null;
    const neg_max =
      row.neg_max != null ? roundTo(row.neg_max * mult, params.round_to ?? null) : null;
    await sb.from("price_menu_rows").insert({
      menu_id: created.id,
      spender_tier: row.spender_tier,
      level: row.level,
      price_min,
      price_max,
      price_plus: row.price_plus,
      neg_min,
      neg_max,
      neg_text: row.neg_text,
      description: desc,
      notes,
      raw_price_normal: formatPriceDisplay({ min: price_min, max: price_max, plus: row.price_plus }),
      raw_price_negotiation: formatPriceDisplay({
        min: neg_min,
        max: neg_max,
        text: row.neg_text,
      }),
      is_active: row.is_active,
      sort_order: row.sort_order,
    });
  }
  return hydrateMenu(created.id);
}

export async function undoLastChange(actor: ActorRef, menuId?: string) {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("price_menu_changes")
    .select("*")
    .eq("actor_id", actor.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (menuId) q = q.eq("menu_id", menuId);
  const { data: change } = await q.maybeSingle();
  if (!change) return { undone: false };

  const mapped = mapChange(change as Record<string, unknown>);

  if (mapped.bulk_operation_id) {
    const { data: bulk } = await sb
      .from("price_menu_changes")
      .select("*")
      .eq("bulk_operation_id", mapped.bulk_operation_id);
    for (const c of bulk ?? []) {
      if (c.row_id && c.field && c.before_value != null) {
        const { parseLegacyPrices } = await import("@/lib/price-parse");
        if (c.field === "price_normal") {
          const parsed = parseLegacyPrices(String(c.before_value), "0");
          await sb
            .from("price_menu_rows")
            .update({
              raw_price_normal: c.before_value,
              price_min: parsed.price_min,
              price_max: parsed.price_max,
              price_plus: parsed.price_plus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", c.row_id);
        } else if (c.field === "price_negotiation") {
          const parsed = parseLegacyPrices("0", String(c.before_value));
          await sb
            .from("price_menu_rows")
            .update({
              raw_price_negotiation: c.before_value,
              neg_min: parsed.neg_min,
              neg_max: parsed.neg_max,
              neg_text: parsed.neg_text,
              updated_at: new Date().toISOString(),
            })
            .eq("id", c.row_id);
        } else {
          await sb
            .from("price_menu_rows")
            .update({ [c.field]: c.before_value, updated_at: new Date().toISOString() })
            .eq("id", c.row_id);
        }
      }
    }
    await logChange({
      bulk_operation_id: null,
      actor_id: actor.id,
      actor_name: actor.name,
      menu_id: mapped.menu_id,
      row_id: null,
      special_id: null,
      entity_type: "undo",
      field: "bulk",
      before_value: mapped.bulk_operation_id,
      after_value: null,
      note: "undo bulk",
    });
    return { undone: true, change: mapped };
  }

  if (mapped.row_id && mapped.field && mapped.field !== "create" && mapped.field !== "delete") {
    await sb
      .from("price_menu_rows")
      .update({ [mapped.field]: mapped.before_value, updated_at: new Date().toISOString() })
      .eq("id", mapped.row_id);
    await logChange({
      bulk_operation_id: null,
      actor_id: actor.id,
      actor_name: actor.name,
      menu_id: mapped.menu_id,
      row_id: mapped.row_id,
      special_id: null,
      entity_type: "undo",
      field: mapped.field,
      before_value: mapped.after_value,
      after_value: mapped.before_value,
      note: "undo",
    });
    return { undone: true, change: mapped };
  }

  return { undone: false, change: mapped };
}

export async function listChanges(menuId?: string, limit = 50): Promise<PriceMenuChange[]> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("price_menu_changes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (menuId) q = q.eq("menu_id", menuId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapChange(r as Record<string, unknown>));
}

export async function upsertSpecial(
  data: Partial<PriceMenuSpecial> & { label: string },
  actor: ActorRef
): Promise<PriceMenuSpecial> {
  const sb = getSupabaseServiceClient();
  const payload: Record<string, unknown> = {
    label: data.label,
    updated_at: new Date().toISOString(),
  };
  for (const k of [
    "price_min",
    "price_max",
    "price_plus",
    "neg_min",
    "neg_max",
    "neg_text",
    "description",
    "raw_price_normal",
    "raw_price_negotiation",
    "applies_to_all",
    "is_active",
    "sort_order",
    "market",
  ] as const) {
    if (k in data && data[k] !== undefined) payload[k] = data[k];
  }

  let id = data.id;
  if (id) {
    const { error } = await sb.from("price_menu_specials").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { data: created, error } = await sb
      .from("price_menu_specials")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    id = created.id;
  }

  if (data.model_ids) {
    await sb.from("price_menu_special_models").delete().eq("special_id", id);
    for (const mid of data.model_ids) {
      await sb.from("price_menu_special_models").insert({ special_id: id, model_id: mid });
    }
  }

  await logChange({
    bulk_operation_id: null,
    actor_id: actor.id,
    actor_name: actor.name,
    menu_id: null,
    row_id: null,
    special_id: id!,
    entity_type: "special",
    field: data.id ? "update" : "create",
    before_value: null,
    after_value: data.label,
    note: "",
  });

  const bundle = await getPriceMenusBundle({ includeInactive: true });
  const sp = bundle.specials.find((s) => s.id === id);
  if (!sp) throw new Error("Special not found after save");
  return sp;
}

export async function deleteSpecial(id: string, actor: ActorRef): Promise<void> {
  const sb = getSupabaseServiceClient();
  await sb.from("price_menu_specials").delete().eq("id", id);
  await logChange({
    bulk_operation_id: null,
    actor_id: actor.id,
    actor_name: actor.name,
    menu_id: null,
    row_id: null,
    special_id: id,
    entity_type: "special",
    field: "delete",
    before_value: id,
    after_value: null,
    note: "",
  });
}

export async function getLegacyCompatiblePricingRows(includeInactive = false): Promise<PricingRow[]> {
  const bundle = await getPriceMenusBundle({ includeInactive });
  const greece = bundle.menus.filter((m) => m.market === "greece" && (includeInactive || m.is_active));
  const out: PricingRow[] = [];
  for (const menu of greece) {
    const mt = (menu.legacy_model_tier as "high" | "medium" | "low") || "high";
    for (const row of bundle.rowsByMenuId[menu.id] ?? []) {
      out.push({
        id: row.id,
        model_tier: mt,
        spender_tier: row.spender_tier,
        video_number: row.level,
        price_normal: displayNormal(row),
        price_negotiation: displayNeg(row),
        description: row.description,
        notes: row.notes,
        is_active: row.is_active,
        sort_order: row.sort_order,
      });
    }
  }
  return out.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getLegacyCompatibleSpecials(includeInactive = false): Promise<PricingSpecial[]> {
  const bundle = await getPriceMenusBundle({ includeInactive });
  return bundle.specials
    .filter((s) => s.market === "greece" || s.market === "all")
    .filter((s) => includeInactive || s.is_active)
    .map((s) => ({
      id: s.id,
      label: s.label,
      price_normal: formatPriceDisplay({
        min: s.price_min,
        max: s.price_max,
        plus: s.price_plus,
        raw: s.raw_price_normal,
      }),
      price_negotiation: formatPriceDisplay({
        min: s.neg_min,
        max: s.neg_max,
        text: s.neg_text,
        raw: s.raw_price_negotiation,
      }),
      description: s.description,
      models_applicable: s.applies_to_all ? "ALL" : s.model_names.join(", "),
      is_active: s.is_active,
      sort_order: s.sort_order,
    }));
}
