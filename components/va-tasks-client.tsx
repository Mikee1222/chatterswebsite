"use client";

import * as React from "react";
import { formatDateEuropean } from "@/lib/format";
import { updateVaTaskStatusAction } from "@/app/actions/va-tasks";
import type { VaTaskRecord, VaTaskPriority, VaTaskStatus } from "@/types";

type Props = { tasks: VaTaskRecord[] };

function toLocalYmd(isoLike: string | null): string {
  if (!isoLike?.trim()) return "";
  const d = new Date(isoLike.trim());
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayYmd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function priorityClasses(p: VaTaskPriority): string {
  if (p === "urgent") return "border-l-4 border-l-red-500 bg-red-500/10";
  if (p === "high") return "border-l-4 border-l-orange-400 bg-orange-500/10";
  if (p === "low") return "border-l-4 border-l-white/20 bg-white/[0.03]";
  return "border-l-4 border-l-emerald-500/40 bg-white/[0.04]";
}

export function VaTasksClient({ tasks: initialTasks }: Props) {
  const [tasks] = React.useState(initialTasks);
  const [selected, setSelected] = React.useState<VaTaskRecord | null>(null);
  const [notes, setNotes] = React.useState("");
  const [statusPick, setStatusPick] = React.useState<VaTaskStatus>("done");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const today = todayYmd();

  const grouped = React.useMemo(() => {
    const m = new Map<string, VaTaskRecord[]>();
    for (const t of tasks) {
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
  }, [tasks]);

  const openTask = (t: VaTaskRecord) => {
    setSelected(t);
    setNotes(t.completed_notes ?? "");
    setStatusPick(t.status === "in_progress" ? "in_progress" : "done");
    setErr(null);
  };

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
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      {grouped.map(({ dateKey, list }) => {
        const isToday = dateKey === today;
        return (
          <section key={dateKey}>
            <h2
              className={`mb-3 text-lg font-semibold ${
                isToday ? "text-[hsl(330,90%,72%)]" : "text-white"
              }`}
            >
              {dateKey === "__none__" ? "No due date" : formatDateEuropean(dateKey)}
              {isToday ? " · Today" : ""}
            </h2>
            <ul className="space-y-2">
              {list.map((t) => {
                const rowToday = t.due_date && toLocalYmd(t.due_date) === today;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openTask(t)}
                      className={`w-full rounded-xl border border-white/10 px-4 py-3 text-left text-sm transition hover:bg-white/[0.06] ${priorityClasses(t.priority)} ${
                        rowToday ? "ring-1 ring-[hsl(330,80%,55%)]/50" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{t.title}</span>
                        {t.is_recurring ? (
                          <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-200">
                            Recurring
                          </span>
                        ) : null}
                        <span className="ml-auto text-xs capitalize text-white/50">{t.priority}</span>
                      </div>
                      {t.description ? <p className="mt-1 text-white/55">{t.description}</p> : null}
                      <p className="mt-2 text-xs text-white/40">{t.status}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">{selected.title}</h3>
            {selected.description ? <p className="mt-2 text-sm text-white/60">{selected.description}</p> : null}
            {err ? <p className="mt-3 text-sm text-red-400">{err}</p> : null}
            <label className="mt-4 block text-sm text-white/70">
              Status
              <select
                value={statusPick}
                onChange={(e) => setStatusPick(e.target.value as VaTaskStatus)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-white"
              >
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="skipped">Skipped</option>
                <option value="pending">Pending</option>
              </select>
            </label>
            <label className="mt-3 block text-sm text-white/70">
              Notes
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-white"
                placeholder="Completion notes…"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="rounded-lg bg-[hsl(330,80%,45%)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
