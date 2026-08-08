"use client";

import * as React from "react";
import { Bell, Check, Camera, Clock, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { formatDateEuropean } from "@/lib/format";
import { ymdInAthens } from "@/lib/airtable-datetime";
import { getVaTasksViewTodayYmd } from "@/lib/va-task-date-filter";
import type { VaTaskRecord, VaTaskStatus, VaTaskPriority } from "@/types";
import type { PhaseItem, TaskPhase } from "@/services/task-phases";
import { cn } from "@/lib/utils";
import { DEFAULT_TASK_STEP_TYPE, TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";
import {
  VA_CARD,
  VA_MODEL_TAG,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { TaskPhaseRibbon, type PhaseRibbonItem, type PhaseRibbonPhase } from "@/components/task-phase-ribbon";

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

function priorityBorderClass(priority: VaTaskPriority) {
  const k = (priority || "normal").toLowerCase();
  if (k === "urgent") return "border-l-red-500";
  if (k === "high") return "border-l-orange-500";
  if (k === "low") return "border-l-gray-500";
  return "border-l-blue-500";
}

const PriorityBadge = React.memo(function PriorityBadge({ priority }: { priority: VaTaskPriority }) {
  const k = (priority || "normal").toLowerCase();
  const variant =
    k === "urgent"
      ? "border-red-500/40 bg-red-500/12 text-red-300"
      : k === "high"
        ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/12 text-[#D4AF8C]"
        : "border-white/12 bg-white/[0.05] text-[#B8B4B8]/70";
  return <span className={cn(VA_STATUS_BADGE, variant)}>{priority}</span>;
});

const StatusBadge = React.memo(function StatusBadge({ status }: { status: VaTaskStatus }) {
  const k = (status || "").toLowerCase();
  const variant =
    k === "pending"
      ? "border-white/14 bg-white/[0.05] text-[#B8B4B8]/70"
      : k === "done"
        ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/12 text-[#D4AF8C]"
        : k === "skipped"
          ? "border-red-500/35 bg-red-500/12 text-red-300"
          : "border-[#FF1493]/35 bg-[#FF1493]/12 text-[#FF1493]";
  return <span className={cn(VA_STATUS_BADGE, variant)}>{status.replace(/_/g, " ")}</span>;
});

export type AdminVaTaskCardProps = {
  task: VaTaskRecord;
  assignedLabel: string;
  canManage: boolean;
  phases: TaskPhase[];
  isReminding: boolean;
  remindSuccess: boolean;
  isConfirmingDelete: boolean;
  onRemind: (task: VaTaskRecord) => void;
  onEdit: (task: VaTaskRecord) => void;
  onDelete: (task: VaTaskRecord) => void;
  onLoadPhases: (taskId: string, sourceTaskId?: string | null) => Promise<void>;
  onAddPhase: (taskId: string, taskTitle: string) => void;
  onUpdatePhase: (phaseId: string, taskId: string, updates: Partial<TaskPhase>) => void;
  onDeletePhase: (phaseId: string, taskId: string) => void;
  onAddPhaseItem: (phaseId: string, taskId: string) => void;
  onUpdatePhaseItem: (itemId: string, phaseId: string, taskId: string, updates: Partial<PhaseItem>) => void;
  onDeletePhaseItem: (itemId: string, phaseId: string, taskId: string) => void;
  onUpdatePhaseTitleLocal: (phaseId: string, taskId: string, title: string) => void;
  onUpdatePhaseItemTitleLocal: (itemId: string, phaseId: string, taskId: string, title: string) => void;
};

export const AdminVaTaskCard = React.memo(function AdminVaTaskCard({
  task,
  assignedLabel,
  canManage,
  phases,
  isReminding,
  remindSuccess,
  isConfirmingDelete,
  onRemind,
  onEdit,
  onDelete,
  onLoadPhases,
  onAddPhase,
  onUpdatePhase,
  onDeletePhase,
  onAddPhaseItem,
  onUpdatePhaseItem,
  onDeletePhaseItem,
  onUpdatePhaseTitleLocal,
  onUpdatePhaseItemTitleLocal,
}: AdminVaTaskCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [loadingPhases, setLoadingPhases] = React.useState(false);
  const modelNames = task.assigned_model_names ?? [];
  const isVirtual = Boolean(task.is_virtual_occurrence || task.id.startsWith("virt_"));
  /** Inline phase edits stay on real rows; use Edit for series / occurrence changes. */
  const canEditPhases = canManage && !isVirtual;
  const dueYmd = ymdInAthens(task.due_date);
  const todayYmd = getVaTasksViewTodayYmd();
  const virtualBadgeLabel = isVirtual && dueYmd && dueYmd > todayYmd ? "Upcoming day" : "Projected";

  const togglePhases = React.useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    setLoadingPhases(true);
    try {
      await onLoadPhases(task.id, task.virtual_source_task_id);
    } finally {
      setLoadingPhases(false);
    }
  }, [expanded, onLoadPhases, task.id, task.virtual_source_task_id]);

  const renderPhaseExtra = React.useCallback(
    (phase: PhaseRibbonPhase) => {
      if (canEditPhases) {
        return (
          <>
            {phase.start_time || phase.end_time ? (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#B8B4B8]/40">
                {phase.start_time ? (
                  <span>Started {formatPhaseActualTime(phase.start_time)}</span>
                ) : null}
                {phase.end_time ? (
                  <span>Ended {formatPhaseActualTime(phase.end_time)}</span>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={phase.region ?? "Global"}
                onChange={(e) =>
                  void onUpdatePhase(phase.id, task.id, {
                    region: e.target.value as TaskPhase["region"],
                  })
                }
                className="cursor-pointer rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#151315] px-3 py-1.5 text-xs text-[#B8B4B8] focus:outline-none focus:border-[#FF1493]/40"
              >
                <option value="Greek">🇬🇷 Greek</option>
                <option value="USA">🇺🇸 USA</option>
                <option value="Global">Global</option>
              </select>
              <input
                value={phase.title}
                onChange={(e) => onUpdatePhaseTitleLocal(phase.id, task.id, e.target.value)}
                onBlur={() => void onUpdatePhase(phase.id, task.id, { title: phase.title })}
                placeholder="Phase title"
                className="min-w-0 flex-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-[#B8B4B8]/25 focus:outline-none focus:border-[#D4AF8C]/35"
              />
              <button
                type="button"
                onClick={() => void onDeletePhase(phase.id, task.id)}
                className="rounded-lg p-1.5 text-[#B8B4B8]/20 transition hover:bg-red-500/10 hover:text-red-400"
                aria-label="Delete phase"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void onAddPhaseItem(phase.id, task.id)}
              className="mt-2 flex items-center gap-1.5 text-xs text-[#B8B4B8]/35 transition hover:text-[#D4AF8C]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add checklist item
            </button>
          </>
        );
      }
      if (phase.start_time || phase.end_time) {
        return (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#B8B4B8]/40">
            {phase.start_time ? (
              <span>Started {formatPhaseActualTime(phase.start_time)}</span>
            ) : null}
            {phase.end_time ? (
              <span>Ended {formatPhaseActualTime(phase.end_time)}</span>
            ) : null}
          </div>
        );
      }
      return null;
    },
    [
      canEditPhases,
      onAddPhaseItem,
      onDeletePhase,
      onUpdatePhase,
      onUpdatePhaseTitleLocal,
      task.id,
    ],
  );

  const renderItem = React.useCallback(
    (item: PhaseRibbonItem, phase: PhaseRibbonPhase, idx: number) => {
      if (!canEditPhases) return null;
      return (
        <div className="group flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-2",
              item.status === "completed"
                ? "border-[#D4AF8C] bg-[#D4AF8C]/15"
                : "border-[#D4AF8C]/35 bg-transparent",
            )}
          >
            {item.status === "completed" ? <Check className="h-3 w-3 text-[#D4AF8C]" aria-hidden /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={item.step_type ?? DEFAULT_TASK_STEP_TYPE}
                onChange={(e) =>
                  void onUpdatePhaseItem(item.id, phase.id, task.id, {
                    step_type: e.target.value as TaskStepType,
                  })
                }
                className="w-[7.5rem] shrink-0 cursor-pointer rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#151315] px-2 py-1 text-[10px] text-[#B8B4B8] focus:border-[#FF1493]/40 focus:outline-none"
                aria-label="Step type"
              >
                {TASK_STEP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={item.title}
                onChange={(e) => onUpdatePhaseItemTitleLocal(item.id, phase.id, task.id, e.target.value)}
                onBlur={() => void onUpdatePhaseItem(item.id, phase.id, task.id, { title: item.title })}
                placeholder={`Item ${idx + 1}…`}
                className={cn(
                  "min-w-0 flex-1 bg-transparent text-sm focus:outline-none",
                  item.status === "completed" ? "text-[#B8B4B8]/30 line-through" : "text-[#B8B4B8]",
                )}
              />
            </div>
            {item.requires_screenshot && item.status !== "completed" ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[#D4AF8C]/55">
                <Camera className="h-3.5 w-3.5" aria-hidden /> Requires proof
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1 self-center opacity-100 transition md:opacity-0 md:group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
            <button
              type="button"
              onClick={() =>
                void onUpdatePhaseItem(item.id, phase.id, task.id, {
                  requires_screenshot: !item.requires_screenshot,
                })
              }
              className={cn(
                "relative h-5 w-9 min-h-[44px] min-w-[44px] rounded-full transition-all",
                item.requires_screenshot ? "bg-[#D4AF8C]" : "bg-white/15",
              )}
              aria-label="Toggle screenshot required"
            >
              <span
                className={cn(
                  "absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white transition-all",
                  item.requires_screenshot ? "left-[1.35rem]" : "left-1",
                )}
              />
            </button>
            <button
              type="button"
              onClick={() => void onDeletePhaseItem(item.id, phase.id, task.id)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#B8B4B8]/50 hover:bg-red-500/10 hover:text-red-400"
              aria-label="Remove item"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    },
    [canEditPhases, onDeletePhaseItem, onUpdatePhaseItem, onUpdatePhaseItemTitleLocal, task.id],
  );

  return (
    <div
      className={cn(
        VA_CARD,
        "group relative overflow-hidden border-l-[5px] p-5",
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
              {task.is_virtual_occurrence ? (
                <span className="rounded-full border border-sky-500/25 bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
                  {virtualBadgeLabel}
                </span>
              ) : null}
            </div>
            <h3
              className={cn(
                "text-lg font-semibold leading-snug text-white",
                task.status === "done" && "text-[#B8B4B8]/45 line-through",
              )}
            >
              {task.title}
            </h3>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {canManage ? (
              <>
                {!isVirtual && task.status !== "done" && task.status !== "skipped" ? (
                  <button
                    type="button"
                    onClick={() => void onRemind(task)}
                    disabled={isReminding}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-40"
                  >
                    <Bell className="h-3 w-3" aria-hidden />
                    {isReminding ? "Sending…" : remindSuccess ? "Sent!" : "Remind"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-white/15 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-white/60 transition hover:border-white/25 hover:text-white"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={isConfirmingDelete}
                  onClick={() => onDelete(task)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-red-500/30 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/50">
            <Users className="h-3 w-3 shrink-0" aria-hidden />
            {assignedLabel}
          </span>
          {modelNames.map((name) => (
            <span key={name} className={VA_MODEL_TAG}>
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
            onClick={() => void togglePhases()}
            className="group/ph flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white/75"
          >
            <span className="text-xs">{expanded ? "▼" : "▶"}</span>
            <span className="font-medium">Phases</span>
            {phases.length > 0 ? (
              <span className="rounded-full border border-[#1f1f1f] bg-[#141414] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/50">
                {phases.length}
              </span>
            ) : null}
            {loadingPhases ? <span className="animate-pulse text-xs text-white/30">Loading…</span> : null}
          </button>

          {expanded ? (
            <div className="mt-5">
              <TaskPhaseRibbon
                phases={phases}
                renderPhaseExtra={renderPhaseExtra}
                renderItem={canEditPhases ? renderItem : undefined}
              />
              {isVirtual ? (
                <p className="mt-3 text-center text-xs text-sky-300/70">
                  Projected occurrence — use Edit or Delete to change this date or the series.
                </p>
              ) : null}
              {canEditPhases ? (
                <button
                  type="button"
                  onClick={() => void onAddPhase(task.id, task.title)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D4AF8C]/20 px-5 py-3 text-xs text-[#B8B4B8]/35 transition hover:border-[#FF1493]/35 hover:text-[#FF1493]/70"
                >
                  <Plus className="h-4 w-4" />
                  Add phase
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.task === next.task &&
  prev.assignedLabel === next.assignedLabel &&
  prev.canManage === next.canManage &&
  prev.phases === next.phases &&
  prev.isReminding === next.isReminding &&
  prev.remindSuccess === next.remindSuccess &&
  prev.isConfirmingDelete === next.isConfirmingDelete &&
  prev.onRemind === next.onRemind &&
  prev.onEdit === next.onEdit &&
  prev.onDelete === next.onDelete &&
  prev.onLoadPhases === next.onLoadPhases &&
  prev.onAddPhase === next.onAddPhase &&
  prev.onUpdatePhase === next.onUpdatePhase &&
  prev.onDeletePhase === next.onDeletePhase &&
  prev.onAddPhaseItem === next.onAddPhaseItem &&
  prev.onUpdatePhaseItem === next.onUpdatePhaseItem &&
  prev.onDeletePhaseItem === next.onDeletePhaseItem &&
  prev.onUpdatePhaseTitleLocal === next.onUpdatePhaseTitleLocal &&
  prev.onUpdatePhaseItemTitleLocal === next.onUpdatePhaseItemTitleLocal,
);
