"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  ImageIcon,
  X,
} from "lucide-react";
import { formatDateTimeAthens } from "@/lib/format";
import { FindingCard, ReviewLoadingState } from "@/components/manager-review-ui";
import type { TaskPhase } from "@/services/task-phases";
import type { VaTaskRecord } from "@/types";
import { cn } from "@/lib/utils";
import { VA_CARD, VA_CHAMPAGNE_DIVIDER, VA_MODEL_TAG, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import {
  buildAgencyProgressStats,
  buildVaProgressSummaries,
  type VaProgressSummary,
  type VaTaskProgressStatus,
  type VaTaskWithPhases,
} from "@/lib/va-tasks-progress";

const STATUS_GLOW: Record<VaTaskProgressStatus, string> = {
  complete:
    "border-emerald-500/25 shadow-[0_0_28px_-10px_rgba(16,185,129,0.35)] before:bg-emerald-500/20",
  partial: "border-[#FF1493]/25 shadow-[0_0_28px_-10px_rgba(255,20,147,0.35)] before:bg-[#FF1493]/20",
  not_started: "border-white/[0.08] shadow-[0_0_20px_-12px_rgba(0,0,0,0.5)] before:bg-white/5",
};

const STATUS_LABEL: Record<VaTaskProgressStatus, string> = {
  complete: "Complete",
  partial: "In progress",
  not_started: "Not started",
};

const STATUS_BADGE: Record<VaTaskProgressStatus, string> = {
  complete: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  partial: "border-[#FF1493]/35 bg-[#FF1493]/10 text-[#FF1493]",
  not_started: "border-white/12 bg-white/[0.04] text-[#B8B4B8]/60",
};

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#FF1493] via-[#E91E8C] to-[#D4AF8C] transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      />
    </div>
  );
}

function ModelTags({ names, className }: { names: string[]; className?: string }) {
  if (names.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {names.map((name) => (
        <span key={name} className={VA_MODEL_TAG}>
          {name}
        </span>
      ))}
    </span>
  );
}

function ScreenshotBadge({ required, provided }: { required: number; provided: number }) {
  if (required === 0) return null;
  const complete = provided >= required;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        complete
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-[#D4AF8C]/30 bg-[#D4AF8C]/8 text-[#D4AF8C]",
      )}
      title={`Screenshots: ${provided}/${required} provided`}
    >
      <Camera className="h-3 w-3" aria-hidden />
      {provided}/{required}
    </span>
  );
}

function ReadOnlyItemRow({
  item,
}: {
  item: TaskPhase["items"][number];
}) {
  const done = item.status === "completed";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-2 py-1.5",
        done && "bg-[#D4AF8C]/[0.04]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          done
            ? "border-[#D4AF8C]/50 bg-[#D4AF8C]/20 text-[#D4AF8C]"
            : "border-white/15 bg-transparent text-transparent",
        )}
        aria-hidden
      >
        {done ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5 text-red-400/50" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <p
            className={cn(
              "flex-1 text-sm leading-snug",
              done ? "text-[#B8B4B8]/40 line-through" : "text-[#B8B4B8]",
            )}
          >
            {item.title || "—"}
          </p>
          {item.requires_screenshot ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium",
                (item.screenshot?.length ?? 0) > 0 ? "text-emerald-400/80" : "text-[#D4AF8C]/70",
              )}
              title={
                (item.screenshot?.length ?? 0) > 0 ? "Screenshot provided" : "Screenshot required — not provided"
              }
            >
              {(item.screenshot?.length ?? 0) > 0 ? (
                <ImageIcon className="h-3 w-3" aria-hidden />
              ) : (
                <Camera className="h-3 w-3" aria-hidden />
              )}
            </span>
          ) : null}
        </div>
        {done && item.completed_at ? (
          <p className="mt-0.5 text-[11px] text-[#B8B4B8]/40">
            {item.completed_by_va_name?.trim() || "VA"}
            {" · "}
            {formatDateTimeAthens(item.completed_at)}
          </p>
        ) : null}
        {done && (item.screenshot?.length ?? 0) > 0 && item.screenshot?.[0]?.url ? (
          <a
            href={item.screenshot[0].url}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[#D4AF8C]/75 hover:text-[#D4AF8C]"
          >
            <ImageIcon className="h-3 w-3" aria-hidden />
            View proof
          </a>
        ) : null}
      </div>
    </div>
  );
}

