/**
 * Compare pre-2474359 vs current expandTasksForAthensYmd for edge cases.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { ymdInAthens, addDaysAthensYmd } from "@/lib/airtable-datetime";
import { taskMatchesAthensYmd } from "@/lib/va-task-date-filter";
import { materializeVirtualOccurrence, shouldSpawnRecurring, vaTaskSeriesKey } from "@/lib/recurrence";
import { getAllVaTasks } from "@/services/va-tasks";
import type { VaTaskRecord } from "@/types";

/** Pre-2474359 logic */
function expandOld(tasks: VaTaskRecord[], ymd: string): VaTaskRecord[] {
  const target = ymd.trim().slice(0, 10);
  const realOnDay = tasks.filter((t) => taskMatchesAthensYmd(t, target));
  const coveredSeries = new Set(realOnDay.filter((t) => t.is_recurring).map((t) => vaTaskSeriesKey(t)));
  const anchors = new Map<string, VaTaskRecord>();
  for (const task of tasks) {
    if (!task.is_recurring || task.is_virtual_occurrence) continue;
    if (!task.due_date?.trim() || !task.recurrence_type?.trim()) continue;
    const key = vaTaskSeriesKey(task);
    const prev = anchors.get(key);
    if (!prev) anchors.set(key, task);
    else {
      const prevMs = prev.due_date ? new Date(prev.due_date).getTime() : Infinity;
      const nextMs = task.due_date ? new Date(task.due_date).getTime() : Infinity;
      if (nextMs < prevMs) anchors.set(key, task);
    }
  }
  const virtual: VaTaskRecord[] = [];
  for (const [key, anchor] of anchors) {
    if (coveredSeries.has(key)) continue;
    const projected = materializeVirtualOccurrence(anchor, target);
    if (projected) virtual.push(projected);
  }
  return [...realOnDay, ...virtual];
}

/** Current logic (without audit logging) */
function recurringRealRowExistsForAthensYmd(tasks: VaTaskRecord[], seriesKey: string, ymd: string): boolean {
  return tasks.some(
    (t) =>
      !t.is_virtual_occurrence &&
      t.is_recurring &&
      vaTaskSeriesKey(t) === seriesKey &&
      taskMatchesAthensYmd(t, ymd),
  );
}

function expandNew(tasks: VaTaskRecord[], ymd: string): VaTaskRecord[] {
  const target = ymd.trim().slice(0, 10);
  const realOnDay = tasks.filter((t) => taskMatchesAthensYmd(t, target));
  const anchors = new Map<string, VaTaskRecord>();
  for (const task of tasks) {
    if (!task.is_recurring || task.is_virtual_occurrence) continue;
    if (!task.due_date?.trim() || !task.recurrence_type?.trim()) continue;
    if (!shouldSpawnRecurring(task)) continue;
    const key = vaTaskSeriesKey(task);
    const prev = anchors.get(key);
    if (!prev) anchors.set(key, task);
    else {
      const prevMs = prev.due_date ? new Date(prev.due_date).getTime() : Infinity;
      const nextMs = task.due_date ? new Date(task.due_date).getTime() : Infinity;
      if (nextMs < prevMs) anchors.set(key, task);
    }
  }
  const virtual: VaTaskRecord[] = [];
  for (const [key, anchor] of anchors) {
    if (recurringRealRowExistsForAthensYmd(tasks, key, target)) continue;
    const projected = materializeVirtualOccurrence(anchor, target);
    if (projected) virtual.push(projected);
  }
  return [...realOnDay, ...virtual];
}

async function main() {
  const today = ymdInAthens(new Date().toISOString());
  const tomorrow = addDaysAthensYmd(today, 1);
  const tasks = await getAllVaTasks({
    athensStartYmd: addDaysAthensYmd(today, -365),
    athensEndYmd: addDaysAthensYmd(today, 365),
  });

  const oldTomorrow = expandOld(tasks, tomorrow);
  const newTomorrow = expandNew(tasks, tomorrow);

  console.log("Old logic tomorrow count:", oldTomorrow.length);
  console.log("New logic tomorrow count:", newTomorrow.length);

  const oldRecurring = oldTomorrow.filter((t) => t.is_recurring);
  const newRecurring = newTomorrow.filter((t) => t.is_recurring);
  console.log("Old recurring tomorrow:", oldRecurring.length);
  console.log("New recurring tomorrow:", newRecurring.length);

  const oldKeys = new Set(oldRecurring.map((t) => vaTaskSeriesKey(t)));
  const newKeys = new Set(newRecurring.map((t) => vaTaskSeriesKey(t)));

  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      console.log("NEW-only series:", key.split("\0")[0]);
    }
  }
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      console.log("OLD-only series:", key.split("\0")[0]);
    }
  }

  // Series with multiple recurring rows
  const bySeries = new Map<string, VaTaskRecord[]>();
  for (const t of tasks.filter((x) => x.is_recurring && !x.is_virtual_occurrence)) {
    const k = vaTaskSeriesKey(t);
    if (!bySeries.has(k)) bySeries.set(k, []);
    bySeries.get(k)!.push(t);
  }
  console.log("\nMulti-row series:");
  for (const [k, rows] of bySeries) {
    if (rows.length > 1) {
      console.log(`  ${k.split("\0")[0]}: ${rows.length} rows`);
      for (const r of rows) {
        console.log(`    id=${r.id} due=${r.due_date} ymd=${ymdInAthens(r.due_date)} spawn=${shouldSpawnRecurring(r)} end=${r.recurrence_end_date}`);
      }
      const oldT = expandOld(tasks, tomorrow).filter((t) => vaTaskSeriesKey(t) === k);
      const newT = expandNew(tasks, tomorrow).filter((t) => vaTaskSeriesKey(t) === k);
      console.log(`    old tomorrow: ${oldT.length}, new tomorrow: ${newT.length}`);
    }
  }
}

main().catch(console.error);
