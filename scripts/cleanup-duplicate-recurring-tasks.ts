#!/usr/bin/env npx tsx
/**
 * One-time cleanup: pending recurring `va_tasks` rows that duplicate the same series
 * (title + assignees). Keeps the row with the earliest due_date (then earliest created_at);
 * marks others as skipped (Airtable has no "cancelled" status in this app).
 *
 * Usage (from repo root, requires Airtable env like other scripts):
 *   npx tsx scripts/cleanup-duplicate-recurring-tasks.ts
 */

import "dotenv/config";
import { getAllVaTasks, updateVaTask } from "../services/va-tasks";
import { vaTaskSeriesKey } from "../lib/recurrence";

async function cleanup() {
  const all = await getAllVaTasks();
  const pendingRecurring = all.filter(
    (t) => t.is_recurring && (t.status === "pending" || t.status === "in_progress")
  );

  console.log(`Found ${pendingRecurring.length} pending/in_progress recurring tasks`);

  const groups = new Map<string, typeof pendingRecurring>();
  for (const t of pendingRecurring) {
    const key = vaTaskSeriesKey(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  let marked = 0;
  for (const [key, group] of groups) {
    if (group.length <= 1) continue;

    group.sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : 0;
      const db = b.due_date ? new Date(b.due_date).getTime() : 0;
      if (da !== db) return da - db;
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ca - cb;
    });

    const [keep, ...dups] = group;
    const titlePreview = key.split("\0")[0]?.slice(0, 60) ?? keep.id;
    console.log(`"${titlePreview}": keeping ${keep.id}, marking ${dups.length} duplicate(s) as skipped`);

    for (const dup of dups) {
      await updateVaTask(dup.id, {
        status: "skipped",
        completed_notes: "Duplicate recurring instance (cleanup-duplicate-recurring-tasks).",
      });
      marked += 1;
    }
  }

  console.log(`Done. Marked ${marked} duplicate task(s) as skipped.`);
}

cleanup().catch((e) => {
  console.error(e);
  process.exit(1);
});
