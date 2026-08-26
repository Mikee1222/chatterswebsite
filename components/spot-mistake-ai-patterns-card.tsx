"use client";

import * as React from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Props = {
  subjectId: string;
  subjectName: string;
  subjectKind?: "va" | "chatter";
};

export function SpotMistakeAiPatternsCard({
  subjectId,
  subjectName,
  subjectKind = "va",
}: Props) {
  const [text, setText] = React.useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function generate(force: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/spot-mistake-patterns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, subjectName, subjectKind, force }),
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
      try {
        const qs = new URLSearchParams({ subjectId, subjectKind });
        const res = await fetch(`/api/admin/ai/spot-mistake-patterns?${qs}`, {
          credentials: "include",
        });
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
          await generate(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, subjectKind]);

  return (
    <div className={cn(VA_CARD, "p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI pattern notes
          </p>
          <p className="mt-1 text-xs text-white/40">Spot checks + mistakes for {subjectName}</p>
        </div>
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
      {loading && !text ? (
        <p className="mt-3 text-sm text-white/50">Analyzing…</p>
      ) : error && !text ? (
        <p className="mt-3 text-sm text-rose-300">{error}</p>
      ) : text ? (
        <p className="mt-3 text-sm leading-relaxed text-white/80">{text}</p>
      ) : (
        <p className="mt-3 text-sm text-white/45">No patterns yet.</p>
      )}
      {generatedAt ? (
        <p className="mt-2 text-[11px] text-white/30">
          Updated {new Date(generatedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
