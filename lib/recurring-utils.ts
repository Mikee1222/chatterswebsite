import { vaTaskSeriesKey } from "@/lib/recurrence";
import type { VaTaskRecord } from "@/types";

export interface RecurringSeriesGroup {
  /** Human-readable series title (may be shared across assignee series). */
  title: string;
  /** Stable key: title + assignees — use for React keys / expand state. */
  seriesKey: string;
  /** Latest pending/in_progress instance for this series, if any */
  currentTask: VaTaskRecord | null;
  /** Completed instances, newest first */
  history: VaTaskRecord[];
  totalCompleted: number;
}

export type GroupRecurringTasksOptions = {
  /** When true (date-filtered lists), show every same-day instance — do not collapse by series. */
  forDateView?: boolean;
};

export function groupRecurringTasks(
  tasks: VaTaskRecord[],
  options?: GroupRecurringTasksOptions,
): {
  regularTasks: VaTaskRecord[];
  recurringGroups: RecurringSeriesGroup[];
} {
  const forDateView = options?.forDateView === true;
  const regularTasks: VaTaskRecord[] = [];
  const recurring: VaTaskRecord[] = [];

  for (const task of tasks) {
    if (!task.is_recurring) regularTasks.push(task);
    else recurring.push(task);
  }

  if (forDateView) {
    recurring.sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : 0;
      const db = b.due_date ? new Date(b.due_date).getTime() : 0;
      if (db !== da) return db - da;
      return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    });
    const recurringGroups: RecurringSeriesGroup[] = recurring.map((task) => ({
      title: task.title,
      // Include id so same title+assignee duplicates on one day stay distinct list rows.
      seriesKey: `${vaTaskSeriesKey(task)}\0${task.id}`,
      currentTask: task,
      history: [],
      totalCompleted: task.status === "done" ? 1 : 0,
    }));
    return { regularTasks, recurringGroups };
  }

  const recurringMap = new Map<string, VaTaskRecord[]>();
  for (const task of recurring) {
    const key = vaTaskSeriesKey(task);
    if (!recurringMap.has(key)) recurringMap.set(key, []);
    recurringMap.get(key)!.push(task);
  }

  const recurringGroups: RecurringSeriesGroup[] = [];

  for (const [seriesKey, instances] of recurringMap) {
    instances.sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : 0;
      const db = b.due_date ? new Date(b.due_date).getTime() : 0;
      return db - da;
    });

    const current =
      instances.find((t) => t.status === "pending" || t.status === "in_progress") ?? null;
    const history = instances.filter((t) => t.status === "done" || t.status === "skipped");
    const totalCompleted = instances.filter((t) => t.status === "done").length;
    const title = instances[0]?.title ?? seriesKey.split("\0")[0] ?? seriesKey;

    recurringGroups.push({
      title,
      seriesKey,
      currentTask: current,
      history,
      totalCompleted,
    });
  }

  recurringGroups.sort((a, b) => a.title.localeCompare(b.title) || a.seriesKey.localeCompare(b.seriesKey));

  return { regularTasks, recurringGroups };
}
