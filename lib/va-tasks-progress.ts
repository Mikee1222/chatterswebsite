import type { PhaseItem, TaskPhase } from "@/services/task-phases";
import type { VaTaskRecord } from "@/types";

export type VaTaskProgressStatus = "complete" | "partial" | "not_started";

export type VaTaskWithPhases = {
  task: VaTaskRecord;
  phases: TaskPhase[];
};

export type VaProgressSummary = {
  vaId: string;
  vaName: string;
  tasks: VaTaskWithPhases[];
  totalItems: number;
  completedItems: number;
  screenshotsRequired: number;
  screenshotsProvided: number;
  status: VaTaskProgressStatus;
  hasOverdue: boolean;
  notes: string[];
};

export type AgencyProgressStats = {
  vasWithTasks: number;
  fullyComplete: number;
  partial: number;
  notStarted: number;
  totalItems: number;
  completedItems: number;
  overallPct: number;
};

function isPastDue(isoLike: string | null | undefined): boolean {
  if (!isoLike?.trim()) return false;
  const t = new Date(isoLike.trim()).getTime();
  return Number.isFinite(t) && t < Date.now();
}

function phaseIsOverdue(phase: TaskPhase): boolean {
  if (phase.status === "overdue") return true;
  if (phase.status === "completed") return false;
  return Boolean(phase.scheduled_time?.trim()) && isPastDue(phase.scheduled_time);
}

function taskIsOverdue(task: VaTaskRecord): boolean {
  return isPastDue(task.due_date) && task.status !== "done" && task.status !== "skipped";
}

function itemProgress(phases: TaskPhase[]): { total: number; completed: number; shotsReq: number; shotsProvided: number } {
  let total = 0;
  let completed = 0;
  let shotsReq = 0;
  let shotsProvided = 0;
  for (const phase of phases) {
    for (const item of phase.items ?? []) {
      total += 1;
      if (item.status === "completed") completed += 1;
      if (item.requires_screenshot) {
        shotsReq += 1;
        if ((item.screenshot?.length ?? 0) > 0) shotsProvided += 1;
      }
    }
  }
  return { total, completed, shotsReq, shotsProvided };
}

function progressStatus(total: number, completed: number): VaTaskProgressStatus {
  if (total === 0) return completed > 0 ? "complete" : "not_started";
  if (completed === 0) return "not_started";
  if (completed >= total) return "complete";
  return "partial";
}

const OBSERVATION_TITLE_RE = /παρατηρήσεις/i;

/** Collect VA-facing notes: task completion notes + observation checklist items. */
export function collectVaNotes(task: VaTaskRecord, phases: TaskPhase[]): string[] {
  const out: string[] = [];
  const taskNotes = task.completed_notes?.trim();
  if (taskNotes) out.push(taskNotes);

  for (const phase of phases) {
    for (const item of phase.items ?? []) {
      if (item.status !== "completed") continue;
      const title = item.title?.trim() ?? "";
      const desc = item.description?.trim() ?? "";
      if (OBSERVATION_TITLE_RE.test(title)) {
        if (desc) out.push(desc);
        else if (title && !OBSERVATION_TITLE_RE.test(title)) out.push(title);
      } else if (desc && item.step_type === "Other") {
        out.push(`${title ? `${title}: ` : ""}${desc}`);
      }
    }
  }

  return out;
}

export function hasOverdueInTask(task: VaTaskRecord, phases: TaskPhase[]): boolean {
  if (taskIsOverdue(task)) return true;
  return phases.some(phaseIsOverdue);
}

export function resolveTaskAssigneeIds(task: VaTaskRecord, allVaIds: string[]): string[] {
  if (task.assigned_to_ids.length === 0) return [...allVaIds];
  const allowed = new Set(allVaIds);
  return task.assigned_to_ids.filter((id) => allowed.has(id));
}

export function buildVaProgressSummaries(
  tasksWithPhases: VaTaskWithPhases[],
  vaUsers: Array<{ id: string; full_name: string; email: string }>,
  nameById: Record<string, string>,
): VaProgressSummary[] {
  const allVaIds = vaUsers.map((u) => u.id);
  const byVa = new Map<string, VaTaskWithPhases[]>();

  for (const va of vaUsers) {
    byVa.set(va.id, []);
  }

  for (const entry of tasksWithPhases) {
    const assignees = resolveTaskAssigneeIds(entry.task, allVaIds);
    for (const vaId of assignees) {
      const list = byVa.get(vaId);
      if (list) list.push(entry);
    }
  }

  const summaries: VaProgressSummary[] = [];

  for (const va of vaUsers) {
    const tasks = byVa.get(va.id) ?? [];
    if (tasks.length === 0) continue;

    let totalItems = 0;
    let completedItems = 0;
    let screenshotsRequired = 0;
    let screenshotsProvided = 0;
    let hasOverdue = false;
    const notes: string[] = [];

    for (const { task, phases } of tasks) {
      const p = itemProgress(phases);
      totalItems += p.total;
      completedItems += p.completed;
      screenshotsRequired += p.shotsReq;
      screenshotsProvided += p.shotsProvided;
      if (hasOverdueInTask(task, phases)) hasOverdue = true;
      notes.push(...collectVaNotes(task, phases));
    }

    summaries.push({
      vaId: va.id,
      vaName: (nameById[va.id] || va.full_name || va.email || va.id).trim(),
      tasks,
      totalItems,
      completedItems,
      screenshotsRequired,
      screenshotsProvided,
      status: progressStatus(totalItems, completedItems),
      hasOverdue,
      notes: [...new Set(notes.filter(Boolean))],
    });
  }

  summaries.sort((a, b) => a.vaName.localeCompare(b.vaName));
  return summaries;
}

export function buildAgencyProgressStats(summaries: VaProgressSummary[]): AgencyProgressStats {
  let fullyComplete = 0;
  let partial = 0;
  let notStarted = 0;
  let totalItems = 0;
  let completedItems = 0;

  for (const s of summaries) {
    if (s.status === "complete") fullyComplete += 1;
    else if (s.status === "partial") partial += 1;
    else notStarted += 1;
    totalItems += s.totalItems;
    completedItems += s.completedItems;
  }

  return {
    vasWithTasks: summaries.length,
    fullyComplete,
    partial,
    notStarted,
    totalItems,
    completedItems,
    overallPct: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
  };
}

export function flattenDateViewTasks(
  regularTasks: VaTaskRecord[],
  recurringGroups: Array<{ currentTask: VaTaskRecord | null }>,
): VaTaskRecord[] {
  return [
    ...regularTasks,
    ...recurringGroups.map((g) => g.currentTask).filter((t): t is VaTaskRecord => Boolean(t)),
  ];
}

export type { PhaseItem };
