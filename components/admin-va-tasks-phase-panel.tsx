"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { VaTaskRecord } from "@/types";
import type { PhaseItem, TaskPhase } from "@/services/task-phases";
import { cn } from "@/lib/utils";
import { DEFAULT_TASK_STEP_TYPE } from "@/lib/task-step-types";
import { VA_TASK_PHASES_FETCH_INIT, normalizeTaskPhasesForClient } from "@/lib/va-task-phases-fetch";
import { VA_CARD } from "@/lib/va-tasks-tokens";
import { AdminVaTaskCard } from "@/components/admin-va-task-card";
import { AdminVaTasksProgressOverview } from "@/components/admin-va-tasks-progress-overview";
import { EMPTY_TASK_PHASES } from "@/components/va-task-card";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import type { StaffUserOption } from "@/components/staff-assignee-picker";

const TASK_LIST_INITIAL_CAP = 40;

type VaUserOption = { id: string; full_name: string; email: string };

type RecurringGroup = {
  seriesKey: string;
  title: string;
  currentTask: VaTaskRecord | null;
  history: VaTaskRecord[];
  totalCompleted: number;
};

export type AdminVaTasksPhasePanelProps = {
  viewMode: "list" | "progress";
  canShowList: boolean;
  canViewProgress: boolean;
  canManage: boolean;
  visibleRegularTasks: VaTaskRecord[];
  regularTasks: VaTaskRecord[];
  recurringGroups: RecurringGroup[];
  showAllTasks: boolean;
  onShowAllTasks: () => void;
  progressViewTasks: VaTaskRecord[];
  dateFilteredTasks: VaTaskRecord[];
  hasAnyTasks: boolean;
  vaUsers: VaUserOption[];
  staffUsers: StaffUserOption[];
  nameById: Record<string, string>;
  reminding: string | null;
  remindSuccess: string | null;
  confirmingTaskDelete: boolean;
  taskPendingDelete: VaTaskRecord | null;
  onRemind: (task: VaTaskRecord) => void;
  onEdit: (task: VaTaskRecord) => void;
  onDelete: (task: VaTaskRecord) => void;
  expandedRecurringHistory: Set<string>;
  onToggleRecurringHistory: (seriesKey: string) => void;
  isSupabaseBackend: boolean;
  onServerRefresh: () => void;
  /** Changes when list filters/date change — clears cached phases. */
  phaseResetKey: string;
  selectedYmd: string;
};

/**
 * Isolated task-phase state + list/progress views so expanding one checklist does not
 * re-render the 2000+ line admin modal shell in the parent client.
 */
