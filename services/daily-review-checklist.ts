/**
 * Assemble the live Daily Review audit tree for an Athens calendar day:
 * VA → task(s) → phase checklist items, with optional verification overlay.
 */
import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { toReviewDateKey } from "@/lib/marketing-reviews-helpers";
import { filterTasksByAthensYmd } from "@/lib/va-task-date-filter";
import {
  listVerificationsForReview,
  listVerificationsForReviews,
  type DailyReviewItemVerification,
  type DailyReviewVerifiedStatus,
} from "@/services/daily-review-verifications";
import {
  getDailyReviews,
  type MarketingDailyReview,
} from "@/services/marketing-reviews";
import { batchSignUrlMap } from "@/lib/supabase-signed-url";
import {
  getPhasesForTasksDisplay,
  type PhaseItem,
  type PhaseScreenshot,
  type TaskPhase,
} from "@/services/task-phases";
import { getAllVaTasks } from "@/services/va-tasks";
import { listActiveUsers } from "@/services/users";
import type { VaTaskRecord } from "@/types";

export type ChecklistItemVaStatus = "pending" | "completed";

export type DailyReviewChecklistScreenshot = PhaseScreenshot;

export interface DailyReviewChecklistItem {
  item_id: string;
  phase_id: string;
  phase_number: number;
  phase_title: string;
  task_id: string;
  task_title: string;
  title: string;
  description: string;
  requires_screenshot: boolean;
  va_status: ChecklistItemVaStatus;
  completed_at: string | null;
  completed_by_va_id: string;
  completed_by_va_name: string;
  screenshot_count: number;
  /** Signed (or https) URLs for VA-uploaded proof screenshots. */
  screenshots: DailyReviewChecklistScreenshot[];
  verification: DailyReviewItemVerification | null;
}

export interface DailyReviewChecklistTask {
  task_id: string;
  task_title: string;
  task_status: string;
  is_virtual: boolean;
  due_date: string | null;
  items: DailyReviewChecklistItem[];
}

export interface DailyReviewChecklistVa {
  va_id: string;
  va_name: string;
  tasks: DailyReviewChecklistTask[];
  stats: {
    total_items: number;
    va_completed: number;
    verified: number;
    flagged: number;
    unverified: number;
  };
}

export interface DailyReviewChecklistSummary {
  total_items: number;
  va_completed: number;
  verified: number;
  flagged: number;
  unverified: number;
  vas_reviewed: number;
  tasks: number;
}

export interface DailyReviewChecklistPayload {
  date: string;
  vas: DailyReviewChecklistVa[];
  summary: DailyReviewChecklistSummary;
  /** When scoped to one supervisor review — verifications for that review only. */
  review_id: string | null;
}

export interface AdminDailyReviewChecklistPayload {
  date: string;
  reviews: Array<{
    review: MarketingDailyReview;
    vas: DailyReviewChecklistVa[];
    summary: DailyReviewChecklistSummary;
  }>;
  /** Flat checklist once (shared across supervisors); each item carries per-supervisor verifications. */
  shared_vas: DailyReviewChecklistVaShared[];
  team_summary: DailyReviewChecklistSummary & {
    supervisors: number;
  };
  leaderboard: {
    vas_by_flags: Array<{ va_id: string; va_name: string; flagged: number; verified: number }>;
    supervisors_by_activity: Array<{
      manager_id: string;
      manager_name: string;
      verified: number;
      flagged: number;
      total: number;
    }>;
  };
}

export interface DailyReviewChecklistVaShared {
  va_id: string;
  va_name: string;
  tasks: Array<{
    task_id: string;
    task_title: string;
    task_status: string;
    is_virtual: boolean;
    due_date: string | null;
    items: Array<
      Omit<DailyReviewChecklistItem, "verification"> & {
        verifications: DailyReviewItemVerification[];
      }
    >;
  }>;
  stats: DailyReviewChecklistVa["stats"];
}

function emptySummary(): DailyReviewChecklistSummary {
  return {
    total_items: 0,
    va_completed: 0,
    verified: 0,
    flagged: 0,
    unverified: 0,
    vas_reviewed: 0,
    tasks: 0,
  };
}

