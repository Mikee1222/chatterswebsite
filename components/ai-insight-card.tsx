"use client";

import * as React from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export type AiInsightCardProps = {
  title: string;
  subtitle?: string;
  /** GET/POST endpoint (same path). */
  endpoint: string;
  /** Query params for GET cache lookup. */
  getParams?: Record<string, string | undefined | null>;
  /** Body merged into POST (plus force). */
  postBody: Record<string, unknown>;
  /** When this changes, reload cached insight (and auto-generate if missing). */
  reloadKey: string;
  /** Disable fetch (e.g. no stats yet). */
  enabled?: boolean;
  glow?: boolean;
  className?: string;
  regenerateLabel?: string;
};

type InsightResponse = {
  text?: string | null;
  generated_at?: string | null;
  error?: string;
};

export function AiInsightCard({
  title,
  subtitle,
  endpoint,
  getParams,
  postBody,
  reloadKey,
  enabled = true,
  glow = true,
  className,
  regenerateLabel = "Regenerate",
}: AiInsightCardProps) {
  const [text, setText] = React.useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const postBodyRef = React.useRef(postBody);
  postBodyRef.current = postBody;

  const generate = React.useCallback(
    async (force: boolean) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...postBodyRef.current, force }),
        });
        const data = (await res.json().catch(() => ({}))) as InsightResponse;
        if (!res.ok) throw new Error(data.error || "Failed to generate insight");
        setText(data.text ?? null);
        setGeneratedAt(data.generated_at ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate");
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [endpoint],
  );

  React.useEffect(() => {
    if (!enabled) {
      setText(null);
      setGeneratedAt(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setText(null);
    setGeneratedAt(null);
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const qs = new URLSearchParams();
        if (getParams) {
          for (const [k, v] of Object.entries(getParams)) {
            if (v != null && String(v).trim() !== "") qs.set(k, String(v));
          }
        }
        const url = qs.toString() ? `${endpoint}?${qs}` : endpoint;
        const res = await fetch(url, { credentials: "include" });
        const data = (await res.json().catch(() => ({}))) as InsightResponse;
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Failed to load insight");
        if (data.text) {
          setText(data.text);
          setGeneratedAt(data.generated_at ?? null);
          setLoading(false);
        } else {
          await generate(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when key / enabled / endpoint change
  }, [reloadKey, enabled, endpoint, generate]);

  if (!enabled) return null;

  const busy = loading || refreshing;

  return (
    <section className={cn(VA_CARD, glow && VA_CARD_GLOW, "p-4 md:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {title}
          </p>
          {subtitle ? <p className="mt-1 text-xs text-white/40">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 text-xs")}
          disabled={busy}
          onClick={() => void generate(true)}
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          {regenerateLabel}
        </button>
      </div>

      {loading && !text ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparing insight…
        </p>
      ) : error && !text ? (
        <p className="mt-3 text-sm text-rose-300/90">{error}</p>
      ) : text ? (
        <p className="mt-3 text-sm leading-relaxed text-white/80">{text}</p>
      ) : (
        <p className="mt-3 text-sm text-white/45">No insight yet.</p>
      )}

      {generatedAt ? (
        <p className="mt-2 text-[11px] text-white/30">
          Updated {new Date(generatedAt).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}