export function AdminVaTasksPhasePanel({
  viewMode,
  canShowList,
  canViewProgress,
  canManage,
  visibleRegularTasks,
  regularTasks,
  recurringGroups,
  showAllTasks,
  onShowAllTasks,
  progressViewTasks,
  dateFilteredTasks,
  hasAnyTasks,
  vaUsers,
  staffUsers,
  nameById,
  reminding,
  remindSuccess,
  confirmingTaskDelete,
  taskPendingDelete,
  onRemind,
  onEdit,
  onDelete,
  expandedRecurringHistory,
  onToggleRecurringHistory,
  isSupabaseBackend,
  onServerRefresh,
  phaseResetKey,
  selectedYmd,
}: AdminVaTasksPhasePanelProps) {
  const [taskPhases, setTaskPhases] = React.useState<Record<string, TaskPhase[]>>({});
  const taskPhasesRef = React.useRef(taskPhases);
  taskPhasesRef.current = taskPhases;
  const phasesInflightRef = React.useRef(new Set<string>());
  const [phasesLoadingIds, setPhasesLoadingIds] = React.useState<Record<string, true>>({});
  const [progressPhasesLoading, setProgressPhasesLoading] = React.useState(false);
  const [progressPhasesError, setProgressPhasesError] = React.useState<string | null>(null);
  const [isTabVisible, setIsTabVisible] = React.useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  React.useEffect(() => {
    setTaskPhases({});
  }, [phaseResetKey]);

  const loadPhases = React.useCallback(async (taskId: string, sourceTaskId?: string | null) => {
    if (phasesInflightRef.current.has(taskId)) return;
    phasesInflightRef.current.add(taskId);
    setPhasesLoadingIds((prev) => ({ ...prev, [taskId]: true }));
    // Keep prior snapshot while refetching — clearing to [] froze expand on large checklists.
    const params = new URLSearchParams({ task_id: taskId });
    if (sourceTaskId?.trim()) params.set("source_task_id", sourceTaskId.trim());
    try {
      const res = await fetch(`/api/admin/task-phases?${params}`, VA_TASK_PHASES_FETCH_INIT);
      const data = (await res.json().catch(() => ({}))) as { phases?: TaskPhase[] };
      React.startTransition(() => {
        setTaskPhases((prev) => ({
          ...prev,
          [taskId]: normalizeTaskPhasesForClient(data.phases ?? []),
        }));
      });
    } finally {
      phasesInflightRef.current.delete(taskId);
      setPhasesLoadingIds((prev) => {
        if (!prev[taskId]) return prev;
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }, []);

  const loadPhasesRef = React.useRef(loadPhases);
  loadPhasesRef.current = loadPhases;

  const loadProgressPhases = React.useCallback(async () => {
    const tasks = progressViewTasks;
    if (tasks.length === 0) {
      setProgressPhasesLoading(false);
      setProgressPhasesError(null);
      return;
    }
    setProgressPhasesLoading(true);
    setProgressPhasesError(null);
    try {
      // Chunk so URL length stays sane and server pagination is exercised for large days.
      const CHUNK = 25;
      const merged: Record<string, TaskPhase[]> = {};
      for (let i = 0; i < tasks.length; i += CHUNK) {
        const slice = tasks.slice(i, i + CHUNK);
        const params = new URLSearchParams({
          task_ids: slice.map((task) => task.id).join(","),
        });
        const sourceTaskIds = slice.map((task) => task.virtual_source_task_id?.trim() ?? "");
        if (sourceTaskIds.some((id) => id.length > 0)) {
          params.set("source_task_ids", sourceTaskIds.join(","));
        }
        const res = await fetch(`/api/admin/task-phases?${params}`, VA_TASK_PHASES_FETCH_INIT);
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json().catch(() => ({}))) as {
          phases_by_task?: Record<string, TaskPhase[]>;
        };
        const phasesByTask = data.phases_by_task ?? {};
        for (const task of slice) {
          merged[task.id] = normalizeTaskPhasesForClient(phasesByTask[task.id] ?? []);
        }
      }
      React.startTransition(() => {
        setTaskPhases((prev) => ({ ...prev, ...merged }));
      });
    } catch {
      setProgressPhasesError("Could not load phase data for progress overview.");
    } finally {
      setProgressPhasesLoading(false);
    }
  }, [progressViewTasks]);

  React.useEffect(() => {
    if (viewMode === "progress" && canViewProgress) {
      void loadProgressPhases();
    }
  }, [viewMode, canViewProgress, loadProgressPhases, selectedYmd]);

  React.useEffect(() => {
    const onVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsTabVisible(visible);
      if (visible && viewMode === "progress" && canViewProgress) {
        void loadProgressPhases();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [viewMode, canViewProgress, loadProgressPhases]);

  React.useEffect(() => {
    if (viewMode !== "progress" || !canViewProgress || !isTabVisible) return;
    if (isSupabaseBackend) return;
    const id = window.setInterval(() => {
      void loadProgressPhases();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [viewMode, canViewProgress, isTabVisible, loadProgressPhases, isSupabaseBackend]);

  useSupabaseRealtimeRefresh(
    ["va_tasks", "va_task_phases", "va_task_phase_items"],
    () => {
      // Do NOT wipe taskPhases — clearing forced every expanded card through empty→refetch
      // and raced checklist completion on large Warm-Up tasks (76 items).
      onServerRefresh();
      if (viewMode === "progress" && canViewProgress) {
        void loadProgressPhases();
      } else {
        const loaded = Object.keys(taskPhasesRef.current);
        for (const taskId of loaded) {
          const task =
            visibleRegularTasks.find((t) => t.id === taskId) ??
            regularTasks.find((t) => t.id === taskId) ??
            progressViewTasks.find((t) => t.id === taskId) ??
            dateFilteredTasks.find((t) => t.id === taskId);
          if (task) {
            void loadPhasesRef.current(
              task.id,
              task.is_virtual_occurrence ? task.virtual_source_task_id : null,
            );
          }
        }
      }
    },
    { debounceMs: 700 },
  );

  const handleAddPhase = React.useCallback(async (taskId: string, taskTitle: string) => {
    if (taskId.startsWith("virt_")) return;
    const phases = taskPhasesRef.current[taskId] ?? [];
    const res = await fetch("/api/admin/task-phases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        task_id: taskId,
        task_title: taskTitle,
        phase_number: phases.length + 1,
        title: `Phase ${phases.length + 1}`,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { phase?: TaskPhase };
    if (data.phase) {
      React.startTransition(() => {
        setTaskPhases((prev) => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), data.phase!] }));
      });
    }
  }, []);

  const handleUpdatePhase = React.useCallback(async (phaseId: string, taskId: string, updates: Partial<TaskPhase>) => {
    if (taskId.startsWith("virt_") || phaseId.startsWith("virt_")) return;
    const payload = { ...updates };
    await fetch(`/api/admin/task-phases/${encodeURIComponent(phaseId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    React.startTransition(() => {
      setTaskPhases((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] ?? []).map((p) => (p.id === phaseId ? { ...p, ...payload } : p)),
      }));
    });
  }, []);

  const handleDeletePhase = React.useCallback(async (phaseId: string, taskId: string) => {
    if (taskId.startsWith("virt_") || phaseId.startsWith("virt_")) return;
    if (!confirm("Delete this phase?")) return;
    await fetch(`/api/admin/task-phases/${encodeURIComponent(phaseId)}`, { method: "DELETE", credentials: "include" });
    React.startTransition(() => {
      setTaskPhases((prev) => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter((p) => p.id !== phaseId) }));
    });
  }, []);

  const handleAddPhaseItem = React.useCallback(async (phaseId: string, taskId: string) => {
    if (taskId.startsWith("virt_") || phaseId.startsWith("virt_")) return;
    const phase = (taskPhasesRef.current[taskId] ?? []).find((p) => p.id === phaseId);
    const itemCount = phase?.items?.length ?? 0;
    const res = await fetch(`/api/admin/task-phases/${encodeURIComponent(phaseId)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        task_id: taskId,
        title: "",
        requires_screenshot: false,
        sort_order: itemCount,
        step_type: DEFAULT_TASK_STEP_TYPE,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { item?: PhaseItem };
    if (data.item) {
      React.startTransition(() => {
        setTaskPhases((prev) => ({
          ...prev,
          [taskId]: (prev[taskId] ?? []).map((p) =>
            p.id === phaseId ? { ...p, items: [...(p.items ?? []), data.item!] } : p,
          ),
        }));
      });
    }
  }, []);

  const handleUpdatePhaseItem = React.useCallback(
    async (itemId: string, phaseId: string, taskId: string, updates: Partial<PhaseItem>) => {
      if (taskId.startsWith("virt_") || phaseId.startsWith("virt_") || itemId.startsWith("virt_")) return;
      await fetch(`/api/admin/task-phases/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      React.startTransition(() => {
        setTaskPhases((prev) => ({
          ...prev,
          [taskId]: (prev[taskId] ?? []).map((p) =>
            p.id === phaseId
              ? {
                  ...p,
                  items: (p.items ?? []).map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
                }
              : p,
          ),
        }));
      });
    },
    [],
  );

  const handleDeletePhaseItem = React.useCallback(async (itemId: string, phaseId: string, taskId: string) => {
    if (taskId.startsWith("virt_") || phaseId.startsWith("virt_") || itemId.startsWith("virt_")) return;
    await fetch(`/api/admin/task-phases/items/${encodeURIComponent(itemId)}`, { method: "DELETE", credentials: "include" });
    React.startTransition(() => {
      setTaskPhases((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] ?? []).map((p) =>
          p.id === phaseId ? { ...p, items: (p.items ?? []).filter((i) => i.id !== itemId) } : p,
        ),
      }));
    });
  }, []);

  const updatePhaseTitleLocal = React.useCallback((phaseId: string, taskId: string, title: string) => {
    React.startTransition(() => {
      setTaskPhases((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] ?? []).map((p) => (p.id === phaseId ? { ...p, title } : p)),
      }));
    });
  }, []);

  const assignedLabel = React.useCallback(
    (t: VaTaskRecord) => {
      if (t.assigned_to_ids.length === 0) return "All VAs";
      return t.assigned_to_ids.map((id) => nameById[id] ?? id).join(", ");
    },
    [nameById],
  );

  const renderTaskCard = React.useCallback(
    (task: VaTaskRecord) => (
      <AdminVaTaskCard
        key={task.id}
        task={task}
        assignedLabel={assignedLabel(task)}
        canManage={canManage}
        phases={taskPhases[task.id] ?? EMPTY_TASK_PHASES}
        phasesLoading={Boolean(phasesLoadingIds[task.id])}
        isReminding={reminding === task.id}
        remindSuccess={remindSuccess === task.id}
        isConfirmingDelete={confirmingTaskDelete && taskPendingDelete?.id === task.id}
        onRemind={onRemind}
        onEdit={onEdit}
        onDelete={onDelete}
        onLoadPhases={loadPhases}
        onAddPhase={handleAddPhase}
        onUpdatePhase={handleUpdatePhase}
        onDeletePhase={handleDeletePhase}
        onAddPhaseItem={handleAddPhaseItem}
        onUpdatePhaseItem={handleUpdatePhaseItem}
        onDeletePhaseItem={handleDeletePhaseItem}
        onUpdatePhaseTitleLocal={updatePhaseTitleLocal}
      />
    ),
    [
      assignedLabel,
      canManage,
      taskPhases,
      phasesLoadingIds,
      reminding,
      remindSuccess,
      confirmingTaskDelete,
      taskPendingDelete,
      onRemind,
      onEdit,
      onDelete,
      loadPhases,
      handleAddPhase,
      handleUpdatePhase,
      handleDeletePhase,
      handleAddPhaseItem,
      handleUpdatePhaseItem,
      handleDeletePhaseItem,
      updatePhaseTitleLocal,
    ],
  );

  return (
    <>
      {viewMode === "progress" && canViewProgress ? (
        <AdminVaTasksProgressOverview
          tasks={progressViewTasks}
          vaUsers={vaUsers}
          staffUsers={staffUsers}
          nameById={nameById}
          taskPhases={taskPhases}
          phasesLoading={progressPhasesLoading}
          phasesError={progressPhasesError}
          onLoadPhases={() => void loadProgressPhases()}
        />
      ) : null}

      {viewMode === "list" && canShowList && hasAnyTasks && dateFilteredTasks.length === 0 ? (
        <div className={cn(VA_CARD, "flex flex-col items-center justify-center px-6 py-12 text-center")}>
          <p className="text-base font-semibold text-white/90">No tasks for this date</p>
          <p className="mt-2 max-w-sm text-sm text-[#B8B4B8]/55">Try another day or jump back to today.</p>
        </div>
      ) : viewMode === "list" && canShowList && regularTasks.length === 0 && recurringGroups.length === 0 ? (
        <div className={cn(VA_CARD, "flex flex-col items-center justify-center px-6 py-16 text-center")}>
          <svg className="mb-5 h-14 w-14 text-[#D4AF8C]/35" viewBox="0 0 64 64" fill="none" aria-hidden>
            <rect x="12" y="10" width="40" height="46" rx="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M22 24h20M22 34h14M22 44h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-base font-semibold text-white/90">No tasks match</p>
          <p className="mt-2 max-w-sm text-sm text-[#B8B4B8]/55">
            {canManage ? "Adjust search or filters, or create a new task." : "Adjust search or filters to find tasks."}
          </p>
        </div>
      ) : viewMode === "list" && canShowList ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleRegularTasks.map((task) => renderTaskCard(task))}
          {!showAllTasks && regularTasks.length > TASK_LIST_INITIAL_CAP ? (
            <button
              type="button"
              onClick={onShowAllTasks}
              className="md:col-span-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151315] px-4 py-3 text-sm font-medium text-[#D4AF8C]/80 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
            >
              Show all {regularTasks.length} tasks ({regularTasks.length - TASK_LIST_INITIAL_CAP} more)
            </button>
          ) : null}
          {recurringGroups.map((group) => (
            <div key={group.seriesKey} className="mb-3 md:col-span-2">
              {group.currentTask ? (
                renderTaskCard(group.currentTask)
              ) : (
                <div className="mb-1 rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-purple-400/50" />
                    <span className="text-sm font-semibold text-white/50">{group.title}</span>
                    <span className="rounded-full border border-purple-500/20 bg-purple-500/15 px-2 py-0.5 text-xs text-purple-400">
                      Recurring
                    </span>
                    <span className="ml-auto text-xs text-white/25">Waiting for next spawn...</span>
                  </div>
                </div>
              )}
              {group.history.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onToggleRecurringHistory(group.seriesKey)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-xs text-white/30 transition-colors hover:text-white/60"
                >
                  <div
                    className={cn(
                      "transition-transform",
                      expandedRecurringHistory.has(group.seriesKey) ? "rotate-90" : "",
                    )}
                  >
                    ▶
                  </div>
                  <span>History ({group.totalCompleted} completed)</span>
                  <div className="ml-2 h-px flex-1 bg-white/8" />
                </button>
              ) : null}
              {expandedRecurringHistory.has(group.seriesKey) ? (
                <div className="mb-3 ml-4 mt-1 space-y-2 border-l border-white/10 pl-4">
                  {group.history.map((histTask) => (
                    <div
                      key={histTask.id}
                      className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.015] px-4 py-3 opacity-70"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/60 line-through">{histTask.title}</p>
                        {histTask.completed_notes ? (
                          <p className="mt-0.5 text-xs italic text-white/30">&ldquo;{histTask.completed_notes}&rdquo;</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        {histTask.due_date ? (
                          <p className="text-xs text-white/25">
                            {new Date(histTask.due_date).toLocaleDateString("el-GR", {
                              timeZone: "Europe/Athens",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        ) : null}
                        {histTask.completed_at ? (
                          <p className="text-xs text-green-400/50">
                            {new Date(histTask.completed_at).toLocaleString("el-GR", {
                              timeZone: "Europe/Athens",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
