"use client";

import * as React from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Props = {
  todaySalesUsd: number;
  sparklineWowPct: number | null;
  topChatterName: string;
  topChatterRevenue: number;
  topModelName: string;
  topModelRevenue: number;
  monthlyRevenue: number;
  pendingCustoms: number;
  activeChatterShifts: number;
  activeVaShifts: number;
};

export function AdminHomeAiBriefingCard(props: Props) {
  const [text, setText] = React.useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const payload = React.useMemo(
    () => ({
      todaySalesUsd: props.todaySalesUsd,
      sparklineWowPct: props.sparklineWowPct,
      topChatterName: props.topChatterName,
      topChatterRevenue: props.topChatterRevenue,
      topModelName: props.topModelName,
      topModelRevenue: props.topModelRevenue,
      monthlyRevenue: props.monthlyRevenue,
      pendingCustoms: props.pendingCustoms,
      activeChatterShifts: props.activeChatterShifts,
      activeVaShifts: props.activeVaShifts,
    }),
    [props],
  );

  const loadCached = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/home-briefing", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string | null;
        generated_at?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load briefing");
      if (data.text) {
        setText(data.text);
        setGeneratedAt(data.generated_at ?? null);
      } else {
        // Auto-generate once when no cache
        await generate(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  async function generate(force: boolean) {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/home-briefing", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, force }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        generated_at?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      setText(data.text ?? null);
      setGeneratedAt(data.generated_at ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadCached();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  return (
    <section className={cn(VA_CARD, VA_CARD_GLOW, "p-4 md:p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI daily briefing
          </p>
          <p className="mt-1 text-xs text-white/40">
            Grounded in today&apos;s earnings, ops queues, and IG Needs Attention
          </p>
        </div>
        <button
          type="button"
          className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 text-xs")}
          disabled={refreshing || loading}
          onClick={() => void generate(true)}
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Refresh
        </button>
      </div>

      {loading && !text ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparing briefing…
        </p>
      ) : error && !text ? (
        <p className="mt-3 text-sm text-rose-300/90">{error}</p>
      ) : text ? (
        <p className="mt-3 text-sm leading-relaxed text-white/80">{text}</p>
      ) : (
        <p className="mt-3 text-sm text-white/45">No briefing yet.</p>
      )}

      {generatedAt ? (
        <p className="mt-2 text-[11px] text-white/30">
          Updated {new Date(generatedAt).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}
