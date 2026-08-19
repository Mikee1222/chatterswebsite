"use client";

/**
 * Per-item task timer control — inline next to a checklist item row.
 * Visually distinct from the completion checkbox (timing ≠ completion).
 * Requires active non-paused shift. One active timer per VA globally.
 */

import * as React from "react";
import { Square, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStepType } from "@/lib/task-step-types";

export type TaskTimerEntry = {
  id: string;
  va_task_id: string;
  task_phase_item_id: string;
  category: TaskStepType;
  started_at: string;
};

/** Isolated 1s tick — only this span re-renders, not sibling timers or the card. */
const LiveDurationDisplay = React.memo(function LiveDurationDisplay({
  startedAt,
}: {
  startedAt: string;
}) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="font-mono tabular-nums opacity-80">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
});

type Props = {
  vaTaskId: string;
  taskPhaseItemId: string;
  category: TaskStepType;
  /** Categories that the admin has enabled for timing */
  enabledCategories: TaskStepType[];
  /** Whether the VA has an active non-paused shift */
  onShift: boolean;
  /** VA-wide active entry (lifted to parent card) */
  activeEntry: TaskTimerEntry | null;
  onActiveEntryChange: (entry: TaskTimerEntry | null) => void;
  disabled?: boolean;
};

export const CategoryTaskTimer = React.memo(function CategoryTaskTimer({
  vaTaskId,
  taskPhaseItemId,
  category,
  enabledCategories,
  onShift,
  activeEntry,
  onActiveEntryChange,
  disabled = false,
}: Props) {
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const timerEnabled = enabledCategories.includes(category);
  const isActive = activeEntry?.task_phase_item_id === taskPhaseItemId;

  if (!timerEnabled || disabled) return null;

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onShift || acting) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/va/task-timer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          va_task_id: vaTaskId,
          task_phase_item_id: taskPhaseItemId,
          category,
        }),
      });
      const d = (await res.json()) as { entry?: TaskTimerEntry; error?: string };
      if (!res.ok || !d.entry) throw new Error(d.error ?? "Failed to start timer");
      onActiveEntryChange(d.entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  const handleEnd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!activeEntry || acting) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/va/task-timer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", entry_id: activeEntry.id }),
      });
      const d = (await res.json()) as { entry?: TaskTimerEntry; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed to end timer");
      onActiveEntryChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      {isActive ? (
        <button
          type="button"
          onClick={(e) => void handleEnd(e)}
          disabled={acting}
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition",
            "border-[#D4AF8C]/40 bg-[#D4AF8C]/10 text-[#D4AF8C]",
            "hover:bg-[#D4AF8C]/20 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Square className="h-2.5 w-2.5 fill-current" aria-hidden />
          End
          {activeEntry?.started_at ? <LiveDurationDisplay startedAt={activeEntry.started_at} /> : null}
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => void handleStart(e)}
          disabled={!onShift || acting}
          title={!onShift ? "Start or resume your shift to use task timer" : "Start timing this item"}
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition",
            "border-white/10 bg-white/[0.03] text-white/45",
            "hover:border-white/18 hover:bg-white/[0.06] hover:text-white/70",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Play className="h-2.5 w-2.5" aria-hidden />
          Start
        </button>
      )}
      {error ? <span className="max-w-[8rem] truncate text-[9px] text-red-400">{error}</span> : null}
    </div>
  );
});

/** Fetch the VA's single active item-timer (shared across all items on a task card). */
export function useVaActiveTaskTimer(enabled: boolean): {
  activeEntry: TaskTimerEntry | null;
  setActiveEntry: React.Dispatch<React.SetStateAction<TaskTimerEntry | null>>;
  loading: boolean;
} {
  const [activeEntry, setActiveEntry] = React.useState<TaskTimerEntry | null>(null);
  const [loading, setLoading] = React.useState(enabled);

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/va/task-timer", { credentials: "include" })
      .then((r) => r.json() as Promise<{ entry?: TaskTimerEntry | null }>)
      .then((d) => {
        if (!cancelled) setActiveEntry(d.entry ?? null);
      })
      .catch(() => {
        /* silent */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { activeEntry, setActiveEntry, loading };
}
