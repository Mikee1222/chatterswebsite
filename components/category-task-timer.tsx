"use client";

/**
 * Per-category task timer button.
 * Shown inline per phase when the category has timer enabled by admin.
 * Visually distinct from shift-level Start/Pause/End controls.
 */

import * as React from "react";
import { Timer, Square, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStepType } from "@/lib/task-step-types";

type TimerEntry = {
  id: string;
  category: TaskStepType;
  started_at: string;
};

function useLiveDuration(startedAt: string | null): string {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const tick = () => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Props = {
  vaTaskId: string;
  category: TaskStepType;
  /** Categories that the admin has enabled for timing */
  enabledCategories: TaskStepType[];
  /** Whether the VA has an active non-paused shift */
  onShift: boolean;
};

export function CategoryTaskTimer({ vaTaskId, category, enabledCategories, onShift }: Props) {
  const [activeEntry, setActiveEntry] = React.useState<TimerEntry | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const timerEnabled = enabledCategories.includes(category);
  const duration = useLiveDuration(activeEntry?.started_at ?? null);

  // Fetch on mount / task id change
  React.useEffect(() => {
    if (!timerEnabled) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/va/task-timer?va_task_id=${encodeURIComponent(vaTaskId)}`, { credentials: "include" })
      .then((r) => r.json() as Promise<{ entry?: TimerEntry | null; enabledCategories?: TaskStepType[] }>)
      .then((d) => {
        if (cancelled) return;
        const entry = d.entry && d.entry.category === category ? d.entry : null;
        setActiveEntry(entry ?? null);
      })
      .catch(() => {/* silently fail initial fetch */})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [vaTaskId, category, timerEnabled]);

  if (!timerEnabled) return null;
  if (loading) return null; // don't flash a loading state

  const isActive = activeEntry !== null;

  const handleStart = async () => {
    if (!onShift || acting) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/va/task-timer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", va_task_id: vaTaskId, category }),
      });
      const d = (await res.json()) as { entry?: TimerEntry; error?: string };
      if (!res.ok || !d.entry) throw new Error(d.error ?? "Failed to start timer");
      setActiveEntry(d.entry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  const handleEnd = async () => {
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
      const d = (await res.json()) as { entry?: TimerEntry; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed to end timer");
      setActiveEntry(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      {isActive ? (
        <button
          type="button"
          onClick={() => void handleEnd()}
          disabled={acting}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
            "border-[#D4AF8C]/40 bg-[#D4AF8C]/10 text-[#D4AF8C]",
            "hover:bg-[#D4AF8C]/20 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Square className="h-3 w-3 fill-current" aria-hidden />
          End Task
          <span className="ml-1 font-mono tabular-nums opacity-80">{duration}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={!onShift || acting}
          title={!onShift ? "Start or resume your shift to use task timer" : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
            "border-white/12 bg-white/[0.04] text-white/55",
            "hover:border-white/20 hover:bg-white/[0.07] hover:text-white/80",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Play className="h-3 w-3" aria-hidden />
          Start Task
        </button>
      )}
      <span className="flex items-center gap-1 text-[10px] text-white/25">
        <Timer className="h-3 w-3" />
        {category}
      </span>
      {error ? <span className="text-[10px] text-red-400">{error}</span> : null}
    </div>
  );
}
