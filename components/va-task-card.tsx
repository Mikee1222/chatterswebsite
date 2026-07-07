"use client";

import * as React from "react";
import {
  AlertTriangle,
  Calendar,
  Camera,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  Smartphone,
} from "lucide-react";
import { formatDateEuropean } from "@/lib/format";
import { getSocialColor } from "@/lib/social-platform-config";
import type { VaTaskRecord, VaTaskPriority, VaTaskStatus } from "@/types";
import type { PhaseItem, TaskPhase } from "@/services/task-phases";
import type { SocialAccount } from "@/services/marketing";
import { cn } from "@/lib/utils";
import {
  VA_CARD,
  VA_MODEL_TAG,
  VA_STATUS_BADGE,
  VA_BTN_SECONDARY,
  VA_CHAMPAGNE_DIVIDER,
} from "@/lib/va-tasks-tokens";
import { TaskPhaseRibbon, type PhaseRibbonItem, type PhaseRibbonPhase } from "@/components/task-phase-ribbon";
import { ChampagneCheckbox } from "@/components/va-tasks-champagne-checkbox";

/** Stable empty array so React.memo is not busted by `?? []` on every parent render. */
export const EMPTY_TASK_PHASES: TaskPhase[] = [];

function isPastDue(isoLike: string | null | undefined): boolean {
  if (!isoLike?.trim()) return false;
  const t = new Date(isoLike.trim()).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
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

function assigneeLabel(task: VaTaskRecord, userName: string): string {
  if (task.assigned_to_ids.length === 0) return "All VAs";
  if (task.assigned_to_ids.length === 1) return userName.trim() || "Assigned VA";
  const extra = task.assigned_to_ids.length - 1;
  return userName.trim() ? `${userName.trim()} + ${extra} more` : `${task.assigned_to_ids.length} VAs`;
}

const PriorityBadge = React.memo(function PriorityBadge({ priority }: { priority: VaTaskPriority }) {
  const k = (priority || "normal").toLowerCase();
  const variant =
    k === "urgent"
      ? "border-red-500/45 bg-red-500/15 text-red-200"
      : k === "high"
        ? "border-[#D4AF8C]/45 bg-[#D4AF8C]/12 text-[#D4AF8C]"
        : "border-white/12 bg-white/[0.05] text-[#B8B4B8]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
  return <span className={cn(VA_STATUS_BADGE, variant)}>{priority}</span>;
});

const TaskStatusBadge = React.memo(function TaskStatusBadge({ status }: { status: VaTaskStatus }) {
  const k = (status || "").toLowerCase();
  const variant =
    k === "pending"
      ? "border-white/14 bg-white/[0.05] text-[#B8B4B8]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      : k === "done"
        ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/12 text-[#D4AF8C]"
        : k === "skipped"
          ? "border-red-500/40 bg-red-500/12 text-red-300"
          : "border-[#FF1493]/40 bg-[#FF1493]/12 text-[#FF1493]";
  return <span className={cn(VA_STATUS_BADGE, variant)}>{status.replace(/_/g, " ")}</span>;
});

export type VaTaskCardProps = {
  task: VaTaskRecord;
  userName: string;
  onShift: boolean;
  isCompleting: boolean;
  phases: TaskPhase[];
  getModelAccounts: (modelId: string) => SocialAccount[];
  onLoadPhases: (task: VaTaskRecord) => void | Promise<void>;
  onMarkComplete: (task: VaTaskRecord, e?: React.MouseEvent) => void;
  onOpenTask: (task: VaTaskRecord) => void;
  onStartCompleteItem: (item: PhaseItem, taskId: string) => void;
  onShadowbanReport: (acc: SocialAccount) => void;
};

function allPhasesCompleted(phases: TaskPhase[]): boolean {
  if (phases.length === 0) return false;
  return phases.every((p) => p.status === "completed");
}

function showDoneButton(task: VaTaskRecord, phases: TaskPhase[]): boolean {
  if (task.status === "done" || task.status === "skipped") return false;
  return task.status === "in_progress" || allPhasesCompleted(phases);
}

export const VaTaskCard = React.memo(function VaTaskCard({
  task,
  userName,
  onShift,
  isCompleting,
  phases,
  getModelAccounts,
  onLoadPhases,
  onMarkComplete,
  onOpenTask,
  onStartCompleteItem,
  onShadowbanReport,
}: VaTaskCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const overdue = isPastDue(task.due_date) && task.status !== "done" && task.status !== "skipped";
  const modelNames = task.assigned_model_names ?? [];
  const showDone = showDoneButton(task, phases);

  const toggleExpanded = React.useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      if (next) void onLoadPhases(task);
      return next;
    });
  }, [onLoadPhases, task]);

  const renderPhaseExtra = React.useCallback(
    (phase: PhaseRibbonPhase) => {
      const accs = phase.assigned_model_id ? getModelAccounts(phase.assigned_model_id) : [];
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
                            onShadowbanReport(acc);
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
    },
    [getModelAccounts, onShadowbanReport],
  );

  const renderItem = React.useCallback(
    (item: PhaseRibbonItem, phase: PhaseRibbonPhase) => {
      const itemDisabled = !onShift || item.status === "completed" || phase.status === "overdue";
      return (
        <div className="flex items-start gap-3">
          <ChampagneCheckbox
            checked={item.status === "completed"}
            disabled={itemDisabled}
            title={!onShift ? "Start your shift to complete items" : undefined}
            onClick={() => {
              if (itemDisabled) return;
              const fullItem = phases.flatMap((p) => p.items ?? []).find((i) => i.id === item.id);
              if (!fullItem) return;
              onStartCompleteItem(fullItem, task.id);
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
    },
    [onShift, onStartCompleteItem, phases, task.id],
  );

  return (
    <article
      className={cn(
        VA_CARD,
        "overflow-hidden",
        expanded && "border-[#FF1493]/35",
        task.status === "done" && !expanded && "opacity-70",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 p-5 pb-3 text-left"
        onClick={toggleExpanded}
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
          {showDone ? (
            <button
              type="button"
              onClick={(e) => void onMarkComplete(task, e)}
              disabled={!onShift || isCompleting}
              title={!onShift ? "Start your shift to mark tasks done" : undefined}
              className={cn(VA_BTN_SECONDARY, "shrink-0 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40")}
            >
              {isCompleting ? "Saving…" : "Mark done"}
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
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
                onClick={() => onOpenTask(task)}
                className="text-xs font-medium text-[#FF1493]/80 transition hover:text-[#FF1493]"
              >
                Details &amp; notes
              </button>
            </div>

            <TaskPhaseRibbon phases={phases} renderPhaseExtra={renderPhaseExtra} renderItem={renderItem} />
          </div>
        </div>
      ) : null}
    </article>
  );
}, (prev, next) =>
  prev.task === next.task &&
  prev.userName === next.userName &&
  prev.onShift === next.onShift &&
  prev.isCompleting === next.isCompleting &&
  prev.phases === next.phases &&
  prev.getModelAccounts === next.getModelAccounts &&
  prev.onLoadPhases === next.onLoadPhases &&
  prev.onMarkComplete === next.onMarkComplete &&
  prev.onOpenTask === next.onOpenTask &&
  prev.onStartCompleteItem === next.onStartCompleteItem &&
  prev.onShadowbanReport === next.onShadowbanReport,
);
