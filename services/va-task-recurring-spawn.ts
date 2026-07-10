import { ymdInAthens } from "@/lib/airtable-datetime";
import {
  getNextOccurrence,
  occurrenceDueForAthensYmd,
  shouldSpawnRecurring,
  vaTaskSeriesKey,
} from "@/lib/recurrence";
import {
  getVaTasksViewTodayYmd,
  recurringRealRowExistsForAthensYmd,
  taskMatchesAthensYmd,
} from "@/lib/va-task-date-filter";

/** In-process mutex: concurrent shift-start + cron spawns share one create per series+day. */
const spawnLocks = new Map<string, Promise<VaTaskRecord | null>>();

function spawnLockKey(seriesKey: string, ymd: string): string {
  return `${seriesKey}\0${ymd}`;
}
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

export { recurringRealRowExistsForAthensYmd } from "@/lib/va-task-date-filter";

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

function findExistingRowForDueIso(
  tasks: VaTaskRecord[],
  seriesKey: string,
  dueIso: string,
): VaTaskRecord | undefined {
  return tasks.find(
    (t) =>
      !t.is_virtual_occurrence &&
      t.is_recurring &&
      vaTaskSeriesKey(t) === seriesKey &&
      taskMatchesAthensYmd(t, ymdInAthens(dueIso) ?? ""),
  );
}

/** Prefer a series row that already has phases (for clonePhasesToTask source). */
async function pickPhaseCloneSourceId(
  allTasks: VaTaskRecord[],
  seriesKey: string,
  fallbackId: string,
): Promise<string> {
  const { getPhasesByTask } = await import("@/services/task-phases");
  const inSeries = allTasks.filter(
    (t) => !t.is_virtual_occurrence && t.is_recurring && vaTaskSeriesKey(t) === seriesKey,
  );
  let bestId = fallbackId;
  let bestCount = -1;
  for (const t of inSeries) {
    const phases = await getPhasesByTask(t.id);
    const itemCount = phases.reduce((n, p) => n + p.items.length, 0);
    if (itemCount > bestCount) {
      bestCount = itemCount;
      bestId = t.id;
    }
  }
  return bestId;
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
 * Create a real recurring occurrence when none exists for the target Athens due day,
 * or backfill phases when a shell row exists without checklist items.
 * Mutates `allTasks` with the new row when spawned (for in-memory de-dupe in loops).
 *
 * Proactive spawns are strictly limited to **today (Athens)** — future days stay virtual
 * until their calendar day (shift-start / day-boundary cron).
 */
export async function spawnRecurringOccurrenceIfMissing(
  anchor: VaTaskRecord,
  dueIso: string,
  allTasks: VaTaskRecord[],
): Promise<VaTaskRecord | null> {
  if (!shouldSpawnRecurring(anchor)) return null;

  const targetYmd = ymdInAthens(dueIso);
  if (!targetYmd) return null;

  const todayYmd = getVaTasksViewTodayYmd();
  if (targetYmd !== todayYmd) {
    return null;
  }

  const series = vaTaskSeriesKey(anchor);
  const lockKey = spawnLockKey(series, targetYmd);
  const inFlight = spawnLocks.get(lockKey);
  if (inFlight) return inFlight;

  const work = spawnRecurringOccurrenceIfMissingLocked(anchor, dueIso, targetYmd, series, allTasks);
  spawnLocks.set(lockKey, work);
  try {
    return await work;
  } finally {
    if (spawnLocks.get(lockKey) === work) spawnLocks.delete(lockKey);
  }
}

async function spawnRecurringOccurrenceIfMissingLocked(
  anchor: VaTaskRecord,
  dueIso: string,
  targetYmd: string,
  series: string,
  allTasks: VaTaskRecord[],
): Promise<VaTaskRecord | null> {
  const { clonePhasesToTask, getPhasesByTask } = await import("@/services/task-phases");

  const resolveExisting = async (): Promise<VaTaskRecord | undefined> => {
    const fromMemory = findExistingRowForDueIso(allTasks, series, dueIso);
    if (fromMemory) return fromMemory;
    const fresh = await getAllVaTasks();
    return findExistingRowForDueIso(fresh, series, dueIso);
  };

  const existing = await resolveExisting();
  if (existing) {
    const phases = await getPhasesByTask(existing.id);
    if (phases.length > 0) return null;
    const sourceId = await pickPhaseCloneSourceId(allTasks, series, anchor.id);
    await clonePhasesToTask(sourceId, existing).catch((err) =>
      console.error("[va-task-recurring-spawn] backfill phases failed", err),
    );
    console.log(`[va-task-recurring-spawn] backfilled phases for "${anchor.title}" → ${dueIso}`);
    return existing;
  }

  // Re-check Airtable immediately before insert (closes concurrent spawn race).
  const freshBeforeInsert = await getAllVaTasks();
  if (recurringRealRowExistsForAthensYmd(freshBeforeInsert, series, targetYmd)) {
    const raced = findExistingRowForDueIso(freshBeforeInsert, series, dueIso);
    if (raced) {
      allTasks.push(raced);
      return raced;
    }
    return null;
  }

  const spawned = await createVaTask(buildSpawnInput(anchor, dueIso));
  const sourceId = await pickPhaseCloneSourceId(allTasks, series, anchor.id);
  await clonePhasesToTask(sourceId, spawned).catch((err) =>
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
 * Backfill today's occurrence after completion when the completed row was overdue
 * and the next calendar occurrence is **today (Athens)**. Never creates future real rows —
 * those stay virtual until shift-start / day-boundary cron on their due day.
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

  const todayYmd = getVaTasksViewTodayYmd();
  const nextYmd = ymdInAthens(nextDue);
  if (!nextYmd || nextYmd !== todayYmd) {
    return null;
  }

  const tasks = allTasks ?? (await getAllVaTasks());
  return spawnRecurringOccurrenceIfMissing(completedTask, nextDue, tasks);
}
