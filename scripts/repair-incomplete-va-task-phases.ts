/**
 * Repair recurring VA tasks whose phase/item structure is below a healthy series template.
 * Preserves completed checklist items (atomic RPC only inserts missing rows).
 *
 * Usage: npx tsx scripts/repair-incomplete-va-task-phases.ts
 */
import "./_polyfill-websocket";
import { config } from "dotenv";
config({ path: ".env.vercel.local" });
config({ path: ".env.local" });
config({ path: ".env" });

import { ymdInAthens } from "@/lib/airtable-datetime";
import { vaTaskSeriesKey } from "@/lib/recurrence";
import { clonePhasesToTask, scorePhaseCloneSources } from "@/services/task-phases";
import { createVaTask, getAllVaTasks, getVaTaskById } from "@/services/va-tasks";
import { occurrenceDueForAthensYmd } from "@/lib/recurrence";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

const AFFECTED = [
  "fb03dc31-99ab-4a73-9b27-c902d41cd71d", // Lydia Oct 4
  "b466b789-fd75-4946-8fa1-1cf1bbe2962d", // Lydia Sept 30
  "787e921a-86aa-46f8-ba19-4e3384e48935", // Chloe Warm-Up Sept 25
];

async function pickHealthySource(seriesKey: string, allTasks: Awaited<ReturnType<typeof getAllVaTasks>>) {
  const inSeries = allTasks.filter(
    (t) => !t.is_virtual_occurrence && t.is_recurring && vaTaskSeriesKey(t) === seriesKey,
  );
  const scores = await scorePhaseCloneSources(inSeries.map((t) => t.id));
  let bestId = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const row of scores) {
    if (!row.isComplete) continue;
    const score =
      (row.withModel ? 1_000_000 : 0) +
      row.phaseCount * 10_000 +
      100_000 -
      Math.min(row.itemCount, 99_999);
    if (score > bestScore) {
      bestScore = score;
      bestId = row.taskId;
    }
  }
  return bestId;
}

async function countStructure(taskId: string) {
  const sb = getSupabaseServiceClient();
  const [{ count: phases }, { count: items }, { count: completed }] = await Promise.all([
    sb.from("va_task_phases").select("id", { count: "exact", head: true }).eq("task_id", taskId),
    sb.from("va_task_phase_items").select("id", { count: "exact", head: true }).eq("task_id", taskId),
    sb
      .from("va_task_phase_items")
      .select("id", { count: "exact", head: true })
      .eq("task_id", taskId)
      .eq("status", "completed"),
  ]);
  return { phases: phases ?? 0, items: items ?? 0, completed: completed ?? 0 };
}

async function main() {
  const allTasks = await getAllVaTasks();
  console.log(`Loaded ${allTasks.length} VA tasks`);

  for (const id of AFFECTED) {
    const task = await getVaTaskById(id);
    if (!task) {
      console.warn(`SKIP missing ${id}`);
      continue;
    }
    const series = vaTaskSeriesKey(task);
    const sourceId = await pickHealthySource(series, allTasks);
    if (!sourceId) {
      console.error(`FAIL no healthy source for ${id} series=${series}`);
      continue;
    }
    const before = await countStructure(id);
    console.log(`\nRepair ${task.assigned_model_names} ${task.title} ${ymdInAthens(task.due_date)}`);
    console.log(`  before: ${before.phases} phases / ${before.items} items (${before.completed} completed)`);
    console.log(`  source: ${sourceId}`);
    await clonePhasesToTask(sourceId, task);
    const after = await countStructure(id);
    console.log(
      `  after:  ${after.phases} phases / ${after.items} items (${after.completed} completed)`,
    );
    if (after.completed < before.completed) {
      console.error("  FAIL: completed items decreased");
      process.exitCode = 1;
    } else if (after.phases < 3) {
      console.error("  FAIL: still incomplete");
      process.exitCode = 1;
    } else {
      console.log("  OK");
    }
  }

  // Ensure Lydia Oct 5 (tomorrow Athens) exists with full phases.
  const lydiaAnchor =
    (await getVaTaskById("fb03dc31-99ab-4a73-9b27-c902d41cd71d")) ??
    allTasks.find(
      (t) =>
        t.title.includes("Daily Marketing Routine Greece") &&
        (t.assigned_model_names ?? []).includes("Lydia"),
    );
  if (lydiaAnchor) {
    const tomorrowYmd = "2026-10-05";
    const dueIso = occurrenceDueForAthensYmd(lydiaAnchor, tomorrowYmd);
    const { buildRecurringSpawnKey } = await import("@/lib/recurrence");
    const key = buildRecurringSpawnKey(vaTaskSeriesKey(lydiaAnchor), tomorrowYmd);
    const { getVaTaskByRecurringSpawnKey } = await import("@/services/va-tasks-supabase");
    const existing = await getVaTaskByRecurringSpawnKey(key);
    const sourceId = await pickHealthySource(vaTaskSeriesKey(lydiaAnchor), allTasks);
    if (!sourceId) throw new Error("No healthy Lydia source for Oct 5");
    if (existing) {
      console.log(`\nOct 5 already exists ${existing.id} — healing`);
      await clonePhasesToTask(sourceId, existing);
      const after = await countStructure(existing.id);
      console.log(`  Oct 5: ${after.phases} phases / ${after.items} items`);
    } else if (dueIso) {
      console.log(`\nCreating Lydia Oct 5 occurrence due=${dueIso}`);
      const created = await createVaTask({
        title: lydiaAnchor.title,
        description: lydiaAnchor.description,
        assigned_to_ids: [...lydiaAnchor.assigned_to_ids],
        assigned_by_ids: lydiaAnchor.assigned_by_ids?.length
          ? [...lydiaAnchor.assigned_by_ids]
          : undefined,
        assigned_model_ids: [...(lydiaAnchor.assigned_model_ids ?? [])],
        assigned_model_names: [...(lydiaAnchor.assigned_model_names ?? [])],
        status: "pending",
        priority: lydiaAnchor.priority,
        due_date: dueIso,
        is_recurring: true,
        recurrence_type: lydiaAnchor.recurrence_type,
        recurrence_days: [...lydiaAnchor.recurrence_days],
        recurrence_interval: lydiaAnchor.recurrence_interval ?? undefined,
        recurrence_end_date: lydiaAnchor.recurrence_end_date,
        recurrence_skipped_dates: [...(lydiaAnchor.recurrence_skipped_dates ?? [])],
        reminder_minutes_before: lydiaAnchor.reminder_minutes_before,
        recurring_spawn_key: key,
      });
      await clonePhasesToTask(sourceId, created);
      const after = await countStructure(created.id);
      console.log(`  Oct 5 ${created.id}: ${after.phases} phases / ${after.items} items`);
      if (after.phases < 3) process.exitCode = 1;
    } else {
      console.warn("Could not compute Oct 5 due ISO");
    }
  }

  console.log("\nDone");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