function summarizeVas(vas: DailyReviewChecklistVa[]): DailyReviewChecklistSummary {
  const summary = emptySummary();
  summary.vas_reviewed = vas.length;
  for (const va of vas) {
    summary.total_items += va.stats.total_items;
    summary.va_completed += va.stats.va_completed;
    summary.verified += va.stats.verified;
    summary.flagged += va.stats.flagged;
    summary.unverified += va.stats.unverified;
    summary.tasks += va.tasks.length;
  }
  return summary;
}

function computeVaStats(tasks: DailyReviewChecklistTask[]): DailyReviewChecklistVa["stats"] {
  let total_items = 0;
  let va_completed = 0;
  let verified = 0;
  let flagged = 0;
  let unverified = 0;
  for (const task of tasks) {
    for (const item of task.items) {
      total_items += 1;
      if (item.va_status === "completed") va_completed += 1;
      if (item.verification?.verified_status === "verified") verified += 1;
      else if (item.verification?.verified_status === "flagged_not_done") flagged += 1;
      else unverified += 1;
    }
  }
  return { total_items, va_completed, verified, flagged, unverified };
}

function userDisplayName(u: { full_name?: string | null; email?: string | null; id: string }): string {
  return (u.full_name || u.email || u.id).trim();
}

async function loadDayTasks(ymd: string): Promise<VaTaskRecord[]> {
  const target = toReviewDateKey(ymd) || getTodayYmdAthens();
  // Pad ±1 day for due_date edge cases; include recurring anchors for virtual projection.
  const start = addDaysAthensYmd(target, -1);
  const end = addDaysAthensYmd(target, 1);
  const tasks = await getAllVaTasks({
    athensStartYmd: start,
    athensEndYmd: end,
    includeRecurring: true,
  });
  return filterTasksByAthensYmd(tasks, target).filter(
    (t) => t.status !== "skipped",
  );
}

function buildNameMap(
  users: Array<{ id: string; full_name?: string | null; email?: string | null }>,
  tasks: VaTaskRecord[],
  phasesByTask: Record<string, TaskPhase[]>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of users) {
    map.set(u.id, userDisplayName(u));
  }
  for (const task of tasks) {
    for (const phase of phasesByTask[task.id] ?? []) {
      if (phase.assigned_va_id && phase.assigned_va_name) {
        map.set(phase.assigned_va_id, phase.assigned_va_name);
      }
      for (const item of phase.items ?? []) {
        if (item.completed_by_va_id && item.completed_by_va_name) {
          map.set(item.completed_by_va_id, item.completed_by_va_name);
        }
      }
    }
  }
  return map;
}

function primaryVaForTask(
  task: VaTaskRecord,
  phases: TaskPhase[],
  nameMap: Map<string, string>,
): { va_id: string; va_name: string } {
  const fromPhase = phases.find((p) => p.assigned_va_id?.trim())?.assigned_va_id?.trim();
  const fromAssignee = task.assigned_to_ids.find((id) => id.trim());
  const va_id = fromPhase || fromAssignee || "unassigned";
  const va_name =
    (va_id !== "unassigned" ? nameMap.get(va_id) : null) ||
    phases.find((p) => p.assigned_va_name?.trim())?.assigned_va_name?.trim() ||
    (va_id === "unassigned" ? "Unassigned" : va_id);
  return { va_id, va_name };
}

function mapItem(
  item: PhaseItem,
  phase: TaskPhase,
  task: VaTaskRecord,
  verificationByItem: Map<string, DailyReviewItemVerification>,
): DailyReviewChecklistItem {
  const screenshots = (item.screenshot ?? []).filter(
    (s): s is PhaseScreenshot => Boolean(s?.url && typeof s.url === "string"),
  );
  return {
    item_id: item.id,
    phase_id: phase.phase_id || phase.id,
    phase_number: phase.phase_number,
    phase_title: phase.title,
    task_id: task.id,
    task_title: task.title,
    title: item.title,
    description: item.description,
    requires_screenshot: item.requires_screenshot,
    va_status: item.status === "completed" ? "completed" : "pending",
    completed_at: item.completed_at,
    completed_by_va_id: item.completed_by_va_id,
    completed_by_va_name: item.completed_by_va_name,
    screenshot_count: screenshots.length,
    screenshots,
    verification: verificationByItem.get(item.id) ?? null,
  };
}

