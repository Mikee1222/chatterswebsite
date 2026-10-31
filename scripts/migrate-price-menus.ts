/**
 * Idempotent data migration: pricing_rows/specials/model_tiers → price_menus*.
 * Does NOT drop or mutate legacy tables. Does NOT change price values.
 *
 * Usage: npx tsx scripts/migrate-price-menus.ts
 */
import "./_polyfill-websocket";
import { config } from "dotenv";
config({ path: ".env.vercel.local" });
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseServiceClient } from "../lib/supabase-server";
import {
  EL_TO_EN_DESCRIPTION,
  EL_TO_EN_NOTES,
  EL_TO_EN_SPECIAL_DESC,
  parseLegacyPrices,
  suggestModelMatches,
  translateElToEn,
} from "../lib/price-parse";

type LegacyRow = {
  id: string;
  model_tier: string;
  spender_tier: string;
  video_number: number;
  price_normal: string;
  price_negotiation: string;
  description: string;
  notes: string;
  is_active: boolean;
  sort_order: number;
};

type Report = {
  greek_menus: { name: string; rows: number; groups: string[] }[];
  usa_menus: { name: string; rows: number }[];
  unparsed_prices: { legacy_row_id: string; field: string; value: string }[];
  exact_links: { legacy_name: string; model_ids: string[]; model_names: string[] }[];
  unmatched_legacy_names: string[];
  fuzzy_suggestions: {
    legacy_name: string;
    suggested_model_name: string;
    suggested_model_id: string;
    distance: number;
  }[];
  untranslated_texts: string[];
  specials: { label: string; applies_to_all: boolean; model_ids: string[] }[];
  legacy_row_count: number;
  migrated_row_count: number;
};

const MENU_META: Record<string, { name: string; sort: number; desc: string }> = {
  high: { name: "High", sort: 1, desc: "High model tier price ladder" },
  medium: { name: "Medium", sort: 2, desc: "Medium model tier price ladder" },
  low: { name: "Low", sort: 3, desc: "Low model tier price ladder" },
};

