"use client";

import * as React from "react";
import { Bell, Check, ClipboardList, Clock, Pencil, Plus, Search, Trash2, Users, X, ImageIcon, Camera, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDateEuropean, formatDateTimeAthens } from "@/lib/format";
import { createVaTaskAction, updateVaTaskAction } from "@/app/actions/va-tasks";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification, ModelRecord, VaTaskRecord, VaTaskStatus, VaTaskPriority, VaRecurrenceType, VaRecurrenceDay } from "@/types";
import type { PhaseItem, TaskPhase } from "@/services/task-phases";
import type { TaskTemplateRecord } from "@/services/task-templates";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import { DEFAULT_TASK_STEP_TYPE, TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";
import { filterTasksByAthensYmd, getVaTasksViewTodayYmd, groupVaTasksForDateView } from "@/lib/va-task-date-filter";
import { VA_CARD, VA_FILTER_INPUT, VA_MODEL_TAG, VA_STATUS_BADGE, VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_CHAMPAGNE_DIVIDER } from "@/lib/va-tasks-tokens";
import { TaskDateNavigator } from "@/components/task-date-navigator";
import { TaskPhaseRibbon } from "@/components/task-phase-ribbon";
import { AdminVaTasksFilters } from "@/components/admin-va-tasks-filters";
import { AdminVaTaskCard } from "@/components/admin-va-task-card";
import {
  AdminVaTasksProgressOverview,
  AdminVaTasksViewToggle,
} from "@/components/admin-va-tasks-progress-overview";
import { EMPTY_TASK_PHASES } from "@/components/va-task-card";
import {
  StaffAssigneePicker,
  staffDisplayName,
  type StaffUserOption,
} from "@/components/staff-assignee-picker";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

const STATUSES: VaTaskStatus[] = ["pending", "in_progress", "done", "skipped"];
const PRIORITIES: VaTaskPriority[] = ["low", "normal", "high", "urgent"];
const RECURRENCE_TYPES: VaRecurrenceType[] = ["daily", "weekly", "monthly"];
const WEEKDAYS: VaRecurrenceDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const REMINDER_CHIPS = [15, 30, 60, 120, 1440] as const;

type VaUserOption = { id: string; full_name: string; email: string };

type EditPhasesSnapshot = { phaseIds: string[]; itemsByPhaseId: Record<string, string[]> };

interface DraftPhaseItem {
  tempId: string;
  serverId?: string;
  title: string;
  requires_screenshot: boolean;
  step_type: TaskStepType;
}

interface DraftPhase {
  tempId: string;
  serverId?: string;
  title: string;
  region: TaskPhase["region"];
  /** Optional deadline (datetime-local string). Blank = phase not eligible for overdue check (A4). */
  scheduled_time: string;
  items: DraftPhaseItem[];
}

type Props = {
  tasks: VaTaskRecord[];
  vaUsers: VaUserOption[];
  staffUsers: StaffUserOption[];
  roleLabels: Record<string, string>;
  modelss: ModelRecord[];
  canManage?: boolean;
  canViewList?: boolean;
  canViewProgress?: boolean;
};

function toLocalYmd(isoLike: string | null): string {
  if (!isoLike?.trim()) return "";
  const d = new Date(isoLike.trim());
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDatetimeLocalValue(isoLike: string | null | undefined): string {
  if (!isoLike?.trim()) return "";
  const d = new Date(isoLike.trim());
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromDatetimeLocal(s: string): string | undefined {
  if (!s?.trim()) return undefined;
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toISOString();
}

/** Default due date/time for new tasks — local "now", so List view (Athens day filter) shows them today. */
function defaultDueDatetimeLocal(): string {
  return toDatetimeLocalValue(new Date().toISOString());
}

function isPastDue(isoLike: string | null | undefined): boolean {
  if (!isoLike?.trim()) return false;
  const t = new Date(isoLike.trim()).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

function formatReminderLabel(minutes: number | null): string {
  if (minutes == null) return "";
  if (minutes === 1440) return "1 day before";
  if (minutes === 120) return "2h before";
  if (minutes === 60) return "1h before";
  return `${minutes}m before`;
}

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon ? <span className="text-base">{icon}</span> : null}
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">{label}</p>
      <div className={cn(VA_CHAMPAGNE_DIVIDER, "flex-1")} />
    </div>
  );
}

const ADMIN_MODAL_INPUT =
  "w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#151315] px-4 py-3 text-sm text-[#B8B4B8] placeholder:text-[#B8B4B8]/30 outline-none transition focus:border-[#FF1493]/45 focus:ring-1 focus:ring-[#FF1493]/15";

const TASK_LIST_INITIAL_CAP = 40;

function Divider() {
  return <div className={cn(VA_CHAMPAGNE_DIVIDER, "h-px")} />;
}

function ModalToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="shrink-0 cursor-pointer"
    >
      <span className={`relative block h-6 w-11 rounded-full transition-all ${value ? "bg-[#FF1493]" : "bg-white/15"}`}>
        <span
          className={`absolute top-1 block h-4 w-4 rounded-full bg-white shadow-sm transition-all ${value ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  );
}

function phaseToDraft(p: TaskPhase): DraftPhase {
  return {
    tempId: p.id,
    serverId: p.id,
    title: p.title,
    region: p.region ?? "Global",
    scheduled_time: toDatetimeLocalValue(p.scheduled_time),
    items: (p.items ?? []).map((i) => ({
      tempId: i.id,
      serverId: i.id,
      title: i.title,
      requires_screenshot: i.requires_screenshot,
      step_type: i.step_type ?? DEFAULT_TASK_STEP_TYPE,
    })),
  };
}

function ModelMultiSelect({
  models,
  selectedIds,
  onChange,
}: {
  models: ModelRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.model_name.toLowerCase().includes(q));
  }, [models, query]);

  const selected = models.filter((m) => selectedIds.includes(m.id));

  return (
    <div className="space-y-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 py-1 pl-1 pr-2 text-xs text-rose-200"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[10px] font-semibold text-rose-300">
                {(m.model_name || "?").trim().slice(0, 1).toUpperCase() || "?"}
              </span>
              <span className="max-w-[140px] truncate">{m.model_name}</span>
              <button
                type="button"
                aria-label={`Remove ${m.model_name}`}
                onClick={() => onChange(selectedIds.filter((id) => id !== m.id))}
                className="rounded-full p-0.5 text-rose-300/60 hover:bg-rose-500/20 hover:text-rose-100"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models…"
          className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
        />
      </div>
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-white/45">No models match your search.</p>
        ) : (
          filtered.map((m) => {
            const checked = selectedIds.includes(m.id);
            return (
              <label
                key={m.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition hover:bg-white/5",
                  checked && "bg-rose-500/10",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const set = new Set(selectedIds);
                    if (set.has(m.id)) set.delete(m.id);
                    else set.add(m.id);
                    onChange([...set]);
                  }}
                  className="h-4 w-4 rounded border-white/25"
                />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-[10px] font-semibold text-rose-300">
                  {(m.model_name || "?").trim().slice(0, 1).toUpperCase() || "?"}
                </span>
                <span className="truncate text-white/80">{m.model_name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AdminVaTasksClient({
  tasks,
  vaUsers,
  staffUsers,
  roleLabels,
  modelss,
  canManage = false,
  canViewList = false,
  canViewProgress = false,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const canShowList = canManage || canViewList;
  const defaultViewMode = canShowList ? "list" : "progress";
  const [localTasks, setLocalTasks] = React.useState(tasks);
  const [taskPendingDelete, setTaskPendingDelete] = React.useState<VaTaskRecord | null>(null);
  const [confirmingTaskDelete, setConfirmingTaskDelete] = React.useState(false);
  const [reminding, setReminding] = React.useState<string | null>(null);
  const [remindSuccess, setRemindSuccess] = React.useState<string | null>(null);
  const [taskPhases, setTaskPhases] = React.useState<Record<string, TaskPhase[]>>({});
  const taskPhasesRef = React.useRef(taskPhases);
  taskPhasesRef.current = taskPhases;

  React.useEffect(() => setLocalTasks(tasks), [tasks]);

  const nameById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of staffUsers) {
      m[u.id] = staffDisplayName(u);
    }
    return m;
  }, [staffUsers]);

  const vaOptionsForFilter = React.useMemo(
    () => [{ value: "", label: "All VAs" }, ...vaUsers.map((u) => ({ value: u.id, label: (u.full_name || u.email).trim() || u.id }))],
    [vaUsers]
  );

  const [deferredSearch, setDeferredSearch] = React.useState("");
  const handleDeferredSearchChange = React.useCallback((q: string) => setDeferredSearch(q), []);
  const [filterVa, setFilterVa] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");
  const todayYmd = getVaTasksViewTodayYmd();
  const [selectedYmd, setSelectedYmd] = React.useState(todayYmd);
  const [showAllTasks, setShowAllTasks] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"list" | "progress">(defaultViewMode);
  const [progressPhasesLoading, setProgressPhasesLoading] = React.useState(false);
  const [progressPhasesError, setProgressPhasesError] = React.useState<string | null>(null);
  const [isTabVisible, setIsTabVisible] = React.useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );

  React.useEffect(() => {
    if (!canShowList && canViewProgress) {
      setViewMode("progress");
    }
  }, [canShowList, canViewProgress]);

  const dateFilteredTasks = React.useMemo(
    () => filterTasksByAthensYmd(localTasks, selectedYmd),
    [localTasks, selectedYmd],
  );

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assignAll, setAssignAll] = React.useState(false);
  const [assignedTo, setAssignedTo] = React.useState<string[]>([]);
  const [assignedModels, setAssignedModels] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<VaTaskStatus>("pending");
  const [priority, setPriority] = React.useState<VaTaskPriority>("normal");
  const [dueLocal, setDueLocal] = React.useState("");
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [recurrenceType, setRecurrenceType] = React.useState<VaRecurrenceType | "">("");
  const [recurrenceInterval, setRecurrenceInterval] = React.useState(1);
  const [recurrenceDays, setRecurrenceDays] = React.useState<VaRecurrenceDay[]>([]);
  const [recurrenceEnd, setRecurrenceEnd] = React.useState("");
  const [hasRecurrenceEnd, setHasRecurrenceEnd] = React.useState(false);
  const [reminderMinutes, setReminderMinutes] = React.useState<number | null>(null);
  const [draftPhases, setDraftPhases] = React.useState<DraftPhase[]>([]);
  const editPhasesSnapshotRef = React.useRef<EditPhasesSnapshot | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createMode, setCreateMode] = React.useState<"scratch" | "template">("scratch");
  const [templateOptions, setTemplateOptions] = React.useState<TaskTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [templateRegion, setTemplateRegion] = React.useState<TaskPhase["region"]>("Global");

  function resetTaskModal() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setAssignAll(false);
    setAssignedTo([]);
    setAssignedModels([]);
    setStatus("pending");
    setPriority("normal");
    setDueLocal("");
    setIsRecurring(false);
    setRecurrenceType("");
    setRecurrenceInterval(1);
    setRecurrenceDays([]);
    setRecurrenceEnd("");
    setHasRecurrenceEnd(false);
    setReminderMinutes(null);
    setDraftPhases([]);
    editPhasesSnapshotRef.current = null;
    setError(null);
    setCreateMode("scratch");
    setSelectedTemplateId("");
    setTemplateRegion("Global");
  }

  async function loadTemplateOptions() {
    try {
      const res = await fetch("/api/admin/task-templates", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { templates?: TaskTemplateRecord[] };
      if (res.ok) {
        setTemplateOptions((data.templates ?? []).filter((t) => t.is_active));
      }
    } catch {
      setTemplateOptions([]);
    }
  }

  const openCreate = () => {
    resetTaskModal();
    // New tasks must land on today's List view — blank due_date is filtered out by Athens date nav.
    setDueLocal(defaultDueDatetimeLocal());
    void loadTemplateOptions();
    setModalOpen(true);
  };

  const openEdit = React.useCallback(async (t: VaTaskRecord) => {
    if (t.is_virtual_occurrence) {
      addToast(
        localToast(
          `vat-edit-virt-${Date.now()}`,
          "Projected day",
          "Edit the recurring series from a real (spawned) occurrence — this date is preview-only until that day is created.",
          "normal",
        ),
      );
      return;
    }
    setEditingId(t.id);
    setTitle(t.title);
    setDescription(t.description);
    setAssignAll(t.assigned_to_ids.length === 0);
    setAssignedTo([...t.assigned_to_ids]);
    setAssignedModels([...(t.assigned_model_ids ?? [])]);
    setStatus(t.status);
    setPriority(t.priority);
    setDueLocal(t.due_date ? toDatetimeLocalValue(t.due_date) : "");
    setIsRecurring(t.is_recurring);
    setRecurrenceType(t.recurrence_type);
    setRecurrenceDays([...t.recurrence_days]);
    setRecurrenceInterval(t.recurrence_interval != null && Number.isFinite(t.recurrence_interval) ? t.recurrence_interval : 1);
    const endYmd = t.recurrence_end_date ? toLocalYmd(t.recurrence_end_date) : "";
    setRecurrenceEnd(endYmd);
    setHasRecurrenceEnd(Boolean(endYmd));
    setReminderMinutes(t.reminder_minutes_before != null && Number.isFinite(t.reminder_minutes_before) ? t.reminder_minutes_before : null);
    setDraftPhases([]);
    editPhasesSnapshotRef.current = null;
    setError(null);
    setModalOpen(true);
    try {
      const res = await fetch(`/api/admin/task-phases?task_id=${encodeURIComponent(t.id)}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { phases?: TaskPhase[] };
      const phases = data.phases ?? [];
      editPhasesSnapshotRef.current = {
        phaseIds: phases.map((p) => p.id),
        itemsByPhaseId: Object.fromEntries(phases.map((p) => [p.id, (p.items ?? []).map((i) => i.id)])),
      };
      setDraftPhases(phases.map(phaseToDraft));
    } catch {
      editPhasesSnapshotRef.current = { phaseIds: [], itemsByPhaseId: {} };
    }
  }, [addToast]);

  const filteredTasks = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return dateFilteredTasks.filter((t) => {
      if (q) {
        const blob = `${t.title} ${t.description}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterVa) {
        if (t.assigned_to_ids.length === 0) return true;
        if (!t.assigned_to_ids.includes(filterVa)) return false;
      }
      return true;
    });
  }, [dateFilteredTasks, deferredSearch, filterVa, filterStatus, filterPriority]);

  const listViewGrouped = React.useMemo(
    () => groupVaTasksForDateView(filteredTasks),
    [filteredTasks],
  );

  const { regularTasks, recurringGroups, flattenedTasks: progressViewTasks } = listViewGrouped;

  const dateGrouped = React.useMemo(
    () => groupVaTasksForDateView(dateFilteredTasks),
    [dateFilteredTasks],
  );

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
      const params = new URLSearchParams({
        task_ids: tasks.map((task) => task.id).join(","),
      });
      const sourceTaskIds = tasks.map((task) => task.virtual_source_task_id?.trim() ?? "");
      if (sourceTaskIds.some((id) => id.length > 0)) {
        params.set("source_task_ids", sourceTaskIds.join(","));
      }
      const res = await fetch(`/api/admin/task-phases?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json().catch(() => ({}))) as {
        phases_by_task?: Record<string, TaskPhase[]>;
      };
      const phasesByTask = data.phases_by_task ?? {};
      setTaskPhases((prev) => {
        const next = { ...prev };
        for (const task of tasks) next[task.id] = phasesByTask[task.id] ?? [];
        return next;
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
    const id = window.setInterval(() => {
      void loadProgressPhases();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [viewMode, canViewProgress, isTabVisible, loadProgressPhases]);

  React.useEffect(() => {
    setShowAllTasks(false);
  }, [selectedYmd, deferredSearch, filterVa, filterStatus, filterPriority]);

  const visibleRegularTasks = React.useMemo(
    () => (showAllTasks ? regularTasks : regularTasks.slice(0, TASK_LIST_INITIAL_CAP)),
    [regularTasks, showAllTasks],
  );

  const taskStats = React.useMemo(() => {
    const { regularTasks: dateRegular, recurringGroups: dateRecurring } = dateGrouped;
    const dateStatsSource = [
      ...dateRegular,
      ...(dateRecurring.map((g) => g.currentTask).filter(Boolean) as VaTaskRecord[]),
    ];
    const doneFromRecurring = dateRecurring.reduce((sum, g) => sum + g.totalCompleted, 0);
    const doneFromRegular = dateFilteredTasks.filter((t) => t.status === "done" && !t.is_recurring).length;
    return {
      total: dateStatsSource.length,
      pending: dateStatsSource.filter((t) => t.status === "pending").length,
      inProgress: dateStatsSource.filter((t) => t.status === "in_progress").length,
      done: doneFromRecurring + doneFromRegular,
    };
  }, [dateFilteredTasks, dateGrouped]);

  const [expandedRecurringHistory, setExpandedRecurringHistory] = React.useState(() => new Set<string>());

  function toggleRecurringHistory(seriesKey: string) {
    setExpandedRecurringHistory((prev) => {
      const next = new Set(prev);
      if (next.has(seriesKey)) next.delete(seriesKey);
      else next.add(seriesKey);
      return next;
    });
  }

  const recurrenceIntervalNum = React.useMemo(
    () => Math.max(1, Math.min(99, recurrenceInterval || 1)),
    [recurrenceInterval],
  );

  function handleCloseModal() {
    setModalOpen(false);
    resetTaskModal();
  }

  function toggleRecurrenceDay(day: VaRecurrenceDay) {
    setRecurrenceDays((prev) => {
      const set = new Set(prev);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return [...set] as VaRecurrenceDay[];
    });
  }

  function addDraftPhase() {
    setDraftPhases((prev) => [
      ...prev,
      {
        tempId: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: "",
        region: "Global",
        scheduled_time: "",
        items: [],
      },
    ]);
  }

  function updateDraftPhase(tempId: string, patch: Partial<DraftPhase>) {
    setDraftPhases((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)));
  }

  function removeDraftPhase(tempId: string) {
    setDraftPhases((prev) => prev.filter((p) => p.tempId !== tempId));
  }

  function addDraftPhaseItem(phaseTempId: string) {
    setDraftPhases((prev) =>
      prev.map((p) =>
        p.tempId === phaseTempId
          ? {
              ...p,
              items: [
                ...p.items,
                {
                  tempId: `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  title: "",
                  requires_screenshot: false,
                  step_type: DEFAULT_TASK_STEP_TYPE,
                },
              ],
            }
          : p,
      ),
    );
  }

  function updateDraftPhaseItem(phaseTempId: string, itemTempId: string, patch: Partial<DraftPhaseItem>) {
    setDraftPhases((prev) =>
      prev.map((p) =>
        p.tempId === phaseTempId
          ? { ...p, items: p.items.map((it) => (it.tempId === itemTempId ? { ...it, ...patch } : it)) }
          : p,
      ),
    );
  }

  function removeDraftPhaseItem(phaseTempId: string, itemTempId: string) {
    setDraftPhases((prev) =>
      prev.map((p) =>
        p.tempId === phaseTempId ? { ...p, items: p.items.filter((it) => it.tempId !== itemTempId) } : p,
      ),
    );
  }

  async function persistDraftPhasesForTask(taskId: string, taskTitle: string, isEdit: boolean) {
    const snap = editPhasesSnapshotRef.current;
    if (isEdit && snap) {
      const kept = new Set(draftPhases.map((d) => d.serverId).filter(Boolean) as string[]);
      for (const pid of snap.phaseIds) {
        if (!kept.has(pid)) {
          await fetch(`/api/admin/task-phases/${encodeURIComponent(pid)}`, { method: "DELETE", credentials: "include" });
        }
      }
    }

    for (let phaseIndex = 0; phaseIndex < draftPhases.length; phaseIndex++) {
      const dp = draftPhases[phaseIndex];
      const scheduledIso = fromDatetimeLocal(dp.scheduled_time) ?? null;
      const phaseBody = {
        task_id: taskId,
        task_title: taskTitle,
        phase_number: phaseIndex + 1,
        title: dp.title.trim() || `Phase ${phaseIndex + 1}`,
        region: dp.region,
        scheduled_time: scheduledIso,
      };

      let phaseAirtableId = dp.serverId;
      if (dp.serverId) {
        await fetch(`/api/admin/task-phases/${encodeURIComponent(dp.serverId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: phaseBody.title,
            region: phaseBody.region,
            scheduled_time: scheduledIso,
          }),
        });
      } else {
        const res = await fetch("/api/admin/task-phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(phaseBody),
        });
        const data = (await res.json().catch(() => ({}))) as { phase?: TaskPhase };
        phaseAirtableId = data.phase?.id;
      }

      if (!phaseAirtableId) continue;

      const prevItemIds = (isEdit && dp.serverId && snap?.itemsByPhaseId?.[dp.serverId]) || [];
      const currServerIds = new Set(dp.items.map((i) => i.serverId).filter(Boolean) as string[]);
      for (const oldId of prevItemIds) {
        if (!currServerIds.has(oldId)) {
          await fetch(`/api/admin/task-phases/items/${encodeURIComponent(oldId)}`, {
            method: "DELETE",
            credentials: "include",
          });
        }
      }

      for (let i = 0; i < dp.items.length; i++) {
        const it = dp.items[i];
        if (it.serverId) {
          await fetch(`/api/admin/task-phases/items/${encodeURIComponent(it.serverId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: it.title,
              requires_screenshot: it.requires_screenshot,
              sort_order: i,
              step_type: it.step_type || DEFAULT_TASK_STEP_TYPE,
            }),
          });
        } else if (it.title.trim() || it.requires_screenshot) {
          await fetch(`/api/admin/task-phases/${encodeURIComponent(phaseAirtableId)}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              task_id: taskId,
              title: it.title,
              description: "",
              requires_screenshot: it.requires_screenshot,
              sort_order: i,
              step_type: it.step_type || DEFAULT_TASK_STEP_TYPE,
            }),
          });
        }
      }
    }
  }

  const handleSubmitTask = async () => {
    const usingTemplate = !editingId && createMode === "template";
    if (!usingTemplate && !title.trim()) return;

    if (usingTemplate) {
      if (!selectedTemplateId) {
        setError("Select a template");
        return;
      }
      if (assignAll || assignedTo.length !== 1) {
        setError("Select exactly one member for template tasks");
        return;
      }
      if (assignedModels.length === 0) {
        setError("Select at least one model for template tasks");
        return;
      }
    }

    setSaving(true);
    setError(null);
    const assigned = assignAll ? [] : assignedTo;
    // Create without an explicit due date used to omit the field entirely; List date filter then
    // never matched. Default to "now" on create (edit may still clear/leave blank intentionally).
    let dueIso = dueLocal ? fromDatetimeLocal(dueLocal) : undefined;
    if (!editingId && !dueIso) {
      dueIso = fromDatetimeLocal(defaultDueDatetimeLocal());
    }
    const interval = isRecurring ? recurrenceIntervalNum : null;

    if (usingTemplate) {
      try {
        const res = await fetch(`/api/admin/task-templates/${encodeURIComponent(selectedTemplateId)}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            assignedVaId: assignedTo[0],
            assignedModelIds: assignedModels,
            dueDate: dueIso ?? null,
            region: templateRegion,
            priority,
            reminderMinutesBefore:
              reminderMinutes != null && Number.isFinite(reminderMinutes) ? reminderMinutes : null,
            is_recurring: isRecurring,
            recurrence_type: isRecurring ? recurrenceType || null : null,
            recurrence_days: isRecurring ? recurrenceDays : [],
            recurrence_interval: isRecurring ? interval : null,
            recurrence_end_date:
              isRecurring && hasRecurrenceEnd && recurrenceEnd.trim() ? recurrenceEnd.trim() : null,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error?.trim() || "Could not apply template");
          return;
        }
        handleCloseModal();
        router.refresh();
      } finally {
        setSaving(false);
      }
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      assigned_to_ids: assigned,
      assigned_model_ids: assignedModels,
      assigned_model_names: assignedModels.map((id) => modelss.find((m) => m.id === id)?.model_name ?? "").filter(Boolean),
      status,
      priority,
      ...(dueIso ? { due_date: dueIso } : {}),
      is_recurring: isRecurring,
      recurrence_type: isRecurring ? recurrenceType || null : null,
      recurrence_days: isRecurring ? recurrenceDays : [],
      recurrence_interval: isRecurring && interval != null ? interval : null,
      recurrence_end_date:
        isRecurring && hasRecurrenceEnd && recurrenceEnd.trim() ? recurrenceEnd.trim() : null,
      reminder_minutes_before: reminderMinutes != null && Number.isFinite(reminderMinutes) ? reminderMinutes : null,
    };

    try {
      if (editingId) {
        const res = await updateVaTaskAction(editingId, payload);
        if (!res.success) {
          setError(res.error);
          return;
        }
        await persistDraftPhasesForTask(editingId, title.trim(), true);
      } else {
        const res = await createVaTaskAction(payload);
        if (!res.success) {
          setError(res.error);
          return;
        }
        const newId = res.task?.id;
        if (newId) {
          await persistDraftPhasesForTask(newId, title.trim(), false);
        }
      }
      handleCloseModal();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTask = React.useCallback(async () => {
    if (!taskPendingDelete) return;
    const id = taskPendingDelete.id;
    setConfirmingTaskDelete(true);
    try {
      const res = await fetch(`/api/va-tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        addToast(localToast(`vat-del-err-${Date.now()}`, "Could not delete", data.error ?? "Delete failed.", "high"));
        return;
      }
      setLocalTasks((prev) => prev.filter((t) => t.id !== id));
      setTaskPendingDelete(null);
      addToast(localToast(`vat-del-ok-${Date.now()}`, "Task deleted", "The task was removed.", "normal"));
      router.refresh();
    } catch {
      addToast(localToast(`vat-del-err-${Date.now()}`, "Could not delete", "Network error.", "high"));
    } finally {
      setConfirmingTaskDelete(false);
    }
  }, [taskPendingDelete, addToast, router]);

  const handleRemind = React.useCallback(async (task: VaTaskRecord) => {
    if (task.is_virtual_occurrence) {
      addToast(
        localToast(
          `vat-rm-virt-${Date.now()}`,
          "Not yet created",
          "This day is a projected occurrence. Reminders unlock when the real task is spawned for that day.",
          "normal",
        ),
      );
      return;
    }
    setReminding(task.id);
    setRemindSuccess(null);
    try {
      const res = await fetch(`/api/admin/va-tasks/${encodeURIComponent(task.id)}/remind`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; notified?: number };
      if (!res.ok) {
        addToast(localToast(`vat-rm-${Date.now()}`, "Remind failed", data.error ?? "Could not send reminder.", "high"));
        return;
      }
      addToast(
        localToast(
          `vat-rm-ok-${Date.now()}`,
          "Reminder sent",
          `Notified ${data.notified ?? 0} recipient(s).`,
          "normal"
        )
      );
      setRemindSuccess(task.id);
      window.setTimeout(() => setRemindSuccess(null), 2000);
    } catch {
      addToast(localToast(`vat-rm-${Date.now()}`, "Remind failed", "Network error.", "high"));
    } finally {
      setReminding(null);
    }
  }, [addToast]);

  const loadPhases = React.useCallback(async (taskId: string, sourceTaskId?: string | null) => {
    if (taskPhasesRef.current[taskId]) return;
    const params = new URLSearchParams({ task_id: taskId });
    if (sourceTaskId?.trim()) params.set("source_task_id", sourceTaskId.trim());
    const res = await fetch(`/api/admin/task-phases?${params}`, { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as { phases?: TaskPhase[] };
    setTaskPhases((prev) => ({ ...prev, [taskId]: data.phases ?? [] }));
  }, []);

  const handleDeleteRequest = React.useCallback((task: VaTaskRecord) => {
    if (task.is_virtual_occurrence || task.id.startsWith("virt_")) {
      addToast(
        localToast(
          `vat-del-virt-${Date.now()}`,
          "Projected day",
          "There is no Airtable row for this date yet. Delete or edit a real occurrence of the series instead.",
          "normal",
        ),
      );
      return;
    }
    setTaskPendingDelete(task);
  }, [addToast]);

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
      setTaskPhases((prev) => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), data.phase!] }));
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
    setTaskPhases((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map((p) => (p.id === phaseId ? { ...p, ...payload } : p)),
    }));
  }, []);

  const handleDeletePhase = React.useCallback(async (phaseId: string, taskId: string) => {
    if (taskId.startsWith("virt_") || phaseId.startsWith("virt_")) return;
    if (!confirm("Delete this phase?")) return;
    await fetch(`/api/admin/task-phases/${encodeURIComponent(phaseId)}`, { method: "DELETE", credentials: "include" });
    setTaskPhases((prev) => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter((p) => p.id !== phaseId) }));
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
      setTaskPhases((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] ?? []).map((p) =>
          p.id === phaseId ? { ...p, items: [...(p.items ?? []), data.item!] } : p,
        ),
      }));
    }
  }, []);

  const handleUpdatePhaseItem = React.useCallback(async (itemId: string, phaseId: string, taskId: string, updates: Partial<PhaseItem>) => {
    if (taskId.startsWith("virt_") || phaseId.startsWith("virt_") || itemId.startsWith("virt_")) return;
    await fetch(`/api/admin/task-phases/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });
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
  }, []);

  const handleDeletePhaseItem = React.useCallback(async (itemId: string, phaseId: string, taskId: string) => {
    if (taskId.startsWith("virt_") || phaseId.startsWith("virt_") || itemId.startsWith("virt_")) return;
    await fetch(`/api/admin/task-phases/items/${encodeURIComponent(itemId)}`, { method: "DELETE", credentials: "include" });
    setTaskPhases((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map((p) =>
        p.id === phaseId ? { ...p, items: (p.items ?? []).filter((i) => i.id !== itemId) } : p,
      ),
    }));
  }, []);

  const updatePhaseTitleLocal = React.useCallback((phaseId: string, taskId: string, title: string) => {
    setTaskPhases((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map((p) => (p.id === phaseId ? { ...p, title } : p)),
    }));
  }, []);

  const updatePhaseItemTitleLocal = React.useCallback((itemId: string, phaseId: string, taskId: string, title: string) => {
    setTaskPhases((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map((p) =>
        p.id === phaseId
          ? { ...p, items: (p.items ?? []).map((i) => (i.id === itemId ? { ...i, title } : i)) }
          : p,
      ),
    }));
  }, []);

  const assignedLabel = React.useCallback((t: VaTaskRecord) => {
    if (t.assigned_to_ids.length === 0) return "All VAs";
    return t.assigned_to_ids.map((id) => nameById[id] ?? id).join(", ");
  }, [nameById]);

  const reminderChipActive = (min: number) => reminderMinutes === min;

  const renderTaskCard = (task: VaTaskRecord) => (
    <AdminVaTaskCard
      key={task.id}
      task={task}
      assignedLabel={assignedLabel(task)}
      canManage={canManage}
      phases={taskPhases[task.id] ?? EMPTY_TASK_PHASES}
      isReminding={reminding === task.id}
      remindSuccess={remindSuccess === task.id}
      isConfirmingDelete={confirmingTaskDelete && taskPendingDelete?.id === task.id}
      onRemind={handleRemind}
      onEdit={openEdit}
      onDelete={handleDeleteRequest}
      onLoadPhases={loadPhases}
      onAddPhase={handleAddPhase}
      onUpdatePhase={handleUpdatePhase}
      onDeletePhase={handleDeletePhase}
      onAddPhaseItem={handleAddPhaseItem}
      onUpdatePhaseItem={handleUpdatePhaseItem}
      onDeletePhaseItem={handleDeletePhaseItem}
      onUpdatePhaseTitleLocal={updatePhaseTitleLocal}
      onUpdatePhaseItemTitleLocal={updatePhaseItemTitleLocal}
    />
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF8C]/65">Administration</p>
          <h1 className="mt-2 text-[36px] font-semibold leading-tight tracking-tight text-white">
            VA Tasks
          </h1>
          <p className="mt-2 text-sm text-[#B8B4B8]/55">Assign and manage tasks for your virtual assistants</p>
          <TaskDateNavigator value={selectedYmd} onChange={setSelectedYmd} className="mt-4" />
        </div>
        {canManage ? (
        <button
          type="button"
          onClick={openCreate}
          className={cn(VA_BTN_PRIMARY, "inline-flex shrink-0 items-center justify-center gap-2 px-5 py-2.5")}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          New task
        </button>
        ) : null}
      </div>

      {canShowList && canViewProgress ? (
        <div className="flex flex-wrap items-center justify-end">
          <AdminVaTasksViewToggle
            viewMode={viewMode}
            onChange={setViewMode}
            showList={canShowList}
            showProgress={canViewProgress}
          />
        </div>
      ) : null}

      {viewMode === "list" && canShowList ? (
        <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total", value: taskStats.total, color: "text-white" },
          { label: "Pending", value: taskStats.pending, color: "text-[#B8B4B8]" },
          { label: "In progress", value: taskStats.inProgress, color: "text-[#FF1493]" },
          { label: "Done", value: taskStats.done, color: "text-[#D4AF8C]" },
        ].map((s) => (
          <div key={s.label} className={cn(VA_CARD, "p-5 hover:translate-y-0")}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B8B4B8]/45">{s.label}</p>
            <p className={cn("mt-2 text-3xl font-semibold tabular-nums", s.color)}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className={cn(VA_CARD, "flex flex-wrap gap-3 p-4 hover:translate-y-0")}>
        <AdminVaTasksFilters
          onDeferredSearchChange={handleDeferredSearchChange}
          filterVa={filterVa}
          onFilterVaChange={setFilterVa}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterPriority={filterPriority}
          onFilterPriorityChange={setFilterPriority}
          vaOptions={vaOptionsForFilter}
          className="w-full"
        />
      </div>
        </>
      ) : null}

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

      {viewMode === "list" && canShowList && localTasks.length > 0 && dateFilteredTasks.length === 0 ? (
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
              onClick={() => setShowAllTasks(true)}
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
                  onClick={() => toggleRecurringHistory(group.seriesKey)}
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
                            {""}
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

      {canManage && modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm md:items-center">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[20px] border border-[rgba(255,255,255,0.06)] bg-[#0D0B0D] shadow-2xl md:max-w-2xl md:rounded-[20px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#0D0B0D]/95 px-6 py-5 backdrop-blur-sm">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">VA tasks</p>
                <h2 className="text-xl font-semibold text-white">
                  {editingId ? "Edit task" : "New task"}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1f1f1f] bg-[#141414] text-white/50 transition hover:border-white/20 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              {!editingId ? (
                <div>
                  <SectionLabel icon="" label="Creation mode" />
                  <div className="inline-flex w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#151315] p-1">
                    <button
                      type="button"
                      onClick={() => setCreateMode("scratch")}
                      className={cn(
                        "flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200",
                        createMode === "scratch"
                          ? "bg-[#FF1493]/15 text-[#FF1493] shadow-inner"
                          : "text-[#B8B4B8]/45 hover:text-[#B8B4B8]/70",
                      )}
                    >
                      Build from scratch
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateMode("template");
                        setAssignAll(false);
                      }}
                      className={cn(
                        "flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200",
                        createMode === "template"
                          ? "bg-[#FF1493]/15 text-[#FF1493] shadow-inner"
                          : "text-[#B8B4B8]/45 hover:text-[#B8B4B8]/70",
                      )}
                    >
                      Start from template
                    </button>
                  </div>
                  {createMode === "template" ? (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/40">Template</label>
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                          className={ADMIN_MODAL_INPUT}
                        >
                          <option value="">Select template…</option>
                          {templateOptions.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.category})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/40">Phase region</label>
                        <select
                          value={templateRegion}
                          onChange={(e) => setTemplateRegion(e.target.value as TaskPhase["region"])}
                          className={ADMIN_MODAL_INPUT}
                        >
                          <option value="Greek">🇬🇷 Greek</option>
                          <option value="USA">🇺🇸 USA</option>
                          <option value="Global">Global</option>
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <SectionLabel icon="" label="Assignment" />
                <div className="mb-3 flex items-center gap-3">
                  {createMode !== "template" || editingId ? (
                    <>
                      <ModalToggle
                        value={assignAll}
                        onChange={(v) => {
                          setAssignAll(v);
                          if (v) setAssignedTo([]);
                        }}
                      />
                      <span className="text-sm text-white/60">Assign to all VAs</span>
                    </>
                  ) : (
                    <span className="text-sm text-white/50">Select one member below</span>
                  )}
                </div>
                {!assignAll ? (
                  <StaffAssigneePicker
                    users={staffUsers}
                    roleLabels={roleLabels}
                    selectedIds={assignedTo}
                    onChange={setAssignedTo}
                    singleSelect={createMode === "template" && !editingId}
                  />
                ) : null}

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium text-white/40">
                    {createMode === "template" && !editingId ? "Assign models *" : "Assign models (optional)"}
                  </label>
                  <ModelMultiSelect
                    models={modelss}
                    selectedIds={assignedModels}
                    onChange={setAssignedModels}
                  />
                </div>
              </div>

              <Divider />

              {createMode === "scratch" || editingId ? (
              <div>
                <SectionLabel icon="" label="Details" />
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/40">
                      Title <span className="text-pink-400">*</span>
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Task title…"
                      className={ADMIN_MODAL_INPUT}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/40">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="What needs to be done?"
                      className={cn(ADMIN_MODAL_INPUT, "resize-none")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/40">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as VaTaskStatus)}
                        className={ADMIN_MODAL_INPUT}
                      >
                        <option value="pending">⏳ Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                        <option value="skipped">⏭ Skipped</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/40">Priority</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as VaTaskPriority)}
                        className={ADMIN_MODAL_INPUT}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              ) : (
                <div>
                  <SectionLabel icon="" label="Details" />
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/40">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as VaTaskPriority)}
                      className={ADMIN_MODAL_INPUT}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              )}

              <Divider />

              <div>
                <SectionLabel icon="" label="Schedule" />
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/40">
                      Due date &amp; time
                      {!editingId ? <span className="text-white/25"> (defaults to now)</span> : null}
                    </label>
                    <input
                      type="datetime-local"
                      value={dueLocal}
                      onChange={(e) => setDueLocal(e.target.value)}
                      required={!editingId}
                      className={cn(ADMIN_MODAL_INPUT, "[color-scheme:dark]")}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <ModalToggle value={isRecurring} onChange={setIsRecurring} />
                    <span className="text-sm text-white/60">Repeat this task</span>
                  </div>
                  <div className="va-recurrence-panel" data-open={isRecurring ? "true" : "false"}>
                    <div className={cn(VA_CARD, "mt-3 space-y-3 p-4")}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs text-white/40">Frequency</label>
                          <select
                            value={recurrenceType}
                            onChange={(e) => setRecurrenceType(e.target.value as VaRecurrenceType | "")}
                            className={ADMIN_MODAL_INPUT}
                          >
                            <option value="">Select…</option>
                            {RECURRENCE_TYPES.map((r) => (
                              <option key={r} value={r}>
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-white/40">Every N</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={recurrenceInterval}
                              onChange={(e) =>
                                setRecurrenceInterval(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                              }
                              className="w-16 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm text-white focus:outline-none focus:border-[#D4AF8C]/40"
                            />
                            <span className="text-sm text-white/40">
                              {recurrenceType === "daily"
                                ? recurrenceIntervalNum === 1
                                  ? "day"
                                  : "days"
                                : recurrenceType === "weekly"
                                  ? recurrenceIntervalNum === 1
                                    ? "week"
                                    : "weeks"
                                  : recurrenceType === "monthly"
                                    ? recurrenceIntervalNum === 1
                                      ? "month"
                                      : "months"
                                    : "interval"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {recurrenceType === "weekly" ? (
                        <div>
                          <label className="mb-2 block text-xs text-white/40">Days of week</label>
                          <div className="flex flex-wrap gap-1.5">
                            {WEEKDAY_SHORT.map((day, i) => {
                              const on = recurrenceDays.includes(WEEKDAYS[i]);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleRecurrenceDay(WEEKDAYS[i])}
                                  className={cn(
                                    "h-10 w-10 rounded-xl border text-xs font-semibold transition-all",
                                    on
                                      ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/15 text-[#D4AF8C] shadow-[0_0_12px_-4px_rgba(212,175,140,0.35)]"
                                      : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10",
                                  )}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      <div>
                        <label className="mb-2 block text-xs text-white/40">End date</label>
                        <div className="mb-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setHasRecurrenceEnd(false);
                              setRecurrenceEnd("");
                            }}
                            className={cn(
                              "rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                              !hasRecurrenceEnd
                                ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/15 text-[#D4AF8C]"
                                : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10",
                            )}
                          >
                            No end date
                          </button>
                          <button
                            type="button"
                            onClick={() => setHasRecurrenceEnd(true)}
                            className={cn(
                              "rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                              hasRecurrenceEnd
                                ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/15 text-[#D4AF8C]"
                                : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10",
                            )}
                          >
                            Set an end date
                          </button>
                        </div>
                        {hasRecurrenceEnd ? (
                          <input
                            type="date"
                            value={recurrenceEnd}
                            onChange={(e) => setRecurrenceEnd(e.target.value)}
                            required={hasRecurrenceEnd}
                            className={cn(ADMIN_MODAL_INPUT, "[color-scheme:dark]")}
                          />
                        ) : (
                          <p className="text-xs text-white/30">
                            Repeats indefinitely until you edit or deactivate the series.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Divider />

              <div>
                <SectionLabel icon="" label="Reminder" />
                <div className="flex flex-wrap gap-2">
                  {REMINDER_CHIPS.map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setReminderMinutes(reminderMinutes === min ? null : min)}
                      className={cn(
                        "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                        reminderChipActive(min)
                          ? "border-pink-500/30 bg-pink-500/20 text-pink-400"
                          : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10",
                      )}
                    >
                      {min === 1440 ? "1 day" : min === 120 ? "2h" : min === 60 ? "1h" : `${min}m`}
                    </button>
                  ))}
                </div>
              </div>

              <Divider />

              {createMode === "scratch" || editingId ? (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" aria-hidden />
                    <p className="text-xs font-semibold text-pink-400">Phases</p>
                    {draftPhases.length > 0 ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/20 text-xs font-bold text-pink-400">
                        {draftPhases.length}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={addDraftPhase}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add phase
                  </button>
                </div>

                {draftPhases.length === 0 ? (
                  <button
                    type="button"
                    onClick={addDraftPhase}
                    className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#D4AF8C]/15 py-5 text-sm text-[#B8B4B8]/30 transition-all hover:border-[#FF1493]/25 hover:text-[#FF1493]/50"
                  >
                    <Zap className="h-6 w-6 text-[#D4AF8C]/70" aria-hidden />
                    <span>Add phases to this task</span>
                    <span className="text-xs text-[#B8B4B8]/25">Optional — break task into steps with checklists</span>
                  </button>
                ) : (
                  <TaskPhaseRibbon
                    variant="mini"
                    phases={draftPhases.map((dp, phaseIndex) => ({
                      id: dp.tempId,
                      title: dp.title || `Phase ${phaseIndex + 1}`,
                      status: "pending" as const,
                      region: dp.region,
                      assigned_model_id: "",
                      assigned_model_name: "",
                      start_time: null,
                      end_time: null,
                      items: dp.items.map((it) => ({
                        id: it.tempId,
                        title: it.title,
                        status: "pending" as const,
                        requires_screenshot: it.requires_screenshot,
                        step_type: it.step_type,
                        completed_by_va_name: "",
                        completed_at: null,
                        screenshot: [] as PhaseItem["screenshot"],
                      })),
                    }))}
                    renderPhaseExtra={(phase) => {
                      const dp = draftPhases.find((p) => p.tempId === phase.id);
                      if (!dp) return null;
                      return (
                        <div className="mt-2 space-y-2 border-t border-[rgba(255,255,255,0.05)] pt-2">
                          <div className="flex items-center gap-2">
                            <input
                              value={dp.title}
                              onChange={(e) => updateDraftPhase(dp.tempId, { title: e.target.value })}
                              placeholder="Phase title"
                              className="min-w-0 flex-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-transparent px-2 py-1 text-xs text-white placeholder:text-[#B8B4B8]/25 focus:outline-none focus:border-[#D4AF8C]/35"
                            />
                            <button
                              type="button"
                              onClick={() => removeDraftPhase(dp.tempId)}
                              className="rounded p-1 text-[#B8B4B8]/20 hover:text-red-400"
                              aria-label="Remove phase"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          <select
                            value={dp.region}
                            onChange={(e) =>
                              updateDraftPhase(dp.tempId, { region: e.target.value as TaskPhase["region"] })
                            }
                            className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#151315] px-2 py-1.5 text-xs text-[#B8B4B8] focus:outline-none"
                          >
                            <option value="Greek">🇬🇷 Greek</option>
                            <option value="USA">🇺🇸 USA</option>
                            <option value="Global">Global</option>
                          </select>
                          <div>
                            <label className="mb-1 block text-[10px] text-[#B8B4B8]/40">
                              Deadline (optional) — leave blank to skip overdue alerts
                            </label>
                            <input
                              type="datetime-local"
                              value={dp.scheduled_time}
                              onChange={(e) =>
                                updateDraftPhase(dp.tempId, { scheduled_time: e.target.value })
                              }
                              className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#151315] px-2 py-1.5 text-xs text-[#B8B4B8] focus:outline-none focus:border-[#D4AF8C]/35"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => addDraftPhaseItem(dp.tempId)}
                            className="flex items-center gap-1 text-[10px] text-[#B8B4B8]/35 hover:text-[#D4AF8C]"
                          >
                            <Plus className="h-3 w-3" /> Add item
                          </button>
                        </div>
                      );
                    }}
                    renderItem={(item) => {
                      const dp = draftPhases.find((p) => p.items.some((it) => it.tempId === item.id));
                      const draftItem = dp?.items.find((it) => it.tempId === item.id);
                      if (!dp || !draftItem) return null;
                      return (
                        <div className="group flex items-center gap-2">
                          <div className="h-3.5 w-3.5 shrink-0 rounded border border-[#D4AF8C]/35" />
                          <select
                            value={draftItem.step_type}
                            onChange={(e) =>
                              updateDraftPhaseItem(dp.tempId, draftItem.tempId, {
                                step_type: e.target.value as TaskStepType,
                              })
                            }
                            className="w-[6.5rem] shrink-0 rounded border border-[rgba(255,255,255,0.08)] bg-[#151315] px-1.5 py-0.5 text-[10px] text-[#B8B4B8] focus:outline-none"
                            aria-label="Step type"
                          >
                            {TASK_STEP_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            value={draftItem.title}
                            onChange={(e) =>
                              updateDraftPhaseItem(dp.tempId, draftItem.tempId, { title: e.target.value })
                            }
                            placeholder="Checklist item"
                            className="min-w-0 flex-1 bg-transparent py-0.5 text-xs text-[#B8B4B8] placeholder:text-[#B8B4B8]/25 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateDraftPhaseItem(dp.tempId, draftItem.tempId, {
                                requires_screenshot: !draftItem.requires_screenshot,
                              })
                            }
                            className={cn(
                              "relative h-4 w-7 shrink-0 rounded-full transition-all",
                              draftItem.requires_screenshot ? "bg-[#D4AF8C]" : "bg-white/15",
                            )}
                            aria-label="Toggle screenshot required"
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                                draftItem.requires_screenshot ? "left-3.5" : "left-0.5",
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDraftPhaseItem(dp.tempId, draftItem.tempId)}
                            className="text-[#B8B4B8]/15 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                            aria-label="Remove item"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    }}
                  />
                )}
              </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex gap-3 border-t border-[rgba(255,255,255,0.06)] bg-[#0D0B0D]/95 px-6 py-5 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => void handleSubmitTask()}
                disabled={
                  saving ||
                  (editingId
                    ? !title.trim()
                    : createMode === "template"
                      ? !selectedTemplateId
                      : !title.trim())
                }
                className={cn(VA_BTN_PRIMARY, "flex-1 py-3.5 text-base active:scale-[0.99] disabled:opacity-40")}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Update task"
                    : createMode === "template"
                      ? "Apply template"
                      : "Create task"}
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className={cn(VA_BTN_SECONDARY, "border-white/15 bg-[#141414] text-white/50 hover:border-white/20 hover:text-white")}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canManage ? (
      <ConfirmDeleteModal
        open={taskPendingDelete != null}
        title="Delete task?"
        description={
          taskPendingDelete ? (
            <>
              Delete <span className="font-medium text-white">{taskPendingDelete.title}</span>? This action cannot be undone.
            </>
          ) : null
        }
        onClose={() => {
          if (!confirmingTaskDelete) setTaskPendingDelete(null);
        }}
        onConfirm={confirmDeleteTask}
        confirming={confirmingTaskDelete}
      />
      ) : null}
    </div>
  );
}