/** Re-mint signed URLs for any leftover `sb://` tokens (Airtable path / stale maps). */
async function ensureChecklistScreenshotsSigned(
  vas: DailyReviewChecklistVa[],
): Promise<DailyReviewChecklistVa[]> {
  const urls: string[] = [];
  for (const va of vas) {
    for (const task of va.tasks) {
      for (const item of task.items) {
        for (const s of item.screenshots) {
          if (s.url) urls.push(s.url);
        }
      }
    }
  }
  if (!urls.length) return vas;
  const signedMap = await batchSignUrlMap(urls);
  return vas.map((va) => ({
    ...va,
    tasks: va.tasks.map((task) => ({
      ...task,
      items: task.items.map((item) => ({
        ...item,
        screenshots: item.screenshots.map((s) => ({
          ...s,
          url: signedMap.get(s.url) ?? s.url,
        })),
      })),
    })),
  }));
}

function groupByVa(
  tasks: VaTaskRecord[],
  phasesByTask: Record<string, TaskPhase[]>,
  nameMap: Map<string, string>,
  verificationByItem: Map<string, DailyReviewItemVerification>,
): DailyReviewChecklistVa[] {
  const byVa = new Map<string, DailyReviewChecklistVa>();

  for (const task of tasks) {
    const phases = [...(phasesByTask[task.id] ?? [])].sort(
      (a, b) => (a.phase_number || 0) - (b.phase_number || 0),
    );
    const items: DailyReviewChecklistItem[] = [];
    for (const phase of phases) {
      const sortedItems = [...(phase.items ?? [])].sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
      );
      for (const item of sortedItems) {
        items.push(mapItem(item, phase, task, verificationByItem));
      }
    }
    // Skip tasks with no checklist structure
    if (!items.length) continue;

    const { va_id, va_name } = primaryVaForTask(task, phases, nameMap);
    const checklistTask: DailyReviewChecklistTask = {
      task_id: task.id,
      task_title: task.title,
      task_status: task.status,
      is_virtual: Boolean(task.is_virtual_occurrence),
      due_date: task.due_date,
      items,
    };

    const existing = byVa.get(va_id);
    if (existing) {
      existing.tasks.push(checklistTask);
      if (!existing.va_name && va_name) existing.va_name = va_name;
    } else {
      byVa.set(va_id, {
        va_id,
        va_name,
        tasks: [checklistTask],
        stats: { total_items: 0, va_completed: 0, verified: 0, flagged: 0, unverified: 0 },
      });
    }
  }

  const vas = [...byVa.values()].map((va) => ({
    ...va,
    tasks: va.tasks.sort((a, b) => a.task_title.localeCompare(b.task_title)),
    stats: computeVaStats(va.tasks),
  }));
  vas.sort((a, b) => a.va_name.localeCompare(b.va_name));
  return vas;
}

/**
 * Checklist audit tree for one Athens day, optionally overlaid with one supervisor's verifications.
 */
export async function getDailyReviewChecklistForDate(params: {
  date: string;
  reviewId?: string | null;
}): Promise<DailyReviewChecklistPayload> {
  const date = toReviewDateKey(params.date) || getTodayYmdAthens();
  const [tasks, users] = await Promise.all([
    loadDayTasks(date),
    listActiveUsers().catch(() => []),
  ]);

  const phasesByTask = await getPhasesForTasksDisplay(
    tasks.map((t) => ({
      taskId: t.id,
      sourceTaskId: t.virtual_source_task_id ?? null,
    })),
  );

  const nameMap = buildNameMap(users, tasks, phasesByTask);
  const verifications = params.reviewId
    ? await listVerificationsForReview(params.reviewId).catch(() => [])
    : [];
  const verificationByItem = new Map(verifications.map((v) => [v.task_phase_item_id, v]));

  const vas = await ensureChecklistScreenshotsSigned(
    groupByVa(tasks, phasesByTask, nameMap, verificationByItem),
  );
  return {
    date,
    vas,
    summary: summarizeVas(vas),
    review_id: params.reviewId ?? null,
  };
}

/**
 * Admin team view: shared VA checklist for the day + every supervisor's verify/flag overlay.
 */
