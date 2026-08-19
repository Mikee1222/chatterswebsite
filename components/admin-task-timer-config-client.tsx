"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { TimerConfig } from "@/services/task-category-timer";
import type { TaskStepType } from "@/lib/task-step-types";

const CATEGORY_DESCRIPTIONS: Record<TaskStepType, string> = {
  "IP Check": "IP verification steps at the start of a shift",
  "Warm-up": "Account warming and early engagement",
  Posting: "Content posting tasks",
  Engagement: "Fan engagement, replies, and DMs",
  Other: "Uncategorised checklist items",
};

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1493]/60",
        enabled ? "bg-[#FF1493]" : "bg-white/15",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function AdminTaskTimerConfigClient({
  initialConfigs,
  embedded = false,
}: {
  initialConfigs: TimerConfig[];
  /** When true, page header is omitted (used inside Tasks Settings tabs). */
  embedded?: boolean;
}) {
  const [configs, setConfigs] = React.useState(initialConfigs);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);

  const toggle = React.useCallback(async (category: TaskStepType, enabled: boolean) => {
    setSaving(category);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/admin/task-timer-config", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, timer_enabled: enabled }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Failed to save");
      }
      setConfigs((prev) => prev.map((c) => (c.category === category ? { ...c, timer_enabled: enabled } : c)));
      setSaved(category);
      setTimeout(() => setSaved(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-semibold text-white">Category Task Timers</h1>
          <p className="mt-1 text-sm text-white/50">
            Enable the Start Task / End Task timer for specific step-type categories. When enabled,
            VAs will see a timer button inline with that category&apos;s checklist items.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="divide-y divide-white/8 rounded-2xl border border-white/8 bg-white/[0.03]">
        {configs.map((config) => (
          <div key={config.category} className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{config.category}</p>
              <p className="text-xs text-white/40">{CATEGORY_DESCRIPTIONS[config.category]}</p>
            </div>
            <div className="flex items-center gap-3">
              {saved === config.category ? (
                <span className="text-xs text-emerald-400">Saved</span>
              ) : null}
              <Toggle
                enabled={config.timer_enabled}
                onChange={(v) => void toggle(config.category, v)}
                disabled={saving === config.category}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/30">
        Changes take effect immediately — VAs will see updated timer controls on their next page load.
      </p>
    </div>
  );
}
