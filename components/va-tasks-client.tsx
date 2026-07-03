"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  Check,
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
import { DISPLAY_SERIF_FAMILY } from "@/lib/fonts/display-serif";
import { VA_CARD, VA_FILTER_INPUT, VA_MODEL_TAG, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { TaskPhaseRibbon } from "@/components/task-phase-ribbon";
import { ChampagneCheckbox } from "@/components/va-tasks-champagne-checkbox";

type Props = { tasks: VaTaskRecord[]; userName?: string };

type ActiveShift = { id: string; start_time: string; status: string };

const FILTER_INPUT = VA_FILTER_INPUT;

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

function PriorityBadge({ priority }: { priority: VaTaskPriority }) {
  const k = (priority || "normal").toLowerCase();
  const variant =
    k === "urgent"
      ? "border-red-500/40 bg-red-500/10 text-red-300"
      : k === "high"
        ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/10 text-[#D4AF8C]"
        : "border-white/10 bg-white/[0.04] text-[#B8B4B8]/70";
  return (
    <span className={cn(VA_STATUS_BADGE, variant)}>{priority}</span>
  );
}

function TaskStatusBadge({ status }: { status: VaTaskStatus }) {
  const k = (status || "").toLowerCase();
  const variant =
    k === "pending"
      ? "border-white/12 bg-white/[0.04] text-[#B8B4B8]/65"
      : k === "done"
        ? "border-[#D4AF8C]/35 bg-[#D4AF8C]/10 text-[#D4AF8C]"
        : k === "skipped"
          ? "border-red-500/35 bg-red-500/10 text-red-300"
          : "border-[#FF1493]/35 bg-[#FF1493]/10 text-[#FF1493]";
  return (
    <span className={cn(VA_STATUS_BADGE, variant)}>{status.replace(/_/g, " ")}</span>
  );
}

function assigneeLabel(task: VaTaskRecord, userName: string): string {
  if (task.assigned_to_ids.length === 0) return "All VAs";
  if (task.assigned_to_ids.length === 1) return userName.trim() || "Assigned VA";
  const extra = task.assigned_to_ids.length - 1;
  return userName.trim() ? `${userName.trim()} + ${extra} more` : `${task.assigned_to_ids.length} VAs`;
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

export function VaTasksClient({ tasks: initialTasks, userName = "" }: Props) {
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
  const [shiftErr, setShiftErr] = React.useState<string | null>(null);
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
    setShiftErr(null);
    try {
      const res = await fetch("/api/va/task-shift/start", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = data.error?.trim() || "Could not start shift";
        if (msg.toLowerCase().includes("already have an active")) {
          await fetchActiveShift();
          return;
        }
        setShiftErr(msg);
        return;
      }
      await res.json().catch(() => ({}));
      setShiftErr(null);
      await fetchActiveShift();
    } finally {
      setShiftBusy(false);
    }
  }

  async function handleEndShift() {
    setShiftBusy(true);
    setShiftErr(null);
    try {
      const res = await fetch("/api/va/task-shift/end", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setShiftErr(data.error?.trim() || "Could not end shift");
        return;
      }
      await res.json().catch(() => ({}));
      setShiftErr(null);
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
    const phases = taskPhases[task.id] ?? [];

    return (
      <article
        key={task.id}
        className={cn(
          VA_CARD,
          "overflow-hidden",
          expanded && "border-[#FF1493]/35 shadow-[0_0_0_1px_rgba(255,20,147,0.12)]",
          task.status === "done" && !expanded && "opacity-70",
        )}
      >
        <button
          type="button"
          className="flex w-full items-start justify-between gap-4 p-5 pb-3 text-left"
          onClick={() => void toggleTaskExpanded(task)}
        >
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <PriorityBadge priority={task.priority} />
              <TaskStatusBadge status={task.status} />
              {task.is_recurring ? (
                <span className={cn(VA_STATUS_BADGE, "border-[#D4AF8C]/30 bg-[#D4AF8C]/8 text-[#D4AF8C]/80")}>
                  Recurring
                </span>
              ) : null}
            </div>
            <h3
              className={cn(
                "text-lg font-semibold leading-snug text-white",
                task.status === "done" && "text-[#B8B4B8]/35 line-through",
              )}
              style={{ fontFamily: DISPLAY_SERIF_FAMILY }}
            >
              {task.title}
            </h3>
            {task.description && !expanded ? (
              <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[#B8B4B8]/75">{task.description}</p>
            ) : null}
          </div>
          <div className="mt-1 flex shrink-0 items-center">
            <ChevronRight
              className={cn(
                "h-5 w-5 text-[#D4AF8C]/45 transition-transform duration-300 motion-reduce:transition-none",
                expanded && "rotate-90",
              )}
            />
          </div>
        </button>

        <div className="space-y-2 px-5 pb-4">
          {task.due_date ? (
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs tabular-nums",
                overdue ? "font-medium text-red-400" : "text-[#B8B4B8]/45",
              )}
              style={{ fontFamily: DISPLAY_SERIF_FAMILY }}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Due {formatDateEuropean(task.due_date)}
                {overdue ? " · Overdue" : ""}
              </span>
            </div>
          ) : null}
          {modelNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {modelNames.map((name) => (
                <span key={name} className={VA_MODEL_TAG}>
                  {name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-[#B8B4B8]/55">{assigneeLabel(task, userName)}</p>
            {showDoneButton(task) ? (
              <button
                type="button"
                onClick={(e) => void handleMarkComplete(task, e)}
                disabled={!onShift || completing === task.id}
                title={!onShift ? "Start your shift to mark tasks done" : undefined}
                className="shrink-0 rounded-lg border border-[#D4AF8C]/35 bg-[#D4AF8C]/10 px-4 py-2 text-sm font-semibold text-[#D4AF8C] transition hover:bg-[#D4AF8C]/18 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {completing === task.id ? "Saving…" : "Mark done"}
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "overflow-hidden transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none",
            expanded ? "max-h-[8000px]" : "max-h-0",
          )}
        >
          <div className="border-t border-[rgba(255,255,255,0.06)]">
            {task.description ? (
              <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/60">Description</p>
                <p className="text-sm leading-relaxed text-[#B8B4B8]">{task.description}</p>
              </div>
            ) : null}

            <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-5">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/60">Phases</p>
                <button
                  type="button"
                  onClick={() => openTask(task)}
                  className="text-xs font-medium text-[#FF1493]/80 transition hover:text-[#FF1493]"
                >
                  Details &amp; notes
                </button>
              </div>

              <TaskPhaseRibbon
                phases={phases}
                renderPhaseExtra={(phase) => {
                  const accs = phase.assigned_model_id ? (modelAccounts[phase.assigned_model_id] ?? []) : [];
                  const startedMins = minutesSince(phase.start_time ?? phase.actual_start_time);
                  if (accs.length === 0 && !(phase.status === "in_progress" && startedMins != null)) return null;
                  return (
                    <div className="mt-3 space-y-3 border-t border-[rgba(255,255,255,0.05)] pt-3">
                      {phase.status === "in_progress" && startedMins != null ? (
                        <p className="text-xs text-[#FF1493]/75">Started {startedMins} min ago</p>
                      ) : null}
                      {accs.length > 0 ? (
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B8B4B8]/40">
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
                                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition hover:scale-[1.02] motion-reduce:transform-none"
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
                                      className="mt-1 text-[10px] text-[#D4AF8C]/60 opacity-0 transition group-hover/acc:opacity-100 hover:text-[#D4AF8C]"
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
                    </div>
                  );
                }}
                renderItem={(item, phase) => {
                  const itemDisabled =
                    !onShift || item.status === "completed" || phase.status === "overdue";
                  return (
                    <div className="flex items-start gap-3">
                      <ChampagneCheckbox
                        checked={item.status === "completed"}
                        disabled={itemDisabled}
                        title={!onShift ? "Start your shift to complete items" : undefined}
                        onClick={() => {
                          if (itemDisabled) return;
                          const fullItem = (taskPhases[task.id] ?? [])
                            .flatMap((p) => p.items ?? [])
                            .find((i) => i.id === item.id);
                          if (!fullItem) return;
                          setCompletingItem({ item: fullItem, taskId: task.id });
                          setProofFile(null);
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p
                            className={cn(
                              "flex-1 text-sm leading-snug",
                              item.status === "completed" ? "text-[#B8B4B8]/30 line-through" : "text-[#B8B4B8]",
                            )}
                          >
                            {item.title || "—"}
                          </p>
                          {item.requires_screenshot && item.status !== "completed" ? (
                            <Camera className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF8C]/80" aria-label="Screenshot required" />
                          ) : null}
                        </div>
                        {item.status === "completed" && (item.completed_by_va_name || item.completed_at) ? (
                          <p className="mt-0.5 text-xs text-[#B8B4B8]/35">
                            {item.completed_by_va_name?.trim() || "VA"}
                            {item.completed_at ? ` · ${timeAgoShort(item.completed_at)}` : ""}
                          </p>
                        ) : null}
                        {item.screenshot?.[0]?.url ? (
                          <a
                            href={item.screenshot[0].url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 flex items-center gap-1 text-[10px] text-[#D4AF8C]/75 hover:text-[#D4AF8C]"
                          >
                            <ImageIcon className="h-3 w-3" /> View proof
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* ── Shift bar ── */}
      {onShift ? (
        <div className="border-b border-[rgba(255,255,255,0.06)] bg-[#0D0B0D]">
          <div className="mx-auto max-w-5xl space-y-3 px-4 py-3.5 md:px-6">
            {shiftErr ? (
              <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
                {shiftErr}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-[#D4AF8C] pl-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D4AF8C] opacity-50 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#D4AF8C]" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]">On shift</span>
                <span
                  className="text-base tabular-nums tracking-tight text-white/90"
                  style={{ fontFamily: DISPLAY_SERIF_FAMILY }}
                >
                  {shiftDuration}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleEndShift()}
                disabled={shiftBusy}
                className="rounded-lg border border-red-500/40 bg-transparent px-5 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
              >
                {shiftBusy ? "Ending…" : "End shift"}
              </button>
            </div>
          </div>
        </div>
      ) : (
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
                <h2 className="text-xl font-semibold text-white" style={{ fontFamily: DISPLAY_SERIF_FAMILY }}>
                  Begin your shift
                </h2>
                <p className="mt-1 text-sm text-[#B8B4B8]/65">Clock in to unlock your task checklist</p>
              </div>
              <button
                type="button"
                onClick={() => void handleStartShift()}
                disabled={shiftBusy || shiftLoading}
                className="flex items-center gap-2 rounded-xl bg-[#FF1493] px-8 py-3.5 text-base font-semibold text-white shadow-[0_8px_32px_-8px_rgba(255,20,147,0.55)] transition hover:brightness-110 disabled:opacity-40"
              >
                <Play className="h-5 w-5 fill-white" />
                {shiftBusy ? "Starting…" : "Start shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 md:px-6">
        {/* ── Page header ── */}
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-white" style={{ fontFamily: DISPLAY_SERIF_FAMILY }}>
            My tasks
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                { key: "", label: "All", count: tasks.length },
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

        {/* ── Filters (always interactive) ── */}
        <div className="relative z-10 flex flex-wrap gap-2 pointer-events-auto">
          <input
            type="search"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(FILTER_INPUT, "min-w-[10rem] flex-1")}
          />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className={cn(FILTER_INPUT, "min-w-[9rem]")}
          >
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* ── Tasks (dimmed off shift) ── */}
        <div
          className={cn(
            "space-y-4 transition-opacity duration-300",
            !onShift && "pointer-events-none opacity-50",
          )}
        >
          {err && !selected ? (
            <div
              className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
              role="alert"
            >
              {err}
            </div>
          ) : null}

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#D4AF8C]/30 bg-[#D4AF8C]/8">
                <Check className="h-8 w-8 text-[#D4AF8C]" strokeWidth={2.5} />
              </div>
              <p className="text-xl font-semibold text-white" style={{ fontFamily: DISPLAY_SERIF_FAMILY }}>
                Your slate is clear
              </p>
              <p className="mt-2 max-w-sm text-sm text-[#B8B4B8]/55">
                No assignments yet — enjoy the quiet moment, or check back soon.
              </p>
            </div>
          ) : regularTasks.length === 0 && recurringGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardList className="mb-4 h-10 w-10 text-[#D4AF8C]/25" />
              <p className="text-base font-semibold text-[#B8B4B8]/80" style={{ fontFamily: DISPLAY_SERIF_FAMILY }}>
                Nothing matches
              </p>
              <p className="mt-1 text-sm text-[#B8B4B8]/45">Try a different filter or search term.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {regularTasks.map((task) => renderVaTaskCard(task))}
              {recurringGroups.map((group) => (
                <div key={group.title}>
                  {group.currentTask ? (
                    renderVaTaskCard(group.currentTask)
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
      </div>

      {/* ── Details & notes modal ── */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151315] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white" style={{ fontFamily: DISPLAY_SERIF_FAMILY }}>{selected.title}</h3>
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

      {/* ── Shadowban report modal ── */}
      {shadowbanReportTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#151315] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white" style={{ fontFamily: DISPLAY_SERIF_FAMILY }}>Report shadowban</h3>
            <p className="mt-1 text-sm text-[#B8B4B8]/65">
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
                  "w-full rounded-2xl border-2 border-dashed p-5 text-center transition-colors",
                  shadowbanFile
                    ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/5"
                    : "border-[#D4AF8C]/20 hover:border-[#D4AF8C]/40 hover:bg-[#D4AF8C]/[0.03]",
                )}
              >
                {shadowbanPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shadowbanPreviewUrl} alt="Evidence" className="mx-auto max-h-28 rounded-xl object-contain" />
                ) : (
                  <>
                    <ClipboardList className="mx-auto mb-1 h-8 w-8 text-[#D4AF8C]/35" />
                    <p className="text-sm text-[#B8B4B8]/50">Paste (Ctrl+V) or tap to upload</p>
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

      {/* ── Screenshot upload modal ── */}
      {completingItem ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#151315] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white" style={{ fontFamily: DISPLAY_SERIF_FAMILY }}>Complete item</h3>
            <p className="mt-1 text-sm text-[#B8B4B8]/65">{completingItem.item.title || "Checklist item"}</p>
            {completingItem.item.requires_screenshot ? (
              <div className="mt-5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D4AF8C]">Screenshot proof required</p>
                <button
                  type="button"
                  onClick={() => proofRef.current?.click()}
                  className={cn(
                    "w-full rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
                    proofFile
                      ? "border-[#D4AF8C]/45 bg-[#D4AF8C]/5"
                      : "border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.03] hover:border-[#D4AF8C]/45",
                  )}
                >
                  {proofFile && proofPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={proofPreviewUrl} alt="Proof" className="mx-auto max-h-32 rounded-xl object-contain" />
                  ) : (
                    <>
                      <Camera className="mx-auto mb-2 h-10 w-10 text-[#D4AF8C]/40" />
                      <p className="text-sm text-[#D4AF8C]/75">Paste (Ctrl+V) or tap to upload</p>
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
                className="flex-1 rounded-2xl border border-[#D4AF8C]/35 bg-[#D4AF8C]/12 py-3 text-sm font-semibold text-[#D4AF8C] disabled:opacity-40"
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
