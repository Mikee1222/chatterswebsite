/**
 * Proves the incomplete-phases root cause + fix:
 * 1) Old scoring preferred incomplete shells over healthy templates
 * 2) Mid-clone abort (Phase 1 only) is self-healed by atomic clone
 * 3) Concurrent clones end at full template phase/item counts
 *
 * Usage: npx tsx scripts/prove-incomplete-phase-clone-fix.ts
 */
import "./_polyfill-websocket";
import { config } from "dotenv";
config({ path: ".env.vercel.local" });
config({ path: ".env.local" });
config({ path: ".env" });

const HEALTHY_SOURCE = "6133753d-6668-4c39-ba6a-848524c30e9a"; // Lydia Oct 3 — 3/50
const POISON_SOURCE = "b466b789-fd75-4946-8fa1-1cf1bbe2962d"; // Lydia Sept 30 — 2/19 empty P2

async function main() {
  const { createVaTask, deleteVaTask } = await import("@/services/va-tasks");
  const {
    clonePhasesToTask,
    getPhasesByTask,
    scorePhaseCloneSources,
    taskPhasesMatchTemplate,
  } = await import("@/services/task-phases");
  const { getSupabaseServiceClient } = await import("@/lib/supabase-server");
  const sb = getSupabaseServiceClient();

  let failed = false;
  const stamp = Date.now();

  // --- 1) Scoring proof ---
  const scores = await scorePhaseCloneSources([HEALTHY_SOURCE, POISON_SOURCE]);
  const healthy = scores.find((s) => s.taskId === HEALTHY_SOURCE)!;
  const poison = scores.find((s) => s.taskId === POISON_SOURCE)!;
  const oldScore = (row: typeof healthy) =>
    (row.withModel ? 1_000_000 : 0) + 100_000 - Math.min(row.itemCount, 99_999);
  const newScore = (row: typeof healthy) =>
    row.isComplete
      ? (row.withModel ? 1_000_000 : 0) +
        row.phaseCount * 10_000 +
        100_000 -
        Math.min(row.itemCount, 99_999)
      : Number.NEGATIVE_INFINITY;

  console.log("\n=== 1) Source scoring ===");
  console.log("healthy:", healthy);
  console.log("poison:", poison);
  console.log("OLD score healthy/poison:", oldScore(healthy), oldScore(poison));
  console.log("NEW score healthy/poison:", newScore(healthy), newScore(poison));
  if (!(oldScore(poison) > oldScore(healthy))) {
    console.error("FAIL: expected old scoring to prefer poison incomplete source");
    failed = true;
  } else {
    console.log("PASS: old scoring prefers incomplete poison source");
  }
  if (!(newScore(healthy) > newScore(poison) && poison.isComplete === false)) {
    console.error("FAIL: new scoring should prefer complete healthy source");
    failed = true;
  } else {
    console.log("PASS: new scoring prefers complete healthy source");
  }

  // --- 2) Mid-clone abort → self-heal ---
  console.log("\n=== 2) Mid-clone abort self-heal ===");
  const sourcePhases = await getPhasesByTask(HEALTHY_SOURCE);
  const sourceItems = sourcePhases.reduce((n, p) => n + p.items.length, 0);
  const target = await createVaTask({
    title: `CLONE-HEAL-PROOF ${stamp}`,
    description: "temp — delete after proof",
    assigned_to_ids: ["281a5068-4207-4e61-9a19-4dd0cf88b067"],
    assigned_model_ids: ["recm7xLOotXa1vQHc"],
    assigned_model_names: ["Lydia"],
    status: "pending",
    priority: "normal",
    due_date: new Date().toISOString(),
    is_recurring: false,
  });

  try {
    const p1 = sourcePhases.find((p) => p.phase_number === 1)!;
    const { data: phaseRow, error: pErr } = await sb
      .from("va_task_phases")
      .insert({
        phase_id: `phase_proof_${stamp}`,
        task_id: target.id,
        task_title: target.title,
        phase_number: 1,
        title: p1.title,
        description: p1.description ?? "",
        status: "pending",
        assigned_model_id: p1.assigned_model_id,
        assigned_model_name: p1.assigned_model_name,
        region: p1.region,
      })
      .select("id, phase_id")
      .single();
    if (pErr) throw pErr;
    const phaseKey = phaseRow.phase_id || phaseRow.id;
    await sb.from("va_task_phase_items").insert(
      p1.items.slice(0, 3).map((item, idx) => ({
        item_id: `item_proof_${stamp}_${idx}`,
        phase_id: phaseKey,
        task_id: target.id,
        title: item.title,
        description: item.description ?? "",
        requires_screenshot: item.requires_screenshot ?? false,
        status: idx === 0 ? "completed" : "pending",
        completed_at: idx === 0 ? new Date().toISOString() : null,
        sort_order: item.sort_order,
        step_type: item.step_type,
      })),
    );

    const before = await getPhasesByTask(target.id);
    const beforeItems = before.reduce((n, p) => n + p.items.length, 0);
    const beforeCompleted = before
      .flatMap((p) => p.items)
      .filter((i) => i.status === "completed").length;
    console.log(`Simulated abort: ${before.length} phases, ${beforeItems} items, ${beforeCompleted} completed`);
    if (before.length !== 1 || beforeItems !== 3) {
      console.error("FAIL: abort simulation setup wrong");
      failed = true;
    }

    // Old behavior would skip here (taskHasAnyPhases === true). New heal continues.
    const matchBefore = await taskPhasesMatchTemplate(target.id, HEALTHY_SOURCE);
    if (matchBefore) {
      console.error("FAIL: partial target should not match template");
      failed = true;
    } else {
      console.log("PASS: partial target does not match template (heal will run)");
    }

    await clonePhasesToTask(HEALTHY_SOURCE, target);
    const after = await getPhasesByTask(target.id);
    const afterItems = after.reduce((n, p) => n + p.items.length, 0);
    const afterCompleted = after
      .flatMap((p) => p.items)
      .filter((i) => i.status === "completed").length;
    console.log(
      `After heal: ${after.length} phases, ${afterItems} items, ${afterCompleted} completed (expected ${sourcePhases.length}/${sourceItems}, completed≥1)`,
    );
    if (after.length !== sourcePhases.length || afterItems !== sourceItems) {
      console.error("FAIL: heal did not restore full template");
      failed = true;
    } else {
      console.log("PASS: heal restored full 3-phase template");
    }
    if (afterCompleted < 1) {
      console.error("FAIL: completed progress was not preserved");
      failed = true;
    } else {
      console.log("PASS: completed item progress preserved");
    }

    // --- 3) Concurrent clones on empty target ---
    console.log("\n=== 3) Concurrent clone ===");
    const target2 = await createVaTask({
      title: `CLONE-CONCUR-PROOF ${stamp}`,
      description: "temp — delete after proof",
      assigned_to_ids: ["281a5068-4207-4e61-9a19-4dd0cf88b067"],
      assigned_model_ids: ["recm7xLOotXa1vQHc"],
      assigned_model_names: ["Lydia"],
      status: "pending",
      priority: "normal",
      due_date: new Date().toISOString(),
      is_recurring: false,
    });
    try {
      const results = await Promise.all([
        clonePhasesToTask(HEALTHY_SOURCE, target2),
        clonePhasesToTask(HEALTHY_SOURCE, target2),
        clonePhasesToTask(HEALTHY_SOURCE, target2),
      ]);
      console.log("parallel results:", results);
      const final = await getPhasesByTask(target2.id);
      const finalItems = final.reduce((n, p) => n + p.items.length, 0);
      console.log(`After concurrent: ${final.length} phases, ${finalItems} items`);
      if (final.length !== sourcePhases.length || finalItems !== sourceItems) {
        console.error("FAIL: concurrent clone incomplete or duplicated");
        failed = true;
      } else {
        console.log("PASS: concurrent clones → exactly one complete checklist");
      }
    } finally {
      await deleteVaTask(target2.id).catch(() => undefined);
    }
  } finally {
    await deleteVaTask(target.id).catch(() => undefined);
    console.log("Cleaned up proof targets");
  }

  if (failed) {
    console.error("\nOVERALL: FAIL");
    process.exit(1);
  }
  console.log("\nOVERALL: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
