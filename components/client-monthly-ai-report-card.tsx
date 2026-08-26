"use client";

import * as React from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

function defaultYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function ClientMonthlyAiReportCard() {
  const [yearMonth, setYearMonth] = React.useState(defaultYearMonth);
  const [text, setText] = React.useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function generate(force: boolean, ym = yearMonth) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/ai/monthly-report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth: ym, force }),
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
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/client/ai/monthly-report?yearMonth=${encodeURIComponent(yearMonth)}`,
          { credentials: "include" },
        );
        const data = (await res.json().catch(() => ({}))) as {
          text?: string | null;
          generated_at?: string | null;
        };
        if (cancelled) return;
        if (data.text) {
          setText(data.text);
          setGeneratedAt(data.generated_at ?? null);
          setLoading(false);
        } else {
          await generate(false, yearMonth);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth]);

  return (
    <section className={cn(VA_CARD, VA_CARD_GLOW, "mb-6 p-4 md:p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Monthly AI report
          </p>
          <p className="mt-1 text-xs text-white/40">
            Narrative summary of your partnership performance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 text-xs")}
            disabled={loading}
            onClick={() => void generate(true)}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        </div>
      </div>
      {loading && !text ? (
        <p className="mt-3 text-sm text-white/50">Writing your report…</p>
      ) : error && !text ? (
        <p className="mt-3 text-sm text-rose-300">{error}</p>
      ) : text ? (
        <p className="mt-3 text-sm leading-relaxed text-white/80 whitespace-pre-wrap">{text}</p>
      ) : (
        <p className="mt-3 text-sm text-white/45">No report yet.</p>
      )}
      {generatedAt ? (
        <p className="mt-2 text-[11px] text-white/30">
          Updated {new Date(generatedAt).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}
