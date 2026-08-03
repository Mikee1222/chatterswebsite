/**
 * Supabase backend for services/va-statistics.ts
 * Delegates all business logic to the airtable-side aggregator; only the direct
 * Airtable reads (phase items + punctuality notifications) switch to Supabase.
 *
 * Because va-statistics.ts is a pure aggregator over already-dual-backed
 * services (users, va-tasks, shifts, model-personal-events…), we don't need
 * to duplicate the aggregation code here. We simply reuse the compute
 * function from the main service which itself reads from the switched
 * backends. The only bits that must move are the two internal readers below,
 * consumed by the main service when isSupabaseBackend() is true.
 */

import { ymdInAthens } from "@/lib/airtable-datetime";
import { sbSelectAll, type SbRow } from "@/lib/supabase-data";
import { TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";

export type PhaseItemRow = {
  task_id: string;
  step_type: TaskStepType;
  status: string;
  requires_screenshot: boolean;
  screenshot_count: number;
  completed_at: string | null;
};

type PunctualityCounts = {
  late: Map<string, number>;
  noShow: Map<string, number>;
  breakExceeded: Map<string, number>;
};

type PhaseItemSbRow = SbRow & {
  task_id?: string | null;
  step_type?: string | null;
  status?: string | null;
  requires_screenshot?: boolean | null;
  screenshot?: string[] | null;
  completed_at?: string | null;
};

type NotificationSbRow = SbRow & {
  event_type?: string | null;
  created_at?: string | null;
  user_id?: string | null;
};

export async function loadPhaseItemsForTasks(taskIds: Set<string>): Promise<PhaseItemRow[]> {
  if (taskIds.size === 0) return [];
  const rows = await sbSelectAll<PhaseItemSbRow>("va_task_phase_items").catch(() => []);
  const out: PhaseItemRow[] = [];
  for (const rec of rows) {
    const tid = String(rec.task_id ?? "").trim();
    if (!tid || !taskIds.has(tid)) continue;
    const stepRaw = String(rec.step_type ?? "").trim();
    const step_type = (TASK_STEP_TYPES as readonly string[]).includes(stepRaw)
      ? (stepRaw as TaskStepType)
      : "Other";
    out.push({
      task_id: tid,
      step_type,
      status: String(rec.status ?? "").trim().toLowerCase(),
      requires_screenshot: rec.requires_screenshot === true,
      screenshot_count: Array.isArray(rec.screenshot) ? rec.screenshot.length : 0,
      completed_at: rec.completed_at?.trim() || null,
    });
  }
  return out;
}

function ymdInRange(ymd: string, start: string, end: string): boolean {
  return Boolean(ymd) && ymd >= start && ymd <= end;
}

export async function loadPunctualityFromNotifications(
  startYmd: string,
  endYmd: string
): Promise<PunctualityCounts> {
  const late = new Map<string, number>();
  const noShow = new Map<string, number>();
  const breakExceeded = new Map<string, number>();
  const bump = (map: Map<string, number>, uid: string) => map.set(uid, (map.get(uid) ?? 0) + 1);

  const relevantEvents = new Set([
    "shift_late",
    "shift_late_admin",
    "shift_no_show",
    "shift_no_show_admin",
    "break_exceeded",
    "break_exceeded_admin",
  ]);

  const rows = await sbSelectAll<NotificationSbRow>("notifications").catch(() => []);
  for (const rec of rows) {
    const ev = String(rec.event_type ?? "").trim();
    if (!relevantEvents.has(ev)) continue;
    const createdAt = rec.created_at;
    const ymd = ymdInAthens(createdAt ?? "") || String(createdAt ?? "").slice(0, 10);
    if (!ymdInRange(ymd, startYmd, endYmd)) continue;
    const uid = String(rec.user_id ?? "").trim();
    if (!uid) continue;
    if (ev.startsWith("shift_late")) bump(late, uid);
    else if (ev.startsWith("shift_no_show")) bump(noShow, uid);
    else if (ev.startsWith("break_exceeded")) bump(breakExceeded, uid);
  }
  return { late, noShow, breakExceeded };
}