function PhaseBlock({
  phase,
  phaseIndex,
  defaultExpanded,
}: {
  phase: TaskPhase;
  phaseIndex: number;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const items = phase.items ?? [];
  const doneCount = items.filter((i) => i.status === "completed").length;
  const total = items.length;
  const overdue =
    phase.status === "overdue" ||
    (phase.status !== "completed" && Boolean(phase.scheduled_time) && new Date(phase.scheduled_time!).getTime() < Date.now());

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0D0B0D]/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.02]"
        aria-expanded={expanded}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#D4AF8C]/25 bg-[#D4AF8C]/8 text-[10px] font-semibold tabular-nums text-[#D4AF8C]">
          {phaseIndex + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{phase.title || `Phase ${phaseIndex + 1}`}</p>
          {overdue ? (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-red-400">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Overdue
            </p>
          ) : null}
        </div>
        {total > 0 ? (
          <span className="shrink-0 rounded-md border border-[#D4AF8C]/20 bg-[#D4AF8C]/8 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#D4AF8C]">
            {doneCount}/{total}
          </span>
        ) : null}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-[#B8B4B8]/40 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      {expanded && items.length > 0 ? (
        <div className="space-y-0.5 border-t border-white/[0.05] px-2 py-2">
          {items.map((item) => (
            <ReadOnlyItemRow key={item.id} item={item} />
          ))}
        </div>
      ) : null}
      {expanded && items.length === 0 ? (
        <p className="border-t border-white/[0.05] px-3 py-3 text-xs text-[#B8B4B8]/35">No checklist items</p>
      ) : null}
    </div>
  );
}

