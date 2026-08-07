"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ListChecks, StickyNote, X } from "lucide-react";
import { updateRecurringVaTaskAction, updateVaTaskAction, updateVaTaskStatusAction } from "@/app/actions/va-tasks";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { RecurringOccurrenceScopeDialog } from "@/components/recurring-occurrence-scope-dialog";
import { selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { VAShadowbanReportModal } from "@/components/va-shadowban-report-modal";
import type { VaTaskPriority, VaTaskRecord, VaTaskStatus } from "@/types";
import type { PhaseItem, TaskPhase } from "@/services/task-phases";
import type { SocialAccount } from "@/services/marketing";
import { cn } from "@/lib/utils";
import type { RecurringOccurrenceScope } from "@/lib/recurring-occurrence-scope";
import { groupRecurringTasks } from "@/lib/recurring-utils";
import { filterTasksByAthensYmd, getVaTasksViewTodayYmd } from "@/lib/va-task-date-filter";
import { formatActiveDuration, isShiftPausedOrOnBreak, shiftActiveSeconds } from "@/lib/shift-active-duration";
import { VA_CARD, VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";
import { ShiftButton } from "@/components/shift-button";
import { TaskDateNavigator } from "@/components/task-date-navigator";
import { VaTaskCard, EMPTY_TASK_PHASES, modelAccountsKeyForPhases } from "@/components/va-task-card";
import { VaTasksSearchBar } from "@/components/va-tasks-search-bar";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { useToast } from "@/contexts/toast-context";
import { applyOptimisticItemCompletion } from "@/lib/va-task-phase-optimistic";
import { ManagerReviewFileDropzone } from "@/components/manager-review-ui";
import { postFormData } from "@/lib/post-form-data";
import { uploadScreenshotToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import {
  ENGAGEMENT_SCREENSHOT_TARGET,
  isEngagementScreenshotItem,
  VA_TASK_SCREENSHOT_MAX_MB,
  vaTaskScreenshotFileError,
} from "@/lib/va-task-screenshots";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";

type Props = {
  tasks: VaTaskRecord[];
  userName?: string;
  initialActiveShift?: ActiveShift | null;
  canManage?: boolean;
};

const DATE_VIEW_GROUP_OPTS = { forDateView: true as const };
const TASK_LIST_INITIAL_CAP = 40;

function isPastDue(isoLike: string | null | undefined): boolean {
  if (!isoLike?.trim()) return false;
  const t = new Date(isoLike.trim()).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

const fieldMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

type ActiveShift = {
  id: string;
  start_time: string;
  status: string;
  break_started_at?: string | null;
  paused_seconds?: number;
  break_minutes?: number;
};

function isOptimisticShiftId(id: string): boolean {
  return id.startsWith("optimistic-");
}

function isShiftPaused(shift: ActiveShift | null | undefined): boolean {
  return isShiftPausedOrOnBreak(shift);
}

/** Isolated shift UI + 1s timer so the task list does not re-render every second. */
function VaShiftBar({
  isViewingToday,
  onShiftChange,
  initialActiveShift = null,
}: {
  isViewingToday: boolean;
  /** True only when actively on shift (not paused) — gates checklist completion. */
  onShiftChange: (onShiftActive: boolean) => void;
  initialActiveShift?: ActiveShift | null;
}) {
  const [activeShift, setActiveShift] = React.useState<ActiveShift | null>(initialActiveShift);
  const [shiftLoading, setShiftLoading] = React.useState(!initialActiveShift);
  const [shiftBusy, setShiftBusy] = React.useState(false);
  const [shiftErr, setShiftErr] = React.useState<string | null>(null);
  const [shiftDuration, setShiftDuration] = React.useState("0s");
  const fetchSeqRef = React.useRef(0);
  const pendingStartIdRef = React.useRef<string | null>(null);
  /** After local pause/resume/start/end, ignore stale SSR until a fresh active-shift fetch applies. */
  const ignoreStaleSsrRef = React.useRef(false);
  const localMutationEpochRef = React.useRef(0);

  const setShiftState = React.useCallback(
    (shift: ActiveShift | null) => {
      setActiveShift(shift);
      onShiftChange(!!shift && !isShiftPaused(shift));
    },
    [onShiftChange],
  );

  const bumpLocalMutation = React.useCallback(() => {
    localMutationEpochRef.current += 1;
    // Invalidate in-flight /api/va/task-shift/active responses.
    fetchSeqRef.current += 1;
    ignoreStaleSsrRef.current = true;
  }, []);

  const fetchActiveShift = React.useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    const epochAtStart = localMutationEpochRef.current;
    try {
      const res = await fetch("/api/va/task-shift/active", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { shift?: ActiveShift | null };
      if (seq !== fetchSeqRef.current) return;
      if (epochAtStart !== localMutationEpochRef.current) return;
      // Don't clobber optimistic start with a stale null while start is in flight.
      if (pendingStartIdRef.current && !data.shift) return;
      if (res.ok) {
        setShiftState(data.shift ?? null);
        ignoreStaleSsrRef.current = false;
      }
    } finally {
      if (seq === fetchSeqRef.current) setShiftLoading(false);
    }
  }, [setShiftState]);

  React.useEffect(() => {
    // Never flip parent onShift from SSR alone without updating VaShiftBar activeShift —
    // that desync locks checkboxes while the bar still shows On Shift.
    if (initialActiveShift) {
      setShiftLoading(false);
      if (!ignoreStaleSsrRef.current) {
        setShiftState(initialActiveShift);
      }
    }
    void fetchActiveShift();
  }, [fetchActiveShift, initialActiveShift, setShiftState]);

  React.useEffect(() => {
    if (!activeShift?.start_time) {
      setShiftDuration("0s");
      return;
    }
    const tick = () => {
      setShiftDuration(
        formatActiveDuration(
          shiftActiveSeconds({
            start_time: activeShift.start_time,
            break_started_at: activeShift.break_started_at,
            paused_seconds: activeShift.paused_seconds,
            break_minutes: activeShift.break_minutes,
            status: activeShift.status,
          }),
        ),
      );
    };
    tick();
    // Freeze the display tick while paused (still recompute once on pause transition).
    if (isShiftPaused(activeShift)) return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [
    activeShift?.start_time,
    activeShift?.status,
    activeShift?.break_started_at,
    activeShift?.paused_seconds,
    activeShift?.break_minutes,
  ]);

  async function handleStartShift() {
    if (shiftBusy) return;
    setShiftErr(null);
    bumpLocalMutation();
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticStartedAt = new Date().toISOString();
    pendingStartIdRef.current = optimisticId;
    // Instant ON SHIFT — don't wait for the network.
    setShiftState({
      id: optimisticId,
      start_time: optimisticStartedAt,
      status: "active",
      break_started_at: null,
      paused_seconds: 0,
      break_minutes: 0,
    });
    setShiftBusy(true);
    try {
      const res = await fetch("/api/va/task-shift/start", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        shift?: ActiveShift;
        shiftId?: string;
      };
      if (!res.ok) {
        if (res.status === 409 && data.shift) {
          pendingStartIdRef.current = data.shift.id;
          setShiftState(data.shift);
          setShiftErr(null);
          return;
        }
        const msg = data.error?.trim() || "Could not start shift";
        if (msg.toLowerCase().includes("already have an active")) {
          pendingStartIdRef.current = null;
          await fetchActiveShift();
          return;
        }
        pendingStartIdRef.current = null;
        setShiftState(null);
        setShiftErr(msg);
        return;
      }
      if (data.shift) {
        pendingStartIdRef.current = data.shift.id;
        setShiftState(data.shift);
      } else if (data.shiftId) {
        pendingStartIdRef.current = data.shiftId;
        setShiftState({
          id: data.shiftId,
          start_time: optimisticStartedAt,
          status: "active",
          break_started_at: null,
          paused_seconds: 0,
          break_minutes: 0,
        });
      }
      setShiftErr(null);
      // Background reconcile — don't block ON SHIFT UI.
      void fetchActiveShift();
    } catch {
      pendingStartIdRef.current = null;
      setShiftState(null);
      setShiftErr("Could not start shift");
    } finally {
      setShiftBusy(false);
    }
  }

  async function handlePauseShift() {
    if (shiftBusy || !activeShift || isOptimisticShiftId(activeShift.id)) return;
    setShiftBusy(true);
    setShiftErr(null);
    const prev = activeShift;
    bumpLocalMutation();
    const pauseIso = new Date().toISOString();
    setShiftState({ ...activeShift, status: "on_break", break_started_at: pauseIso });
    try {
      const res = await fetch("/api/va/task-shift/pause", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; shift?: ActiveShift };
      if (!res.ok) {
        setShiftState(prev);
        setShiftErr(data.error?.trim() || "Could not pause shift");
        return;
      }
      if (data.shift) setShiftState(data.shift);
      setShiftErr(null);
    } catch {
      setShiftState(prev);
      setShiftErr("Could not pause shift");
    } finally {
      setShiftBusy(false);
    }
  }

  async function handleResumeShift() {
    if (shiftBusy || !activeShift || isOptimisticShiftId(activeShift.id)) return;
    setShiftBusy(true);
    setShiftErr(null);
    const prev = activeShift;
    bumpLocalMutation();
    // Optimistically close the open pause into paused_seconds.
    let paused = Math.max(0, Math.floor(Number(activeShift.paused_seconds ?? 0)));
    if (activeShift.break_started_at?.trim()) {
      const startMs = new Date(activeShift.break_started_at).getTime();
      if (Number.isFinite(startMs)) {
        paused += Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      }
    }
    setShiftState({
      ...activeShift,
      status: "active",
      break_started_at: null,
      paused_seconds: paused,
      break_minutes: Math.ceil(paused / 60),
    });
    try {
      const res = await fetch("/api/va/task-shift/resume", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; shift?: ActiveShift };
      if (!res.ok) {
        setShiftState(prev);
        setShiftErr(data.error?.trim() || "Could not resume shift");
        return;
      }
      if (data.shift) {
        setShiftState({
          ...data.shift,
          status: "active",
          break_started_at: null,
        });
      }
      setShiftErr(null);
      void fetchActiveShift();
    } catch {
      setShiftState(prev);
      setShiftErr("Could not resume shift");
    } finally {
      setShiftBusy(false);
    }
  }

  async function handleEndShift() {
    if (shiftBusy) return;
    setShiftBusy(true);
    setShiftErr(null);
    const prev = activeShift;
    bumpLocalMutation();
    pendingStartIdRef.current = null;
    setShiftState(null);
    try {
      const res = await fetch("/api/va/task-shift/end", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setShiftState(prev);
        setShiftErr(data.error?.trim() || "Could not end shift");
        return;
      }
      setShiftErr(null);
    } catch {
      setShiftState(prev);
      setShiftErr("Could not end shift");
    } finally {
      setShiftBusy(false);
    }
  }

  if (!isViewingToday) return null;

  const onShift = !!activeShift;
  const paused = isShiftPaused(activeShift);

  if (onShift && paused) {
    return (
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-gradient-to-br from-[#12100E] via-[#1A1612] to-[#0A0A0A]">
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-3.5 md:px-6">
          {shiftErr ? (
            <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
              {shiftErr}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-amber-500/70 pl-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400/90" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/90">Paused</span>
              <span className="text-base tabular-nums tracking-tight text-white/55">{shiftDuration}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ShiftButton variant="resume" loading={shiftBusy} onClick={() => void handleResumeShift()} />
              <ShiftButton variant="end" loading={shiftBusy} onClick={() => void handleEndShift()} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (onShift) {
    return (
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-gradient-to-br from-[#0D0B0D] via-[#151315] to-[#0A0A0A]">
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-3.5 md:px-6">
          {shiftErr ? (
            <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
              {shiftErr}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-emerald-500/70 pl-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/90">On shift</span>
              <span className="text-base tabular-nums tracking-tight text-white/90">{shiftDuration}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ShiftButton
                variant="pause"
                loading={shiftBusy}
                disabled={isOptimisticShiftId(activeShift.id)}
                onClick={() => void handlePauseShift()}
              />
              <ShiftButton variant="end" loading={shiftBusy} onClick={() => void handleEndShift()} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 w-full border-b border-[rgba(255,255,255,0.06)] bg-gradient-to-br from-[#0D0B0D] via-[#151315] to-[#0A0A0A]">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-6 md:px-6">
        {shiftErr ? (
          <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
            {shiftErr}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D4AF8C] shadow-[0_0_8px_rgba(212,175,140,0.5)]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/80">Ready</span>
            </div>
            <h2 className="text-xl font-semibold text-white">Begin your shift</h2>
            <p className="mt-1 text-sm text-[#B8B4B8]/65">Clock in to unlock your task checklist</p>
          </div>
          <ShiftButton
            variant="start"
            size="lg"
            loading={shiftBusy}
            disabled={shiftLoading}
            onClick={() => void handleStartShift()}
          />
        </div>
      </div>
    </div>
  );
}

export function VaTasksClient({
  tasks: initialTasks,
  userName = "",
  initialActiveShift = null,
  canManage = false,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const isSupabase = useIsSupabaseBackend();
  const tasks = initialTasks;
  const [selected, setSelected] = React.useState<VaTaskRecord | null>(null);
  const [notes, setNotes] = React.useState("");
  const [statusPick, setStatusPick] = React.useState<VaTaskStatus>("done");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [completing, setCompleting] = React.useState<string | null>(null);

  const [scopeDialog, setScopeDialog] = React.useState<
    null | { mode: "edit" | "delete"; task: VaTaskRecord }
  >(null);
  const [taskPendingDelete, setTaskPendingDelete] = React.useState<VaTaskRecord | null>(null);
  const [deleteScope, setDeleteScope] = React.useState<RecurringOccurrenceScope | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [editModal, setEditModal] = React.useState<{
    task: VaTaskRecord;
    scope: RecurringOccurrenceScope | null;
  } | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editPriority, setEditPriority] = React.useState<VaTaskPriority>("normal");
  const [editSaving, setEditSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const todayYmd = getVaTasksViewTodayYmd();
  const [selectedYmd, setSelectedYmd] = React.useState(todayYmd);
  const isViewingToday = selectedYmd === todayYmd;

  useSupabaseRealtimeRefresh(
    ["va_tasks", "va_task_phases", "va_task_phase_items"],
    () => router.refresh(),
    { debounceMs: 700 },
  );

  const [deferredSearch, setDeferredSearch] = React.useState("");
  const handleDeferredSearchChange = React.useCallback((q: string) => setDeferredSearch(q), []);
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");
  const [showAllTasks, setShowAllTasks] = React.useState(false);

  const [onShift, setOnShift] = React.useState(
    () => !!initialActiveShift && !isShiftPaused(initialActiveShift),
  );
  const handleShiftChange = React.useCallback((next: boolean) => setOnShift(next), []);
  const [taskPhases, setTaskPhases] = React.useState<Record<string, TaskPhase[]>>({});
  const [modelAccounts, setModelAccounts] = React.useState<Record<string, SocialAccount[]>>({});
  const modelAccountsRef = React.useRef(modelAccounts);
  modelAccountsRef.current = modelAccounts;
  const getModelAccounts = React.useCallback(
    (modelId: string) => modelAccountsRef.current[modelId] ?? [],
    [],
  );
  const [completingItem, setCompletingItem] = React.useState<{ item: PhaseItem; taskId: string } | null>(null);
  const [proofFiles, setProofFiles] = React.useState<File[]>([]);
  const [proofError, setProofError] = React.useState<string | null>(null);
  const [screenshotUploading, setScreenshotUploading] = React.useState(false);
  const [observationsSavingId, setObservationsSavingId] = React.useState<string | null>(null);
  const phaseRollbackRef = React.useRef<Record<string, TaskPhase[]>>({});
  const inflightItemIdsRef = React.useRef(new Set<string>());

  const [shadowbanReportTarget, setShadowbanReportTarget] = React.useState<SocialAccount | null>(null);

  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const found = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!found) return;
      const f = found.getAsFile();
      if (!f) return;
      if (completingItem) setProofFiles((prev) => [...prev, f]);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [completingItem]);

  const dateFilteredTasks = React.useMemo(
    () => filterTasksByAthensYmd(tasks, selectedYmd),
    [tasks, selectedYmd],
  );

  const taskStats = React.useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let done = 0;
    let overdue = 0;
    for (const t of dateFilteredTasks) {
      if (t.status === "pending") pending++;
      else if (t.status === "in_progress") inProgress++;
      else if (t.status === "done") done++;
      if (isPastDue(t.due_date) && t.status !== "done" && t.status !== "skipped") overdue++;
    }
    return { pending, inProgress, done, overdue, total: dateFilteredTasks.length };
  }, [dateFilteredTasks]);

  const filteredTasks = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    let list = [...dateFilteredTasks];
    if (q) {
      list = list.filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(q));
    }
    if (filterStatus) list = list.filter((t) => t.status === filterStatus);
    if (filterPriority) list = list.filter((t) => t.priority === filterPriority);
    const dueMs = (t: VaTaskRecord) => (t.due_date ? new Date(t.due_date).getTime() : 0);
    const createdMs = (t: VaTaskRecord) => (t.created_at ? new Date(t.created_at).getTime() : 0);
    return list.sort((a, b) => {
      const da = dueMs(a);
      const db = dueMs(b);
      if (da && db && da !== db) return da - db;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return createdMs(b) - createdMs(a);
    });
  }, [dateFilteredTasks, deferredSearch, filterStatus, filterPriority]);

  const { regularTasks, recurringGroups } = React.useMemo(
    () => groupRecurringTasks(filteredTasks, DATE_VIEW_GROUP_OPTS),
    [filteredTasks],
  );

  React.useEffect(() => {
    setShowAllTasks(false);
  }, [selectedYmd, deferredSearch, filterStatus, filterPriority]);

  const visibleRegularTasks = React.useMemo(
    () => (showAllTasks ? regularTasks : regularTasks.slice(0, TASK_LIST_INITIAL_CAP)),
    [regularTasks, showAllTasks],
  );

  const [expandedVaRecurringHistory, setExpandedVaRecurringHistory] = React.useState(() => new Set<string>());

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    const res = await updateVaTaskStatusAction({
      taskId: selected.id,
      status: statusPick,
      completed_notes: notes,
    });
    setBusy(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setSelected(null);
    router.refresh();
  };

  const taskPhasesRef = React.useRef(taskPhases);
  taskPhasesRef.current = taskPhases;

  const optimisticallyCompleteItem = React.useCallback((taskId: string, itemId: string) => {
    setTaskPhases((prev) => {
      const phases = prev[taskId];
      if (!phases) return prev;
      phaseRollbackRef.current[taskId] = phases;
      return { ...prev, [taskId]: applyOptimisticItemCompletion(phases, itemId, userName) };
    });
  }, [userName]);

  const rollbackOptimisticItem = React.useCallback((taskId: string) => {
    const saved = phaseRollbackRef.current[taskId];
    if (saved) {
      setTaskPhases((prev) => ({ ...prev, [taskId]: saved }));
      delete phaseRollbackRef.current[taskId];
    }
  }, []);

  const clearOptimisticRollback = React.useCallback((taskId: string) => {
    delete phaseRollbackRef.current[taskId];
  }, []);

  const loadPhasesAndAccounts = React.useCallback(async (task: VaTaskRecord) => {
    if (taskPhasesRef.current[task.id]) return;
    const params = new URLSearchParams({ task_id: task.id });
    if (task.virtual_source_task_id?.trim()) {
      params.set("source_task_id", task.virtual_source_task_id.trim());
    }
    const res = await fetch(`/api/va/task-phases?${params}`, { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as { phases?: TaskPhase[] };
    const phases: TaskPhase[] = data.phases ?? [];

    const modelIds = [...new Set(phases.map((p) => p.assigned_model_id).filter(Boolean))] as string[];
    const accountsByModel: Record<string, SocialAccount[]> = {};
    await Promise.all(
      modelIds.map(async (modelId) => {
        const accRes = await fetch(`/api/va/marketing/accounts?model_id=${encodeURIComponent(modelId)}`, {
          credentials: "include",
        });
        const accData = (await accRes.json().catch(() => ({}))) as { accounts?: SocialAccount[] };
        if (accRes.ok) {
          accountsByModel[modelId] = accData.accounts ?? [];
        }
      }),
    );

    // Set phases + accounts together so the memoized card's first expand paint includes links.
    setModelAccounts((prev) => {
      const next = { ...prev };
      for (const [modelId, accs] of Object.entries(accountsByModel)) {
        if (!next[modelId]) next[modelId] = accs;
      }
      return next;
    });
    setTaskPhases((prev) => ({ ...prev, [task.id]: phases }));
  }, []);

  const submitPhaseItemCompletion = React.useCallback(
    async (item: PhaseItem, taskId: string, screenshots: File[] = []) => {
      if (taskId.startsWith("virt_")) return null;
      if (inflightItemIdsRef.current.has(item.id)) return null;
      inflightItemIdsRef.current.add(item.id);

      optimisticallyCompleteItem(taskId, item.id);

      try {
        const fd = new FormData();
        if (isSupabase && screenshots.length > 0) {
          for (const file of screenshots) {
            const { sbUrl } = await uploadScreenshotToSupabaseStorage(file, "va-phase-item", {
              itemId: item.id,
            });
            fd.append("screenshot_url", sbUrl);
          }
        } else {
          for (const file of screenshots) {
            fd.append("screenshots", file);
          }
        }
        const res = await postFormData(
          `/api/va/phase-items/${encodeURIComponent(item.id)}/complete`,
          fd,
          { credentials: "include" },
        );
        const payload = (await res.json().catch(() => ({}))) as {
          allPhasesCompleted?: boolean;
          error?: string;
        };
        if (!res.ok) {
          rollbackOptimisticItem(taskId);
          addToast(
            winnerVideoLocalToast(
              `va-item-err-${item.id}-${Date.now()}`,
              "Could not complete item",
              payload.error?.trim() || "Please try again.",
              "high",
            ),
          );
          return null;
        }
        clearOptimisticRollback(taskId);
        if (payload.allPhasesCompleted) router.refresh();
        return payload;
      } catch (err) {
        rollbackOptimisticItem(taskId);
        addToast(
          winnerVideoLocalToast(
            `va-item-err-${item.id}-${Date.now()}`,
            "Could not complete item",
            err instanceof Error ? err.message : "Network error — please try again.",
            "high",
          ),
        );
        return null;
      } finally {
        inflightItemIdsRef.current.delete(item.id);
      }
    },
    [addToast, clearOptimisticRollback, isSupabase, optimisticallyCompleteItem, rollbackOptimisticItem, router],
  );

  async function reloadModelAccounts(modelId: string) {
    const mId = modelId.trim();
    if (!mId) return;
    const accRes = await fetch(`/api/va/marketing/accounts?model_id=${encodeURIComponent(mId)}`, {
      credentials: "include",
    });
    const accData = (await accRes.json().catch(() => ({}))) as { accounts?: SocialAccount[] };
    if (accRes.ok) {
      setModelAccounts((prev) => ({ ...prev, [mId]: accData.accounts ?? [] }));
    }
  }

  const handleMarkComplete = React.useCallback(async (task: VaTaskRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (task.is_virtual_occurrence) {
      addToast(
        winnerVideoLocalToast(
          `vat-virt-done-${Date.now()}`,
          "Upcoming day",
          "This projected day isn’t a real task yet — complete it after it spawns for today, or ask a manager to edit the series.",
          "normal",
        ),
      );
      return;
    }
    setCompleting(task.id);
    try {
      const res = await updateVaTaskStatusAction({
        taskId: task.id,
        status: "done",
        completed_notes: "",
      });
      if (!res.success) {
        setErr(res.error);
        return;
      }
      setSelected((prev) => (prev?.id === task.id ? null : prev));
      router.refresh();
    } finally {
      setCompleting(null);
    }
  }, [addToast, router]);

  const handleOpenTask = React.useCallback((t: VaTaskRecord) => {
    if (t.is_virtual_occurrence) {
      addToast(
        winnerVideoLocalToast(
          `vat-virt-open-${Date.now()}`,
          "Upcoming day",
          "Checklist items unlock when this day’s real task is spawned.",
          "normal",
        ),
      );
      return;
    }
    setSelected(t);
    setNotes(t.completed_notes ?? "");
    setStatusPick(t.status === "in_progress" ? "in_progress" : "done");
    setErr(null);
  }, [addToast]);

  const openEditForm = React.useCallback((task: VaTaskRecord, scope: RecurringOccurrenceScope | null) => {
    setEditModal({ task, scope });
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditPriority(task.priority);
    setEditError(null);
  }, []);

  const handleEditRequest = React.useCallback(
    (task: VaTaskRecord) => {
      if (task.is_recurring || task.is_virtual_occurrence) {
        setScopeDialog({ mode: "edit", task });
        return;
      }
      openEditForm(task, null);
    },
    [openEditForm],
  );

  const handleDeleteRequest = React.useCallback((task: VaTaskRecord) => {
    if (task.is_recurring || task.is_virtual_occurrence) {
      setScopeDialog({ mode: "delete", task });
      return;
    }
    setDeleteScope(null);
    setTaskPendingDelete(task);
  }, []);

  const handleScopeChosen = React.useCallback(
    (scope: RecurringOccurrenceScope) => {
      const dlg = scopeDialog;
      setScopeDialog(null);
      if (!dlg) return;
      if (dlg.mode === "edit") {
        openEditForm(dlg.task, scope);
        return;
      }
      setDeleteScope(scope);
      setTaskPendingDelete(dlg.task);
    },
    [scopeDialog, openEditForm],
  );

  const confirmDeleteTask = React.useCallback(async () => {
    if (!taskPendingDelete) return;
    setConfirmingDelete(true);
    try {
      const isRecurring = Boolean(
        taskPendingDelete.is_recurring || taskPendingDelete.is_virtual_occurrence || deleteScope,
      );
      const res = await fetch(`/api/va-tasks/${encodeURIComponent(taskPendingDelete.id)}`, {
        method: "DELETE",
        headers: isRecurring ? { "Content-Type": "application/json" } : undefined,
        body: isRecurring
          ? JSON.stringify({
              scope: deleteScope ?? "this_only",
              taskPayload: taskPendingDelete,
            })
          : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(
            `vat-del-err-${Date.now()}`,
            "Could not delete",
            data.error ?? "Delete failed.",
            "high",
          ),
        );
        return;
      }
      setTaskPendingDelete(null);
      setDeleteScope(null);
      addToast(winnerVideoLocalToast(`vat-del-ok-${Date.now()}`, "Task deleted", "Removed.", "normal"));
      router.refresh();
    } catch {
      addToast(winnerVideoLocalToast(`vat-del-err-${Date.now()}`, "Could not delete", "Network error.", "high"));
    } finally {
      setConfirmingDelete(false);
    }
  }, [taskPendingDelete, deleteScope, addToast, router]);

  const saveEditModal = React.useCallback(async () => {
    if (!editModal || !editTitle.trim()) return;
    setEditSaving(true);
    setEditError(null);
    const payload = {
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority,
    };
    try {
      if (editModal.scope) {
        const res = await updateRecurringVaTaskAction({
          taskId: editModal.task.id,
          scope: editModal.scope,
          data: payload,
          taskPayload: editModal.task,
        });
        if (!res.success) {
          setEditError(res.error);
          return;
        }
      } else {
        const res = await updateVaTaskAction(editModal.task.id, payload);
        if (!res.success) {
          setEditError(res.error);
          return;
        }
      }
      setEditModal(null);
      router.refresh();
    } finally {
      setEditSaving(false);
    }
  }, [editModal, editTitle, editDescription, editPriority, router]);

  const handleCompleteItemClick = React.useCallback(
    (item: PhaseItem, taskId: string) => {
      if (taskId.startsWith("virt_")) return;
      if (item.requires_screenshot) {
        setCompletingItem({ item, taskId });
        setProofFiles([]);
        setProofError(null);
        return;
      }
      void submitPhaseItemCompletion(item, taskId);
    },
    [submitPhaseItemCompletion],
  );

  const handleProofFilesChange = React.useCallback((files: File[]) => {
    for (const file of files) {
      const err = vaTaskScreenshotFileError(file);
      if (err) {
        setProofError(err);
        setProofFiles(files.filter((f) => !vaTaskScreenshotFileError(f)));
        return;
      }
    }
    setProofError(null);
    setProofFiles(files);
  }, []);

  const handleSubmitScreenshotProof = React.useCallback(async () => {
    if (!completingItem || proofFiles.length === 0 || screenshotUploading) return;
    for (const file of proofFiles) {
      const err = vaTaskScreenshotFileError(file);
      if (err) {
        setProofError(err);
        return;
      }
    }
    const { item, taskId } = completingItem;
    setScreenshotUploading(true);
    setProofError(null);
    try {
      const result = await submitPhaseItemCompletion(item, taskId, proofFiles);
      if (result) {
        setCompletingItem(null);
        setProofFiles([]);
        setProofError(null);
      }
    } finally {
      setScreenshotUploading(false);
    }
  }, [completingItem, proofFiles, screenshotUploading, submitPhaseItemCompletion]);

  const handleSaveObservations = React.useCallback(
    async (taskId: string, notes: string) => {
      setObservationsSavingId(taskId);
      try {
        const res = await fetch(`/api/va/tasks/${encodeURIComponent(taskId)}/notes`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed_notes: notes }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          addToast(
            winnerVideoLocalToast(
              `va-notes-err-${taskId}-${Date.now()}`,
              "Could not save observations",
              data.error?.trim() || "Please try again.",
              "high",
            ),
          );
          return false;
        }
        return true;
      } catch {
        addToast(
          winnerVideoLocalToast(
            `va-notes-err-${taskId}-${Date.now()}`,
            "Could not save observations",
            "Network error — please try again.",
            "high",
          ),
        );
        return false;
      } finally {
        setObservationsSavingId(null);
      }
    },
    [addToast],
  );

  const handleShadowbanReport = React.useCallback((acc: SocialAccount) => {
    setShadowbanReportTarget(acc);
  }, []);

  return (
    <div className="min-h-screen">
      <VaShiftBar
        isViewingToday={isViewingToday}
        onShiftChange={handleShiftChange}
        initialActiveShift={initialActiveShift}
      />

      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 md:px-6">
        {/* ── Page header ── */}
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-white">
            My tasks
          </h1>
          <TaskDateNavigator value={selectedYmd} onChange={setSelectedYmd} className="mt-4" />
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                { key: "", label: "All", count: taskStats.total },
                { key: "pending", label: "Pending", count: taskStats.pending },
                { key: "in_progress", label: "In progress", count: taskStats.inProgress },
                { key: "done", label: "Done", count: taskStats.done },
              ] as const
            ).map((pill) => (
              <button
                key={pill.key || "all"}
                type="button"
                onClick={() => setFilterStatus(pill.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition duration-200 motion-reduce:transition-none",
                  filterStatus === pill.key
                    ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/10 text-[#D4AF8C]"
                    : "border-[rgba(255,255,255,0.08)] bg-[#151315] text-[#B8B4B8]/75 hover:border-[#D4AF8C]/25",
                )}
              >
                <span>{pill.label}</span>
                <span className="rounded-full border border-[#D4AF8C]/30 bg-[#D4AF8C]/12 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#D4AF8C]">
                  {pill.count}
                </span>
              </button>
            ))}
            {taskStats.overdue > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/8 px-3.5 py-1.5 text-sm text-red-300">
                Overdue
                <span className="rounded-full border border-red-500/30 bg-red-500/12 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                  {taskStats.overdue}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <VaTasksSearchBar
          onDeferredSearchChange={handleDeferredSearchChange}
          filterPriority={filterPriority}
          onFilterPriorityChange={setFilterPriority}
        />

        {/* ── Tasks (readable off-shift; action buttons gated individually) ── */}
        <div className="space-y-4">
          {err && !selected ? (
            <div
              className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
              role="alert"
            >
              {err}
            </div>
          ) : null}

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <svg className="mb-6 h-20 w-20 text-[#D4AF8C]/35" viewBox="0 0 64 64" fill="none" aria-hidden>
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
                <path d="M20 34l8 8 16-18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-xl font-semibold text-white">
                Your slate is clear
              </p>
              <p className="mt-2 max-w-sm text-sm text-[#B8B4B8]/55">
                No assignments yet — enjoy the quiet moment, or check back soon.
              </p>
            </div>
          ) : dateFilteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <svg className="mb-5 h-14 w-14 text-[#D4AF8C]/30" viewBox="0 0 64 64" fill="none" aria-hidden>
                <rect x="14" y="12" width="36" height="44" rx="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M22 24h20M22 32h14M22 40h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-base font-semibold text-[#B8B4B8]/80">No tasks for this date</p>
              <p className="mt-1 text-sm text-[#B8B4B8]/45">Try another day or jump back to today.</p>
            </div>
          ) : regularTasks.length === 0 && recurringGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <svg className="mb-5 h-14 w-14 text-[#D4AF8C]/30" viewBox="0 0 64 64" fill="none" aria-hidden>
                <rect x="14" y="12" width="36" height="44" rx="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M22 24h20M22 32h14M22 40h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-base font-semibold text-[#B8B4B8]/80">
                Nothing matches
              </p>
              <p className="mt-1 text-sm text-[#B8B4B8]/45">Try a different filter or search term.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleRegularTasks.map((task) => (
                <VaTaskCard
                  key={task.id}
                  task={task}
                  userName={userName}
                  onShift={onShift}
                  isCompleting={completing === task.id}
                  phases={taskPhases[task.id] ?? EMPTY_TASK_PHASES}
                  getModelAccounts={getModelAccounts}
                  modelAccountsKey={modelAccountsKeyForPhases(
                    taskPhases[task.id] ?? EMPTY_TASK_PHASES,
                    modelAccounts,
                  )}
                  onLoadPhases={loadPhasesAndAccounts}
                  onMarkComplete={handleMarkComplete}
                  onOpenTask={handleOpenTask}
                  onCompleteItem={handleCompleteItemClick}
                  onShadowbanReport={handleShadowbanReport}
                  onSaveObservations={handleSaveObservations}
                  observationsSaving={observationsSavingId === task.id}
                  canManage={canManage}
                  onEdit={canManage ? handleEditRequest : undefined}
                  onDelete={canManage ? handleDeleteRequest : undefined}
                />
              ))}
              {!showAllTasks && regularTasks.length > TASK_LIST_INITIAL_CAP ? (
                <button
                  type="button"
                  onClick={() => setShowAllTasks(true)}
                  className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151315] px-4 py-3 text-sm font-medium text-[#D4AF8C]/80 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
                >
                  Show all {regularTasks.length} tasks ({regularTasks.length - TASK_LIST_INITIAL_CAP} more)
                </button>
              ) : null}
              {recurringGroups.map((group) => (
                <div key={group.seriesKey}>
                  {group.currentTask ? (
                    <VaTaskCard
                      key={group.currentTask.id}
                      task={group.currentTask}
                      userName={userName}
                      onShift={onShift}
                      isCompleting={completing === group.currentTask.id}
                      phases={taskPhases[group.currentTask.id] ?? EMPTY_TASK_PHASES}
                      getModelAccounts={getModelAccounts}
                      modelAccountsKey={modelAccountsKeyForPhases(
                        taskPhases[group.currentTask.id] ?? EMPTY_TASK_PHASES,
                        modelAccounts,
                      )}
                      onLoadPhases={loadPhasesAndAccounts}
                      onMarkComplete={handleMarkComplete}
                      onOpenTask={handleOpenTask}
                      onCompleteItem={handleCompleteItemClick}
                      onShadowbanReport={handleShadowbanReport}
                      onSaveObservations={handleSaveObservations}
                      observationsSaving={observationsSavingId === group.currentTask.id}
                      canManage={canManage}
                      onEdit={canManage ? handleEditRequest : undefined}
                      onDelete={canManage ? handleDeleteRequest : undefined}
                    />
                  ) : (
                    <div className="rounded-2xl border border-[#D4AF8C]/15 bg-[#151315] px-4 py-3">
                      <p className="text-sm font-medium text-[#B8B4B8]/60">{group.title}</p>
                      <p className="text-xs text-[#B8B4B8]/35">
                        Next occurrence pending… · {group.totalCompleted} done
                      </p>
                    </div>
                  )}
                  {group.history.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedVaRecurringHistory((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.seriesKey)) next.delete(group.seriesKey);
                          else next.add(group.seriesKey);
                          return next;
                        });
                      }}
                      className="ml-2 mt-1 text-xs text-white/25 hover:text-white/50"
                    >
                      {expandedVaRecurringHistory.has(group.seriesKey) ? "Hide" : "Show"} history ({group.totalCompleted})
                    </button>
                  ) : null}
                  {expandedVaRecurringHistory.has(group.seriesKey) ? (
                    <div className="ml-3 mt-2 space-y-1 border-l border-purple-500/20 pl-3">
                      {group.history.map((histTask) => (
                        <div key={histTask.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 opacity-50">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="truncate text-sm text-white/40 line-through">{histTask.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Details & notes modal ── */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={cn(VA_CARD, "relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-y-auto overscroll-contain shadow-2xl")}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white">{selected.title}</h3>
                {selected.description ? (
                  <p className="mt-1 text-sm text-[#B8B4B8]/70">{selected.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/70 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {err ? (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {err}
                </div>
              ) : null}
              <motion.div {...fieldMotion}>
                <FormField label="Status" icon={<ListChecks />} htmlFor="va-task-status" staggerIndex={0}>
                  <FormSelect
                    id="va-task-status"
                    value={statusPick}
                    onChange={(e) => setStatusPick(e.target.value as VaTaskStatus)}
                  >
                    <option value="in_progress" className={selectOptionClass}>In progress</option>
                    <option value="done" className={selectOptionClass}>Done</option>
                    <option value="skipped" className={selectOptionClass}>Skipped</option>
                    <option value="pending" className={selectOptionClass}>Pending</option>
                  </FormSelect>
                </FormField>
              </motion.div>
              <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.05 }}>
                <FormField
                  label="Completion notes"
                  icon={<StickyNote />}
                  htmlFor="va-task-notes"
                  description="Optional — visible to admins."
                  staggerIndex={1}
                >
                  <FormTextarea
                    id="va-task-notes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What did you complete?"
                  />
                </FormField>
              </motion.div>
              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className={cn(VA_BTN_SECONDARY, "bg-white/5 text-white/85 hover:bg-white/10 border-white/15")}
                >
                  Cancel
                </button>
                <FormSubmitButton disabled={busy} loading={busy} className="sm:min-w-[140px]">
                  Save update
                </FormSubmitButton>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}

      {/* ── Shadowban report modal (shared component) ── */}
      <VAShadowbanReportModal
        open={!!shadowbanReportTarget}
        presetAccount={shadowbanReportTarget}
        vaAccounts={[]}
        onClose={() => {
          const mId = shadowbanReportTarget?.model_id;
          setShadowbanReportTarget(null);
          if (mId) void reloadModelAccounts(mId);
        }}
      />

      {/* ── Screenshot upload modal ── */}
      {completingItem ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={cn(VA_CARD, "max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain p-6 shadow-2xl")}>
            <h3 className="text-lg font-semibold text-white">Screenshot proof</h3>
            <p className="mt-1 text-sm text-[#B8B4B8]/65">{completingItem.item.title || "Checklist item"}</p>
            {isEngagementScreenshotItem(completingItem.item) ? (
              <p className="mt-2 text-xs text-[#D4AF8C]/75">
                Upload 3–5 screenshots showing your engagement work.
              </p>
            ) : null}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D4AF8C]">
                  Paste or upload images
                </p>
                {isEngagementScreenshotItem(completingItem.item) ? (
                  <span className="text-[10px] font-semibold tabular-nums text-[#D4AF8C]/80">
                    {proofFiles.length}/{ENGAGEMENT_SCREENSHOT_TARGET} uploaded
                  </span>
                ) : proofFiles.length > 0 ? (
                  <span className="text-[10px] font-semibold tabular-nums text-[#D4AF8C]/80">
                    {proofFiles.length} uploaded
                  </span>
                ) : null}
              </div>
              <ManagerReviewFileDropzone
                files={proofFiles}
                onChange={handleProofFilesChange}
                accept="image/*"
                multiple
              />
              <p className="text-xs text-[#B8B4B8]/45">
                Tip: Ctrl+V to paste from clipboard · max {VA_TASK_SCREENSHOT_MAX_MB}MB per image
              </p>
              {proofError ? <p className="text-sm text-red-400">{proofError}</p> : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={screenshotUploading}
                onClick={() => {
                  setCompletingItem(null);
                  setProofFiles([]);
                  setProofError(null);
                  setScreenshotUploading(false);
                }}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={screenshotUploading || proofFiles.length === 0}
                onClick={() => void handleSubmitScreenshotProof()}
                className={cn(
                  VA_BTN_SECONDARY,
                  "border-[#D4AF8C]/35 px-5 py-3 text-sm text-[#D4AF8C] disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                {screenshotUploading ? "Saving…" : "Complete item"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canManage ? (
        <>
          <RecurringOccurrenceScopeDialog
            open={scopeDialog != null}
            mode={scopeDialog?.mode ?? "edit"}
            taskTitle={scopeDialog?.task.title}
            onClose={() => setScopeDialog(null)}
            onChoose={handleScopeChosen}
          />
          <ConfirmDeleteModal
            open={taskPendingDelete != null}
            title="Delete task?"
            description={
              taskPendingDelete ? (
                <>
                  Delete <span className="font-medium text-white">{taskPendingDelete.title}</span>
                  {deleteScope === "this_only"
                    ? " for this date only"
                    : deleteScope === "this_and_future"
                      ? " from this date forward"
                      : ""}
                  ?
                </>
              ) : null
            }
            onClose={() => {
              if (!confirmingDelete) {
                setTaskPendingDelete(null);
                setDeleteScope(null);
              }
            }}
            onConfirm={confirmDeleteTask}
            confirming={confirmingDelete}
          />
          {editModal ? (
            <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center">
              <button
                type="button"
                className="absolute inset-0"
                aria-label="Close"
                onClick={() => !editSaving && setEditModal(null)}
              />
              <div className={cn(VA_CARD, "relative z-10 w-full max-w-md p-5 shadow-2xl")}>
                <h2 className="text-lg font-semibold text-white">Edit task</h2>
                {editModal.scope ? (
                  <p className="mt-1 text-xs text-white/50">
                    {editModal.scope === "this_only"
                      ? "This occurrence only"
                      : "This and all future occurrences"}
                  </p>
                ) : null}
                <div className="mt-4 space-y-3">
                  <label className="block text-sm text-white/70">
                    Title
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500/40"
                    />
                  </label>
                  <label className="block text-sm text-white/70">
                    Description
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500/40"
                    />
                  </label>
                  <label className="block text-sm text-white/70">
                    Priority
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as VaTaskPriority)}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500/40"
                    >
                      <option value="low" className={selectOptionClass}>
                        Low
                      </option>
                      <option value="normal" className={selectOptionClass}>
                        Normal
                      </option>
                      <option value="high" className={selectOptionClass}>
                        High
                      </option>
                      <option value="urgent" className={selectOptionClass}>
                        Urgent
                      </option>
                    </select>
                  </label>
                  {editError ? <p className="text-sm text-red-300">{editError}</p> : null}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={editSaving}
                    onClick={() => setEditModal(null)}
                    className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-sm")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={editSaving || !editTitle.trim()}
                    onClick={() => void saveEditModal()}
                    className="rounded-xl bg-[#FF1493] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45"
                  >
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
