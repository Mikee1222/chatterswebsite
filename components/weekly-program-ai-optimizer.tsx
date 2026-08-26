"use client";

import * as React from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Suggestion = {
  chatter_id: string;
  chatter_name: string;
  model_ids: string[];
  model_names: string[];
  day: string;
  shift_type: string;
  rationale: string;
  score_hint: number | null;
};

type Props = {
  weekStart: string;
};

export function WeeklyProgramAiOptimizer({ weekStart }: Props) {
  const [open, setOpen] = React.useState(false);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [rejected, setRejected] = React.useState<Set<string>>(new Set());
  const [accepted, setAccepted] = React.useState<Set<string>>(new Set());

  async function generate(force: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/schedule-optimizer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, force }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        suggestions?: Suggestion[];
        summary?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to suggest schedule");
      setSuggestions(data.suggestions ?? []);
      setSummary(data.summary ?? null);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSuggestion(s: Suggestion) {
    const key = `${s.chatter_id}:${s.day}:${s.shift_type}`;
    setConfirming(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/schedule-optimizer", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          suggestion: { ...s, week_start: weekStart },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok) throw new Error(data.error || "Could not create shift");
      setAccepted((prev) => new Set(prev).add(key));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setConfirming(null);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void generate(false)}
        disabled={loading}
        className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-2")}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Suggest a schedule (AI)
      </button>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {open ? (
        <div className={cn(VA_CARD, VA_CARD_GLOW, "p-4")}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">AI schedule suggestions</h3>
              <p className="text-xs text-white/50">Suggestion-only — accept creates a shift</p>
            </div>
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "text-xs")}
              onClick={() => void generate(true)}
              disabled={loading}
            >
              Regenerate
            </button>
          </div>
          {summary ? <p className="mb-3 text-sm text-white/70">{summary}</p> : null}
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const key = `${s.chatter_id}:${s.day}:${s.shift_type}`;
              if (rejected.has(key)) return null;
              const done = accepted.has(key);
              return (
                <li
                  key={key}
                  className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {s.chatter_name} · {s.day} · {s.shift_type}
                      </p>
                      <p className="text-xs text-white/50">
                        {(s.model_names.length ? s.model_names : s.model_ids).join(", ") || "No models"}
                      </p>
                      <p className="mt-1 text-xs text-white/65">{s.rationale}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        disabled={done || confirming === key || s.model_ids.length === 0}
                        onClick={() => void confirmSuggestion(s)}
                        className={cn(
                          VA_BTN_SECONDARY,
                          "inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-200",
                        )}
                        title={s.model_ids.length === 0 ? "Missing model IDs" : "Accept & create"}
                      >
                        {confirming === key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        {done ? "Created" : "Accept"}
                      </button>
                      <button
                        type="button"
                        disabled={done}
                        onClick={() => setRejected((prev) => new Set(prev).add(key))}
                        className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1 px-2 py-1 text-xs")}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