function VaProgressCard({ summary }: { summary: VaProgressSummary }) {
  return (
    <FindingCard
      className={cn(
        "relative overflow-hidden before:pointer-events-none before:absolute before:-inset-1 before:-z-10 before:rounded-[20px] before:opacity-50 before:blur-lg",
        STATUS_GLOW[summary.status],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{summary.vaName}</h3>
            {summary.modelNames ? <ModelTags names={summary.modelNames} /> : null}
            <span className={cn(VA_STATUS_BADGE, STATUS_BADGE[summary.status])}>{STATUS_LABEL[summary.status]}</span>
            {summary.hasOverdue ? (
              <span className={cn(VA_STATUS_BADGE, "border-red-500/35 bg-red-500/10 text-red-300")}>
                <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
                Overdue
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[#B8B4B8]/55">
            {summary.completedItems}/{summary.totalItems} items done
            {summary.tasks.length > 1 ? ` · ${summary.tasks.length} tasks` : ""}
          </p>
        </div>
        <ScreenshotBadge required={summary.screenshotsRequired} provided={summary.screenshotsProvided} />
      </div>

      <ProgressBar value={summary.completedItems} max={summary.totalItems} className="mt-4" />

      {summary.notes.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">Observations</p>
          {summary.notes.map((note, i) => (
            <p key={i} className="rounded-lg border border-[#D4AF8C]/15 bg-[#D4AF8C]/[0.04] px-3 py-2 text-sm italic leading-relaxed text-[#B8B4B8]/75">
              &ldquo;{note}&rdquo;
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {summary.tasks.map(({ task, phases }) => {
          const taskModelNames = (task.assigned_model_names ?? []).map((n) => n.trim()).filter(Boolean);
          const showTaskModels = taskModelNames.length > 0 && summary.modelNames === null;
          return (
          <div key={task.id}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-[#B8B4B8]/50">{task.title}</p>
              {showTaskModels ? <ModelTags names={taskModelNames} /> : null}
            </div>
            <div className="space-y-2">
              {phases.map((phase, idx) => (
                <PhaseBlock key={phase.id} phase={phase} phaseIndex={idx} defaultExpanded={idx === 0} />
              ))}
              {phases.length === 0 ? (
                <p className="text-xs text-[#B8B4B8]/35">No phases defined for this task</p>
              ) : null}
            </div>
          </div>
          );
        })}
      </div>
    </FindingCard>
  );
}

function AgencySummaryHeader({ stats }: { stats: ReturnType<typeof buildAgencyProgressStats> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {[
        { label: "VAs with tasks", value: stats.vasWithTasks, color: "text-white" },
        { label: "Fully complete", value: stats.fullyComplete, color: "text-emerald-400" },
        { label: "Partial", value: stats.partial, color: "text-[#FF1493]" },
        { label: "Not started", value: stats.notStarted, color: "text-[#B8B4B8]/60" },
        {
          label: "Overall completion",
          value: `${stats.overallPct}%`,
          sub: stats.totalItems > 0 ? `${stats.completedItems}/${stats.totalItems} items` : undefined,
          color: "text-[#D4AF8C]",
        },
      ].map((s) => (
        <div key={s.label} className={cn(VA_CARD, "p-4 hover:translate-y-0")}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B8B4B8]/45">{s.label}</p>
          <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", s.color)}>{s.value}</p>
          {"sub" in s && s.sub ? <p className="mt-0.5 text-[11px] text-[#B8B4B8]/40">{s.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}

type Props = {
  tasks: VaTaskRecord[];
  vaUsers: Array<{ id: string; full_name: string; email: string }>;
  staffUsers: Array<{ id: string; full_name: string; email: string }>;
  nameById: Record<string, string>;
  taskPhases: Record<string, TaskPhase[]>;
  phasesLoading: boolean;
  phasesError: string | null;
  onLoadPhases: () => void;
};

export function AdminVaTasksProgressOverview({
  tasks,
  vaUsers,
  staffUsers,
  nameById,
  taskPhases,
  phasesLoading,
  phasesError,
  onLoadPhases,
}: Props) {
  const tasksWithPhases = React.useMemo<VaTaskWithPhases[]>(
    () => tasks.map((task) => ({ task, phases: taskPhases[task.id] ?? [] })),
    [tasks, taskPhases],
  );

  const summaries = React.useMemo(
    () => buildVaProgressSummaries(tasksWithPhases, vaUsers, nameById, staffUsers),
    [tasksWithPhases, vaUsers, nameById, staffUsers],
  );

  const agencyStats = React.useMemo(() => buildAgencyProgressStats(summaries), [summaries]);

  if (tasks.length === 0) {
    return (
      <div className={cn(VA_CARD, "flex flex-col items-center justify-center px-6 py-14 text-center")}>
        <ClipboardList className="mb-4 h-12 w-12 text-[#D4AF8C]/30" aria-hidden />
        <p className="text-base font-semibold text-white/90">No tasks for this date</p>
        <p className="mt-2 max-w-sm text-sm text-[#B8B4B8]/55">Pick another day to see VA progress.</p>
      </div>
    );
  }

  if (phasesLoading) {
    return <ReviewLoadingState label="Loading phase progress…" />;
  }

  if (phasesError) {
    return (
      <div className={cn(VA_CARD, "flex flex-col items-center gap-4 px-6 py-12 text-center")}>
        <p className="text-sm text-red-400">{phasesError}</p>
        <button
          type="button"
          onClick={onLoadPhases}
          className="rounded-xl border border-[#D4AF8C]/30 px-4 py-2 text-sm text-[#D4AF8C] hover:bg-[#D4AF8C]/10"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AgencySummaryHeader stats={agencyStats} />

      <div className={cn(VA_CHAMPAGNE_DIVIDER, "h-px")} />

      {summaries.length === 0 ? (
        <div className={cn(VA_CARD, "px-6 py-12 text-center")}>
          <p className="text-sm text-[#B8B4B8]/55">No VAs are assigned to tasks on this date.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {summaries.map((summary) => (
            <VaProgressCard key={summary.vaId} summary={summary} />
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-[#B8B4B8]/35">
        Item completion timestamps shown when tracked at checklist completion. Phase-level start/end times are not shown in this view.
      </p>
    </div>
  );
}

export function AdminVaTasksViewToggle({
  viewMode,
  onChange,
  showList = true,
  showProgress = true,
  className,
}: {
  viewMode: "list" | "progress";
  onChange: (mode: "list" | "progress") => void;
  showList?: boolean;
  showProgress?: boolean;
  className?: string;
}) {
  const modes = (
    [
      showList ? ({ mode: "list" as const, label: "List" }) : null,
      showProgress ? ({ mode: "progress" as const, label: "Progress Overview" }) : null,
    ] as const
  ).filter(Boolean) as Array<{ mode: "list" | "progress"; label: string }>;

  if (modes.length === 0) return null;

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-white/[0.08] bg-[#0D0B0D]/70 p-0.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]",
        className,
      )}
      role="group"
      aria-label="View mode"
    >
      {modes.map(({ mode, label }) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition duration-200 motion-reduce:transition-none",
              active
                ? "border border-[#FF1493]/35 bg-[#FF1493]/12 text-[#FFB3D9] shadow-[0_0_14px_-4px_rgba(255,20,147,0.35)]"
                : "border border-transparent text-[#B8B4B8]/60 hover:text-[#B8B4B8]/85",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
