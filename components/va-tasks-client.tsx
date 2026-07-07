"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  ListChecks,
  Camera,
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
import { CustomSelect } from "@/components/ui/custom-select";
import { VAShadowbanReportModal } from "@/components/va-shadowban-report-modal";
import { getSocialColor } from "@/lib/social-platform-config";
import type { VaTaskRecord, VaTaskPriority, VaTaskStatus } from "@/types";
import type { PhaseItem, TaskPhase } from "@/services/task-phases";
import type { SocialAccount } from "@/services/marketing";
import { cn } from "@/lib/utils";
import { groupRecurringTasks } from "@/lib/recurring-utils";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { filterTasksByAthensYmd } from "@/lib/va-task-date-filter";
import { VA_CARD, VA_CARD_GLOW, VA_FILTER_INPUT, VA_MODEL_TAG, VA_STATUS_BADGE, VA_BTN_SECONDARY, VA_CHAMPAGNE_DIVIDER } from "@/lib/va-tasks-tokens";
import { ShiftButton } from "@/components/shift-button";
import { TaskDateNavigator } from "@/components/task-date-navigator";
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
      ? "border-red-500/45 bg-red-500/15 text-red-200 shadow-[0_0_14px_-4px_rgba(239,68,68,0.45)]"
      : k === "high"
        ? "border-[#D4AF8C]/45 bg-[#D4AF8C]/12 text-[#D4AF8C] shadow-[0_0_14px_-4px_rgba(212,175,140,0.35)]"
        : "border-white/12 bg-white/[0.05] text-[#B8B4B8]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
  return (
    <span className={cn(VA_STATUS_BADGE, variant)}>{priority}</span>
  );
}

function TaskStatusBadge({ status }: { status: VaTaskStatus }) {
  const k = (status || "").toLowerCase();
  const variant =
    k === "pending"
      ? "border-white/14 bg-white/[0.05] text-[#B8B4B8]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      : k === "done"
        ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/12 text-[#D4AF8C] shadow-[0_0_14px_-4px_rgba(212,175,140,0.35)]"
        : k === "skipped"
          ? "border-red-500/40 bg-red-500/12 text-red-300 shadow-[0_0_14px_-4px_rgba(239,68,68,0.35)]"
          : "border-[#FF1493]/40 bg-[#FF1493]/12 text-[#FF1493] shadow-[0_0_16px_-4px_rgba(255,20,147,0.4)]";
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

export function VaTasksClient({ tasks: initialTasks, userName = "" }: Props) {
  const router = useRouter();
  const tasks = initialTasks;
  const [selected, setSelected] = React.useState<VaTaskRecord | null>(null);
  const [notes, setNotes] = React.useState("");
  const [statusPick, setStatusPick] = React.useState<VaTaskStatus>("done");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [completing, setCompleting] = React.useState<string | null>(null);

  const todayYmd = getTodayYmdAthens();
  const [selectedYmd, setSelectedYmd] = React.useState(todayYmd);
  const isViewingToday = selectedYmd === todayYmd;

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
    const q = search.trim().toLowerCase();
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
  }, [dateFilteredTasks, search, filterStatus, filterPriority]);

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
          expanded && cn("border-[#FF1493]/35", VA_CARD_GLOW),
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
                className={cn(VA_BTN_SECONDARY, "shrink-0 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40")}
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
              <div className="px-5 py-5">
                <div className={cn(VA_CHAMPAGNE_DIVIDER, "mb-4")} />
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
                              const color = getSocialColor(plat);
                              const href = acc.account_link?.trim() || "#";
                              const st = acc.account_status ?? "active";
                              const flagged = st === "shadowbanned" || st === "banned";
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
                                    {flagged ? (
                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                                          st === "banned"
                                            ? "border-red-500/40 bg-red-500/15 text-red-300"
                                            : "border-amber-500/40 bg-amber-500/15 text-amber-300",
                                        )}
                                        title={st === "banned" ? "Account banned" : "Account shadowbanned"}
                                      >
                                        <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                                        {st === "banned" ? "Banned" : "Flagged"}
                                      </span>
                                    ) : null}
                                    <ExternalLink className="h-3 w-3 text-white/30" />
                                  </a>
                                  {st === "active" ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setShadowbanReportTarget(acc);
                                      }}
                                      className="mt-1 text-[10px] text-[#D4AF8C]/60 opacity-0 transition group-hover/acc:opacity-100 [@media(pointer:coarse)]:opacity-60 hover:text-[#D4AF8C]"
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
    <div className="min-h-screen">
      {/* ── Shift bar (today only — reflects live shift state) ── */}
      {isViewingToday && onShift ? (
        <div className={cn("border-b border-[rgba(255,255,255,0.06)] bg-gradient-to-br from-[#0D0B0D] via-[#151315] to-[#0A0A0A]", VA_CARD_GLOW)}>
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
                <span className="text-base tabular-nums tracking-tight text-white/90">
                  {shiftDuration}
                </span>
              </div>
              <ShiftButton variant="end" loading={shiftBusy} onClick={() => void handleEndShift()} />
            </div>
          </div>
        </div>
      ) : isViewingToday ? (
        <div className={cn("mb-8 w-full border-b border-[rgba(255,255,255,0.06)] bg-gradient-to-br from-[#0D0B0D] via-[#151315] to-[#0A0A0A]", VA_CARD_GLOW)}>
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
                <h2 className="text-xl font-semibold text-white">
                  Begin your shift
                </h2>
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
      ) : null}

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

        {/* ── Filters (always interactive) ── */}
        <div className="relative z-10 flex flex-wrap gap-2 pointer-events-auto">
          <input
            type="search"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(FILTER_INPUT, "min-w-[10rem] flex-1")}
          />
          <CustomSelect
            value={filterPriority}
            onChange={setFilterPriority}
            portaled
            placeholder="All priorities"
            className="min-w-[9rem]"
            options={[
              { value: "", label: "All priorities" },
              { value: "urgent", label: "Urgent" },
              { value: "high", label: "High" },
              { value: "normal", label: "Normal" },
              { value: "low", label: "Low" },
            ]}
          />
        </div>

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
            className={cn(VA_CARD, "relative w-full max-w-md overflow-hidden shadow-2xl")}
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
          <div className={cn(VA_CARD, "w-full max-w-sm p-6 shadow-2xl")}>
            <h3 className="text-lg font-semibold text-white">Complete item</h3>
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
