#!/usr/bin/env npx tsx
/**
 * One-time cleanup: duplicate pending/in_progress recurring `va_tasks` rows that share
 * the same series (title + assignees) AND the same Athens due calendar day.
 *
 * Keeps the row with the most completed checklist items (phase progress); ties break
 * on earliest created_at. Marks others as skipped.
 *
 * Usage (from repo root, requires Airtable env like other scripts):
 *   npx tsx scripts/cleanup-duplicate-recurring-tasks.ts
 *   npx tsx scripts/cleanup-duplicate-recurring-tasks.ts --dry-run
 */

import "dotenv/config";
import { ymdInAthens } from "../lib/airtable-datetime";
import { vaTaskSeriesKey } from "../lib/recurrence";
import { getAllVaTasks, updateVaTask } from "../services/va-tasks";
import { getPhasesByTask } from "../services/task-phases";

const dryRun = process.argv.includes("--dry-run");

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

async function cleanup() {
  const all = await getAllVaTasks();
  const pendingRecurring = all.filter(
    (t) => t.is_recurring && (t.status === "pending" || t.status === "in_progress"),
  );

  console.log(`Found ${pendingRecurring.length} pending/in_progress recurring tasks`);
  if (dryRun) console.log("(dry-run — no writes)");

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
      `"${titlePreview}" due ${dueYmd}: keeping ${keep.id} (${keepScore} items done), marking ${dups.length} duplicate(s)`,
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

  console.log(`Done. ${dryRun ? "Would mark" : "Marked"} ${marked} duplicate task(s) as skipped.`);
}

cleanup().catch((e) => {
  console.error(e);
  process.exit(1);
});
