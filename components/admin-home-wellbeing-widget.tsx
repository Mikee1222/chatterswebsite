"use client";

import * as React from "react";
import { HeartHandshake, Loader2, RefreshCw } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Signal = {
  person_id: string;
  person_name: string;
  role: string;
  headline: string;
  evidence: string[];
  ai_note: string | null;
};

/** Admin-only. Never render this for the subject user. */
export function AdminHomeWellbeingWidget() {
  const [signals, setSignals] = React.useState<Signal[]>([]);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/wellbeing-signals", {
        method: force ? "POST" : "GET",
        credentials: "include",
        headers: force ? { "Content-Type": "application/json" } : undefined,
        body: force ? JSON.stringify({ force: true, notify: true }) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as {
        signals?: Signal[];
        summary?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load signals");
      setSignals(data.signals ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-sky-300" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-white">Private check-in signals</h2>
            <p className="text-xs text-amber-200/70">Admin-only · never shown to the person</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing || loading}
          className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs")}
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning notes…
        </div>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : signals.length === 0 ? (
        <p className="text-sm text-white/60">{summary || "No notable trends."}</p>
      ) : (
        <ul className="space-y-2">
          {signals.slice(0, 4).map((s) => (
            <li key={s.person_id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
              <p className="text-sm font-medium text-white">
                {s.person_name}{" "}
                <span className="text-xs font-normal text-white/40">({s.role})</span>
              </p>
              <p className="mt-1 text-xs text-white/65">{s.headline}</p>
              <p className="mt-1 text-xs text-white/45">{s.evidence.slice(0, 2).join(" · ")}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
