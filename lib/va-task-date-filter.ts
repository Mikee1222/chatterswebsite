import { ymdInAthens } from "@/lib/airtable-datetime";
import type { VaTaskRecord } from "@/types";

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