export async function getAdminDailyReviewChecklistForDate(params: {
  date: string;
}): Promise<AdminDailyReviewChecklistPayload> {
  const date = toReviewDateKey(params.date) || getTodayYmdAthens();
  const [base, dayReviews] = await Promise.all([
    getDailyReviewChecklistForDate({ date }),
    getDailyReviews({ date_from: date, date_to: date }),
  ]);

  const reviewIds = dayReviews.map((r) => r.id);
  const allVerifications = reviewIds.length
    ? await listVerificationsForReviews(reviewIds).catch(() => [])
    : [];

  const verificationsByReview = new Map<string, DailyReviewItemVerification[]>();
  for (const v of allVerifications) {
    const list = verificationsByReview.get(v.review_id) ?? [];
    list.push(v);
    verificationsByReview.set(v.review_id, list);
  }

  const reviews = dayReviews.map((review) => {
    const vMap = new Map(
      (verificationsByReview.get(review.id) ?? []).map((v) => [v.task_phase_item_id, v]),
    );
    const vas: DailyReviewChecklistVa[] = base.vas.map((va) => {
      const tasks = va.tasks.map((task) => ({
        ...task,
        items: task.items.map((item) => ({
          ...item,
          verification: vMap.get(item.item_id) ?? null,
        })),
      }));
      return { ...va, tasks, stats: computeVaStats(tasks) };
    });
    return { review, vas, summary: summarizeVas(vas) };
  });

  const verificationsByItem = new Map<string, DailyReviewItemVerification[]>();
  for (const v of allVerifications) {
    const list = verificationsByItem.get(v.task_phase_item_id) ?? [];
    list.push(v);
    verificationsByItem.set(v.task_phase_item_id, list);
  }

  const shared_vas: DailyReviewChecklistVaShared[] = base.vas.map((va) => {
    const tasks = va.tasks.map((task) => ({
      task_id: task.task_id,
      task_title: task.task_title,
      task_status: task.task_status,
      is_virtual: task.is_virtual,
      due_date: task.due_date,
      items: task.items.map((item) => {
        const { verification: _drop, ...rest } = item;
        return {
          ...rest,
          verifications: verificationsByItem.get(item.item_id) ?? [],
        };
      }),
    }));
    let flagged = 0;
    let verified = 0;
    let total_items = 0;
    let va_completed = 0;
    for (const task of tasks) {
      for (const item of task.items) {
        total_items += 1;
        if (item.va_status === "completed") va_completed += 1;
        if (item.verifications.some((v) => v.verified_status === "flagged_not_done")) flagged += 1;
        else if (item.verifications.some((v) => v.verified_status === "verified")) verified += 1;
      }
    }
    const unverified = Math.max(0, total_items - verified - flagged);
    return {
      va_id: va.va_id,
      va_name: va.va_name,
      tasks,
      stats: { total_items, va_completed, verified, flagged, unverified },
    };
  });

  const flagCounts = new Map<string, { va_id: string; va_name: string; flagged: number; verified: number }>();
  for (const va of shared_vas) {
    flagCounts.set(va.va_id, {
      va_id: va.va_id,
      va_name: va.va_name,
      flagged: va.stats.flagged,
      verified: va.stats.verified,
    });
  }

  const supervisorActivity = new Map<
    string,
    { manager_id: string; manager_name: string; verified: number; flagged: number; total: number }
  >();
  for (const review of dayReviews) {
    const key = review.manager_id || review.manager_name;
    const entry = supervisorActivity.get(key) ?? {
      manager_id: review.manager_id,
      manager_name: review.manager_name,
      verified: 0,
      flagged: 0,
      total: 0,
    };
    for (const v of verificationsByReview.get(review.id) ?? []) {
      entry.total += 1;
      if (v.verified_status === "verified") entry.verified += 1;
      else entry.flagged += 1;
    }
    supervisorActivity.set(key, entry);
  }

  const team_summary = {
    ...base.summary,
    verified: allVerifications.filter((v) => v.verified_status === "verified").length,
    flagged: allVerifications.filter((v) => v.verified_status === "flagged_not_done").length,
    unverified: Math.max(
      0,
      base.summary.total_items - new Set(allVerifications.map((v) => v.task_phase_item_id)).size,
    ),
    supervisors: dayReviews.length,
  };

  return {
    date,
    reviews,
    shared_vas,
    team_summary,
    leaderboard: {
      vas_by_flags: [...flagCounts.values()]
        .filter((v) => v.flagged > 0 || v.verified > 0)
        .sort((a, b) => b.flagged - a.flagged || b.verified - a.verified),
      supervisors_by_activity: [...supervisorActivity.values()].sort(
        (a, b) => b.total - a.total || b.verified - a.verified,
      ),
    },
  };
}

export { formatVaBreakdownLine } from "@/lib/daily-review-checklist-format";

export type { DailyReviewVerifiedStatus };
