"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, ListChecks, Plus, StickyNote, X } from "lucide-react";
import { formatDateTimeAthens } from "@/lib/format";
import { updateVaTaskStatusAction } from "@/app/actions/va-tasks";
import { selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { VaTaskRecord, VaTaskPriority, VaTaskStatus } from "@/types";
import type { PhaseItem, TaskPhase } from "@/services/task-phases";
import type { SocialAccount } from "@/services/marketing";
import { cn } from "@/lib/utils";

type Props = { tasks: VaTaskRecord[] };

function isPastDue(isoLike: string | null | undefined): boolean {
  if (!isoLike?.trim()) return false;
  const t = new Date(isoLike.trim()).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
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
          : "border border-sky-500/30 bg-sky-500/15 text-sky-200";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const fieldMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

const ACCOUNT_COLORS: Record<string, string> = {
  Instagram: "#E1306C",
  Facebook: "#1877F2",
  TikTok: "#000000",
  Twitter: "#1DA1F2",
  YouTube: "#FF0000",
  Snapchat: "#FFFC00",
};

const ACCOUNT_ICONS: Record<string, string> = {
  Instagram: "📸",
  Facebook: "👥",
  TikTok: "🎵",
  Twitter: "🐦",
  YouTube: "▶️",
  Snapchat: "👻",
};

export function VaTasksClient({ tasks: initialTasks }: Props) {
  const router = useRouter();
  const tasks = initialTasks;
  const [selected, setSelected] = React.useState<VaTaskRecord | null>(null);
  const [notes, setNotes] = React.useState("");
  const [statusPick, setStatusPick] = React.useState<VaTaskStatus>("done");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [completing, setCompleting] = React.useState<string | null>(null);

  const [expandedTaskId, setExpandedTaskId] = React.useState<string | null>(null);
  const [taskPhases, setTaskPhases] = React.useState<Record<string, TaskPhase[]>>({});
  const [modelAccounts, setModelAccounts] = React.useState<Record<string, SocialAccount[]>>({});
  const [loadingPhasesTaskId, setLoadingPhasesTaskId] = React.useState<string | null>(null);
  const [completingItem, setCompletingItem] = React.useState<PhaseItem | null>(null);
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = React.useState(false);
  const proofRef = React.useRef<HTMLInputElement>(null);

  const proofPreviewUrl = React.useMemo(() => (proofFile ? URL.createObjectURL(proofFile) : null), [proofFile]);
  React.useEffect(() => {
    return () => {
      if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    };
  }, [proofPreviewUrl]);

  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!completingItem) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (item) {
        const f = item.getAsFile();
        if (f) setProofFile(f);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [completingItem]);

  const [search, setSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");

  const filteredTasks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...tasks];
    if (q) {
      list = list.filter((t) => {
        const blob = `${t.title} ${t.description}`.toLowerCase();
        return blob.includes(q);
      });
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
  }, [tasks, search, filterStatus, filterPriority]);

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

  async function handleMarkComplete(task: VaTaskRecord, e?: React.MouseEvent) {
    e?.stopPropagation();
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
      if (selected?.id === task.id) setSelected(null);
      router.refresh();
    } finally {
      setCompleting(null);
    }
  }

  async function loadPhasesAndAccounts(task: VaTaskRecord, opts?: { force?: boolean }) {
    if (!opts?.force && taskPhases[task.id]) return;
    setLoadingPhasesTaskId(task.id);
    try {
      const res = await fetch(`/api/va/task-phases?task_id=${encodeURIComponent(task.id)}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { phases?: TaskPhase[]; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not load phases");
        return;
      }
      const phases = data.phases ?? [];
      setTaskPhases((prev) => ({ ...prev, [task.id]: phases }));
      const modelIds = [...new Set(phases.map((p) => p.assigned_model_id).filter(Boolean))];
      const entries = await Promise.all(
        modelIds.map(async (modelId) => {
          const accRes = await fetch(
            `/api/va/marketing/model-accounts?model_id=${encodeURIComponent(modelId)}`,
            { credentials: "include" },
          );
          const accData = (await accRes.json().catch(() => ({}))) as { accounts?: SocialAccount[] };
          return [modelId, accRes.ok ? accData.accounts ?? [] : []] as const;
        }),
      );
      setModelAccounts((prev) => {
        const next = { ...prev };
        for (const [mid, accs] of entries) next[mid] = accs;
        return next;
      });
    } finally {
      setLoadingPhasesTaskId(null);
    }
  }

  async function handleCompleteItem() {
    if (!completingItem) return;
    if (completingItem.requires_screenshot && !proofFile) return;
    const taskId = completingItem.task_id;
    setSubmittingProof(true);
    setErr(null);
    try {
      const fd = new FormData();
      if (proofFile) fd.append("screenshot", proofFile);
      const res = await fetch(`/api/va/phase-items/${encodeURIComponent(completingItem.id)}/complete`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; allPhasesCompleted?: boolean };
      if (!res.ok) {
        setErr(data.error ?? "Could not complete item");
        return;
      }
      const task = tasks.find((t) => t.id === taskId);
      if (task) await loadPhasesAndAccounts(task, { force: true });
      setCompletingItem(null);
      setProofFile(null);
      if (data.allPhasesCompleted) router.refresh();
    } finally {
      setSubmittingProof(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-purple-400/60">My work</p>
        <h1 className="mt-1 text-3xl font-bold text-white">VA tasks</h1>
        <p className="mt-1 text-sm text-white/40">Your assigned tasks and to-dos</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[10rem] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-purple-500/50"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-11 min-w-[9rem] rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-purple-500/50"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
          <option value="skipped">Skipped</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="h-11 min-w-[9rem] rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-purple-500/50"
        >
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      {err && !selected ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
          {err}
        </div>
      ) : null}

      {filteredTasks.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-10 text-center text-sm text-white/50">
          No tasks match your filters.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "relative rounded-2xl border p-5 transition-all",
                task.status === "done"
                  ? "border-emerald-500/15 opacity-60"
                  : task.priority === "urgent"
                    ? "border-red-500/25 bg-red-500/[0.02]"
                    : task.priority === "high"
                      ? "border-amber-500/20"
                      : "border-white/8",
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => openTask(task)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openTask(task);
                  }
                }}
                className="cursor-pointer rounded-xl outline-none ring-offset-2 ring-offset-zinc-950 focus-visible:ring-2 focus-visible:ring-purple-500/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                      {task.is_recurring ? (
                        <span className="inline-flex items-center rounded-full border border-purple-500/25 bg-purple-500/15 px-2 py-0.5 text-xs text-purple-400">
                          🔄{" "}
                          {task.recurrence_interval != null && task.recurrence_interval > 1
                            ? `Every ${task.recurrence_interval} ${
                                task.recurrence_type === "daily"
                                  ? "days"
                                  : task.recurrence_type === "weekly"
                                    ? "weeks"
                                    : task.recurrence_type === "monthly"
                                      ? "months"
                                      : "times"
                              }`
                            : task.recurrence_type || "recurring"}
                        </span>
                      ) : null}
                    </div>
                    <h3
                      className={cn(
                        "font-semibold",
                        task.status === "done" ? "text-white/40 line-through" : "text-white",
                      )}
                    >
                      {task.title}
                    </h3>
                    {task.description ? <p className="mt-1 text-sm text-white/40">{task.description}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/30">
                      {task.due_date ? (
                        <span className={isPastDue(task.due_date) && task.status !== "done" ? "text-red-400" : ""}>
                          {formatDateTimeAthens(task.due_date)}
                          {isPastDue(task.due_date) && task.status !== "done" ? " · Overdue" : ""}
                        </span>
                      ) : (
                        <span>No due date</span>
                      )}
                    </div>
                  </div>
                  {task.status !== "done" && task.status !== "skipped" ? (
                    <button
                      type="button"
                      onClick={(e) => void handleMarkComplete(task, e)}
                      disabled={completing === task.id}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" aria-hidden />
                      {completing === task.id ? "Saving…" : "Done"}
                    </button>
                  ) : (
                    <div className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Completed
                    </div>
                  )}
                </div>
              </div>

              <div
                className="mt-3 border-t border-white/10 pt-3"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={async () => {
                    if (expandedTaskId === task.id) {
                      setExpandedTaskId(null);
                      return;
                    }
                    setExpandedTaskId(task.id);
                    await loadPhasesAndAccounts(task);
                  }}
                  className="flex items-center gap-2 text-xs text-white/30 transition-colors hover:text-white/60"
                >
                  <span aria-hidden>{expandedTaskId === task.id ? "▼" : "▶"}</span>
                  Phases · links
                  {taskPhases[task.id]?.length ? ` (${taskPhases[task.id].length})` : ""}
                  {loadingPhasesTaskId === task.id ? <span className="animate-pulse">loading…</span> : null}
                </button>

                {expandedTaskId === task.id ? (
                  <div className="mt-4">
                    {(() => {
                      const seen = new Set<string>();
                      return (taskPhases[task.id] ?? []).map((phase) => {
                        const mid = phase.assigned_model_id?.trim();
                        if (!mid || seen.has(mid)) return null;
                        seen.add(mid);
                        const accs = modelAccounts[mid] ?? [];
                        if (!accs.length) return null;
                        return (
                          <div key={`${task.id}-accs-${mid}`} className="mb-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/25">
                              {phase.assigned_model_name || "Model"} · Social accounts
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {accs.map((acc) => {
                                const color = ACCOUNT_COLORS[acc.platform] ?? "#888888";
                                const icon = ACCOUNT_ICONS[acc.platform] ?? "📱";
                                return (
                                  <a
                                    key={acc.id}
                                    href={acc.account_link || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    style={{
                                      backgroundColor: `${color}15`,
                                      borderColor: `${color}40`,
                                    }}
                                  >
                                    <span className="text-xl">{icon}</span>
                                    <div>
                                      <p className="text-xs font-bold leading-tight text-white">@{acc.username}</p>
                                      <p className="text-xs leading-tight" style={{ color: `${color}bb` }}>
                                        {acc.account_type === "main" ? "Main" : "Secondary"} ·
                                        {acc.region === "Greek" ? " GR" : acc.region === "USA" ? " US" : " Global"}
                                      </p>
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {(taskPhases[task.id] ?? []).length === 0 && !loadingPhasesTaskId ? (
                      <p className="py-4 text-center text-sm text-white/20">No phases for this task</p>
                    ) : null}

                    {(taskPhases[task.id] ?? []).map((phase, phaseIndex) => {
                      const doneCount = phase.items.filter((i) => i.status === "completed").length;
                      const total = phase.items.length;
                      const progress = total > 0 ? (doneCount / total) * 100 : 0;
                      return (
                        <div
                          key={phase.id}
                          className={cn(
                            "mb-4 overflow-hidden rounded-2xl border",
                            phase.status === "completed"
                              ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                              : phase.status === "overdue"
                                ? "border-red-500/20 bg-red-500/[0.03]"
                                : phase.status === "in_progress"
                                  ? "border-sky-500/20 bg-sky-500/[0.03]"
                                  : "border-white/10 bg-white/[0.02]",
                          )}
                        >
                          <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                                phase.status === "completed"
                                  ? "bg-emerald-500 text-white"
                                  : phase.status === "overdue"
                                    ? "bg-red-500 text-white"
                                    : phase.status === "in_progress"
                                      ? "bg-sky-500/80 text-white"
                                      : "bg-white/10 text-white/50",
                              )}
                            >
                              {phaseIndex + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white">
                                {phase.title || `Phase ${phaseIndex + 1}`}
                              </p>
                              {phase.scheduled_time ? (
                                <p className="text-xs text-white/30">
                                  Due:{" "}
                                  {new Date(phase.scheduled_time).toLocaleString("el-GR", {
                                    timeZone: "Europe/Athens",
                                  })}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs text-white/30">
                                {doneCount}/{total}
                              </p>
                              <div className="mt-1 h-1.5 w-16 rounded-full bg-white/10">
                                <div
                                  className={cn(
                                    "h-1.5 rounded-full transition-all",
                                    phase.status === "completed"
                                      ? "bg-emerald-500"
                                      : phase.status === "overdue"
                                        ? "bg-red-500"
                                        : "bg-sky-500",
                                  )}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {(phase.region || phase.assigned_model_name) ? (
                            <div className="flex flex-wrap gap-2 border-b border-white/[0.05] px-4 py-2">
                              {phase.region ? (
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-xs",
                                    phase.region === "Greek"
                                      ? "border-sky-500/20 bg-sky-500/10 text-sky-400"
                                      : phase.region === "USA"
                                        ? "border-red-500/20 bg-red-500/10 text-red-400"
                                        : "border-purple-500/20 bg-purple-500/10 text-purple-400",
                                  )}
                                >
                                  {phase.region}
                                </span>
                              ) : null}
                              {phase.assigned_model_name ? (
                                <span className="rounded-full border border-pink-500/20 bg-pink-500/10 px-2 py-0.5 text-xs text-pink-400">
                                  {phase.assigned_model_name}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="space-y-3 px-4 py-3">
                            {phase.items.map((item) => (
                              <div key={item.id} className="flex items-start gap-3">
                                <button
                                  type="button"
                                  onClick={() => item.status !== "completed" && phase.status !== "overdue" && setCompletingItem(item)}
                                  disabled={item.status === "completed" || phase.status === "overdue"}
                                  className={cn(
                                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                                    item.status === "completed"
                                      ? "cursor-default border-emerald-500 bg-emerald-500"
                                      : phase.status === "overdue"
                                        ? "cursor-not-allowed border-white/15 bg-white/5 opacity-40"
                                        : "cursor-pointer border-white/25 bg-white/5 hover:border-pink-500/60 hover:bg-pink-500/10",
                                  )}
                                >
                                  {item.status === "completed" ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={cn(
                                      "text-sm",
                                      item.status === "completed" ? "text-white/30 line-through" : "text-white",
                                    )}
                                  >
                                    {item.title || "—"}
                                  </p>
                                  {item.requires_screenshot && item.status !== "completed" ? (
                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-400/70">
                                      Screenshot required
                                    </p>
                                  ) : null}
                                  {item.screenshot?.[0]?.url ? (
                                    <a
                                      href={item.screenshot[0].url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                                    >
                                      View proof
                                    </a>
                                  ) : null}
                                  {item.status === "completed" && item.completed_by_va_name ? (
                                    <p className="mt-0.5 text-xs text-white/25">✓ {item.completed_by_va_name}</p>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                            {phase.items.length === 0 ? (
                              <p className="text-xs text-white/20">No items in this phase</p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
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

      {completingItem ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <h3 className="text-lg font-bold text-white">Complete item</h3>
            <p className="mt-1 text-sm text-white/50">{completingItem.title || "Checklist item"}</p>

            {completingItem.requires_screenshot ? (
              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-amber-400">
                  Screenshot proof required
                </p>
                <button
                  type="button"
                  onClick={() => proofRef.current?.click()}
                  className={cn(
                    "w-full cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                    proofFile ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50",
                  )}
                >
                  {proofPreviewUrl ? (
                    <Image
                      src={proofPreviewUrl}
                      alt=""
                      width={320}
                      height={128}
                      unoptimized
                      className="mx-auto max-h-32 rounded-xl object-contain"
                    />
                  ) : (
                    <>
                      <p className="mb-2 text-3xl" aria-hidden>
                        📷
                      </p>
                      <p className="text-sm font-medium text-amber-400/80">Paste (Ctrl+V) or click to upload</p>
                      <p className="mt-1 text-xs text-white/25">Paste works while this dialog is open</p>
                    </>
                  )}
                  <input
                    ref={proofRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  />
                </button>
              </div>
            ) : null}

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => void handleCompleteItem()}
                disabled={
                  submittingProof || (completingItem.requires_screenshot && !proofFile)
                }
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40"
              >
                {submittingProof ? "Saving…" : "Mark complete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompletingItem(null);
                  setProofFile(null);
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/50 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
            {err && completingItem ? (
              <p className="mt-3 text-sm text-rose-300" role="alert">
                {err}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
