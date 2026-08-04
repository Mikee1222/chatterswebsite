/**
 * Aggregate VA task + shift performance metrics over a date range.
 * Admin-only reporting layer — no new Airtable tables.
 */

import { addDaysAthensYmd, getTodayYmdAthens, ymdInAthens } from "@/lib/airtable-datetime";
import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import { TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";
import { getAllVaTasks } from "@/services/va-tasks";
import { listAllShifts } from "@/services/shifts";
import { listAllUsers } from "@/services/users";
import type { Shift, VaTaskRecord } from "@/types";

export type VaStatisticsPreset = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

export type VaStatisticsRange = {
  startYmd: string;
  endYmd: string;
  preset: VaStatisticsPreset;
};

export type StepTypeStat = {
  step_type: TaskStepType;
  total: number;
  completed: number;
  completion_rate: number | null;
};

export type VaTaskMetrics = {
  assigned: number;
  completed: number;
  overdue_or_missed: number;
  pending_or_in_progress: number;
  completion_rate: number | null;
  /** Hours from created_at → completed_at for done tasks with both timestamps. Null if insufficient data. */
  avg_completion_hours: number | null;
  avg_completion_sample_size: number;
  screenshot_required: number;
  screenshot_provided: number;
  screenshot_compliance_rate: number | null;
  by_step_type: StepTypeStat[];
};

export type VaShiftMetrics = {
  shifts: number;
  total_hours: number;
  avg_duration_hours: number | null;
  on_time_starts: number;
  late_starts: number;
  /** Late / (on-time + late) when either is known. Null if no punctuality sample. */
  on_time_rate: number | null;
  no_shows: number;
  break_exceeded: number;
};

export type VaDailyTrendPoint = {
  ymd: string;
  completed_tasks: number;
  hours_worked: number;
  assigned_tasks: number;
};

export type VaPerUserStatistics = {
  va_id: string;
  va_name: string;
  tasks: VaTaskMetrics;
  shifts: VaShiftMetrics;
  daily: VaDailyTrendPoint[];
};

export type VaStatisticsReport = {
  range: VaStatisticsRange;
  team: {
    va_count: number;
    tasks: VaTaskMetrics;
    shifts: VaShiftMetrics;
    avg_completion_rate: number | null;
    vas_below_70_pct: number;
    daily: VaDailyTrendPoint[];
  };
  by_va: VaPerUserStatistics[];
};

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const parts = ymd.trim().slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return null;
  return { y: parts[0]!, m: parts[1]!, d: parts[2]! };
}

function startOfWeekMonday(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const mid = new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0));
  const dow = mid.getUTCDay(); // 0 Sun
  const delta = dow === 0 ? -6 : 1 - dow;
  mid.setUTCDate(mid.getUTCDate() + delta);
  return mid.toISOString().slice(0, 10);
}

