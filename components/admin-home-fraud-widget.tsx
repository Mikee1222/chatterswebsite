"use client";

import * as React from "react";
import { AlertTriangle, Info, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Flag = {
  id: string;
  kind: string;
  severity: "warn" | "critical" | "notable";
  model_name: string;
  title: string;
  evidence: string[];
  ai_explanation: string | null;
  metrics: Record<string, number | string | null>;
};

function sanitizeSummary(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  // Guard against cached/truncated AI dumps that look like JSON or markdown fences.
  if (t.startsWith("```") || t.startsWith("{") || t.startsWith("[")) return null;
  return t;
}

export function AdminHomeFraudWidget() {
  const [flags, setFlags] = React.useState<Flag[]>([]);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/fraud-anomalies", {
        method: force ? "POST" : "GET",
        credentials: "include",
        headers: force ? { "Content-Type": "application/json" } : undefined,
        body: force ? JSON.stringify({ force: true, notify: true }) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as {
        flags?: Flag[];
        summary?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load fraud scan");
      setFlags(data.flags ?? []);
      setSummary(sanitizeSummary(data.summary));
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

  const riskFlags = flags.filter((f) => f.severity === "critical" || f.severity === "warn");
  const notableFlags = flags.filter((f) => f.severity === "notable");
  // Prefer fraud-risk in the card; fill with notable only if room.
  const displayFlags = [...riskFlags, ...notableFlags].slice(0, 5);

  return (
    <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-300" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-white">AI fraud / anomaly flags</h2>
            <p className="text-xs text-white/50">Grounded in Infloww txs + refunds</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing || loading}
          className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs")}
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Rescan
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning…
        </div>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : flags.length === 0 ? (
        <p className="text-sm text-white/60">{summary || "No anomaly flags in the current window."}</p>
      ) : (
        <div className="space-y-3">
          {summary ? <p className="text-sm text-white/70">{summary}</p> : null}
          {riskFlags.length === 0 && notableFlags.length > 0 ? (
            <p className="text-xs text-white/45">
              No fraud-risk flags — {notableFlags.length} notable large tx(s) only.
            </p>
          ) : null}
          <ul className="space-y-2">
            {displayFlags.map((f) => {
              const isNotable = f.severity === "notable";
              const Icon = isNotable ? Info : AlertTriangle;
              return (
                <li
                  key={f.id}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        f.severity === "critical"
                          ? "text-rose-400"
                          : f.severity === "warn"
                            ? "text-amber-300"
                            : "text-sky-300/80",
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">{f.title}</p>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            f.severity === "critical" && "bg-rose-500/20 text-rose-200",
                            f.severity === "warn" && "bg-amber-500/20 text-amber-100",
                            isNotable && "bg-sky-500/15 text-sky-200/90",
                          )}
                        >
                          {isNotable ? "notable" : f.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/55">
                        {f.ai_explanation || f.evidence[0] || f.kind}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {flags.length > displayFlags.length ? (
            <p className="text-xs text-white/40">+{flags.length - displayFlags.length} more flags</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
