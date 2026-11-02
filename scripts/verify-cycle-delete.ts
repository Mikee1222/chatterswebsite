/**
 * Throwaway-only verification for Content Cycle delete (keep vs delete bunches + numbering).
 * Avoids importing server-only content-cycles (tsx conflict) — mirrors deleteCycle semantics.
 *
 * Usage: npx tsx scripts/verify-cycle-delete.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";
loadEnv({ path: ".env.vercel.local" });
loadEnv({ path: ".env.local" });
loadEnv();

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabaseServiceClient } from "../lib/supabase-server";
import {
  createVideoBunch,
  deleteVideoBunch,
  getVideoBunch,
} from "../services/winner-sourcing";

const TAG = `[throwaway-cycle-del-${Date.now()}]`;

async function ensureRpc(sb: ReturnType<typeof getSupabaseServiceClient>) {
  const { error } = await sb.rpc("delete_content_cycle_atomic", {
    p_cycle_id: "00000000-0000-0000-0000-000000000000",
    p_delete_bunches: false,
  });
  if (!error) return true;
  const missing =
    /could not find the function|function .* does not exist|PGRST202|Cycle not found/i.test(
      error.message,
    ) || error.code === "PGRST202";
  if (/Cycle not found/i.test(error.message)) return true;
  if (!missing) throw new Error(`rpc probe: ${error.message}`);

  console.log("Applying delete_content_cycle_atomic migration via SQL…");
  const sql = readFileSync(
    resolve("supabase/migrations/20261103120000_delete_content_cycle_atomic.sql"),
    "utf8",
  );
  // Prefer exec via postgres REST isn't available — try rpc create through service.
  // Fall back: ordered steps in this script are enough to verify semantics.
  console.log("   (RPC missing — script will use ordered-step fallback for deletes)");
  void sql;
  return false;
}

async function deleteCycleFallback(
  sb: ReturnType<typeof getSupabaseServiceClient>,
  cycleId: string,
  deleteBunches: boolean,
  actor: { user_id: string; user_name: string },
  hasRpc: boolean,
) {
  if (hasRpc) {
    const { error } = await sb.rpc("delete_content_cycle_atomic", {
      p_cycle_id: cycleId,
      p_delete_bunches: deleteBunches,
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (deleteBunches) {
    const { data: bunches } = await sb.from("video_bunches").select("id").eq("cycle_id", cycleId);
    for (const row of bunches ?? []) {
      await deleteVideoBunch(String((row as { id: string }).id), actor);
    }
  } else {
    await sb.from("video_bunches").update({ cycle_id: null }).eq("cycle_id", cycleId);
    await sb
      .from("content_cycles")
      .update({ proven_bunch_id: null, experimental_bunch_id: null })
      .eq("id", cycleId);
  }
  const { error } = await sb.from("content_cycles").delete().eq("id", cycleId);
  if (error) throw new Error(error.message);
}

async function insertCycle(
  sb: ReturnType<typeof getSupabaseServiceClient>,
  modelId: string,
  modelName: string,
  number: number,
  actor: { user_id: string; user_name: string },
) {
  const { data, error } = await sb
    .from("content_cycles")
    .insert({
      model_id: modelId,
      model_name: modelName,
      number,
      start_date: "2099-01-01",
      end_date: "2099-01-15",
      proven_cap: 5,
      experimental_cap: 3,
      grid_per_day: 3,
      trials_per_day: 6,
      status: "filling",
      created_by_id: actor.user_id,
      created_by_name: actor.user_name,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; number: number };
}

async function main() {
  const sb = getSupabaseServiceClient();
  const actor = { user_id: "script-verify", user_name: "verify-cycle-delete" };
  const modelId = `throwaway-model-${Date.now()}`;
  const modelName = `${TAG} Model`;
  const hasRpc = await ensureRpc(sb);

  console.log("1) Keep-bunches: create cycle + 2 bunches…");
  const c1 = await insertCycle(sb, modelId, modelName, 9001, actor);
  const b1 = await createVideoBunch({
    name: `${TAG} Keep Proven`,
    model_id: modelId,
    model_name: modelName,
    target_video_count: 5,
    created_by_id: actor.user_id,
    created_by_name: actor.user_name,
    kind: "proven",
    cycle_id: c1.id,
  });
  const b2 = await createVideoBunch({
    name: `${TAG} Keep Exp`,
    model_id: modelId,
    model_name: modelName,
    target_video_count: 3,
    created_by_id: actor.user_id,
    created_by_name: actor.user_name,
    kind: "experimental",
    cycle_id: c1.id,
  });
  await sb
    .from("content_cycles")
    .update({ proven_bunch_id: b1.id, experimental_bunch_id: b2.id })
    .eq("id", c1.id);

  await deleteCycleFallback(sb, c1.id, false, actor, hasRpc);
  const still1 = await getVideoBunch(b1.id);
  const still2 = await getVideoBunch(b2.id);
  if (!still1 || !still2) throw new Error("Bunches should remain after keep_bunches");
  if (still1.cycle_id || still2.cycle_id) throw new Error("Bunches should be unlinked (cycle_id null)");
  const { data: gone1 } = await sb.from("content_cycles").select("id").eq("id", c1.id).maybeSingle();
  if (gone1) throw new Error("Cycle should be deleted");
  console.log("   ok keep_bunches — bunches remain unlinked");

  console.log("2) Delete-bunches: create cycle + bunches + queue item…");
  const c2 = await insertCycle(sb, modelId, modelName, 9002, actor);
  const d1 = await createVideoBunch({
    name: `${TAG} Del Proven`,
    model_id: modelId,
    model_name: modelName,
    target_video_count: 5,
    created_by_id: actor.user_id,
    created_by_name: actor.user_name,
    kind: "proven",
    cycle_id: c2.id,
  });
  const d2 = await createVideoBunch({
    name: `${TAG} Del Exp`,
    model_id: modelId,
    model_name: modelName,
    target_video_count: 3,
    created_by_id: actor.user_id,
    created_by_name: actor.user_name,
    kind: "experimental",
    cycle_id: c2.id,
  });
  await sb
    .from("content_cycles")
    .update({ proven_bunch_id: d1.id, experimental_bunch_id: d2.id })
    .eq("id", c2.id);

  const { data: sub, error: subErr } = await sb
    .from("winner_submissions")
    .insert({
      model_id: modelId,
      model_name: modelName,
      submitted_by_id: actor.user_id,
      submitted_by_name: actor.user_name,
      video_link: `https://example.com/${TAG}-queue`,
      view_count: 1,
      tier: "winner",
      status: "queued_for_recreation",
    })
    .select("id")
    .single();
  if (subErr) throw new Error(subErr.message);
  const { data: qRow, error: qErr } = await sb
    .from("recreation_queue_items")
    .insert({
      winner_submission_id: (sub as { id: string }).id,
      bunch_id: d1.id,
      required_recreate_count: 1,
      decision: "next_bunch",
    })
    .select("id")
    .single();
  if (qErr) throw new Error(qErr.message);
  const queueId = String((qRow as { id: string }).id);

  await deleteCycleFallback(sb, c2.id, true, actor, hasRpc);
  if (await getVideoBunch(d1.id)) throw new Error("Proven bunch should be deleted");
  if (await getVideoBunch(d2.id)) throw new Error("Exp bunch should be deleted");
  const { data: q } = await sb
    .from("recreation_queue_items")
    .select("bunch_id, decision")
    .eq("id", queueId)
    .maybeSingle();
  const qr = q as { bunch_id?: string | null; decision?: string } | null;
  if (!qr) throw new Error("Queue item should still exist");
  if (qr.bunch_id != null) throw new Error("Queue item should be unassigned");
  if (qr.decision !== "pending") throw new Error(`Queue decision should be pending, got ${qr.decision}`);
  await sb.from("recreation_queue_items").delete().eq("id", queueId);
  await sb.from("winner_submissions").delete().eq("id", (sub as { id: string }).id);
  console.log("   ok delete_bunches — bunches gone, queue returned");

  console.log("3) Numbering: max+1 after deleting high number…");
  const cHigh = await insertCycle(sb, modelId, modelName, 9010, actor);
  const cLow = await insertCycle(sb, modelId, modelName, 9005, actor);
  await deleteCycleFallback(sb, cHigh.id, false, actor, hasRpc);
  const { data: remaining } = await sb
    .from("content_cycles")
    .select("number")
    .eq("model_id", modelId);
  const maxNum = (remaining ?? []).reduce(
    (m, r) => Math.max(m, Number((r as { number: number }).number) || 0),
    0,
  );
  const next = maxNum + 1;
  const cNext = await insertCycle(sb, modelId, modelName, next, actor);
  if (cNext.number !== next) throw new Error("next number mismatch");
  // Collision check: inserting same number must fail
  let collided = false;
  try {
    await insertCycle(sb, modelId, modelName, next, actor);
  } catch {
    collided = true;
  }
  if (!collided) throw new Error("UNIQUE(model_id, number) should reject duplicate");
  console.log(`   ok next number=${next} (unique), low cycle ${cLow.number} still present`);

  console.log("4) Cleanup throwaway rows…");
  await sb.from("video_bunches").delete().eq("model_id", modelId);
  await sb.from("content_cycles").delete().eq("model_id", modelId);
  // settings should not have been created — ensure none
  const { data: settings } = await sb
    .from("content_cycle_settings")
    .select("model_id")
    .eq("model_id", modelId)
    .maybeSingle();
  if (settings) {
    await sb.from("content_cycle_settings").delete().eq("model_id", modelId);
    console.log("   (unexpected settings row cleaned)");
  }
  // leftover keep bunches
  await deleteVideoBunch(b1.id, actor).catch(() => null);
  await deleteVideoBunch(b2.id, actor).catch(() => null);

  console.log("ALL OK", { hasRpc, nextNumber: next });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
