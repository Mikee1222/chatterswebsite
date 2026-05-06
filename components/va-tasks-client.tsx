"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ListChecks, StickyNote, X } from "lucide-react";
import { formatDateEuropean } from "@/lib/format";
import { updateVaTaskStatusAction } from "@/app/actions/va-tasks";
import { selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
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

const fieldMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

export function VaTasksClient({ tasks: initialTasks }: Props) {
  const router = useRouter();
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
    router.refresh();
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-white">{selected.title}</h3>
                {selected.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-white/55">{selected.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
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
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
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
                    <option value="in_progress" className={selectOptionClass}>
                      In progress
                    </option>
                    <option value="done" className={selectOptionClass}>
                      Done
                    </option>
                    <option value="skipped" className={selectOptionClass}>
                      Skipped
                    </option>
                    <option value="pending" className={selectOptionClass}>
                      Pending
                    </option>
                  </FormSelect>
                </FormField>
              </motion.div>

              <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.05 }}>
                <FormField
                  label="Completion notes"
                  icon={<StickyNote />}
                  htmlFor="va-task-notes"
                  description="Optional — visible to admins on this task."
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
                  className="order-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 sm:order-1"
                >
                  Cancel
                </button>
                <FormSubmitButton disabled={busy} loading={busy} className="order-1 sm:order-2 sm:min-w-[140px]">
                  Save update
                </FormSubmitButton>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
