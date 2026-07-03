"use client";

import * as React from "react";
import { Bell, Check, ClipboardList, Clock, Pencil, Plus, Trash2, Users, X, ImageIcon, Camera, Zap } from "lucide-react";
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
import { groupRecurringTasks } from "@/lib/recurring-utils";

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
const RECURRENCE_TYPES: VaRecurrenceType[] = ["daily", "weekly", "monthly", "custom"];
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
}

interface DraftPhase {
  tempId: string;
  serverId?: string;
  title: string;
  region: TaskPhase["region"];
  items: DraftPhaseItem[];
}

type Props = {
  tasks: VaTaskRecord[];
  vaUsers: VaUserOption[];
  modelss: ModelRecord[];
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
      <p className="text-xs font-semibold tracking-wide text-pink-400">{label}</p>
      <div className="h-px flex-1 bg-[#1f1f1f]" />
    </div>
  );
}

function priorityBorderClass(priority: VaTaskPriority) {
  const k = (priority || "normal").toLowerCase();
  if (k === "urgent") return "border-l-red-500";
  if (k === "high") return "border-l-orange-500";
  if (k === "low") return "border-l-gray-500";
  return "border-l-blue-500";
}

const ADMIN_FILTER_INPUT =
  "h-11 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20";

const ADMIN_MODAL_INPUT =
  "w-full rounded-xl border border-[#1f1f1f] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20";

function Divider() {
  return <div className="h-px bg-white/6" />;
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
      <span className={`relative block h-6 w-11 rounded-full transition-all ${value ? "bg-pink-500" : "bg-white/20"}`}>
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
    items: (p.items ?? []).map((i) => ({
      tempId: i.id,
      serverId: i.id,
      title: i.title,
      requires_screenshot: i.requires_screenshot,
    })),
  };
}

function formatPhaseActualTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/Athens",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PriorityBadge({ priority }: { priority: VaTaskPriority }) {
  const k = (priority || "normal").toLowerCase();
  const variant =
    k === "urgent"
      ? "border border-red-500/30 bg-red-500/20 text-red-300"
      : k === "high"
        ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
        : "border border-white/15 bg-white/10 text-white/65";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: VaTaskStatus }) {
  const k = (status || "").toLowerCase();
  const variant =
    k === "pending"
      ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
      : k === "done"
        ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
        : k === "skipped"
          ? "border border-red-500/30 bg-red-500/20 text-red-300"
          : "border border-white/15 bg-white/10 text-white/65";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {status.replace(/_/g, "")}
    </span>
  );
}

