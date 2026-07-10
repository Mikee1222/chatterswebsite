#!/usr/bin/env npx tsx
/**
 * Cleanup recurring `va_tasks` over-spawn:
 * 1. Duplicate pending/in_progress rows (same series + Athens due day) → mark skipped (keep best progress)
 * 2. Premature future real rows (due after today Athens) → delete so virtual previews return
 *
 * Usage (from repo root, requires Airtable env like other scripts):
 *   npx tsx scripts/cleanup-duplicate-recurring-tasks.ts
 *   npx tsx scripts/cleanup-duplicate-recurring-tasks.ts --dry-run
 *   npx tsx scripts/cleanup-duplicate-recurring-tasks.ts --skip-future   # dupes only
 *   npx tsx scripts/cleanup-duplicate-recurring-tasks.ts --skip-dupes    # future only
 */

import "dotenv/config";
import { ymdInAthens } from "../lib/airtable-datetime";
import { getVaTasksViewTodayYmd } from "../lib/va-task-date-filter";
import { shouldSpawnRecurring, vaTaskSeriesKey } from "../lib/recurrence";
import { deleteVaTask, getAllVaTasks, updateVaTask } from "../services/va-tasks";
import { getPhasesByTask } from "../services/task-phases";

const dryRun = process.argv.includes("--dry-run");
const skipFuture = process.argv.includes("--skip-future");
const skipDupes = process.argv.includes("--skip-dupes");

async function countCompletedChecklistItems(taskId: string): Promise<number> {
  const phases = await getPhasesByTask(taskId);
  let completed = 0;
  for (const phase of phases) {
    for (const item of phase.items) {
      if (item.status === "completed") completed += 1;
    }
  }
  return completed;
}

function groupKey(task: { title: string; assigned_to_ids: string[]; due_date: string | null }): string {
  const ymd = task.due_date ? ymdInAthens(task.due_date) : "";
  return `${vaTaskSeriesKey(task)}\0${ymd}`;
}

async function cleanupDupes() {
  const all = await getAllVaTasks();
  const pendingRecurring = all.filter(
    (t) => t.is_recurring && (t.status === "pending" || t.status === "in_progress"),
  );

  console.log(`\n=== Duplicate same-day cleanup ===`);
  console.log(`Found ${pendingRecurring.length} pending/in_progress recurring tasks`);

  const groups = new Map<string, typeof pendingRecurring>();
  for (const t of pendingRecurring) {
    const key = groupKey(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const duplicateGroups = [...groups.entries()].filter(([, g]) => g.length > 1);
  console.log(`Duplicate groups (same series + due day): ${duplicateGroups.length}`);

  let marked = 0;
  for (const [key, group] of duplicateGroups) {
    const scored = await Promise.all(
      group.map(async (t) => ({
        task: t,
        completedItems: await countCompletedChecklistItems(t.id),
        createdMs: t.created_at ? new Date(t.created_at).getTime() : Number.POSITIVE_INFINITY,
      })),
    );

    scored.sort((a, b) => {
      if (b.completedItems !== a.completedItems) return b.completedItems - a.completedItems;
      return a.createdMs - b.createdMs;
    });

    const [keep, ...dups] = scored.map((s) => s.task);
    const titlePreview = key.split("\0")[0]?.slice(0, 60) ?? keep.id;
    const dueYmd = key.split("\0").slice(-1)[0] ?? "?";
    const keepScore = scored[0]!.completedItems;
    console.log(
      `"${titlePreview}" due ${dueYmd}: keeping ${keep.id} (${keepScore} items done), removing ${dups.length} duplicate(s)`,
    );

    for (const dup of dups) {
      if (dryRun) {
        console.log(`  would skip ${dup.id}`);
        marked += 1;
        continue;
      }
      await updateVaTask(dup.id, {
        status: "skipped",
        completed_notes: "Duplicate recurring instance (cleanup-duplicate-recurring-tasks).",
      });
      marked += 1;
    }
  }

  console.log(`Dupes: ${dryRun ? "Would mark" : "Marked"} ${marked} duplicate task(s) as skipped.`);
  return { marked, duplicateGroups };
}

async function cleanupFutureRows() {
  const todayYmd = getVaTasksViewTodayYmd();
  const all = await getAllVaTasks();

  const premature = all.filter((t) => {
    if (!t.is_recurring || t.is_virtual_occurrence) return false;
    if (!shouldSpawnRecurring(t)) return false;
    const ymd = t.due_date ? ymdInAthens(t.due_date) : null;
    return Boolean(ymd && ymd > todayYmd);
  });

  console.log(`\n=== Premature future real rows (after ${todayYmd}) ===`);
  console.log(`Found ${premature.length} row(s) to delete`);

  let deleted = 0;
  for (const t of premature) {
    const ymd = ymdInAthens(t.due_date);
    console.log(`  delete ${t.id} | "${t.title}" | due ${t.due_date} (${ymd}) | status=${t.status}`);
    if (dryRun) {
      deleted += 1;
      continue;
    }
    await deleteVaTask(t.id);
    deleted += 1;
  }

  console.log(`Future: ${dryRun ? "Would delete" : "Deleted"} ${deleted} premature row(s).`);
  return { deleted, ids: premature.map((t) => t.id) };
}

async function cleanup() {
  console.log(`Recurring cleanup${dryRun ? " (dry-run)" : ""}`);
  console.log(`Athens today: ${getVaTasksViewTodayYmd()}`);

  const results: Record<string, unknown> = {};

  if (!skipDupes) {
    results.dupes = await cleanupDupes();
  }
  if (!skipFuture) {
    results.future = await cleanupFutureRows();
  }

  console.log("\nDone.", JSON.stringify(results, null, 2));
}

cleanup().catch((e) => {
  console.error(e);
  process.exit(1);
});