async function main() {
  const sb = getSupabaseServiceClient();
  const report: Report = {
    greek_menus: [],
    usa_menus: [],
    unparsed_prices: [],
    exact_links: [],
    unmatched_legacy_names: [],
    fuzzy_suggestions: [],
    untranslated_texts: [],
    specials: [],
    legacy_row_count: 0,
    migrated_row_count: 0,
  };

  const { data: existingMenus, error: emErr } = await sb.from("price_menus").select("id, name, market");
  if (emErr) throw emErr;

  const { data: legacyRows, error: lrErr } = await sb
    .from("pricing_rows")
    .select("*")
    .order("sort_order", { ascending: true });
  if (lrErr) throw lrErr;
  const rows = (legacyRows ?? []) as LegacyRow[];
  report.legacy_row_count = rows.length;

  const { data: models, error: mErr } = await sb
    .from("modelss")
    .select("id, model_name, status, airtable_id");
  if (mErr) throw mErr;
  const modelList = (models ?? []).map((m) => ({
    id: String(m.id),
    model_name: String(m.model_name ?? ""),
    status: String(m.status ?? ""),
  }));

  const { data: tiers, error: tErr } = await sb.from("model_tiers").select("*").order("sort_order");
  if (tErr) throw tErr;

  const { data: specials, error: sErr } = await sb.from("pricing_specials").select("*").order("sort_order");
  if (sErr) throw sErr;

  // --- Greek menus ---
  const greekMenuIds: Record<string, string> = {};
  for (const tier of ["high", "medium", "low"] as const) {
    const meta = MENU_META[tier];
    const existing = (existingMenus ?? []).find(
      (m) => m.market === "greece" && String(m.name).toLowerCase() === meta.name.toLowerCase()
    );
    let menuId = existing?.id as string | undefined;
    if (!menuId) {
      const { data: created, error } = await sb
        .from("price_menus")
        .insert({
          name: meta.name,
          market: "greece",
          description: meta.desc,
          is_active: true,
          sort_order: meta.sort,
          legacy_model_tier: tier,
        })
        .select("id")
        .single();
      if (error) throw error;
      menuId = created.id;
    } else {
      await sb
        .from("price_menus")
        .update({ legacy_model_tier: tier, sort_order: meta.sort, updated_at: new Date().toISOString() })
        .eq("id", menuId);
    }
    greekMenuIds[tier] = menuId!;
  }

  // Clear & re-seed greek rows only when empty for that menu (idempotent by legacy_pricing_row_id)
  for (const tier of ["high", "medium", "low"] as const) {
    const menuId = greekMenuIds[tier];
    const tierRows = rows.filter((r) => String(r.model_tier) === tier);
    const groups = [
      ...new Set(tierRows.map((r) => `${r.model_tier}|${r.spender_tier}`)),
    ].sort();

    let inserted = 0;
    for (const r of tierRows) {
      const parsed = parseLegacyPrices(r.price_normal ?? "", r.price_negotiation ?? "");
      if (parsed.unparsed) {
        if (parsed.price_min == null && String(r.price_normal ?? "").trim()) {
          report.unparsed_prices.push({
            legacy_row_id: r.id,
            field: "price_normal",
            value: String(r.price_normal),
          });
        }
      }
      // Negotiation open-ended (+)
      const negParsed = parseLegacyPrices("0", r.price_negotiation ?? "");
      void negParsed;

      const { data: existingRow } = await sb
        .from("price_menu_rows")
        .select("id")
        .eq("legacy_pricing_row_id", r.id)
        .maybeSingle();

      const payload = {
        menu_id: menuId,
        spender_tier: r.spender_tier,
        level: Number(r.video_number) || 1,
        price_min: parsed.price_min,
        price_max: parsed.price_max,
        price_plus: parsed.price_plus,
        neg_min: parsed.neg_min,
        neg_max: parsed.neg_max,
        neg_text: parsed.neg_text,
        description: String(r.description ?? ""),
        notes: String(r.notes ?? ""),
        raw_price_normal: String(r.price_normal ?? ""),
        raw_price_negotiation: String(r.price_negotiation ?? ""),
        is_active: r.is_active !== false,
        sort_order: Number(r.sort_order) || 0,
        legacy_pricing_row_id: r.id,
        updated_at: new Date().toISOString(),
      };

      // Fix negotiation plus: parse negotiation independently for plus-only
      const negSide = (() => {
        const s = String(r.price_negotiation ?? "").trim();
        const m = s.match(/^\s*(\d+(?:\.\d+)?)\s*\+\s*$/);
        if (m) return { neg_min: Number(m[1]), neg_max: null as number | null, neg_text: null as string | null };
        return null;
      })();
      if (negSide) {
        payload.neg_min = negSide.neg_min;
        payload.neg_max = negSide.neg_max;
        payload.neg_text = negSide.neg_text;
      }

      if (existingRow?.id) {
        const { error } = await sb.from("price_menu_rows").update(payload).eq("id", existingRow.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("price_menu_rows").insert(payload);
        if (error) throw error;
        inserted++;
      }
      report.migrated_row_count++;
    }
    report.greek_menus.push({ name: MENU_META[tier].name, rows: tierRows.length, groups });
    console.log(`Greek ${MENU_META[tier].name}: ${tierRows.length} rows (${inserted} new)`);
  }

  // --- Exact model links (Greece menus only) ---
  const linkedLegacy = new Set<string>();
  for (const tier of tiers ?? []) {
    const legacyName = String(tier.model_name ?? "").trim();
    if (!legacyName) continue;
    const tierKey = String(tier.tier ?? "low");
    const menuId = greekMenuIds[tierKey] ?? greekMenuIds.low;
    const matches = modelList.filter(
      (m) => m.model_name.trim().toLowerCase() === legacyName.toLowerCase()
    );
    if (matches.length === 0) {
      report.unmatched_legacy_names.push(legacyName);
      continue;
    }
    linkedLegacy.add(legacyName.toLowerCase());
    const ids: string[] = [];
    const names: string[] = [];
    for (const m of matches) {
      // Upsert: move if already on another menu
      await sb.from("price_menu_models").delete().eq("model_id", m.id);
      const { error } = await sb.from("price_menu_models").insert({
        menu_id: menuId,
        model_id: m.id,
        linked_by: "migration:exact",
      });
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      ids.push(m.id);
      names.push(m.model_name);
    }
    report.exact_links.push({ legacy_name: legacyName, model_ids: ids, model_names: names });
  }

  // Fuzzy suggestions for unmatched
  const fuzzy = suggestModelMatches(
    [...new Set(report.unmatched_legacy_names)],
    modelList.map((m) => ({ id: m.id, model_name: m.model_name })),
    { maxDistance: 8, topN: 3 }
  );
  report.fuzzy_suggestions = fuzzy.map((f) => ({
    legacy_name: f.legacy_name,
    suggested_model_name: f.suggested_model_name,
    suggested_model_id: f.suggested_model_id,
    distance: f.distance,
  }));

  for (const f of fuzzy) {
    const tierRow = (tiers ?? []).find(
      (t) => String(t.model_name).trim().toLowerCase() === f.legacy_name.toLowerCase()
    );
    await sb.from("price_menu_link_suggestions").upsert(
      {
        legacy_name: f.legacy_name,
        suggested_model_id: f.suggested_model_id,
        suggested_model_name: f.suggested_model_name,
        tier: tierRow ? String(tierRow.tier) : null,
        distance: f.distance,
        score: f.score,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "legacy_name,suggested_model_id" }
    );
  }

  // --- USA menus (copy prices + EN text, no model links) ---
  for (const tier of ["high", "medium", "low"] as const) {
    const meta = MENU_META[tier];
    const usaName = `USA - ${meta.name}`;
    const existing = (existingMenus ?? []).find(
      (m) => m.market === "usa" && String(m.name).toLowerCase() === usaName.toLowerCase()
    );
    let usaId = existing?.id as string | undefined;
    const sourceId = greekMenuIds[tier];
    if (!usaId) {
      const { data: created, error } = await sb
        .from("price_menus")
        .insert({
          name: usaName,
          market: "usa",
          description: `USA copy of ${meta.name} (same prices, English copy)`,
          is_active: true,
          sort_order: meta.sort + 10,
          legacy_model_tier: tier,
          source_menu_id: sourceId,
        })
        .select("id")
        .single();
      if (error) throw error;
      usaId = created.id;
    }

    const { data: grRows, error: grErr } = await sb
      .from("price_menu_rows")
      .select("*")
      .eq("menu_id", sourceId)
      .order("sort_order");
    if (grErr) throw grErr;

    // Replace USA rows if count mismatch or empty (idempotent by clearing source-linked copies)
    const { count } = await sb
      .from("price_menu_rows")
      .select("*", { count: "exact", head: true })
      .eq("menu_id", usaId);
    if (!count) {
      for (const r of grRows ?? []) {
        const descT = translateElToEn(String(r.description ?? ""), EL_TO_EN_DESCRIPTION);
        const notesT = translateElToEn(String(r.notes ?? ""), EL_TO_EN_NOTES);
        if (descT.untranslated && descT.translated) report.untranslated_texts.push(descT.translated);
        if (notesT.untranslated && notesT.translated) report.untranslated_texts.push(notesT.translated);
        const { error } = await sb.from("price_menu_rows").insert({
          menu_id: usaId,
          spender_tier: r.spender_tier,
          level: r.level,
          price_min: r.price_min,
          price_max: r.price_max,
          price_plus: r.price_plus,
          neg_min: r.neg_min,
          neg_max: r.neg_max,
          neg_text: r.neg_text,
          description: descT.translated,
          notes: notesT.translated,
          raw_price_normal: r.raw_price_normal,
          raw_price_negotiation: r.raw_price_negotiation,
          is_active: r.is_active,
          sort_order: r.sort_order,
          legacy_pricing_row_id: null,
        });
        if (error) throw error;
      }
    }
    report.usa_menus.push({ name: usaName, rows: (grRows ?? []).length });
    console.log(`USA ${usaName}: ${(grRows ?? []).length} rows`);
  }

  // --- Specials ---
  for (const s of specials ?? []) {
    const legacyId = String(s.id);
    const { data: existingSp } = await sb
      .from("price_menu_specials")
      .select("id")
      .eq("legacy_special_id", legacyId)
      .maybeSingle();

    const parsed = parseLegacyPrices(String(s.price_normal ?? ""), String(s.price_negotiation ?? ""));
    const applicable = String(s.models_applicable ?? "").trim();
    const applies_to_all = /^all$/i.test(applicable);
    const names = applies_to_all
      ? []
      : applicable
          .split(/[,;]+/)
          .map((x) => x.trim())
          .filter(Boolean);

    const modelIds: string[] = [];
    for (const name of names) {
      const hits = modelList.filter((m) => m.model_name.trim().toLowerCase() === name.toLowerCase());
      for (const h of hits) modelIds.push(h.id);
      if (!hits.length) {
        report.unmatched_legacy_names.push(`[special:${s.label}] ${name}`);
        const sug = suggestModelMatches([name], modelList, { maxDistance: 6, topN: 1 });
        report.fuzzy_suggestions.push(
          ...sug.map((f) => ({
            legacy_name: f.legacy_name,
            suggested_model_name: f.suggested_model_name,
            suggested_model_id: f.suggested_model_id,
            distance: f.distance,
          }))
        );
      }
    }

    const descT = translateElToEn(String(s.description ?? ""), {
      ...EL_TO_EN_DESCRIPTION,
      ...EL_TO_EN_SPECIAL_DESC,
    });
    if (descT.untranslated && descT.translated) report.untranslated_texts.push(descT.translated);

    const payload = {
      label: String(s.label ?? ""),
      price_min: parsed.price_min,
      price_max: parsed.price_max,
      price_plus: parsed.price_plus,
      neg_min: parsed.neg_min,
      neg_max: parsed.neg_max,
      neg_text: parsed.neg_text,
      description: String(s.description ?? ""),
      raw_price_normal: String(s.price_normal ?? ""),
      raw_price_negotiation: String(s.price_negotiation ?? ""),
      applies_to_all,
      is_active: s.is_active !== false,
      sort_order: Number(s.sort_order) || 0,
      market: "greece",
      legacy_special_id: legacyId,
      updated_at: new Date().toISOString(),
    };

    let specialId = existingSp?.id as string | undefined;
    if (specialId) {
      const { error } = await sb.from("price_menu_specials").update(payload).eq("id", specialId);
      if (error) throw error;
    } else {
      const { data: created, error } = await sb
        .from("price_menu_specials")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      specialId = created.id;
    }

    await sb.from("price_menu_special_models").delete().eq("special_id", specialId);
    for (const mid of modelIds) {
      await sb.from("price_menu_special_models").insert({ special_id: specialId, model_id: mid });
    }

    // USA special copy
    const { data: usaSp } = await sb
      .from("price_menu_specials")
      .select("id")
      .eq("label", String(s.label ?? ""))
      .eq("market", "usa")
      .maybeSingle();
    const usaPayload = {
      ...payload,
      description: descT.translated,
      market: "usa",
      legacy_special_id: null,
    };
    if (!usaSp?.id) {
      const { data: createdUsa, error } = await sb
        .from("price_menu_specials")
        .insert(usaPayload)
        .select("id")
        .single();
      if (error) throw error;
      if (applies_to_all) {
        /* none */
      } else {
        for (const mid of modelIds) {
          await sb
            .from("price_menu_special_models")
            .insert({ special_id: createdUsa.id, model_id: mid });
        }
      }
    }

    report.specials.push({
      label: String(s.label),
      applies_to_all,
      model_ids: modelIds,
    });
  }

  report.unmatched_legacy_names = [...new Set(report.unmatched_legacy_names)];
  report.untranslated_texts = [...new Set(report.untranslated_texts)];

  const outPath = "scripts/_price-menus-migration-report.json";
  const fs = await import("fs");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("\n=== MIGRATION REPORT ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
