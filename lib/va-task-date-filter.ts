import { ymdInAthens } from "@/lib/airtable-datetime";
import { materializeVirtualOccurrence, vaTaskSeriesKey } from "@/lib/recurrence";
import { groupRecurringTasks, type RecurringSeriesGroup } from "@/lib/recurring-utils";
import { flattenDateViewTasks } from "@/lib/va-tasks-progress";
import type { VaTaskRecord } from "@/types";

const DATE_VIEW_GROUP_OPTS = { forDateView: true as const };

/** Today YYYY-MM-DD for VA task date nav — matches {@link ymdInAthens} task bucketing (schedule). */
export function getVaTasksViewTodayYmd(): string {
  return ymdInAthens(new Date().toISOString());
}

/** True when task `due_date` buckets to the given Athens YYYY-MM-DD. */
export function taskMatchesAthensYmd(task: VaTaskRecord, ymd: string): boolean {
  if (!ymd.trim()) return false;
  const taskYmd = ymdInAthens(task.due_date);
  return Boolean(taskYmd && taskYmd === ymd);
}

/**
 * Expand recurring series so every Athens calendar day in range has a visible instance.
 *
 * Real Airtable rows are preferred when already spawned. Otherwise we project a
 * display-only virtual pending occurrence (cron/completion still create real rows later).
 * Null `recurrence_end_date` means indefinite — still projects until the walk limit.
 */
export function expandTasksForAthensYmd(tasks: VaTaskRecord[], ymd: string): VaTaskRecord[] {
  const target = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return tasks;

  const realOnDay = tasks.filter((t) => taskMatchesAthensYmd(t, target));
  const coveredSeries = new Set(
    realOnDay.filter((t) => t.is_recurring).map((t) => vaTaskSeriesKey(t)),
  );

  // Prefer the earliest-due recurring row per series as the recurrence "anchor".
  const anchors = new Map<string, VaTaskRecord>();
  for (const task of tasks) {
    if (!task.is_recurring || task.is_virtual_occurrence) continue;
    if (!task.due_date?.trim() || !task.recurrence_type?.trim()) continue;
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

  const virtual: VaTaskRecord[] = [];
  for (const [key, anchor] of anchors) {
    if (coveredSeries.has(key)) continue;
    const projected = materializeVirtualOccurrence(anchor, target);
    if (projected) virtual.push(projected);
  }

  return [...realOnDay, ...virtual];
}

/** Tasks whose `due_date` falls on the given Athens calendar day, plus projected recurring instances. */
export function filterTasksByAthensYmd(tasks: VaTaskRecord[], ymd: string): VaTaskRecord[] {
  if (!ymd.trim()) return tasks;
  return expandTasksForAthensYmd(tasks, ymd);
}

export type VaTasksDateViewSelection = {
  dateFilteredTasks: VaTaskRecord[];
  regularTasks: VaTaskRecord[];
  recurringGroups: RecurringSeriesGroup[];
  flattenedTasks: VaTaskRecord[];
};

/** Group recurring instances for a date-scoped task list (List + Progress Overview). */
export function groupVaTasksForDateView(tasks: VaTaskRecord[]): Omit<VaTasksDateViewSelection, "dateFilteredTasks"> {
  const { regularTasks, recurringGroups } = groupRecurringTasks(tasks, DATE_VIEW_GROUP_OPTS);
  return {
    regularTasks,
    recurringGroups,
    flattenedTasks: flattenDateViewTasks(regularTasks, recurringGroups),
  };
}

/** Athens date filter + recurring grouping — shared by List and Progress Overview. */
export function selectVaTasksForDateView(tasks: VaTaskRecord[], ymd: string): VaTasksDateViewSelection {
  const dateFilteredTasks = filterTasksByAthensYmd(tasks, ymd);
  return { dateFilteredTasks, ...groupVaTasksForDateView(dateFilteredTasks) };
}
