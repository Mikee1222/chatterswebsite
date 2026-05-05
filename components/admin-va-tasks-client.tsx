"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDateEuropean } from "@/lib/format";
import { createVaTaskAction, updateVaTaskAction } from "@/app/actions/va-tasks";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification, VaTaskRecord, VaTaskStatus, VaTaskPriority, VaRecurrenceType, VaRecurrenceDay } from "@/types";
import { CustomSelect } from "@/components/ui/custom-select";

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

const STATUS_FORM_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }));
const PRIORITY_FORM_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: p }));
const RECURRENCE_FORM_OPTIONS = [
  { value: "", label: "—" },
  ...RECURRENCE_TYPES.map((r) => ({ value: r, label: r })),
];

type VaUserOption = { id: string; full_name: string; email: string };

type Props = {
  tasks: VaTaskRecord[];
  vaUsers: VaUserOption[];
};

const inputClass =
  "mt-2 block h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-colors focus:border-pink-500 focus:ring-0";
const textareaClass =
  "mt-2 block min-h-[100px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none transition-colors focus:border-pink-500 focus:ring-0";
const labelClass = "block text-sm font-medium text-white/70";

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
          {title}
        </span>
        <span
          className="h-px min-w-[2rem] flex-1 bg-gradient-to-r from-white/20 via-white/10 to-transparent"
          aria-hidden
        />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

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

  React.useEffect(() => setLocalTasks(tasks), [tasks]);

  const nameById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of vaUsers) {
      m[u.id] = (u.full_name || u.email || u.id).trim();
    }
    return m;
  }, [vaUsers]);

  const filterVaOptions = React.useMemo(
    () => [
      { value: "", label: "All" },
      ...vaUsers.map((u) => ({ value: u.id, label: u.full_name || u.email })),
    ],
    [vaUsers]
  );
  const filterStatusOptions = React.useMemo(
    () => [{ value: "", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: s }))],
    []
  );

  const [filterVa, setFilterVa] = React.useState<string>("");
  const [filterStatus, setFilterStatus] = React.useState<string>("");
  const [filterFrom, setFilterFrom] = React.useState("");
  const [filterTo, setFilterTo] = React.useState("");

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

  const filtered = React.useMemo(() => {
    return localTasks.filter((t) => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterVa) {
        if (t.assigned_to_ids.length === 0) return true;
        if (!t.assigned_to_ids.includes(filterVa)) return false;
      }
      const ymd = t.due_date ? toLocalYmd(t.due_date) : "";
      if (filterFrom && (!ymd || ymd < filterFrom)) return false;
      if (filterTo && (!ymd || ymd > filterTo)) return false;
      return true;
    });
  }, [localTasks, filterVa, filterStatus, filterFrom, filterTo]);

  const grouped = React.useMemo(() => {
    const m = new Map<string, VaTaskRecord[]>();
    for (const t of filtered) {
      const key = t.due_date ? toLocalYmd(t.due_date) : "__none__";
      const list = m.get(key) ?? [];
      list.push(t);
      m.set(key, list);
    }
    const keys = [...m.keys()].sort((a, b) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return a.localeCompare(b);
    });
    return keys.map((k) => ({ dateKey: k, list: m.get(k)! }));
  }, [filtered]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const assigned = form.allVas ? [] : form.assigned_to_ids;
    const dueIso = form.due_local ? fromDatetimeLocal(form.due_local) : undefined;
    const rawI = form.recurrence_interval.trim();
    const interval = rawI === "" ? null : Number(rawI);
    const reminder =
      form.reminder_minutes.trim() === "" ? null : Number(form.reminder_minutes);

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
    window.location.reload();
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

  const assignedLabel = (t: VaTaskRecord) => {
    if (t.assigned_to_ids.length === 0) return "All VAs";
    return t.assigned_to_ids.map((id) => nameById[id] ?? id).join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl border border-[hsl(330,80%,55%)]/50 bg-[hsl(330,80%,55%)]/20 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/30"
        >
          New task
        </button>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
        <label className="flex flex-col gap-1 text-white/70">
          <span>VA</span>
          <CustomSelect value={filterVa} onChange={setFilterVa} options={filterVaOptions} />
        </label>
        <label className="flex flex-col gap-1 text-white/70">
          <span>Status</span>
          <CustomSelect value={filterStatus} onChange={setFilterStatus} options={filterStatusOptions} />
        </label>
        <label className="flex flex-col gap-1 text-white/70">
          <span>From date</span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-white/70">
          <span>To date</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-white"
          />
        </label>
      </div>

      <div className="space-y-8">
        {grouped.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50">No tasks match filters.</p>
        ) : (
          grouped.map(({ dateKey, list }) => (
            <section key={dateKey}>
              <h2 className="mb-3 text-lg font-semibold text-white">
                {dateKey === "__none__" ? "No due date" : formatDateEuropean(dateKey)}
              </h2>
              <ul className="space-y-2">
                {list.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{t.title}</p>
                      {t.description ? <p className="mt-1 text-white/55">{t.description}</p> : null}
                      <p className="mt-2 text-xs text-white/45">
                        Assigned: {assignedLabel(t)} · {t.priority} · {t.status}
                        {t.is_recurring ? " · recurring" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-[hsl(330,90%,70%)] hover:bg-white/5"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={confirmingTaskDelete && taskPendingDelete?.id === t.id}
                        onClick={() => setTaskPendingDelete(t)}
                        className="rounded-lg border border-red-500/30 p-2 text-red-300/90 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
                        title="Delete task"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/95 p-8 shadow-[0_0_60px_-12px_rgba(236,72,153,0.25)]">
            <h3 className="text-xl font-semibold tracking-tight text-white">
              {editingId ? "Edit task" : "New task"}
            </h3>
            <p className="mt-1 text-sm text-white/45">Configure assignment, schedule, and reminders.</p>
            <form onSubmit={submit} className="mt-8 space-y-10">
              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <FormSection title="Assignment">
                <label className={`${labelClass} flex cursor-pointer items-center gap-3`}>
                  <input
                    type="checkbox"
                    checked={form.allVas}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        allVas: e.target.checked,
                        assigned_to_ids: e.target.checked ? [] : f.assigned_to_ids,
                      }))
                    }
                    className="h-5 w-5 shrink-0 rounded border-white/25 bg-white/5 text-pink-500 accent-pink-500 focus:ring-pink-500/40"
                  />
                  <span className="text-white/85">All VAs (no specific assignees)</span>
                </label>
                {!form.allVas ? (
                  <fieldset>
                    <legend className={labelClass}>Assign to</legend>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      {vaUsers.map((u) => (
                        <label key={u.id} className="flex cursor-pointer items-center gap-3 py-1">
                          <input
                            type="checkbox"
                            checked={form.assigned_to_ids.includes(u.id)}
                            onChange={(e) => {
                              setForm((f) => {
                                const set = new Set(f.assigned_to_ids);
                                if (e.target.checked) set.add(u.id);
                                else set.delete(u.id);
                                return { ...f, assigned_to_ids: [...set] };
                              });
                            }}
                            className="h-5 w-5 shrink-0 rounded border-white/25 bg-white/5 text-pink-500 accent-pink-500 focus:ring-pink-500/40"
                          />
                          <span className="text-sm text-white/85">{u.full_name || u.email}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
              </FormSection>

              <FormSection title="Details">
                <label className={labelClass}>
                  Title *
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className={inputClass}
                    placeholder="Task title"
                  />
                </label>
                <label className={labelClass}>
                  Description
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className={textareaClass}
                    placeholder="Optional details…"
                  />
                </label>
              </FormSection>

              <FormSection title="Schedule">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Status
                    <CustomSelect
                      value={form.status}
                      onChange={(v) => setForm((f) => ({ ...f, status: v as VaTaskStatus }))}
                      options={STATUS_FORM_OPTIONS}
                      className="mt-2"
                    />
                  </label>
                  <label className={labelClass}>
                    Priority
                    <CustomSelect
                      value={form.priority}
                      onChange={(v) => setForm((f) => ({ ...f, priority: v as VaTaskPriority }))}
                      options={PRIORITY_FORM_OPTIONS}
                      className="mt-2"
                    />
                  </label>
                </div>
                <label className={labelClass}>
                  Due date &amp; time
                  <input
                    type="datetime-local"
                    value={form.due_local}
                    onChange={(e) => setForm((f) => ({ ...f, due_local: e.target.value }))}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </label>
              </FormSection>

              <FormSection title="Recurrence">
                <label className={`${labelClass} flex cursor-pointer items-center gap-3`}>
                  <input
                    type="checkbox"
                    checked={form.is_recurring}
                    onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                    className="h-5 w-5 shrink-0 rounded border-white/25 bg-white/5 text-pink-500 accent-pink-500 focus:ring-pink-500/40"
                  />
                  <span className="text-white/85">Recurring task</span>
                </label>
                {form.is_recurring ? (
                  <div className="space-y-4">
                    <label className={labelClass}>
                      Recurrence type
                      <CustomSelect
                        value={form.recurrence_type}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, recurrence_type: v as VaRecurrenceType | "" }))
                        }
                        options={RECURRENCE_FORM_OPTIONS}
                        className="mt-2"
                      />
                    </label>
                    <div>
                      <span className={labelClass}>Recurrence days</span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {WEEKDAYS.map((d) => {
                          const on = form.recurrence_days.includes(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                setForm((f) => {
                                  const set = new Set(f.recurrence_days);
                                  if (set.has(d)) set.delete(d);
                                  else set.add(d);
                                  return { ...f, recurrence_days: [...set] as VaRecurrenceDay[] };
                                });
                              }}
                              className={`rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
                                on
                                  ? "bg-pink-500/35 text-pink-100 ring-1 ring-pink-400/50"
                                  : "border border-white/10 bg-white/5 text-white/65 hover:border-white/20 hover:bg-white/[0.08]"
                              }`}
                            >
                              {d.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className={labelClass}>
                      Recurrence interval
                      <input
                        type="number"
                        min={1}
                        value={form.recurrence_interval}
                        onChange={(e) => setForm((f) => ({ ...f, recurrence_interval: e.target.value }))}
                        className={inputClass}
                        placeholder="1"
                      />
                    </label>
                    <label className={labelClass}>
                      Recurrence end date
                      <input
                        type="date"
                        value={form.recurrence_end}
                        onChange={(e) => setForm((f) => ({ ...f, recurrence_end: e.target.value }))}
                        className={`${inputClass} [color-scheme:dark]`}
                      />
                    </label>
                  </div>
                ) : null}
              </FormSection>

              <FormSection title="Reminder">
                <label className={labelClass}>
                  Minutes before due
                  <input
                    type="number"
                    min={0}
                    value={form.reminder_minutes}
                    onChange={(e) => setForm((f) => ({ ...f, reminder_minutes: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. 15"
                  />
                </label>
              </FormSection>

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[hsl(330,72%,48%)] to-[hsl(330,82%,40%)] text-sm font-semibold text-white shadow-lg shadow-pink-950/30 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create task"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex h-12 w-full items-center justify-center rounded-xl border border-white/20 bg-transparent text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.06]"
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
