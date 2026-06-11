"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  ImageIcon,
  ListChecks,
  Camera,
  Play,
  Smartphone,
  StickyNote,
  X,
} from "lucide-react";
import { formatDateEuropean } from "@/lib/format";
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
import { groupRecurringTasks } from "@/lib/recurring-utils";

type Props = { tasks: VaTaskRecord[] };

type ActiveShift = { id: string; start_time: string; status: string };

function isPastDue(isoLike: string | null | undefined): boolean {
  if (!isoLike?.trim()) return false;
  const t = new Date(isoLike.trim()).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

function formatShiftElapsed(startTime: string): string {
  const ms = Math.max(0, Date.now() - new Date(startTime).getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function timeAgoShort(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso.trim()).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const t = new Date(iso.trim()).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

function regionFlag(region: string): string {
  if (region === "Greek") return "🇬🇷";
  if (region === "USA") return "🇺🇸";
  if (region === "Global") return "🌍";
  return "";
}

function PriorityBadge({ priority }: { priority: VaTaskPriority }) {
  const k = (priority || "normal").toLowerCase();
  const variant =
    k === "urgent"
      ? "border-red-500/30 bg-red-500/20 text-red-300"
      : k === "high"
        ? "border-amber-500/30 bg-amber-500/20 text-amber-300"
        : "border-white/15 bg-white/10 text-white/65";
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {priority}
    </span>
  );
}

function TaskStatusBadge({ status }: { status: VaTaskStatus }) {
  const k = (status || "").toLowerCase();
  const variant =
    k === "pending"
      ? "border-white/20 bg-white/10 text-white/60"
      : k === "done"
        ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
        : k === "skipped"
          ? "border-red-500/30 bg-red-500/20 text-red-300"
          : "border-sky-500/30 bg-sky-500/15 text-sky-200";
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function PhaseStatusBadge({ status }: { status: TaskPhase["status"] }) {
  const variant =
    status === "completed"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
      : status === "overdue"
        ? "border-red-500/30 bg-red-500/15 text-red-300"
        : status === "in_progress"
          ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
          : "border-white/15 bg-white/10 text-white/50";
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", variant)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const fieldMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

const SOCIAL_COLORS: Record<string, string> = {
  Instagram: "#E1306C",
  Facebook: "#1877F2",
  TikTok: "#000000",
  Twitter: "#1DA1F2",
  YouTube: "#FF0000",
  Snapchat: "#FFFC00",
  Telegram: "#229ED9",
  GetMyLinks: "#9333EA",
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

  const [search, setSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");

  const [expandedTaskId, setExpandedTaskId] = React.useState<string | null>(null);
  const [taskPhases, setTaskPhases] = React.useState<Record<string, TaskPhase[]>>({});
  const [modelAccounts, setModelAccounts] = React.useState<Record<string, SocialAccount[]>>({});
  const [completingItem, setCompletingItem] = React.useState<{ item: PhaseItem; taskId: string } | null>(null);
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const proofRef = React.useRef<HTMLInputElement>(null);
  const proofPreviewUrl = React.useMemo(
    () => (proofFile ? URL.createObjectURL(proofFile) : null),
    [proofFile],
  );
  React.useEffect(() => {
    return () => {
      if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    };
  }, [proofPreviewUrl]);

  const [shadowbanReportTarget, setShadowbanReportTarget] = React.useState<SocialAccount | null>(null);
  const [shadowbanFile, setShadowbanFile] = React.useState<File | null>(null);
  const [shadowbanNotes, setShadowbanNotes] = React.useState("");
  const [shadowbanSubmitting, setShadowbanSubmitting] = React.useState(false);
  const shadowbanProofRef = React.useRef<HTMLInputElement>(null);
  const shadowbanPreviewUrl = React.useMemo(
    () => (shadowbanFile ? URL.createObjectURL(shadowbanFile) : null),
    [shadowbanFile],
  );
  React.useEffect(() => {
    return () => {
      if (shadowbanPreviewUrl) URL.revokeObjectURL(shadowbanPreviewUrl);
    };
  }, [shadowbanPreviewUrl]);

  const [activeShift, setActiveShift] = React.useState<ActiveShift | null>(null);
  const [shiftLoading, setShiftLoading] = React.useState(true);
  const [shiftBusy, setShiftBusy] = React.useState(false);
  const [shiftDuration, setShiftDuration] = React.useState("0s");

  const fetchActiveShift = React.useCallback(async () => {
    try {
      const res = await fetch("/api/va/task-shift/active", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { shift?: ActiveShift | null };
      if (res.ok) setActiveShift(data.shift ?? null);
    } finally {
      setShiftLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchActiveShift();
  }, [fetchActiveShift]);

  React.useEffect(() => {
    if (!activeShift?.start_time) {
      setShiftDuration("0s");
      return;
    }
    const tick = () => setShiftDuration(formatShiftElapsed(activeShift.start_time));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeShift?.start_time]);

  async function handleStartShift() {
    setShiftBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/va/task-shift/start", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error?.trim() || "Could not start shift");
        return;
      }
      await fetchActiveShift();
    } finally {
      setShiftBusy(false);
    }
  }

  async function handleEndShift() {
    setShiftBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/va/task-shift/end", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error?.trim() || "Could not end shift");
        return;
      }
      setActiveShift(null);
    } finally {
      setShiftBusy(false);
    }
  }

  const onShift = !!activeShift;

  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const found = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!found) return;
      const f = found.getAsFile();
      if (!f) return;
      if (completingItem) setProofFile(f);
      else if (shadowbanReportTarget) setShadowbanFile(f);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [completingItem, shadowbanReportTarget]);

  const taskStats = React.useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let done = 0;
    let overdue = 0;
    for (const t of tasks) {
      if (t.status === "pending") pending++;
      else if (t.status === "in_progress") inProgress++;
      else if (t.status === "done") done++;
      if (isPastDue(t.due_date) && t.status !== "done" && t.status !== "skipped") overdue++;
    }
    return { pending, inProgress, done, overdue };
  }, [tasks]);

  const filteredTasks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...tasks];
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
  }, [tasks, search, filterStatus, filterPriority]);

  const { regularTasks, recurringGroups } = React.useMemo(
    () => groupRecurringTasks(filteredTasks),
    [filteredTasks],
  );

  const [expandedVaRecurringHistory, setExpandedVaRecurringHistory] = React.useState(() => new Set<string>());

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

  async function reloadPhasesForTask(taskId: string) {
    const res = await fetch(`/api/va/task-phases?task_id=${encodeURIComponent(taskId)}`, { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as { phases?: TaskPhase[] };
    if (res.ok) {
      setTaskPhases((prev) => ({ ...prev, [taskId]: data.phases ?? [] }));
    }
  }

  async function loadPhasesAndAccounts(task: VaTaskRecord) {
    if (taskPhases[task.id]) return;
    const res = await fetch(`/api/va/task-phases?task_id=${encodeURIComponent(task.id)}`, { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as { phases?: TaskPhase[] };
    const phases: TaskPhase[] = data.phases ?? [];
    setTaskPhases((prev) => ({ ...prev, [task.id]: phases }));

    const modelIds = [...new Set(phases.map((p) => p.assigned_model_id).filter(Boolean))] as string[];
    for (const modelId of modelIds) {
      const accRes = await fetch(`/api/va/marketing/accounts?model_id=${encodeURIComponent(modelId)}`, {
        credentials: "include",
      });
      const accData = (await accRes.json().catch(() => ({}))) as { accounts?: SocialAccount[] };
      if (accRes.ok) {
        setModelAccounts((prev) => (prev[modelId] ? prev : { ...prev, [modelId]: accData.accounts ?? [] }));
      }
    }
  }

  async function handleCompleteItem() {
    if (!completingItem) return;
    const { item, taskId } = completingItem;
    if (item.requires_screenshot && !proofFile) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (proofFile) fd.append("screenshot", proofFile);
      const res = await fetch(`/api/va/phase-items/${encodeURIComponent(item.id)}/complete`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const payload = (await res.json().catch(() => ({}))) as { allPhasesCompleted?: boolean; error?: string };
      if (!res.ok) {
        setErr(payload.error?.trim() || "Could not complete item");
        return;
      }
      await reloadPhasesForTask(taskId);
      setCompletingItem(null);
      setProofFile(null);
      if (payload.allPhasesCompleted) router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitShadowbanReport() {
    if (!shadowbanReportTarget || !shadowbanFile) return;
    setShadowbanSubmitting(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("account_id", shadowbanReportTarget.account_id);
      fd.append("model_id", shadowbanReportTarget.model_id);
      fd.append("model_name", shadowbanReportTarget.model_name);
      fd.append("platform", shadowbanReportTarget.platform);
      fd.append("username", shadowbanReportTarget.username);
      fd.append("notes", shadowbanNotes);
      fd.append("screenshot", shadowbanFile);
      const res = await fetch("/api/va/marketing/report-shadowban", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(payload.error?.trim() || "Could not submit report");
        return;
      }
      const mId = shadowbanReportTarget.model_id?.trim();
      if (mId) {
        const accRes = await fetch(`/api/va/marketing/accounts?model_id=${encodeURIComponent(mId)}`, {
          credentials: "include",
        });
        const accData = (await accRes.json().catch(() => ({}))) as { accounts?: SocialAccount[] };
        if (accRes.ok) {
          setModelAccounts((prev) => ({ ...prev, [mId]: accData.accounts ?? [] }));
        }
      }
      setShadowbanReportTarget(null);
      setShadowbanFile(null);
      setShadowbanNotes("");
    } finally {
      setShadowbanSubmitting(false);
    }
  }

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

  function allPhasesCompleted(taskId: string): boolean {
    const phases = taskPhases[taskId];
    if (!phases || phases.length === 0) return false;
    return phases.every((p) => p.status === "completed");
  }

  function showDoneButton(task: VaTaskRecord): boolean {
    if (task.status === "done" || task.status === "skipped") return false;
    return task.status === "in_progress" || allPhasesCompleted(task.id);
  }

  function phaseCardClass(status: TaskPhase["status"]) {
    if (status === "completed") return "border-emerald-500/30 bg-emerald-500/[0.04]";
    if (status === "overdue") return "border-red-500/30 bg-red-500/[0.04]";
    if (status === "in_progress") return "border-blue-500/30 bg-blue-500/[0.04]";
    return "border-white/15 bg-white/[0.02]";
  }

  async function toggleTaskExpanded(task: VaTaskRecord) {
    if (expandedTaskId === task.id) {
      setExpandedTaskId(null);
      return;
    }
    setExpandedTaskId(task.id);
    await loadPhasesAndAccounts(task);
  }

  function renderVaTaskCard(task: VaTaskRecord) {
    const expanded = expandedTaskId === task.id;
    const overdue = isPastDue(task.due_date) && task.status !== "done" && task.status !== "skipped";
    const modelNames = task.assigned_model_names ?? [];
    const assigneeLabel = modelNames.length > 0 ? modelNames.join(", ") : null;

    return (
      <div
        key={task.id}
        className={cn(
          "w-full overflow-hidden rounded-2xl border transition-all",
          task.status === "done"
            ? "border-emerald-500/15 opacity-70"
            : overdue
              ? "border-red-500/25"
              : task.priority === "urgent"
                ? "border-red-500/20"
                : "border-white/10 hover:border-white/20",
        )}
      >
        <div className="flex w-full items-start gap-3 p-4">
          <button
            type="button"
            className="mt-1 shrink-0 text-white/40 hover:text-white/70"
            onClick={() => void toggleTaskExpanded(task)}
            aria-label={expanded ? "Collapse task" : "Expand task"}
          >
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>

          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => void toggleTaskExpanded(task)}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={task.priority} />
              <TaskStatusBadge status={task.status} />
              {task.is_recurring ? (
                <span className="rounded-full border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
                  Recurring
                </span>
              ) : null}
            </div>
            <h3
              className={cn(
                "text-lg font-bold text-white",
                task.status === "done" && "text-white/40 line-through",
              )}
            >
              {task.title}
            </h3>
            <p className="mt-1.5 text-sm text-white/40">
              {task.due_date ? (
                <span className={overdue ? "text-red-400" : ""}>
                  Due {formatDateEuropean(task.due_date)}
                  {overdue ? " · Overdue" : ""}
                </span>
              ) : (
                "No due date"
              )}
              {assigneeLabel ? (
                <span className="text-white/30">
                  {" "}
                  · {assigneeLabel}
                </span>
              ) : null}
            </p>
          </button>

          {showDoneButton(task) ? (
            <button
              type="button"
              onClick={(e) => void handleMarkComplete(task, e)}
              disabled={!onShift || completing === task.id}
              title={!onShift ? "Start your shift to mark tasks done" : undefined}
              className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {completing === task.id ? "Saving…" : "Mark done"}
            </button>
          ) : null}
        </div>

        {expanded ? (
          <div className="border-t border-white/8 px-4 pb-4 pt-3">
            {task.description ? <p className="mb-3 text-sm text-white/50">{task.description}</p> : null}

            {modelNames.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {modelNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-0.5 text-xs text-pink-300"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => openTask(task)}
              className="mb-4 text-xs font-medium text-purple-300 hover:text-purple-200"
            >
              Details &amp; notes
            </button>

            {(taskPhases[task.id] ?? []).length === 0 ? (
              <p className="rounded-xl border border-white/8 bg-white/[0.02] py-8 text-center text-sm text-white/25">
                No phases for this task
              </p>
            ) : (
              <div className="space-y-3">
                {(taskPhases[task.id] ?? []).map((phase, phaseIndex) => {
                  const accs = phase.assigned_model_id ? (modelAccounts[phase.assigned_model_id] ?? []) : [];
                  const items = phase.items ?? [];
                  const doneCount = items.filter((i) => i.status === "completed").length;
                  const total = items.length;
                  const progress = total > 0 ? (doneCount / total) * 100 : 0;
                  const startedMins = minutesSince(phase.start_time ?? phase.actual_start_time);

                  return (
                    <div key={phase.id} className={cn("rounded-xl border p-4", phaseCardClass(phase.status))}>
                      <div className="mb-3 flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                            phase.status === "completed"
                              ? "bg-emerald-500 text-white"
                              : phase.status === "overdue"
                                ? "bg-red-500 text-white"
                                : phase.status === "in_progress"
                                  ? "bg-blue-500 text-white"
                                  : "bg-white/10 text-white/50",
                          )}
                        >
                          {phaseIndex + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-white">{phase.title || `Phase ${phaseIndex + 1}`}</p>
                            <PhaseStatusBadge status={phase.status} />
                          </div>
                          {phase.region ? (
                            <p className="mt-0.5 text-xs text-white/40">
                              {regionFlag(phase.region)} {phase.region}
                            </p>
                          ) : null}
                          {phase.status === "in_progress" && startedMins != null ? (
                            <p className="mt-0.5 text-xs text-blue-300/80">Started {startedMins} min ago</p>
                          ) : null}
                        </div>
                        {total > 0 ? (
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-white/50">
                            {doneCount}/{total}
                          </span>
                        ) : null}
                      </div>

                      {total > 0 ? (
                        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              phase.status === "completed"
                                ? "bg-emerald-500"
                                : phase.status === "overdue"
                                  ? "bg-red-500"
                                  : "bg-blue-500",
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      ) : null}

                      {accs.length > 0 ? (
                        <div className="mb-3">
                          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/25">
                            <Smartphone className="h-3.5 w-3.5" />
                            {phase.assigned_model_name?.trim() || "Creator"} links
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {accs.map((acc) => {
                              const plat = acc.platform?.trim() || "";
                              const color = SOCIAL_COLORS[plat] ?? "#888888";
                              const href = acc.account_link?.trim() || "#";
                              const st = acc.account_status ?? "active";
                              return (
                                <div key={acc.id} className="group/acc relative">
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition hover:scale-[1.02]"
                                    style={{ backgroundColor: `${color}12`, borderColor: `${color}35` }}
                                    onClick={(e) => {
                                      if (!acc.account_link?.trim()) e.preventDefault();
                                    }}
                                  >
                                    <span className="font-semibold text-white">@{acc.username}</span>
                                    <ExternalLink className="h-3 w-3 text-white/30" />
                                  </a>
                                  {st === "active" ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setShadowbanReportTarget(acc);
                                        setShadowbanFile(null);
                                        setShadowbanNotes("");
                                      }}
                                      className="mt-1 text-[10px] text-amber-400/70 opacity-0 transition group-hover/acc:opacity-100 hover:text-amber-400"
                                    >
                                      Report shadowban
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        {items.map((item) => {
                          const itemDisabled =
                            !onShift || item.status === "completed" || phase.status === "overdue";
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border px-3 py-3",
                                item.status === "completed"
                                  ? "border-emerald-500/15 bg-emerald-500/[0.03]"
                                  : "border-white/8 bg-white/[0.02]",
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (itemDisabled) return;
                                  setCompletingItem({ item, taskId: task.id });
                                  setProofFile(null);
                                }}
                                disabled={itemDisabled}
                                title={!onShift ? "Start your shift to complete items" : undefined}
                                className={cn(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition",
                                  item.status === "completed"
                                    ? "border-emerald-500 bg-emerald-500"
                                    : itemDisabled
                                      ? "cursor-not-allowed border-white/10 bg-white/5 opacity-40"
                                      : "border-white/25 hover:border-emerald-500/50",
                                )}
                                style={{ width: 24, height: 24 }}
                              >
                                {item.status === "completed" ? (
                                  <Check className="h-4 w-4 text-white" />
                                ) : null}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-2">
                                  <p
                                    className={cn(
                                      "flex-1 text-sm",
                                      item.status === "completed" ? "text-white/30 line-through" : "text-white/85",
                                    )}
                                  >
                                    {item.title || "—"}
                                  </p>
                                  {item.requires_screenshot && item.status !== "completed" ? (
                                    <Camera className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/70" aria-label="Screenshot required" />
                                  ) : null}
                                </div>
                                {item.status === "completed" && (item.completed_by_va_name || item.completed_at) ? (
                                  <p className="mt-0.5 text-xs text-white/35">
                                    {item.completed_by_va_name?.trim() || "VA"}
                                    {item.completed_at ? ` · ${timeAgoShort(item.completed_at)}` : ""}
                                  </p>
                                ) : null}
                                {item.screenshot?.[0]?.url ? (
                                  <a
                                    href={item.screenshot[0].url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-0.5 flex items-center gap-1 text-[10px] text-blue-400/80 hover:text-blue-400"
                                  >
                                    <ImageIcon className="h-3 w-3" /> View proof
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                        {items.length === 0 ? (
                          <p className="py-2 text-center text-xs text-white/20">No items in this phase</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Shift bar — full width */}
      {onShift ? (
        <div className="border-b border-white/10 bg-zinc-950/95">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 border-l-4 border-emerald-500 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-sm font-semibold text-white">On shift</span>
              <span className="font-mono text-sm tabular-nums text-emerald-300">{shiftDuration}</span>
            </div>
            <button
              type="button"
              onClick={() => void handleEndShift()}
              disabled={shiftBusy}
              className="rounded-xl border border-red-500/50 bg-transparent px-5 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
            >
              {shiftBusy ? "Ending…" : "End shift"}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                <Play className="h-5 w-5 fill-emerald-400 text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-white">Start your shift</p>
                <p className="text-sm text-white/50">Complete your checklist to track work time</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleStartShift()}
              disabled={shiftBusy || shiftLoading}
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:opacity-40"
            >
              {shiftBusy ? "Starting…" : "Start shift"}
            </button>
          </div>
        </div>
      )}

      {/* Main content — dimmed when not on shift */}
      <div
        className={cn(
          "mx-auto max-w-5xl space-y-6 px-4 py-6 transition-opacity md:px-6",
          !onShift && "opacity-60",
        )}
      >
        {/* Header + stats */}
        <div>
          <h1 className="text-2xl font-bold text-white">My tasks</h1>
          <p className="mt-1 text-sm text-white/40">Your assigned work and phase checklists</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
            {[
              { label: "Pending", value: taskStats.pending },
              { label: "In progress", value: taskStats.inProgress },
              { label: "Done", value: taskStats.done },
              { label: "Overdue", value: taskStats.overdue },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 ? <span className="text-white/25">·</span> : null}
                <span className="text-white/50">
                  {s.label}{" "}
                  <span className="font-bold tabular-nums text-white">{s.value}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[10rem] flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-purple-500/40"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
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
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
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

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
            <ClipboardList className="mb-4 h-12 w-12 text-white/20" />
            <p className="text-lg font-semibold text-white/70">No tasks assigned to you</p>
            <p className="mt-1 text-sm text-white/35">Check back later for new assignments.</p>
          </div>
        ) : regularTasks.length === 0 && recurringGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <ClipboardList className="mb-4 h-10 w-10 text-white/20" />
            <p className="text-base font-semibold text-white/70">No tasks match</p>
            <p className="mt-1 text-sm text-white/35">Try adjusting filters or check back later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {regularTasks.map((task) => renderVaTaskCard(task))}
            {recurringGroups.map((group) => (
              <div key={group.title}>
                {group.currentTask ? renderVaTaskCard(group.currentTask) : (
                  <div className="rounded-2xl border border-purple-500/15 bg-white/[0.02] px-4 py-3">
                    <p className="text-sm font-medium text-white/50">{group.title}</p>
                    <p className="text-xs text-white/25">Next occurrence pending… · {group.totalCompleted} done</p>
                  </div>
                )}
                {group.history.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedVaRecurringHistory((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.title)) next.delete(group.title);
                        else next.add(group.title);
                        return next;
                      });
                    }}
                    className="ml-2 mt-1 text-xs text-white/25 hover:text-white/50"
                  >
                    {expandedVaRecurringHistory.has(group.title) ? "Hide" : "Show"} history ({group.totalCompleted})
                  </button>
                ) : null}
                {expandedVaRecurringHistory.has(group.title) ? (
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

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white">{selected.title}</h3>
                {selected.description ? (
                  <p className="mt-1 text-sm text-white/55">{selected.description}</p>
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
                  className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm text-white/85 hover:bg-white/10"
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

      {shadowbanReportTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Report shadowban</h3>
            <p className="mt-1 text-sm text-white/50">
              @{shadowbanReportTarget.username} · {shadowbanReportTarget.platform}
            </p>
            <div className="mt-5">
              <label className="mb-2 block text-xs text-white/40">
                Screenshot <span className="text-amber-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => shadowbanProofRef.current?.click()}
                className={cn(
                  "w-full rounded-2xl border-2 border-dashed p-5 text-center",
                  shadowbanFile ? "border-amber-500/40 bg-amber-500/5" : "border-white/15 hover:border-amber-500/40",
                )}
              >
                {shadowbanPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shadowbanPreviewUrl} alt="Evidence" className="mx-auto max-h-28 rounded-xl object-contain" />
                ) : (
                  <>
                    <ClipboardList className="mx-auto mb-1 h-8 w-8 text-white/30" />
                    <p className="text-sm text-white/40">Paste (Ctrl+V) or click</p>
                  </>
                )}
              </button>
              <input
                ref={shadowbanProofRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setShadowbanFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <textarea
              value={shadowbanNotes}
              onChange={(e) => setShadowbanNotes(e.target.value)}
              rows={2}
              placeholder="What did you notice?"
              className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none"
            />
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void handleSubmitShadowbanReport()}
                disabled={!shadowbanFile || shadowbanSubmitting}
                className="flex-1 rounded-2xl border border-amber-500/30 bg-amber-500/20 py-3 font-bold text-amber-400 disabled:opacity-40"
              >
                {shadowbanSubmitting ? "Submitting…" : "Submit report"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShadowbanReportTarget(null);
                  setShadowbanFile(null);
                  setShadowbanNotes("");
                }}
                className="rounded-2xl border border-white/10 px-5 py-3 text-white/50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {completingItem ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Complete item</h3>
            <p className="mt-1 text-sm text-white/50">{completingItem.item.title || "Checklist item"}</p>
            {completingItem.item.requires_screenshot ? (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold text-amber-400">Screenshot proof required</p>
                <button
                  type="button"
                  onClick={() => proofRef.current?.click()}
                  className={cn(
                    "w-full rounded-2xl border-2 border-dashed p-6 text-center",
                    proofFile ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5",
                  )}
                >
                  {proofFile && proofPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={proofPreviewUrl} alt="Proof" className="mx-auto max-h-32 rounded-xl object-contain" />
                  ) : (
                    <>
                      <Camera className="mx-auto mb-2 h-10 w-10 text-white/30" />
                      <p className="text-sm text-amber-400/80">Paste (Ctrl+V) or click to upload</p>
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
                disabled={submitting || (completingItem.item.requires_screenshot && !proofFile)}
                className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {submitting ? "Saving…" : "Mark complete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompletingItem(null);
                  setProofFile(null);
                }}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
