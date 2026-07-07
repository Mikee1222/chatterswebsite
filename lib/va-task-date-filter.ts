import { ymdInAthens } from "@/lib/airtable-datetime";
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

/** Tasks whose `due_date` falls on the given Athens calendar day. */
export function filterTasksByAthensYmd(tasks: VaTaskRecord[], ymd: string): VaTaskRecord[] {
  if (!ymd.trim()) return tasks;
  return tasks.filter((t) => taskMatchesAthensYmd(t, ymd));
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