function monthBounds(ymd: string): { start: string; end: string } {
  const p = parseYmd(ymd);
  if (!p) return { start: ymd, end: ymd };
  const start = `${p.y}-${String(p.m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(p.y, p.m, 0, 12, 0, 0));
  const end = last.toISOString().slice(0, 10);
  return { start, end };
}

export function resolveVaStatisticsRange(
  preset: VaStatisticsPreset,
  customStart?: string | null,
  customEnd?: string | null,
): VaStatisticsRange {
  const today = getTodayYmdAthens();
  if (preset === "custom") {
    const start = (customStart ?? today).slice(0, 10);
    const end = (customEnd ?? today).slice(0, 10);
    return start <= end
      ? { startYmd: start, endYmd: end, preset }
      : { startYmd: end, endYmd: start, preset };
  }
  if (preset === "this_week") {
    const start = startOfWeekMonday(today);
    return { startYmd: start, endYmd: today, preset };
  }
  if (preset === "last_week") {
    const thisMon = startOfWeekMonday(today);
    const lastSun = addDaysAthensYmd(thisMon, -1);
    const lastMon = startOfWeekMonday(lastSun);
    return { startYmd: lastMon, endYmd: lastSun, preset };
  }
  if (preset === "this_month") {
    const { start } = monthBounds(today);
    return { startYmd: start, endYmd: today, preset };
  }
  // last_month
  const p = parseYmd(today)!;
  const prevMonthAnchor = addDaysAthensYmd(`${p.y}-${String(p.m).padStart(2, "0")}-01`, -1);
  const { start, end } = monthBounds(prevMonthAnchor);
  return { startYmd: start, endYmd: end, preset };
}

function ymdInRange(ymd: string, start: string, end: string): boolean {
  return Boolean(ymd) && ymd >= start && ymd <= end;
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function emptyTaskMetrics(): VaTaskMetrics {
  return {
    assigned: 0,
    completed: 0,
    overdue_or_missed: 0,
    pending_or_in_progress: 0,
    completion_rate: null,
    avg_completion_hours: null,
    avg_completion_sample_size: 0,
    screenshot_required: 0,
    screenshot_provided: 0,
    screenshot_compliance_rate: null,
    by_step_type: TASK_STEP_TYPES.map((step_type) => ({
      step_type,
      total: 0,
      completed: 0,
      completion_rate: null,
    })),
  };
}

function emptyShiftMetrics(): VaShiftMetrics {
  return {
    shifts: 0,
    total_hours: 0,
    avg_duration_hours: null,
    on_time_starts: 0,
    late_starts: 0,
    on_time_rate: null,
    no_shows: 0,
    break_exceeded: 0,
  };
}

function workedHours(s: Shift): number {
  if (typeof s.worked_minutes === "number" && s.worked_minutes > 0) return s.worked_minutes / 60;
  if (typeof (s as Shift & { total_minutes?: number }).total_minutes === "number") {
    const t = (s as Shift & { total_minutes?: number }).total_minutes!;
    if (t > 0) return t / 60;
  }
  if (s.start_time && s.end_time) {
    const a = new Date(s.start_time).getTime();
    const b = new Date(s.end_time).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return (b - a) / 3_600_000;
  }
  return 0;
}

function taskBucketYmd(task: VaTaskRecord): string {
  return (
    ymdInAthens(task.due_date) ||
    ymdInAthens(task.completed_at) ||
    ymdInAthens(task.created_at) ||
    ""
  );
}

type PhaseItemRow = {
  task_id: string;
  step_type: TaskStepType;
  status: string;
  requires_screenshot: boolean;
  screenshot_count: number;
  completed_at: string | null;
};

async function loadPhaseItemsForTasks(taskIds: Set<string>): Promise<PhaseItemRow[]> {
  if (taskIds.size === 0) return [];
  if (isSupabaseBackend()) {
    return (await import("./va-statistics-supabase")).loadPhaseItemsForTasks(taskIds);
  }
  type ItemFields = {
    task_id?: string;
    step_type?: string;
    status?: string;
    requires_screenshot?: boolean;
    screenshot?: { url?: string }[];
    completed_at?: string;
  };
  const records = await listAllRecords<ItemFields>("va_task_phase_items", {}).catch(() => []);
  const out: PhaseItemRow[] = [];
  for (const rec of records as AirtableRecord<ItemFields>[]) {
    const tid = String(rec.fields.task_id ?? "").trim();
    if (!tid || !taskIds.has(tid)) continue;
    const stepRaw = String(rec.fields.step_type ?? "").trim();
    const step_type = (TASK_STEP_TYPES as readonly string[]).includes(stepRaw)
      ? (stepRaw as TaskStepType)
      : "Other";
    out.push({
      task_id: tid,
      step_type,
      status: String(rec.fields.status ?? "").trim().toLowerCase(),
      requires_screenshot: rec.fields.requires_screenshot === true,
      screenshot_count: Array.isArray(rec.fields.screenshot) ? rec.fields.screenshot.length : 0,
      completed_at: rec.fields.completed_at?.trim() || null,
    });
  }
  return out;
}

type PunctualityCounts = {
  late: Map<string, number>;
  noShow: Map<string, number>;
  breakExceeded: Map<string, number>;
};

/**
 * Late / no-show / break_exceeded are recorded as notifications (not Shift columns).
 * Count by recipient user within the date range.
 */
async function loadPunctualityFromNotifications(
  startYmd: string,
  endYmd: string,
): Promise<PunctualityCounts> {
  if (isSupabaseBackend()) {
    return (await import("./va-statistics-supabase")).loadPunctualityFromNotifications(startYmd, endYmd);
  }
  type NFields = {
    event_type?: string;
    created_at?: string;
    user?: string | string[];
    recipient?: string | string[];
  };
  const late = new Map<string, number>();
  const noShow = new Map<string, number>();
  const breakExceeded = new Map<string, number>();
  const bump = (map: Map<string, number>, uid: string) => map.set(uid, (map.get(uid) ?? 0) + 1);

  const records = await listAllRecords<NFields>("notifications", {
    filterByFormula: `OR({event_type}="shift_late",{event_type}="shift_late_admin",{event_type}="shift_no_show",{event_type}="shift_no_show_admin",{event_type}="break_exceeded",{event_type}="break_exceeded_admin")`,
  }).catch(() => []);

  for (const rec of records as AirtableRecord<NFields>[]) {
    const ymd = ymdInAthens(rec.fields.created_at) || String(rec.fields.created_at ?? "").slice(0, 10);
    if (!ymdInRange(ymd, startYmd, endYmd)) continue;
    const ev = String(rec.fields.event_type ?? "").trim();
    const raw = rec.fields.user ?? rec.fields.recipient;
    const uids = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const uid of uids) {
      const id = String(uid).trim();
      if (!id) continue;
      if (ev.startsWith("shift_late")) bump(late, id);
      else if (ev.startsWith("shift_no_show")) bump(noShow, id);
      else if (ev.startsWith("break_exceeded")) bump(breakExceeded, id);
    }
  }
  return { late, noShow, breakExceeded };
}

function finalizeTaskMetrics(m: VaTaskMetrics): VaTaskMetrics {
  m.completion_rate = rate(m.completed, m.assigned);
  m.screenshot_compliance_rate = rate(m.screenshot_provided, m.screenshot_required);
  m.by_step_type = m.by_step_type.map((s) => ({
    ...s,
    completion_rate: rate(s.completed, s.total),
  }));
  return m;
}

function finalizeShiftMetrics(m: VaShiftMetrics): VaShiftMetrics {
  m.total_hours = Math.round(m.total_hours * 10) / 10;
  m.avg_duration_hours =
    m.shifts > 0 ? Math.round((m.total_hours / m.shifts) * 10) / 10 : null;
  const punctualSample = m.on_time_starts + m.late_starts;
  m.on_time_rate = rate(m.on_time_starts, punctualSample);
  return m;
}

function eachDay(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  let cur = startYmd;
  let guard = 0;
  while (cur <= endYmd && guard < 400) {
    out.push(cur);
    cur = addDaysAthensYmd(cur, 1);
    guard += 1;
  }
  return out;
}

function emptyDailySeries(startYmd: string, endYmd: string): VaDailyTrendPoint[] {
  return eachDay(startYmd, endYmd).map((ymd) => ({
    ymd,
    completed_tasks: 0,
    hours_worked: 0,
    assigned_tasks: 0,
  }));
}

export async function computeVaStatisticsReport(range: VaStatisticsRange): Promise<VaStatisticsReport> {
  const { startYmd, endYmd } = range;
  const users = await listAllUsers();
  const vaUsers = users.filter(
    (u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant",
  );
  const vaNameById = new Map(
    vaUsers.map((u) => [u.id, (u.full_name || u.email || u.id).trim() || u.id]),
  );
  const vaIds = new Set(vaUsers.map((u) => u.id));

  const shiftFormula = `AND(DATESTR({date}) >= "${startYmd.replace(/"/g, '""')}", DATESTR({date}) <= "${endYmd.replace(/"/g, '""')}", {staff_role} = "virtual_assistant")`;

  const [allTasks, punctuality, shiftsInRangeRaw] = await Promise.all([
    getAllVaTasks({
      athensStartYmd: startYmd,
      athensEndYmd: endYmd,
      includeBucketDates: true,
      includeRecurring: false,
    }),
    loadPunctualityFromNotifications(startYmd, endYmd),
    listAllShifts(shiftFormula, "va-statistics.shifts").catch(() => [] as Shift[]),
  ]);

  const tasksInRange = allTasks.filter((t) => {
    const ymd = taskBucketYmd(t);
    return ymdInRange(ymd, startYmd, endYmd);
  });
  const taskIds = new Set(tasksInRange.map((t) => t.id));
  const items = await loadPhaseItemsForTasks(taskIds);
  const itemsByTask = new Map<string, PhaseItemRow[]>();
  for (const item of items) {
    const list = itemsByTask.get(item.task_id) ?? [];
    list.push(item);
    itemsByTask.set(item.task_id, list);
  }

  const shiftsInRange = shiftsInRangeRaw.filter(
    (s) => ymdInRange((s.date ?? "").slice(0, 10), startYmd, endYmd),
  );

  const perVa = new Map<string, VaPerUserStatistics>();
  for (const va of vaUsers) {
    perVa.set(va.id, {
      va_id: va.id,
      va_name: vaNameById.get(va.id) ?? va.id,
      tasks: emptyTaskMetrics(),
      shifts: emptyShiftMetrics(),
      daily: emptyDailySeries(startYmd, endYmd),
    });
  }

  const ensureVa = (id: string, nameHint?: string) => {
    if (!perVa.has(id)) {
      perVa.set(id, {
        va_id: id,
        va_name: nameHint || vaNameById.get(id) || id,
        tasks: emptyTaskMetrics(),
        shifts: emptyShiftMetrics(),
        daily: emptyDailySeries(startYmd, endYmd),
      });
    }
    return perVa.get(id)!;
  };

  const dailyIndex = (series: VaDailyTrendPoint[], ymd: string) =>
    series.findIndex((d) => d.ymd === ymd);

  // Seed perVa from VA shifts first. Marketing executives (and others) who work
  // staff_role=virtual_assistant shifts are not always role=virtual_assistant;
  // without this, their tasks were dropped from per-VA attribution and only
  // appeared in the anonymous team-only bucket.
  for (const shift of shiftsInRange) {
    const uid = shift.chatter_id?.trim();
    if (!uid) continue;
    const row = ensureVa(uid, shift.chatter_name);
    const hours = workedHours(shift);
    if (shift.status === "completed" || shift.status === "active" || shift.status === "on_break") {
      row.shifts.shifts += 1;
      row.shifts.total_hours += hours;
      const di = dailyIndex(row.daily, (shift.date ?? "").slice(0, 10));
      if (di >= 0) row.daily[di]!.hours_worked += hours;
    }
  }

  for (const task of tasksInRange) {
    // Attribute to every assignee on a VA task (ensureVa), not only formal VA roles.
    const targets = task.assigned_to_ids.map((id) => id.trim()).filter(Boolean);
    const ymd = taskBucketYmd(task);
    const isDone = task.status === "done";
    const isOpen = task.status === "pending" || task.status === "in_progress";
    const overdue =
      !isDone &&
      task.status !== "skipped" &&
      Boolean(task.due_date) &&
      new Date(task.due_date!).getTime() < Date.now();

    let completionHours: number | null = null;
    if (isDone && task.created_at && task.completed_at) {
      const a = new Date(task.created_at).getTime();
      const b = new Date(task.completed_at).getTime();
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        completionHours = (b - a) / 3_600_000;
      }
    }

    const taskItems = itemsByTask.get(task.id) ?? [];

    const applyTo = (m: VaTaskMetrics, daily: VaDailyTrendPoint[]) => {
      m.assigned += 1;
      if (isDone) m.completed += 1;
      if (isOpen) m.pending_or_in_progress += 1;
      if (overdue || task.status === "skipped") m.overdue_or_missed += 1;
      if (completionHours != null) {
        const prevSum = (m.avg_completion_hours ?? 0) * m.avg_completion_sample_size;
        m.avg_completion_sample_size += 1;
        m.avg_completion_hours =
          Math.round(((prevSum + completionHours) / m.avg_completion_sample_size) * 10) / 10;
      }
      for (const item of taskItems) {
        const step = m.by_step_type.find((s) => s.step_type === item.step_type);
        if (step) {
          step.total += 1;
          if (item.status === "completed") step.completed += 1;
        }
        if (item.requires_screenshot) {
          m.screenshot_required += 1;
          if (item.screenshot_count > 0) m.screenshot_provided += 1;
        }
      }
      const di = dailyIndex(daily, ymd);
      if (di >= 0) {
        daily[di]!.assigned_tasks += 1;
        if (isDone) daily[di]!.completed_tasks += 1;
      }
    };

    if (targets.length === 0) {
      // Still track in a team-only bucket via a placeholder applied later
      (task as VaTaskRecord & { __teamOnly?: boolean }).__teamOnly = true;
    } else {
      for (const uid of targets) {
        const row = ensureVa(uid);
        applyTo(row.tasks, row.daily);
      }
    }
  }

  // Team-only / unassigned tasks (no assignee ids at all)
  const teamTasks = emptyTaskMetrics();
  const teamDaily = emptyDailySeries(startYmd, endYmd);
  for (const task of tasksInRange) {
    const assignees = task.assigned_to_ids.map((id) => id.trim()).filter(Boolean);
    if (assignees.length > 0) continue;
    const ymd = taskBucketYmd(task);
    const isDone = task.status === "done";
    const isOpen = task.status === "pending" || task.status === "in_progress";
    const overdue =
      !isDone &&
      task.status !== "skipped" &&
      Boolean(task.due_date) &&
      new Date(task.due_date!).getTime() < Date.now();
    teamTasks.assigned += 1;
    if (isDone) teamTasks.completed += 1;
    if (isOpen) teamTasks.pending_or_in_progress += 1;
    if (overdue || task.status === "skipped") teamTasks.overdue_or_missed += 1;
    const di = dailyIndex(teamDaily, ymd);
    if (di >= 0) {
      teamDaily[di]!.assigned_tasks += 1;
      if (isDone) teamDaily[di]!.completed_tasks += 1;
    }
    for (const item of itemsByTask.get(task.id) ?? []) {
      const step = teamTasks.by_step_type.find((s) => s.step_type === item.step_type);
      if (step) {
        step.total += 1;
        if (item.status === "completed") step.completed += 1;
      }
      if (item.requires_screenshot) {
        teamTasks.screenshot_required += 1;
        if (item.screenshot_count > 0) teamTasks.screenshot_provided += 1;
      }
    }
  }

  for (const [uid, count] of punctuality.late) {
    if (!perVa.has(uid) && !vaIds.has(uid)) continue;
    const row = ensureVa(uid);
    row.shifts.late_starts += count;
  }
  for (const [uid, count] of punctuality.noShow) {
    if (!perVa.has(uid) && !vaIds.has(uid)) continue;
    ensureVa(uid).shifts.no_shows += count;
  }
  for (const [uid, count] of punctuality.breakExceeded) {
    if (!perVa.has(uid) && !vaIds.has(uid)) continue;
    ensureVa(uid).shifts.break_exceeded += count;
  }

  // Infer on-time starts: completed/active/on_break shifts minus late notifications (floor at 0)
  for (const row of perVa.values()) {
    const started = row.shifts.shifts;
    row.shifts.on_time_starts = Math.max(0, started - row.shifts.late_starts);
    finalizeTaskMetrics(row.tasks);
    finalizeShiftMetrics(row.shifts);
    for (const d of row.daily) {
      d.hours_worked = Math.round(d.hours_worked * 10) / 10;
    }
  }

  const by_va = [...perVa.values()]
    .filter((v) => v.tasks.assigned > 0 || v.shifts.shifts > 0 || v.shifts.no_shows > 0)
    .sort((a, b) => a.va_name.localeCompare(b.va_name));

  // Team rollup = sum of per-VA + unassigned tasks
  const teamTaskRollup = emptyTaskMetrics();
  const teamShiftRollup = emptyShiftMetrics();
  const teamDailyRollup = emptyDailySeries(startYmd, endYmd);

  const mergeTasks = (into: VaTaskMetrics, from: VaTaskMetrics) => {
    into.assigned += from.assigned;
    into.completed += from.completed;
    into.overdue_or_missed += from.overdue_or_missed;
    into.pending_or_in_progress += from.pending_or_in_progress;
    into.screenshot_required += from.screenshot_required;
    into.screenshot_provided += from.screenshot_provided;
    if (from.avg_completion_sample_size > 0 && from.avg_completion_hours != null) {
      const prev = (into.avg_completion_hours ?? 0) * into.avg_completion_sample_size;
      into.avg_completion_sample_size += from.avg_completion_sample_size;
      into.avg_completion_hours =
        Math.round(((prev + from.avg_completion_hours * from.avg_completion_sample_size) /
          into.avg_completion_sample_size) *
          10) / 10;
    }
    for (let i = 0; i < into.by_step_type.length; i++) {
      into.by_step_type[i]!.total += from.by_step_type[i]!.total;
      into.by_step_type[i]!.completed += from.by_step_type[i]!.completed;
    }
  };

  for (const row of by_va) {
    mergeTasks(teamTaskRollup, row.tasks);
    teamShiftRollup.shifts += row.shifts.shifts;
    teamShiftRollup.total_hours += row.shifts.total_hours;
    teamShiftRollup.on_time_starts += row.shifts.on_time_starts;
    teamShiftRollup.late_starts += row.shifts.late_starts;
    teamShiftRollup.no_shows += row.shifts.no_shows;
    teamShiftRollup.break_exceeded += row.shifts.break_exceeded;
    for (let i = 0; i < teamDailyRollup.length; i++) {
      teamDailyRollup[i]!.assigned_tasks += row.daily[i]?.assigned_tasks ?? 0;
      teamDailyRollup[i]!.completed_tasks += row.daily[i]?.completed_tasks ?? 0;
      teamDailyRollup[i]!.hours_worked += row.daily[i]?.hours_worked ?? 0;
    }
  }
  mergeTasks(teamTaskRollup, finalizeTaskMetrics(teamTasks));
  for (let i = 0; i < teamDailyRollup.length; i++) {
    teamDailyRollup[i]!.assigned_tasks += teamDaily[i]?.assigned_tasks ?? 0;
    teamDailyRollup[i]!.completed_tasks += teamDaily[i]?.completed_tasks ?? 0;
  }
  for (const d of teamDailyRollup) {
    d.hours_worked = Math.round(d.hours_worked * 10) / 10;
  }

  finalizeTaskMetrics(teamTaskRollup);
  finalizeShiftMetrics(teamShiftRollup);

  const rates = by_va
    .map((v) => v.tasks.completion_rate)
    .filter((r): r is number => r != null);
  const avg_completion_rate =
    rates.length > 0 ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 10) / 10 : null;
  const vas_below_70_pct = rates.filter((r) => r < 70).length;

  return {
    range,
    team: {
      va_count: by_va.length,
      tasks: teamTaskRollup,
      shifts: teamShiftRollup,
      avg_completion_rate,
      vas_below_70_pct,
      daily: teamDailyRollup,
    },
    by_va,
  };
}
