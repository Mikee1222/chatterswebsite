import { ymdInAthens } from "@/lib/airtable-datetime";
import {
  getNextOccurrence,
  occurrenceDueForAthensYmd,
  shouldSpawnRecurring,
  vaTaskSeriesKey,
} from "@/lib/recurrence";
import { getVaTasksViewTodayYmd, taskMatchesAthensYmd } from "@/lib/va-task-date-filter";
import {
  createVaTask,
  getAllVaTasks,
  getVaTasksForUser,
  type VaTaskCreateInput,
} from "@/services/va-tasks";
import type { VaTaskRecord } from "@/types";

export type SpawnRecurringResult = {
  spawned: number;
  skipped: number;
};

/** True when a real (non-virtual) recurring row already exists for this series on an Athens day. */
export function recurringRealRowExistsForAthensYmd(
  tasks: VaTaskRecord[],
  seriesKey: string,
  ymd: string,
): boolean {
  return tasks.some(
    (t) =>
      !t.is_virtual_occurrence &&
      t.is_recurring &&
      vaTaskSeriesKey(t) === seriesKey &&
      taskMatchesAthensYmd(t, ymd),
  );
}

/** Date-bucket de-dupe for a target due instant (Athens calendar day). */
export function recurringRealRowExistsForDueIso(
  tasks: VaTaskRecord[],
  seriesKey: string,
  dueIso: string,
): boolean {
  const ymd = ymdInAthens(dueIso);
  if (!ymd) return false;
  return recurringRealRowExistsForAthensYmd(tasks, seriesKey, ymd);
}

function pickSeriesAnchors(tasks: VaTaskRecord[]): Map<string, VaTaskRecord> {
  const anchors = new Map<string, VaTaskRecord>();
  for (const task of tasks) {
    if (!task.is_recurring || task.is_virtual_occurrence) continue;
    if (!task.due_date?.trim() || !task.recurrence_type?.trim()) continue;
    if (!shouldSpawnRecurring(task)) continue;
    const key = vaTaskSeriesKey(task);
    const prev = anchors.get(key);
    if (!prev) {
      anchors.set(key, task);
      continue;
    }
    const prevMs = prev.due_date ? new Date(prev.due_date).getTime() : Number.POSITIVE_INFINITY;
    const nextMs = task.due_date ? new Date(task.due_date).getTime() : Number.POSITIVE_INFINITY;
    if (nextMs < prevMs) anchors.set(key, task);
  }
  return anchors;
}

function taskVisibleToVa(task: VaTaskRecord, vaId: string): boolean {
  if (task.assigned_to_ids.length === 0) return true;
  return task.assigned_to_ids.includes(vaId);
}

function buildSpawnInput(anchor: VaTaskRecord, dueIso: string): VaTaskCreateInput {
  return {
    title: anchor.title,
    description: anchor.description,
    assigned_to_ids: [...anchor.assigned_to_ids],
    assigned_by_ids: anchor.assigned_by_ids?.length ? [...anchor.assigned_by_ids] : undefined,
    assigned_model_ids: [...(anchor.assigned_model_ids ?? [])],
    assigned_model_names: [...(anchor.assigned_model_names ?? [])],
    status: "pending",
    priority: anchor.priority,
    due_date: dueIso,
    is_recurring: true,
    recurrence_type: anchor.recurrence_type,
    recurrence_days: [...anchor.recurrence_days],
    recurrence_interval: anchor.recurrence_interval ?? undefined,
    recurrence_end_date: anchor.recurrence_end_date,
    reminder_minutes_before: anchor.reminder_minutes_before,
  };
}

/**
 * Create a real recurring occurrence when none exists for the target Athens due day.
 * Mutates `allTasks` with the new row when spawned (for in-memory de-dupe in loops).
 */
export async function spawnRecurringOccurrenceIfMissing(
  anchor: VaTaskRecord,
  dueIso: string,
  allTasks: VaTaskRecord[],
): Promise<VaTaskRecord | null> {
  if (!shouldSpawnRecurring(anchor)) return null;
  const series = vaTaskSeriesKey(anchor);
  if (recurringRealRowExistsForDueIso(allTasks, series, dueIso)) return null;

  const spawned = await createVaTask(buildSpawnInput(anchor, dueIso));
  const { clonePhasesToTask } = await import("@/services/task-phases");
  await clonePhasesToTask(anchor.id, spawned).catch((err) =>
    console.error("[va-task-recurring-spawn] clone phases failed", err),
  );
  allTasks.push(spawned);
  console.log(`[va-task-recurring-spawn] spawned "${anchor.title}" → ${dueIso}`);
  return spawned;
}

/** Option A: spawn today's real rows for recurring series assigned to this VA when shift starts. */
export async function spawnTodayRecurringOccurrencesForVa(vaId: string): Promise<SpawnRecurringResult> {
  const todayYmd = getVaTasksViewTodayYmd();
  const tasks = await getVaTasksForUser(vaId);
  const anchors = pickSeriesAnchors(tasks);

  let spawned = 0;
  let skipped = 0;

  for (const [series, anchor] of anchors) {
    if (!taskVisibleToVa(anchor, vaId)) {
      skipped += 1;
      continue;
    }

    const dueIso = occurrenceDueForAthensYmd(anchor, todayYmd);
    if (!dueIso) {
      skipped += 1;
      continue;
    }
    if (recurringRealRowExistsForAthensYmd(tasks, series, todayYmd)) {
      skipped += 1;
      continue;
    }

    const result = await spawnRecurringOccurrenceIfMissing(anchor, dueIso, tasks);
    if (result) spawned += 1;
    else skipped += 1;
  }

  return { spawned, skipped };
}

/** Option B: day-boundary safety net — spawn today's occurrence for every active recurring series. */
export async function spawnTodayRecurringOccurrencesAll(): Promise<SpawnRecurringResult> {
  const todayYmd = getVaTasksViewTodayYmd();
  let allTasks = await getAllVaTasks();
  const anchors = pickSeriesAnchors(allTasks);

  let spawned = 0;
  let skipped = 0;

  for (const [series, anchor] of anchors) {
    const dueIso = occurrenceDueForAthensYmd(anchor, todayYmd);
    if (!dueIso) {
      skipped += 1;
      continue;
    }
    if (recurringRealRowExistsForAthensYmd(allTasks, series, todayYmd)) {
      skipped += 1;
      continue;
    }

    const result = await spawnRecurringOccurrenceIfMissing(anchor, dueIso, allTasks);
    if (result) {
      spawned += 1;
      allTasks = await getAllVaTasks();
    } else {
      skipped += 1;
    }
  }

  return { spawned, skipped };
}

/**
 * Backfill next occurrence after completion (or cron). Uses Athens-day de-dupe only —
 * allows multiple open rows on different days (e.g. overdue + today).
 */
export async function spawnNextRecurringOccurrenceAfterComplete(
  completedTask: VaTaskRecord,
  allTasks?: VaTaskRecord[],
): Promise<VaTaskRecord | null> {
  if (!shouldSpawnRecurring(completedTask) || !completedTask.due_date || !completedTask.recurrence_type) {
    return null;
  }

  const nextDue = getNextOccurrence(
    completedTask.due_date,
    completedTask.recurrence_type,
    completedTask.recurrence_interval ?? 1,
    completedTask.recurrence_days ?? [],
    completedTask.recurrence_end_date,
  );
  if (!nextDue) return null;

  const tasks = allTasks ?? (await getAllVaTasks());
  return spawnRecurringOccurrenceIfMissing(completedTask, nextDue, tasks);
}