export function AdminVaTasksClient({ tasks, vaUsers, modelss }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [localTasks, setLocalTasks] = React.useState(tasks);
  const [taskPendingDelete, setTaskPendingDelete] = React.useState<VaTaskRecord | null>(null);
  const [confirmingTaskDelete, setConfirmingTaskDelete] = React.useState(false);
  const [reminding, setReminding] = React.useState<string | null>(null);
  const [remindSuccess, setRemindSuccess] = React.useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = React.useState<string | null>(null);
  const [taskPhases, setTaskPhases] = React.useState<Record<string, TaskPhase[]>>({});
  const [loadingPhases, setLoadingPhases] = React.useState<string | null>(null);

  React.useEffect(() => setLocalTasks(tasks), [tasks]);

  const nameById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of vaUsers) {
      m[u.id] = (u.full_name || u.email || u.id).trim();
    }
    return m;
  }, [vaUsers]);

  const vaOptionsForFilter = React.useMemo(
    () => [{ value: "", label: "All VAs" }, ...vaUsers.map((u) => ({ value: u.id, label: (u.full_name || u.email).trim() || u.id }))],
    [vaUsers]
  );

  const [search, setSearch] = React.useState("");
  const [filterVa, setFilterVa] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");

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
    void loadTemplateOptions();
    setModalOpen(true);
  };

  const openEdit = async (t: VaTaskRecord) => {
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
    setRecurrenceEnd(t.recurrence_end_date ? toLocalYmd(t.recurrence_end_date) : "");
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
  };

  const filteredTasks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return localTasks.filter((t) => {
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
  }, [localTasks, search, filterVa, filterStatus, filterPriority]);

  const { regularTasks, recurringGroups } = React.useMemo(
    () => groupRecurringTasks(filteredTasks),
    [filteredTasks],
  );

  const activeTasksForStats = React.useMemo(() => {
    const currents = recurringGroups.map((g) => g.currentTask).filter(Boolean) as VaTaskRecord[];
    return [...regularTasks, ...currents];
  }, [regularTasks, recurringGroups]);

  const taskStats = React.useMemo(() => {
    const doneFromRecurring = recurringGroups.reduce((sum, g) => sum + g.totalCompleted, 0);
    const doneFromRegular = regularTasks.filter((t) => t.status === "done").length;
    return {
      total: activeTasksForStats.length,
      pending: activeTasksForStats.filter((t) => t.status === "pending").length,
      inProgress: activeTasksForStats.filter((t) => t.status === "in_progress").length,
      done: doneFromRecurring + doneFromRegular,
    };
  }, [activeTasksForStats, regularTasks, recurringGroups]);

  const [expandedRecurringHistory, setExpandedRecurringHistory] = React.useState(() => new Set<string>());

  function toggleRecurringHistory(title: string) {
    setExpandedRecurringHistory((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
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

  function toggleAssignee(vaId: string) {
    setAssignedTo((prev) => (prev.includes(vaId) ? prev.filter((id) => id !== vaId) : [...prev, vaId]));
  }

  function toggleModel(modelId: string) {
    setAssignedModels((prev) => (prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]));
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
      const phaseBody = {
        task_id: taskId,
        task_title: taskTitle,
        phase_number: phaseIndex + 1,
        title: dp.title.trim() || `Phase ${phaseIndex + 1}`,
        region: dp.region,
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
        setError("Select exactly one VA for template tasks");
        return;
      }
      if (assignedModels.length !== 1) {
        setError("Select exactly one model for template tasks");
        return;
      }
    }

    setSaving(true);
    setError(null);
    const assigned = assignAll ? [] : assignedTo;
    const dueIso = dueLocal ? fromDatetimeLocal(dueLocal) : undefined;
    const interval = isRecurring ? recurrenceIntervalNum : null;

    if (usingTemplate) {
      try {
        const res = await fetch(`/api/admin/task-templates/${encodeURIComponent(selectedTemplateId)}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            assignedVaId: assignedTo[0],
            assignedModelId: assignedModels[0],
            dueDate: dueIso ?? null,
            region: templateRegion,
            priority,
            reminderMinutesBefore:
              reminderMinutes != null && Number.isFinite(reminderMinutes) ? reminderMinutes : null,
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
      recurrence_end_date: isRecurring && recurrenceEnd.trim() ? recurrenceEnd.trim() : null,
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

  async function handleRemind(task: VaTaskRecord) {
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
  }

  async function loadPhases(taskId: string) {
    if (taskPhases[taskId]) return;
    setLoadingPhases(taskId);
    try {
      const res = await fetch(`/api/admin/task-phases?task_id=${encodeURIComponent(taskId)}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { phases?: TaskPhase[] };
      setTaskPhases((prev) => ({ ...prev, [taskId]: data.phases ?? [] }));
    } finally {
      setLoadingPhases(null);
    }
  }

  async function handleAddPhase(taskId: string, taskTitle: string) {
    const phases = taskPhases[taskId] ?? [];
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
  }

  function normalizePhasePatch(updates: Partial<TaskPhase>): Partial<TaskPhase> {
    return { ...updates };
  }

  async function handleUpdatePhase(phaseId: string, taskId: string, updates: Partial<TaskPhase>) {
    const payload = normalizePhasePatch(updates);
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
  }

  async function handleDeletePhase(phaseId: string, taskId: string) {
    if (!confirm("Delete this phase?")) return;
    await fetch(`/api/admin/task-phases/${encodeURIComponent(phaseId)}`, { method: "DELETE", credentials: "include" });
    setTaskPhases((prev) => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter((p) => p.id !== phaseId) }));
  }

  async function handleAddPhaseItem(phaseId: string, taskId: string) {
    const phase = (taskPhases[taskId] ?? []).find((p) => p.id === phaseId);
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
  }

  async function handleUpdatePhaseItem(itemId: string, phaseId: string, taskId: string, updates: Partial<PhaseItem>) {
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
  }

  async function handleDeletePhaseItem(itemId: string, phaseId: string, taskId: string) {
    await fetch(`/api/admin/task-phases/items/${encodeURIComponent(itemId)}`, { method: "DELETE", credentials: "include" });
    setTaskPhases((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map((p) =>
        p.id === phaseId ? { ...p, items: (p.items ?? []).filter((i) => i.id !== itemId) } : p,
      ),
    }));
  }

  function updatePhaseTitleLocal(phaseId: string, taskId: string, title: string) {
    setTaskPhases((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map((p) => (p.id === phaseId ? { ...p, title } : p)),
    }));
  }

  function updatePhaseItemTitleLocal(itemId: string, phaseId: string, taskId: string, title: string) {
    setTaskPhases((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map((p) =>
        p.id === phaseId
          ? { ...p, items: (p.items ?? []).map((i) => (i.id === itemId ? { ...i, title } : i)) }
          : p,
      ),
    }));
  }

  const assignedLabel = (t: VaTaskRecord) => {
    if (t.assigned_to_ids.length === 0) return "All VAs";
    return t.assigned_to_ids.map((id) => nameById[id] ?? id).join(", ");
  };

  const reminderChipActive = (min: number) => reminderMinutes === min;

  function renderAdminTaskCard(task: VaTaskRecord) {
    const modelNames = task.assigned_model_names ?? [];
    return (
                <div
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-[#1f1f1f] border-l-[5px] bg-[#0d0d0d] p-5 transition-all hover:border-[#2a2a2a]",
                    priorityBorderClass(task.priority),
                    task.status === "done" && "opacity-70",
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <StatusBadge status={task.status} />
                          <PriorityBadge priority={task.priority} />
                          {task.is_recurring ? (
                            <span className="rounded-full border border-purple-500/25 bg-purple-500/15 px-2 py-0.5 text-xs text-purple-300">
                              Recurring
                            </span>
                          ) : null}
                        </div>
                        <h3
                          className={cn(
                            "text-lg font-semibold leading-snug text-white",
                            task.status === "done" && "text-white/50 line-through"
                          )}
                        >
                          {task.title}
                        </h3>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {task.status !== "done" && task.status !== "skipped" ? (
                          <button
                            type="button"
                            onClick={() => void handleRemind(task)}
                            disabled={reminding === task.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-40"
                          >
                            <Bell className="h-3 w-3" aria-hidden />
                            {reminding === task.id ? "Sending…" : remindSuccess === task.id ? "Sent!" : "Remind"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEdit(task)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-white/60 transition hover:border-white/25 hover:text-white"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={confirmingTaskDelete && taskPendingDelete?.id === task.id}
                          onClick={() => setTaskPendingDelete(task)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/50">
                        <Users className="h-3 w-3 shrink-0" aria-hidden />
                        {assignedLabel(task)}
                      </span>
                      {modelNames.map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-pink-500/25 bg-pink-500/10 px-2.5 py-1 text-xs font-medium text-pink-300"
                        >
                          {name}
                        </span>
                      ))}
                      {task.due_date ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs",
                            isPastDue(task.due_date) && task.status !== "done"
                              ? "border-red-500/30 text-red-400"
                              : "text-white/45",
                          )}
                        >
                          <Clock className="h-3 w-3 shrink-0" aria-hidden />
                          {formatDateEuropean(task.due_date)}
                          {isPastDue(task.due_date) && task.status !== "done" ? " · Overdue" : ""}
                        </span>
                      ) : null}
                      {task.reminder_minutes_before != null ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/40">
                          {formatReminderLabel(task.reminder_minutes_before)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-5 border-t border-[#1f1f1f] pt-4">
                      <button
                        type="button"
                        onClick={async () => {
                          if (expandedTaskId === task.id) {
                            setExpandedTaskId(null);
                            return;
                          }
                          setExpandedTaskId(task.id);
                          await loadPhases(task.id);
                        }}
                        className="group/ph flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white/75"
                      >
                        <span className="text-xs">{expandedTaskId === task.id ? "▼" : "▶"}</span>
                        <span className="font-medium">Phases</span>
                        {taskPhases[task.id]?.length ? (
                          <span className="rounded-full border border-[#1f1f1f] bg-[#141414] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/50">
                            {taskPhases[task.id].length}
                          </span>
                        ) : null}
                        {loadingPhases === task.id ? <span className="animate-pulse text-xs text-white/30">Loading…</span> : null}
                      </button>

                      {expandedTaskId === task.id ? (
                        <div className="relative mt-5 space-y-0 pl-5">
                          <div className="absolute bottom-2 left-[0.625rem] top-2 w-px bg-[#1f1f1f]" aria-hidden />
                          {(taskPhases[task.id] ?? []).map((phase, phaseIndex) => {
                            const items = phase.items ?? [];
                            const doneItems = items.filter((i) => i.status === "completed").length;
                            const progressPct = items.length > 0 ? (doneItems / items.length) * 100 : 0;
                            const isLast = phaseIndex === (taskPhases[task.id]?.length ?? 0) - 1;
                            return (
                              <div key={phase.id} className={cn("relative pb-6", isLast && "pb-0")}>
                                <div
                                  className={cn(
                                    "absolute -left-5 top-5 z-10 h-3.5 w-3.5 rounded-full border-2 border-[#0d0d0d]",
                                    phase.status === "completed"
                                      ? "bg-emerald-500"
                                      : phase.status === "overdue"
                                        ? "bg-red-500"
                                        : phase.status === "in_progress"
                                          ? "bg-blue-500"
                                          : "bg-gray-500",
                                  )}
                                />
                              <div
                                className={cn(
                                  "overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] transition-all",
                                  phase.status === "completed"
                                    ? "border-l-[3px] border-l-emerald-500"
                                    : phase.status === "overdue"
                                      ? "border-l-[3px] border-l-red-500"
                                      : phase.status === "in_progress"
                                        ? "border-l-[3px] border-l-blue-500"
                                        : "border-l-[3px] border-l-gray-600",
                                )}
                              >
                                <div className="flex items-center gap-3 px-5 py-4">
                                  <div
                                    className={cn(
                                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                                      phase.status === "completed"
                                        ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                                        : phase.status === "overdue"
                                          ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                                          : phase.status === "in_progress"
                                            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                                            : "bg-white/10 text-white/50",
                                    )}
                                  >
                                    {phaseIndex + 1}
                                  </div>
                                  <input
                                    value={phase.title}
                                    onChange={(e) => updatePhaseTitleLocal(phase.id, task.id, e.target.value)}
                                    onBlur={() => void handleUpdatePhase(phase.id, task.id, { title: phase.title })}
                                    placeholder={`Phase ${phaseIndex + 1}`}
                                    className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white placeholder:text-white/20 focus:outline-none"
                                  />
                                  {items.length > 0 ? (
                                    <div
                                      className={cn(
                                        "flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold",
                                        phase.status === "completed"
                                          ? "bg-green-500/15 text-green-400"
                                          : phase.status === "overdue"
                                            ? "bg-red-500/15 text-red-400"
                                            : "bg-white/8 text-white/50",
                                      )}
                                    >
                                      <div className="h-1.5 w-16 rounded-full bg-white/10">
                                        <div
                                          className={cn(
                                            "h-1.5 rounded-full transition-all",
                                            phase.status === "completed"
                                              ? "bg-green-500"
                                              : phase.status === "overdue"
                                                ? "bg-red-500"
                                                : "bg-blue-400",
                                          )}
                                          style={{ width: `${progressPct}%` }}
                                        />
                                      </div>
                                      <span className="tabular-nums">
                                        {doneItems}/{items.length}
                                      </span>
                                    </div>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => void handleDeletePhase(phase.id, task.id)}
                                    className="shrink-0 rounded-lg p-1.5 text-white/15 transition-all hover:bg-red-500/10 hover:text-red-400"
                                    aria-label="Delete phase"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {(phase.actual_start_time || phase.actual_end_time) ? (
                                  <div className="flex flex-wrap gap-3 px-5 pb-2 text-xs text-white/35">
                                    {phase.actual_start_time ? (
                                      <span>Started {formatPhaseActualTime(phase.actual_start_time)}</span>
                                    ) : null}
                                    {phase.actual_end_time ? (
                                      <span>Ended {formatPhaseActualTime(phase.actual_end_time)}</span>
                                    ) : null}
                                  </div>
                                ) : null}

                                <div className="flex flex-wrap gap-2 px-5 pb-3">
                                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                    <select
                                      value={phase.region ?? "Global"}
                                      onChange={(e) =>
                                        void handleUpdatePhase(phase.id, task.id, {
                                          region: e.target.value as TaskPhase["region"],
                                        })
                                      }
                                      className="cursor-pointer bg-transparent text-xs text-white focus:outline-none"
                                    >
                                      <option value="Greek">🇬🇷 Greek</option>
                                      <option value="USA">🇺🇸 USA</option>
                                      <option value="Global">Global</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="px-5 pb-4">
                                  <div className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.03]">
                                    {items.map((item, idx) => (
                                      <div
                                        key={item.id}
                                        className={cn(
                                          "group flex items-start gap-3 px-4 py-3",
                                          idx < items.length - 1 ? "border-b border-white/5" : "",
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
                                            item.status === "completed"
                                              ? "border-green-500 bg-green-500"
                                              : "border-white/20 bg-transparent",
                                          )}
                                        >
                                          {item.status === "completed" ? (
                                            <Check className="h-3 w-3 text-white" aria-hidden />
                                          ) : null}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <input
                                            value={item.title}
                                            onChange={(e) =>
                                              updatePhaseItemTitleLocal(item.id, phase.id, task.id, e.target.value)
                                            }
                                            onBlur={() =>
                                              void handleUpdatePhaseItem(item.id, phase.id, task.id, { title: item.title })
                                            }
                                            placeholder={`Item ${idx + 1}…`}
                                            className={cn(
                                              "w-full bg-transparent text-sm focus:outline-none",
                                              item.status === "completed" ? "text-white/30 line-through" : "text-white/80",
                                            )}
                                          />
                                          {item.status === "completed" &&
                                          item.screenshot &&
                                          item.screenshot.length > 0 ? (
                                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                              <a
                                                href={item.screenshot[0].url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-1.5 text-xs text-blue-400 transition-colors hover:text-blue-300"
                                              >
                                                <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" aria-hidden />View proof</span>
                                              </a>
                                              <a href={item.screenshot[0].url} target="_blank" rel="noreferrer">
                                                <img
                                                  src={item.screenshot[0].url}
                                                  alt=""
                                                  className="h-8 w-12 rounded-lg border border-white/10 object-cover transition-opacity hover:opacity-80"
                                                />
                                              </a>
                                            </div>
                                          ) : null}
                                          {item.requires_screenshot && item.status !== "completed" ? (
                                            <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-400/50">
                                              <span className="inline-flex items-center gap-1"><Camera className="h-3.5 w-3.5" aria-hidden />Requires proof</span>
                                            </p>
                                          ) : null}
                                          {item.status === "completed" && item.completed_by_va_name ? (
                                            <p className="mt-0.5 text-xs text-white/20">
                                              {item.completed_by_va_name}
                                              {item.completed_at
                                                ? ` · ${new Date(item.completed_at).toLocaleString("el-GR", {
                                                    timeZone: "Europe/Athens",
                                                    day: "numeric",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                  })}`
                                                : ""}
                                            </p>
                                          ) : null}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 self-center">
                                          <label className="flex cursor-pointer items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Camera className="h-3.5 w-3.5 text-white/30" aria-hidden />
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void handleUpdatePhaseItem(item.id, phase.id, task.id, {
                                                  requires_screenshot: !item.requires_screenshot,
                                                })
                                              }
                                              className={cn(
                                                "relative h-4 w-8 rounded-full transition-all",
                                                item.requires_screenshot ? "bg-amber-500" : "bg-white/15",
                                              )}
                                              aria-label="Toggle screenshot required"
                                            >
                                              <span
                                                className={cn(
                                                  "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                                                  item.requires_screenshot ? "left-4" : "left-0.5",
                                                )}
                                              />
                                            </button>
                                          </label>
                                          <button
                                            type="button"
                                            onClick={() => void handleDeletePhaseItem(item.id, phase.id, task.id)}
                                            className="rounded p-1 text-white/10 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                                            aria-label="Remove item"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => void handleAddPhaseItem(phase.id, task.id)}
                                      className="flex w-full items-center gap-2 border-t border-white/5 px-4 py-3 text-xs text-white/25 transition-all hover:bg-white/[0.03] hover:text-white/50"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add checklist item
                                    </button>
                                  </div>
                                </div>
                              </div>
                              </div>
                            );
                          })}

                          <button
                            type="button"
                            onClick={() => void handleAddPhase(task.id, task.title)}
                            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 px-5 py-3 text-xs text-white/25 transition-all hover:border-pink-500/40 hover:text-pink-400"
                          >
                            <Plus className="h-4 w-4" />
                            Add phase
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-pink-400">Administration</p>
          <h1 className="mt-2 text-[36px] font-bold leading-tight tracking-tight text-white">VA Tasks</h1>
          <p className="mt-2 text-sm text-white/40">Assign and manage tasks for your virtual assistants</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:bg-pink-400"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          New task
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total", value: taskStats.total, color: "text-white" },
          { label: "Pending", value: taskStats.pending, color: "text-amber-400" },
          { label: "In progress", value: taskStats.inProgress, color: "text-blue-400" },
          { label: "Done", value: taskStats.done, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] p-5">
            <p className="text-xs font-medium text-white/40">{s.label}</p>
            <p className={cn("mt-2 text-3xl font-bold tabular-nums", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] p-4">
        <input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(ADMIN_FILTER_INPUT, "min-w-[10rem] flex-1")}
        />
        <CustomSelect
          value={filterVa}
          onChange={setFilterVa}
          options={vaOptionsForFilter}
          triggerClassName={cn(ADMIN_FILTER_INPUT, "min-w-[10rem]")}
          portaled
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={cn(ADMIN_FILTER_INPUT, "min-w-[9rem]")}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className={cn(ADMIN_FILTER_INPUT, "min-w-[9rem]")}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {regularTasks.length === 0 && recurringGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/35">
            <ClipboardList className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-5 text-base font-semibold text-white/90">No tasks match</p>
          <p className="mt-2 max-w-sm text-sm text-white/50">Adjust search or filters, or create a new task.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {regularTasks.map((task) => (
            <React.Fragment key={task.id}>{renderAdminTaskCard(task)}</React.Fragment>
          ))}
          {recurringGroups.map((group) => (
            <div key={group.title} className="mb-3 md:col-span-2">
              {group.currentTask ? (
                <React.Fragment key={group.currentTask.id}>{renderAdminTaskCard(group.currentTask)}</React.Fragment>
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
                  onClick={() => toggleRecurringHistory(group.title)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-xs text-white/30 transition-colors hover:text-white/60"
                >
                  <div
                    className={cn(
                      "transition-transform",
                      expandedRecurringHistory.has(group.title) ? "rotate-90" : "",
                    )}
                  >
                    ▶
                  </div>
                  <span>History ({group.totalCompleted} completed)</span>
                  <div className="ml-2 h-px flex-1 bg-white/8" />
                </button>
              ) : null}
              {expandedRecurringHistory.has(group.title) ? (
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
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm md:items-center">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[20px] border border-[#1f1f1f] bg-[#0d0d0d] shadow-2xl md:max-w-2xl md:rounded-[20px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1f1f1f] bg-[#0d0d0d]/95 px-6 py-5 backdrop-blur-sm">
              <div>
                <p className="mb-1 text-xs font-semibold text-pink-400">VA tasks</p>
                <h2 className="text-xl font-bold text-white">{editingId ? "Edit task" : "New task"}</h2>
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
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateMode("scratch")}
                      className={cn(
                        "rounded-xl border py-3 text-sm font-semibold transition-all",
                        createMode === "scratch"
                          ? "border-pink-500/30 bg-pink-500/20 text-pink-400"
                          : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10",
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
                        "rounded-xl border py-3 text-sm font-semibold transition-all",
                        createMode === "template"
                          ? "border-pink-500/30 bg-pink-500/20 text-pink-400"
                          : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10",
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
                    <span className="text-sm text-white/50">Select one VA below</span>
                  )}
                </div>
                {!assignAll ? (
                  <div className="flex flex-wrap gap-2">
                    {vaUsers.map((va) => {
                      const name = (va.full_name || va.email).trim() || va.id;
                      const initial = name.charAt(0).toUpperCase();
                      const on = assignedTo.includes(va.id);
                      return (
                        <button
                          key={va.id}
                          type="button"
                          onClick={() => toggleAssignee(va.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                            on
                              ? "border-pink-500/30 bg-pink-500/20 text-pink-400 shadow-lg shadow-pink-500/10"
                              : "border-white/10 bg-white/5 text-white/50 hover:bg-white/8",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                              on ? "bg-pink-500/30 text-pink-400" : "bg-white/10 text-white/40",
                            )}
                          >
                            {initial}
                          </div>
                          {name}
                          {on ? <Check className="h-3 w-3" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium text-white/40">
                    {createMode === "template" && !editingId ? "Assign model *" : "Assign models (optional)"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {modelss.map((m) => {
                      const on = assignedModels.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleModel(m.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                            on
                              ? "border-rose-500/30 bg-rose-500/20 text-rose-400"
                              : "border-white/10 bg-white/5 text-white/40 hover:bg-white/8",
                          )}
                        >
                          <Users className="h-4 w-4 text-rose-400/70" aria-hidden />
                          {m.model_name}
                          {on ? <Check className="h-3 w-3" /> : null}
                        </button>
                      );
                    })}
                  </div>
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
                    <label className="mb-1.5 block text-xs font-medium text-white/40">Due date &amp; time</label>
                    <input
                      type="datetime-local"
                      value={dueLocal}
                      onChange={(e) => setDueLocal(e.target.value)}
                      className={cn(ADMIN_MODAL_INPUT, "[color-scheme:dark]")}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    {createMode === "scratch" || editingId ? (
                      <>
                        <ModalToggle value={isRecurring} onChange={setIsRecurring} />
                        <span className="text-sm text-white/60">Recurring task</span>
                      </>
                    ) : null}
                  </div>
                  {isRecurring && (createMode === "scratch" || editingId) ? (
                    <div className="space-y-3 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs text-white/40">Repeat every</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={recurrenceInterval}
                              onChange={(e) =>
                                setRecurrenceInterval(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                              }
                              className="w-16 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm text-white focus:outline-none"
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
                                    : recurrenceType === "custom"
                                      ? recurrenceIntervalNum === 1
                                        ? "time"
                                        : "times"
                                      : recurrenceIntervalNum === 1
                                        ? "day"
                                        : "days"}
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-white/40">Type</label>
                          <select
                            value={recurrenceType}
                            onChange={(e) => setRecurrenceType(e.target.value as VaRecurrenceType | "")}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none"
                          >
                            <option value="">—</option>
                            {RECURRENCE_TYPES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {recurrenceType === "weekly" ? (
                        <div>
                          <label className="mb-2 block text-xs text-white/40">Days</label>
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
                                      ? "border-pink-500/30 bg-pink-500/20 text-pink-400"
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
                        <label className="mb-1.5 block text-xs text-white/40">End date (optional)</label>
                        <input
                          type="date"
                          value={recurrenceEnd}
                          onChange={(e) => setRecurrenceEnd(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : null}
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
                    className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-white/10 py-5 text-sm text-white/20 transition-all hover:border-pink-500/30 hover:text-pink-400/50"
                  >
                    <Zap className="h-6 w-6 text-amber-400" aria-hidden />
                    <span>Add phases to this task</span>
                    <span className="text-xs text-white/15">Optional — break task into steps with checklists</span>
                  </button>
                ) : null}

                <div className="space-y-3">
                  {draftPhases.map((phase, phaseIndex) => (
                    <div key={phase.tempId} className="overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0a0a0a]">
                      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/15 text-xs font-bold text-pink-400">
                          {phaseIndex + 1}
                        </div>
                        <input
                          value={phase.title}
                          onChange={(e) => updateDraftPhase(phase.tempId, { title: e.target.value })}
                          placeholder={`Phase ${phaseIndex + 1} title`}
                          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white placeholder:text-white/20 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeDraftPhase(phase.tempId)}
                          className="rounded-lg p-1 text-white/20 transition-all hover:bg-red-500/10 hover:text-red-400"
                          aria-label="Remove phase"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="border-b border-white/5 px-4 py-3">
                        <label className="mb-1 block text-xs text-white/25">Region</label>
                        <select
                          value={phase.region}
                          onChange={(e) =>
                            updateDraftPhase(phase.tempId, { region: e.target.value as TaskPhase["region"] })
                          }
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white focus:outline-none"
                        >
                          <option value="Greek">🇬🇷 Greek</option>
                          <option value="USA">🇺🇸 USA</option>
                          <option value="Global">Global</option>
                        </select>
                      </div>

                      <div className="px-4 py-3">
                        <div className="mb-2 space-y-2">
                          {phase.items.map((item, itemIdx) => (
                            <div key={item.tempId} className="group flex items-center gap-2.5">
                              <div className="h-4 w-4 shrink-0 rounded border border-white/20 bg-white/5" />
                              <input
                                value={item.title}
                                onChange={(e) =>
                                  updateDraftPhaseItem(phase.tempId, item.tempId, { title: e.target.value })
                                }
                                placeholder={`Item ${itemIdx + 1}…`}
                                className="min-w-0 flex-1 border-b border-transparent bg-transparent py-0.5 text-xs text-white/80 focus:border-white/20 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateDraftPhaseItem(phase.tempId, item.tempId, {
                                    requires_screenshot: !item.requires_screenshot,
                                  })
                                }
                                className={cn(
                                  "relative h-4 w-8 shrink-0 rounded-full transition-all",
                                  item.requires_screenshot ? "bg-amber-500" : "bg-white/15",
                                )}
                                aria-label="Toggle screenshot required"
                              >
                                <span
                                  className={cn(
                                    "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                                    item.requires_screenshot ? "left-4" : "left-0.5",
                                  )}
                                />
                              </button>
                              <Camera className="h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
                              <button
                                type="button"
                                onClick={() => removeDraftPhaseItem(phase.tempId, item.tempId)}
                                className="text-white/10 opacity-0 transition-colors hover:text-red-400 group-hover:opacity-100"
                                aria-label="Remove item"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => addDraftPhaseItem(phase.tempId)}
                          className="flex items-center gap-1.5 text-xs text-white/20 transition-colors hover:text-white/50"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add item
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex gap-3 border-t border-[#1f1f1f] bg-[#0d0d0d]/95 px-6 py-5 backdrop-blur-sm">
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
                className="flex-1 rounded-xl bg-pink-500 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-500/25 transition hover:bg-pink-400 active:scale-[0.99] disabled:opacity-40"
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
                className="rounded-xl border border-[#1f1f1f] bg-[#141414] px-5 py-3.5 text-white/50 transition hover:border-white/20 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
    </div>
  );
}
