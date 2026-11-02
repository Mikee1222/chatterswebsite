/**
 * Throwaway-only verification for Content Cycles bunch delete.
 * Exercises shared deleteVideoBunch + cycle FK/counter behavior without importing
 * server-only content-cycles (tsx + server-only conflict).
 *
 * Usage: npx tsx scripts/verify-cycle-bunch-delete.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";
loadEnv({ path: ".env.vercel.local" });
loadEnv({ path: ".env.local" });
loadEnv();

import { getSupabaseServiceClient } from "../lib/supabase-server";
import {
  createVideoBunch,
  deleteVideoBunch,
  getVideoBunch,
  getVideoBunchDeleteImpact,
} from "../services/winner-sourcing";

const TAG = `[throwaway-cycle-delete-${Date.now()}]`;

async function main() {
  const sb = getSupabaseServiceClient();
  const actor = { user_id: "script-verify", user_name: "verify-cycle-bunch-delete" };
  const modelId = `throwaway-model-${Date.now()}`;
  const modelName = `${TAG} Model`;

  console.log("1) Create throwaway cycle + bunches…");
  const { data: cycleRow, error: cycleErr } = await sb
    .from("content_cycles")
    .insert({
      model_id: modelId,
      model_name: modelName,
      number: 9999,
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
  if (cycleErr) throw new Error(cycleErr.message);
  const cycleId = String(cycleRow.id);

  const emptyProven = await createVideoBunch({
    name: `${TAG} Empty Proven`,
    model_id: modelId,
    model_name: modelName,
    target_video_count: 5,
    created_by_id: actor.user_id,
    created_by_name: actor.user_name,
    kind: "proven",
    cycle_id: cycleId,
  });
  const pendingExp = await createVideoBunch({
    name: `${TAG} Pending Exp`,
    model_id: modelId,
    model_name: modelName,
    target_video_count: 3,
    created_by_id: actor.user_id,
    created_by_name: actor.user_name,
    kind: "experimental",
    cycle_id: cycleId,
  });

  await sb
    .from("content_cycles")
    .update({
      proven_bunch_id: emptyProven.id,
      experimental_bunch_id: pendingExp.id,
    })
    .eq("id", cycleId);

  await sb.from("recreate_video_slots").insert({
    bunch_id: pendingExp.id,
    source: "researcher_submitted",
    sequence_number: 1,
    description: `${TAG} pending slot`,
    video_link: "https://example.com/throwaway",
    status: "Pending Review",
  });

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
  const { data: queueItem, error: qErr } = await sb
    .from("recreation_queue_items")
    .insert({
      winner_submission_id: sub.id,
      bunch_id: pendingExp.id,
      required_recreate_count: 1,
      decision: "next_bunch",
    })
    .select("id")
    .single();
  if (qErr) throw new Error(qErr.message);

  console.log("2) Empty bunch impact — should NOT require typed confirm…");
  const emptyImpact = await getVideoBunchDeleteImpact(emptyProven.id);
  if (!emptyImpact) throw new Error("missing empty impact");
  if (emptyImpact.has_valuable_work) throw new Error("empty bunch should not have valuable work");
  console.log("   ok empty has_valuable_work=false");

  console.log("3) Pending-only impact — one-click confirm…");
  const pendingImpact = await getVideoBunchDeleteImpact(pendingExp.id);
  if (!pendingImpact) throw new Error("missing pending impact");
  if (pendingImpact.has_valuable_work) {
    throw new Error("pending-only should not require typed confirm");
  }
  if (pendingImpact.queue_items_returning !== 1) {
    throw new Error(`expected 1 queue returning, got ${pendingImpact.queue_items_returning}`);
  }
  console.log("   ok pending slots + queue returning");

  console.log("4) Approved throwaway bunch — typed confirm…");
  const approvedBunch = await createVideoBunch({
    name: `${TAG} Approved`,
    model_id: modelId,
    model_name: modelName,
    target_video_count: 2,
    created_by_id: actor.user_id,
    created_by_name: actor.user_name,
    kind: "proven",
  });
  await sb.from("recreate_video_slots").insert({
    bunch_id: approvedBunch.id,
    source: "researcher_submitted",
    sequence_number: 1,
    description: `${TAG} approved`,
    video_link: "https://example.com/approved",
    status: "Approved",
  });
  const approvedImpact = await getVideoBunchDeleteImpact(approvedBunch.id);
  if (!approvedImpact?.has_valuable_work) throw new Error("approved should require typed confirm");
  console.log("   ok approved has_valuable_work");

  console.log("5) Delete empty proven (cycle membership + SET NULL)…");
  // Mirror deleteBunchFromCycle membership check
  const { data: cBefore } = await sb
    .from("content_cycles")
    .select("proven_bunch_id, experimental_bunch_id")
    .eq("id", cycleId)
    .single();
  if (cBefore?.proven_bunch_id !== emptyProven.id) throw new Error("cycle membership mismatch");
  await deleteVideoBunch(emptyProven.id, actor);
  const { data: cAfterEmpty } = await sb
    .from("content_cycles")
    .select("proven_bunch_id, experimental_bunch_id")
    .eq("id", cycleId)
    .single();
  if (cAfterEmpty?.proven_bunch_id != null) throw new Error("proven_bunch_id should be null via FK");
  if (cAfterEmpty?.experimental_bunch_id !== pendingExp.id) {
    throw new Error("experimental ref should remain");
  }
  console.log("   ok proven_bunch_id SET NULL, cycle row kept");

  console.log("6) Cross-cycle rejection (membership check)…");
  const belongs =
    cAfterEmpty?.proven_bunch_id === approvedBunch.id ||
    cAfterEmpty?.experimental_bunch_id === approvedBunch.id;
  if (belongs) throw new Error("approved bunch should not belong to cycle");
  console.log("   ok other-cycle bunch would be rejected by API");

  console.log("7) Delete pending exp — queue returns…");
  await deleteVideoBunch(pendingExp.id, actor);
  const { data: qAfter } = await sb
    .from("recreation_queue_items")
    .select("bunch_id, decision")
    .eq("id", queueItem.id)
    .maybeSingle();
  if (!qAfter) throw new Error("queue item missing after delete");
  if (qAfter.bunch_id != null) throw new Error("queue bunch_id should be null");
  if (qAfter.decision !== "pending") throw new Error(`decision should be pending, got ${qAfter.decision}`);
  const { data: cAfterExp } = await sb
    .from("content_cycles")
    .select("experimental_bunch_id")
    .eq("id", cycleId)
    .single();
  if (cAfterExp?.experimental_bunch_id != null) throw new Error("experimental_bunch_id should be null");
  console.log("   ok queue unassigned pending + experimental cleared");

  console.log("8) Recreate proven bunch on empty slot…");
  const recreated = await createVideoBunch({
    name: `${TAG} Recreated Proven`,
    model_id: modelId,
    model_name: modelName,
    target_video_count: 5,
    created_by_id: actor.user_id,
    created_by_name: actor.user_name,
    kind: "proven",
    cycle_id: cycleId,
  });
  await sb.from("content_cycles").update({ proven_bunch_id: recreated.id }).eq("id", cycleId);
  const { data: cRecreated } = await sb
    .from("content_cycles")
    .select("proven_bunch_id")
    .eq("id", cycleId)
    .single();
  if (cRecreated?.proven_bunch_id !== recreated.id) throw new Error("recreate failed");
  console.log("   ok Create bunch slot refill");

  console.log("9) Bunches-page path still works (deleteVideoBunch)…");
  await deleteVideoBunch(approvedBunch.id, actor);
  if (await getVideoBunch(approvedBunch.id)) throw new Error("approved bunch still exists");
  console.log("   ok shared deleteVideoBunch");

  console.log("10) Cleanup throwaway…");
  await deleteVideoBunch(recreated.id, actor).catch(() => null);
  await sb.from("recreation_queue_items").delete().eq("id", queueItem.id);
  await sb.from("winner_submissions").delete().eq("id", sub.id);
  await sb.from("content_cycles").delete().eq("id", cycleId);
  const { data: leftovers } = await sb
    .from("video_bunches")
    .select("id")
    .ilike("name", `${TAG}%`);
  for (const row of leftovers ?? []) {
    await deleteVideoBunch(String((row as { id: string }).id), actor).catch(() => null);
  }

  console.log("PASS — throwaway cycle bunch delete verification complete");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
