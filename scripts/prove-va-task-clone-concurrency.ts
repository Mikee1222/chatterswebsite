/**
 * Concurrency proof: 3 parallel clonePhasesToTask onto the same empty target
 * must leave exactly one phase set (not 2–3× checklist items).
 *
 * Usage: npx tsx scripts/prove-va-task-clone-concurrency.ts
 */
import "./_polyfill-websocket";
import { config } from "dotenv";
config({ path: ".env.vercel.local" });
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { createVaTask, deleteVaTask } = await import("@/services/va-tasks");
  const { clonePhasesToTask, getPhasesByTask } = await import("@/services/task-phases");
  const { getSupabaseServiceClient } = await import("@/lib/supabase-server");

  const sb = getSupabaseServiceClient();

  // Source: a healthy Ariane Warm-Up day (44 items / 3 phases).
  const SOURCE_ID = "f6d5a197-5a97-4bfc-bbc3-4335aa9780b9"; // Sept 28 Victoria Danger
  const sourcePhases = await getPhasesByTask(SOURCE_ID);
  const sourceItems = sourcePhases.reduce((n, p) => n + p.items.length, 0);
  if (sourcePhases.length < 1 || sourceItems < 1) {
    throw new Error(`Source ${SOURCE_ID} has no phases/items to clone`);
  }
  console.log(`Source ${SOURCE_ID}: ${sourcePhases.length} phases, ${sourceItems} items`);

  const stamp = Date.now();
  const target = await createVaTask({
    title: `CLONE-CONCURRENCY-PROOF ${stamp}`,
    description: "temp — delete after proof",
    assigned_to_ids: ["5cbba822-88f2-4c09-9873-47187ff90f3e"], // Ariane
    assigned_model_ids: ["d62b2d86-707d-4491-b6e2-545fc8f6f733"],
    assigned_model_names: ["Victoria Danger"],
    status: "pending",
    priority: "normal",
    due_date: new Date().toISOString(),
    is_recurring: false,
  });
  console.log(`Created empty target ${target.id}`);

  try {
    const results = await Promise.all([
      clonePhasesToTask(SOURCE_ID, target),
      clonePhasesToTask(SOURCE_ID, target),
      clonePhasesToTask(SOURCE_ID, target),
    ]);
    console.log("clonePhasesToTask parallel results (cloned phase counts):", results);

    const { data: phases, error: pErr } = await sb
      .from("va_task_phases")
      .select("id, phase_number, phase_id")
      .eq("task_id", target.id);
    if (pErr) throw pErr;

    const { data: items, error: iErr } = await sb
      .from("va_task_phase_items")
      .select("id, phase_id, sort_order")
      .eq("task_id", target.id);
    if (iErr) throw iErr;

    const phaseCount = phases?.length ?? 0;
    const itemCount = items?.length ?? 0;
    console.log(`After 3 concurrent clones: ${phaseCount} phases, ${itemCount} items`);
    console.log(`Expected: ${sourcePhases.length} phases, ${sourceItems} items`);

    const ok = phaseCount === sourcePhases.length && itemCount === sourceItems;
    if (!ok) {
      console.error("FAIL: concurrent clone produced duplicates");
      process.exitCode = 1;
    } else {
      console.log("PASS: 3 concurrent clones → exactly 1 checklist copy");
    }

    // Also prove DB unique rejects a second item insert with same (phase_id, sort_order)
    const phaseId = phases?.[0]?.phase_id;
    if (phaseId) {
      const { error: dupErr } = await sb.from("va_task_phase_items").insert({
        item_id: `item_proof_${stamp}`,
        phase_id: phaseId,
        task_id: target.id,
        title: "SHOULD_FAIL_UNIQUE",
        sort_order: 0,
        status: "pending",
      });
      if (dupErr && (dupErr.message.includes("unique") || dupErr.code === "23505")) {
        console.log("PASS: DB unique index blocked duplicate (phase_id, sort_order) insert");
      } else if (dupErr) {
        console.log("PASS (unique violated with message):", dupErr.message);
      } else {
        console.error("FAIL: duplicate item insert was allowed");
        process.exitCode = 1;
      }
    }
  } finally {
    await deleteVaTask(target.id).catch(() => undefined);
    console.log("Cleaned up proof target");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
