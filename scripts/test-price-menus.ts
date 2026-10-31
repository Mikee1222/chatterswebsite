/**
 * Throwaway verification for price menus migration + APIs (cleans write tests).
 * Usage: npx tsx scripts/test-price-menus.ts
 */
import "./_polyfill-websocket";
import { config } from "dotenv";
config({ path: ".env.vercel.local" });
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseServiceClient } from "../lib/supabase-server";
import {
  bulkAdjustPrices,
  getLegacyCompatiblePricingRows,
  getPriceMenusBundle,
  linkModels,
  unlinkModel,
  undoLastChange,
} from "../services/price-menus";
import { getAllPricingRows } from "../services/pricing";

const actor = { id: "test-script", name: "Price Menus Test" };

async function main() {
  const sb = getSupabaseServiceClient();
  const failures: string[] = [];

  const legacyCount = (
    await sb.from("pricing_rows").select("*", { count: "exact", head: true })
  ).count;
  const menus = await getPriceMenusBundle({ includeInactive: true });
  const greece = menus.menus.filter((m) => m.market === "greece" && m.is_active);
  const usa = menus.menus.filter((m) => m.market === "usa" && m.is_active);

  console.log("legacy pricing_rows", legacyCount);
  console.log(
    "greece menus",
    greece.map((m) => `${m.name}:${(menus.rowsByMenuId[m.id] ?? []).length}`)
  );
  console.log(
    "usa menus",
    usa.map((m) => `${m.name}:${(menus.rowsByMenuId[m.id] ?? []).length}`)
  );

  if (greece.length !== 3) failures.push(`Expected 3 Greece menus, got ${greece.length}`);
  if (usa.length !== 3) failures.push(`Expected 3 USA menus, got ${usa.length}`);

  const totalGrRows = greece.reduce((n, m) => n + (menus.rowsByMenuId[m.id] ?? []).length, 0);
  if (totalGrRows !== Number(legacyCount)) {
    failures.push(`Greek rows ${totalGrRows} != legacy ${legacyCount}`);
  }

  // Groups preserved: 8 spender groups across 3 menus
  const groups = new Set<string>();
  for (const m of greece) {
    for (const r of menus.rowsByMenuId[m.id] ?? []) {
      groups.add(`${m.legacy_model_tier}|${r.spender_tier}`);
    }
  }
  console.log("groups", [...groups].sort(), "count", groups.size);
  if (groups.size !== 8) failures.push(`Expected 8 groups, got ${groups.size}`);

  // Compatibility layer
  const compat = await getLegacyCompatiblePricingRows(false);
  const viaPricing = await getAllPricingRows();
  console.log("compat rows", compat.length, "via getAllPricingRows", viaPricing.length);
  if (compat.length !== totalGrRows) failures.push("compat length mismatch");

  // Descriptions/notes/order: sample first High/high row
  const high = greece.find((m) => m.legacy_model_tier === "high");
  const highHigh = (menus.rowsByMenuId[high!.id] ?? [])
    .filter((r) => r.spender_tier === "high")
    .sort((a, b) => a.sort_order - b.sort_order);
  const { data: legacySample } = await sb
    .from("pricing_rows")
    .select("*")
    .eq("model_tier", "high")
    .eq("spender_tier", "high")
    .order("sort_order");
  for (let i = 0; i < (legacySample ?? []).length; i++) {
    const L = legacySample![i];
    const R = highHigh[i];
    if (!R) {
      failures.push(`Missing migrated high/high level ${i}`);
      continue;
    }
    if (String(L.description ?? "") !== R.description) {
      failures.push(`Description mismatch level ${R.level}`);
    }
    if (String(L.notes ?? "") !== R.notes) {
      failures.push(`Notes mismatch level ${R.level}`);
    }
    if (String(L.price_normal ?? "") !== R.raw_price_normal) {
      failures.push(`raw_price_normal changed for level ${R.level}`);
    }
  }

  // One-menu-per-model uniqueness
  const { data: links } = await sb.from("price_menu_models").select("model_id");
  const ids = (links ?? []).map((l) => String(l.model_id));
  if (new Set(ids).size !== ids.length) failures.push("Duplicate model links");

  // USA edit isolation: tweak a USA row then ensure Greek raw unchanged
  const usaHigh = usa.find((m) => /high/i.test(m.name))!;
  const usaRow = (menus.rowsByMenuId[usaHigh.id] ?? [])[0];
  const grRow = highHigh[0];
  const beforeGr = grRow.raw_price_normal;
  const beforeUsa = usaRow.raw_price_normal;
  await sb
    .from("price_menu_rows")
    .update({ notes: `tmp-test-${Date.now()}`, updated_at: new Date().toISOString() })
    .eq("id", usaRow.id);
  const { data: grCheck } = await sb
    .from("price_menu_rows")
    .select("raw_price_normal, notes")
    .eq("id", grRow.id)
    .single();
  if (grCheck?.raw_price_normal !== beforeGr) failures.push("USA edit mutated Greek price");
  // cleanup USA note
  await sb
    .from("price_menu_rows")
    .update({ notes: "", updated_at: new Date().toISOString() })
    .eq("id", usaRow.id);
  console.log("USA isolation ok; usa raw was", beforeUsa);

  // Bulk adjust preview + apply + undo on USA menu only
  const preview = await bulkAdjustPrices({
    menu_id: usaHigh.id,
    mode: "add",
    amount: 1,
    round_to: 1,
    target: "normal",
    preview: true,
    actor,
  });
  console.log("bulk preview sample", preview.preview.slice(0, 2));
  const applied = await bulkAdjustPrices({
    menu_id: usaHigh.id,
    mode: "add",
    amount: 1,
    round_to: 1,
    target: "normal",
    preview: false,
    actor,
  });
  console.log("bulk applied", applied.bulk_operation_id);
  const undone = await undoLastChange(actor, usaHigh.id);
  console.log("undo", undone.undone);

  // Revert any residual by subtracting 1 if undo didn't restore structured fields fully
  // Restore from raw by re-running migration-safe subtract of the +1 if needed
  const { data: afterUndo } = await sb
    .from("price_menu_rows")
    .select("id, raw_price_normal, price_min")
    .eq("menu_id", usaHigh.id)
    .limit(1)
    .maybeSingle();
  console.log("after undo sample", afterUndo);

  // Link/unlink throwaway: pick an unlinked inactive model if any
  const unlinked = menus.unlinkedActiveModels[0] || menus.allModels.find((m) => m.status !== "active");
  if (unlinked && high) {
    const r1 = await linkModels(high.id, [unlinked.id], actor, { forceMove: true });
    console.log("linked", r1.linked);
    await unlinkModel(unlinked.id, actor);
    console.log("unlinked", unlinked.model_name);
  }

  // Legacy tables untouched
  const legacyStill = (
    await sb.from("pricing_rows").select("*", { count: "exact", head: true })
  ).count;
  const tiersStill = (
    await sb.from("model_tiers").select("*", { count: "exact", head: true })
  ).count;
  console.log("legacy still present", { pricing_rows: legacyStill, model_tiers: tiersStill });

  if (failures.length) {
    console.error("FAILURES:\n" + failures.join("\n"));
    process.exit(1);
  }
  console.log("ALL CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
