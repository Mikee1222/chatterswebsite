import type { VaTaskRecord } from "@/types";

export interface RecurringSeriesGroup {
  title: string;
  /** Latest pending/in_progress instance for this title, if any */
  currentTask: VaTaskRecord | null;
  /** Completed instances, newest first */
  history: VaTaskRecord[];
  totalCompleted: number;
}

export function groupRecurringTasks(tasks: VaTaskRecord[]): {
  regularTasks: VaTaskRecord[];
  recurringGroups: RecurringSeriesGroup[];
} {
  const regularTasks: VaTaskRecord[] = [];
  const recurringMap = new Map<string, VaTaskRecord[]>();

  for (const task of tasks) {
    if (!task.is_recurring) {
      regularTasks.push(task);
      continue;
    }
    if (!recurringMap.has(task.title)) recurringMap.set(task.title, []);
    recurringMap.get(task.title)!.push(task);
  }

  const recurringGroups: RecurringSeriesGroup[] = [];

  for (const [title, instances] of recurringMap) {
    instances.sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : 0;
      const db = b.due_date ? new Date(b.due_date).getTime() : 0;
      return db - da;
    });

    const current =
      instances.find((t) => t.status === "pending" || t.status === "in_progress") ?? null;
    const history = instances.filter((t) => t.status === "done" || t.status === "skipped");
    const totalCompleted = instances.filter((t) => t.status === "done").length;

    recurringGroups.push({
      title,
      currentTask: current,
      history,
      totalCompleted,
    });
  }

  recurringGroups.sort((a, b) => a.title.localeCompare(b.title));

  return { regularTasks, recurringGroups };
}
