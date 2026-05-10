"use client";

import * as React from "react";
import { Bell, ClipboardList, Clock, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDateEuropean, formatDateTimeAthens } from "@/lib/format";
import { createVaTaskAction, updateVaTaskAction } from "@/app/actions/va-tasks";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification, VaTaskRecord, VaTaskStatus, VaTaskPriority, VaRecurrenceType, VaRecurrenceDay } from "@/types";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";

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

type Props = {
  tasks: VaTaskRecord[];
  vaUsers: VaUserOption[];
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

function toDatetimeLocalValue(isoLike: string | null): string {
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
      {status.replace(/_/g, " ")}
    </span>
  );
}

function emptyForm() {
  return {
    title: "",
    description: "",
    assigned_to_ids: [] as string[],
    allVas: false,
    status: "pending" as VaTaskStatus,
    priority: "normal" as VaTaskPriority,
    due_local: "",
    is_recurring: false,
    recurrence_type: "" as VaRecurrenceType | "",
    recurrence_days: [] as VaRecurrenceDay[],
    recurrence_interval: "" as string,
    recurrence_end: "",
    reminder_minutes: "" as string,
  };
}

export function AdminVaTasksClient({ tasks, vaUsers }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [localTasks, setLocalTasks] = React.useState(tasks);
  const [taskPendingDelete, setTaskPendingDelete] = React.useState<VaTaskRecord | null>(null);
  const [confirmingTaskDelete, setConfirmingTaskDelete] = React.useState(false);
  const [reminding, setReminding] = React.useState<string | null>(null);

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
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (t: VaTaskRecord) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description,
      assigned_to_ids: [...t.assigned_to_ids],
      allVas: t.assigned_to_ids.length === 0,
      status: t.status,
      priority: t.priority,
      due_local: t.due_date ? toDatetimeLocalValue(t.due_date) : "",
      is_recurring: t.is_recurring,
      recurrence_type: t.recurrence_type,
      recurrence_days: [...t.recurrence_days],
      recurrence_interval: t.recurrence_interval != null ? String(t.recurrence_interval) : "",
      recurrence_end: t.recurrence_end_date ? toLocalYmd(t.recurrence_end_date) : "",
      reminder_minutes: t.reminder_minutes_before != null ? String(t.reminder_minutes_before) : "",
    });
    setError(null);
    setModalOpen(true);
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

  const recurrenceIntervalNum = React.useMemo(() => {
    const t = form.recurrence_interval.trim();
    if (t === "") return 1;
    const n = Number(t);
    return Math.max(1, Math.min(99, Number.isFinite(n) ? n : 1));
  }, [form.recurrence_interval]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const assigned = form.allVas ? [] : form.assigned_to_ids;
    const dueIso = form.due_local ? fromDatetimeLocal(form.due_local) : undefined;
    const rawI = form.recurrence_interval.trim();
    const interval = rawI === "" ? null : Number(rawI);
    const reminder = form.reminder_minutes.trim() === "" ? null : Number(form.reminder_minutes);

    const payload = {
      title: form.title,
      description: form.description,
      assigned_to_ids: assigned,
      status: form.status,
      priority: form.priority,
      ...(dueIso ? { due_date: dueIso } : {}),
      is_recurring: form.is_recurring,
      recurrence_type: form.recurrence_type || null,
      recurrence_days: form.recurrence_days,
      recurrence_interval: interval != null && Number.isFinite(interval) ? interval : null,
      recurrence_end_date: form.recurrence_end.trim() ? form.recurrence_end.trim() : null,
      reminder_minutes_before: reminder != null && Number.isFinite(reminder) ? reminder : null,
    };

    let res;
    if (editingId) {
      res = await updateVaTaskAction(editingId, payload);
    } else {
      res = await createVaTaskAction(payload);
    }
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setModalOpen(false);
    router.refresh();
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
    } catch {
      addToast(localToast(`vat-rm-${Date.now()}`, "Remind failed", "Network error.", "high"));
    } finally {
      setReminding(null);
    }
  }

  const assignedLabel = (t: VaTaskRecord) => {
    if (t.assigned_to_ids.length === 0) return "All VAs";
    return t.assigned_to_ids.map((id) => nameById[id] ?? id).join(", ");
  };

  const reminderChipActive = (min: number) => form.reminder_minutes === String(min);

  const toggleRecurrenceDayIndex = (i: number) => {
    const day = WEEKDAYS[i];
    setForm((f) => {
      const set = new Set(f.recurrence_days);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...f, recurrence_days: [...set] as VaRecurrenceDay[] };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-pink-400/60">Administration</p>
          <h1 className="mt-1 text-3xl font-bold text-white">VA tasks</h1>
          <p className="mt-1 text-sm text-white/40">Assign and manage tasks for your virtual assistants</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          New task
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: localTasks.length, color: "text-white" },
          { label: "Pending", value: localTasks.filter((t) => t.status === "pending").length, color: "text-amber-400" },
          {
            label: "In progress",
            value: localTasks.filter((t) => t.status === "in_progress").length,
            color: "text-sky-400",
          },
          { label: "Done", value: localTasks.filter((t) => t.status === "done").length, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">{s.label}</p>
            <p className={cn("mt-1 text-3xl font-bold tabular-nums", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
        <input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[10rem] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-500/50"
        />
        <CustomSelect
          value={filterVa}
          onChange={setFilterVa}
          options={vaOptionsForFilter}
          triggerClassName="h-11 min-w-[10rem] rounded-xl border border-white/10 bg-white/5 text-sm text-white"
          portaled
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-11 min-w-[9rem] rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-pink-500/50"
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
          className="h-11 min-w-[9rem] rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-pink-500/50"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/35">
            <ClipboardList className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-5 text-base font-semibold text-white/90">No tasks match</p>
          <p className="mt-2 max-w-sm text-sm text-white/50">Adjust search or filters, or create a new task.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "group relative rounded-2xl border p-5 pl-6 transition-all hover:bg-white/[0.04]",
                task.status === "done"
                  ? "border-emerald-500/15 opacity-70"
                  : task.priority === "urgent"
                    ? "border-red-500/25"
                    : task.priority === "high"
                      ? "border-amber-500/20"
                      : "border-white/8"
              )}
            >
              <div
                className={cn(
                  "absolute left-2 top-4 bottom-4 w-1 rounded-full",
                  task.priority === "urgent"
                    ? "bg-red-500"
                    : task.priority === "high"
                      ? "bg-amber-500"
                      : task.priority === "normal"
                        ? "bg-sky-500"
                        : "bg-white/25"
                )}
              />
              <div className="pl-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
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
                        "font-semibold text-white",
                        task.status === "done" && "text-white/50 line-through"
                      )}
                    >
                      {task.title}
                    </h3>
                    {task.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-white/40">{task.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    {task.status !== "done" && task.status !== "skipped" ? (
                      <button
                        type="button"
                        onClick={() => void handleRemind(task)}
                        disabled={reminding === task.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25 disabled:opacity-40"
                      >
                        <Bell className="h-3.5 w-3.5" aria-hidden />
                        {reminding === task.id ? "Sending…" : "Remind"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openEdit(task)}
                      className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={confirmingTaskDelete && taskPendingDelete?.id === task.id}
                      onClick={() => setTaskPendingDelete(task)}
                      className="rounded-lg p-1.5 text-white/40 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/30">
                  {task.due_date ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        isPastDue(task.due_date) && task.status !== "done" && "text-red-400"
                      )}
                    >
                      <Clock className="h-3 w-3 shrink-0" aria-hidden />
                      {formatDateTimeAthens(task.due_date)}
                      {isPastDue(task.due_date) && task.status !== "done" ? " · Overdue" : ""}
                    </span>
                  ) : null}
                  <span>{assignedLabel(task)}</span>
                  {task.reminder_minutes_before != null ? (
                    <span>{formatReminderLabel(task.reminder_minutes_before)}</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-[#0f0f1a] shadow-2xl">
            <form onSubmit={submit} className="flex max-h-[92vh] flex-col">
              <div className="flex items-start justify-between border-b border-white/10 p-6 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{editingId ? "Edit task" : "New task"}</h2>
                  <p className="mt-0.5 text-sm text-white/40">Configure assignment, schedule, and reminders</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl p-2 text-white/30 transition hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6 pr-4">
                {error ? <p className="text-sm text-red-400">{error}</p> : null}

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-pink-400/70">Assignment</p>
                  <label className="mb-1.5 block text-xs text-white/40">Assign to</label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.allVas}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        allVas: !f.allVas,
                        assigned_to_ids: !f.allVas ? [] : f.assigned_to_ids,
                      }))
                    }
                    className="mb-3 flex cursor-pointer items-center gap-3"
                  >
                    <span
                      className={cn(
                        "relative h-5 w-10 rounded-full transition-colors",
                        form.allVas ? "bg-pink-500" : "bg-white/20"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                          form.allVas ? "left-5" : "left-0.5"
                        )}
                      />
                    </span>
                    <span className="text-sm text-white/60">All VAs</span>
                  </button>
                  {!form.allVas ? (
                    <div className="flex flex-wrap gap-2">
                      {vaUsers.map((va) => {
                        const name = (va.full_name || va.email).trim() || va.id;
                        const initial = name.charAt(0).toUpperCase();
                        const on = form.assigned_to_ids.includes(va.id);
                        return (
                          <label
                            key={va.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 transition-all",
                              on
                                ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
                                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/[0.08]"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setForm((f) => {
                                  const set = new Set(f.assigned_to_ids);
                                  if (set.has(va.id)) set.delete(va.id);
                                  else set.add(va.id);
                                  return { ...f, assigned_to_ids: [...set] };
                                })
                              }
                              className="sr-only"
                            />
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-400">
                              {initial}
                            </span>
                            <span className="text-sm">{name}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="h-px bg-white/[0.08]" />

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-pink-400/70">Details</p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs text-white/40">Title *</label>
                      <input
                        required
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Task title…"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-pink-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-white/40">Description</label>
                      <textarea
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="What needs to be done?"
                        className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-pink-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs text-white/40">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VaTaskStatus }))}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-pink-500/50"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-white/40">Priority</label>
                        <select
                          value={form.priority}
                          onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as VaTaskPriority }))}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-pink-500/50"
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

                <div className="h-px bg-white/[0.08]" />

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-pink-400/70">Schedule</p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs text-white/40">Due date &amp; time</label>
                      <input
                        type="datetime-local"
                        value={form.due_local}
                        onChange={(e) => setForm((f) => ({ ...f, due_local: e.target.value }))}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-pink-500/50"
                      />
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.is_recurring}
                      onClick={() => setForm((f) => ({ ...f, is_recurring: !f.is_recurring }))}
                      className="flex cursor-pointer items-center gap-3"
                    >
                      <span
                        className={cn(
                          "relative h-5 w-10 rounded-full transition-colors",
                          form.is_recurring ? "bg-pink-500" : "bg-white/20"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                            form.is_recurring ? "left-5" : "left-0.5"
                          )}
                        />
                      </span>
                      <span className="text-sm text-white/60">Recurring task</span>
                    </button>
                    {form.is_recurring ? (
                      <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-xs text-white/40">Recurrence type</label>
                            <select
                              value={form.recurrence_type}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, recurrence_type: e.target.value as VaRecurrenceType | "" }))
                              }
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500/50"
                            >
                              <option value="">—</option>
                              {RECURRENCE_TYPES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs text-white/40">Repeat every</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={99}
                                value={form.recurrence_interval}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setForm((f) => {
                                    if (raw === "") return { ...f, recurrence_interval: "" };
                                    const n = Math.max(1, Math.min(99, Number(raw) || 1));
                                    return { ...f, recurrence_interval: String(n) };
                                  });
                                }}
                                className="w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm text-white outline-none focus:border-pink-500/50"
                              />
                              <span className="text-sm text-white/50">
                                {form.recurrence_type === "daily"
                                  ? recurrenceIntervalNum === 1
                                    ? "day"
                                    : "days"
                                  : form.recurrence_type === "weekly"
                                    ? recurrenceIntervalNum === 1
                                      ? "week"
                                      : "weeks"
                                    : form.recurrence_type === "monthly"
                                      ? recurrenceIntervalNum === 1
                                        ? "month"
                                        : "months"
                                      : form.recurrence_type === "custom"
                                        ? recurrenceIntervalNum === 1
                                          ? "time"
                                          : "times"
                                        : recurrenceIntervalNum === 1
                                          ? "day"
                                          : "days"}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs text-white/25">
                              {recurrenceIntervalNum === 1
                                ? `Repeats every ${
                                    form.recurrence_type === "daily"
                                      ? "day"
                                      : form.recurrence_type === "weekly"
                                        ? "week"
                                        : form.recurrence_type === "monthly"
                                          ? "month"
                                          : form.recurrence_type === "custom"
                                            ? "time"
                                            : "day"
                                  }`
                                : `Repeats every ${recurrenceIntervalNum} ${
                                    form.recurrence_type === "daily"
                                      ? "days"
                                      : form.recurrence_type === "weekly"
                                        ? "weeks"
                                        : form.recurrence_type === "monthly"
                                          ? "months"
                                          : form.recurrence_type === "custom"
                                            ? "times"
                                            : "days"
                                  }`}
                            </p>
                          </div>
                        </div>
                        {form.recurrence_type === "weekly" ? (
                          <div>
                            <label className="mb-2 block text-xs text-white/40">Days</label>
                            <div className="flex flex-wrap gap-1.5">
                              {WEEKDAY_SHORT.map((day, i) => {
                                const on = form.recurrence_days.includes(WEEKDAYS[i]);
                                return (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => toggleRecurrenceDayIndex(i)}
                                    className={cn(
                                      "h-10 w-10 rounded-xl border text-xs font-semibold transition-all",
                                      on
                                        ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
                                        : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10"
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
                          <label className="mb-1.5 block text-xs text-white/40">End date</label>
                          <input
                            type="date"
                            value={form.recurrence_end}
                            onChange={(e) => setForm((f) => ({ ...f, recurrence_end: e.target.value }))}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none [color-scheme:dark] focus:border-pink-500/50"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="h-px bg-white/[0.08]" />

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-pink-400/70">Reminder</p>
                  <label className="mb-1.5 block text-xs text-white/40">Minutes before due</label>
                  <div className="flex flex-wrap gap-2">
                    {REMINDER_CHIPS.map((min) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            reminder_minutes: reminderChipActive(min) ? "" : String(min),
                          }))
                        }
                        className={cn(
                          "rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                          reminderChipActive(min)
                            ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
                            : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                        )}
                      >
                        {min === 1440 ? "1 day" : min === 120 ? "2h" : min === 60 ? "1h" : `${min}m`}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      placeholder="Custom…"
                      value={
                        form.reminder_minutes &&
                        !REMINDER_CHIPS.some((m) => String(m) === form.reminder_minutes)
                          ? form.reminder_minutes
                          : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => ({ ...f, reminder_minutes: v === "" ? "" : String(Math.max(1, Number(v)) || 1) }));
                      }}
                      className="w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-pink-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-white/8 p-6 pt-4">
                <button
                  type="submit"
                  disabled={!form.title.trim() || saving}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 disabled:opacity-40"
                >
                  {saving ? "Saving…" : editingId ? "Update task" : "Create task"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/50 transition hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </form>
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
