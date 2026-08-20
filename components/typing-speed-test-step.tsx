"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";
import { pipelineUi } from "@/lib/application-pipeline-i18n";
import {
  computeTypingStats,
  pickRandomTypingPassage,
  type TypingPassage,
} from "@/lib/application-typing-passages";
import {
  APPLY_BTN_PRIMARY,
  APPLY_EYEBROW,
  APPLY_INPUT,
  APPLY_LABEL,
  APPLY_SURFACE,
} from "@/lib/application-ui-tokens";
import { ApplyStepShell } from "@/components/application-public-chrome";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  preferredLanguage: PipelineLanguage;
  ensureSession: () => Promise<string>;
  onComplete: () => void;
};

type Phase = "ready" | "typing" | "results";

function detectClientDevice(): "desktop" | "mobile" | "tablet" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile/.test(ua)) return "mobile";
  return "desktop";
}

function StatPill({
  label,
  value,
  accent = "pink",
}: {
  label: string;
  value: string | number;
  accent?: "pink" | "champagne" | "muted";
}) {
  const styles = {
    pink: "border-[#FF1493]/30 bg-[#FF1493]/10 text-[#FF1493]",
    champagne: "border-[#D4AF8C]/35 bg-[#D4AF8C]/10 text-[#D4AF8C]",
    muted: "border-white/10 bg-white/[0.04] text-white/70",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs tabular-nums",
        styles[accent],
      )}
    >
      <span className="font-semibold">{value}</span>
      <span className="font-sans text-[10px] uppercase tracking-wider opacity-70">{label}</span>
    </span>
  );
}

export function TypingSpeedTestStep({
  slug,
  preferredLanguage,
  ensureSession,
  onComplete,
}: Props) {
  const ui = pipelineUi(preferredLanguage);
  const [passageLang, setPassageLang] = useState<PipelineLanguage>(preferredLanguage);
  const [passage, setPassage] = useState<TypingPassage | null>(null);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalStats, setFinalStats] = useState<{ wpm: number; accuracy_percent: number } | null>(
    null,
  );
  const startedAt = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lockedPrefix = useRef("");

  useEffect(() => {
    setPassageLang(preferredLanguage);
  }, [preferredLanguage]);

  useEffect(() => {
    if (phase !== "typing") return;
    const t = setInterval(() => {
      if (startedAt.current) setElapsedMs(Date.now() - startedAt.current);
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  const live = useMemo(() => {
    if (!passage || phase !== "typing") return null;
    return computeTypingStats({
      passage: passage.text,
      typed,
      elapsedMs: Math.max(elapsedMs, 1),
    });
  }, [passage, typed, elapsedMs, phase]);

  function start() {
    const p = pickRandomTypingPassage(passageLang);
    setPassage(p);
    setTyped("");
    lockedPrefix.current = "";
    setElapsedMs(0);
    setFinalStats(null);
    setError(null);
    setPhase("typing");
    startedAt.current = Date.now();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onTypedChange(next: string) {
    const lock = lockedPrefix.current;
    if (lock && !next.startsWith(lock)) {
      next = lock + next.slice(lock.length).replace(/^[^\s]*/, "");
      if (!next.startsWith(lock)) next = lock;
    }
    if (!passage) {
      setTyped(next);
      return;
    }
    let matchLen = 0;
    const limit = Math.min(next.length, passage.text.length);
    for (let i = 0; i < limit; i++) {
      if (next[i] === passage.text[i]) matchLen = i + 1;
      else break;
    }
    const lastSpace = passage.text.lastIndexOf(" ", Math.max(0, matchLen - 1));
    const newLock = lastSpace >= 0 ? passage.text.slice(0, lastSpace + 1) : "";
    if (newLock.length > lockedPrefix.current.length) {
      lockedPrefix.current = newLock;
    }
    setTyped(next);
  }

  async function finish() {
    if (!passage || !startedAt.current) return;
    setSubmitting(true);
    setError(null);
    try {
      const session_id = await ensureSession();
      const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
      const stats = computeTypingStats({
        passage: passage.text,
        typed,
        elapsedMs: Date.now() - startedAt.current,
      });
      const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_typing",
          session_id,
          passage: passage.text,
          typed,
          passage_id: passage.id,
          passage_language: passageLang,
          device_type: detectClientDevice(),
          time_taken_seconds: elapsed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setFinalStats({
        wpm: data.result?.wpm ?? stats.wpm,
        accuracy_percent: data.result?.accuracy_percent ?? stats.accuracy_percent,
      });
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const seconds = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (phase === "results" && finalStats) {
    return (
      <ApplyStepShell>
        <div className="px-6 py-10 text-center sm:px-8">
          <p className={APPLY_EYEBROW}>{ui.typingTitle}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {ui.typingResults}
          </h2>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: ui.typingWpm, value: finalStats.wpm, accent: "pink" as const },
              {
                label: ui.typingAccuracy,
                value: `${finalStats.accuracy_percent}%`,
                accent: "champagne" as const,
              },
              { label: ui.typingTime, value: `${mm}:${ss}`, accent: "muted" as const },
            ].map((s) => (
              <div
                key={s.label}
                className={cn(
                  APPLY_SURFACE,
                  "p-4",
                  s.accent === "pink" && "border-[#FF1493]/25 bg-[#FF1493]/[0.08]",
                  s.accent === "champagne" && "border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.08]",
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  {s.label}
                </p>
                <p
                  className={cn(
                    "mt-2 text-2xl font-semibold tabular-nums",
                    s.accent === "pink" && "text-[#FF1493]",
                    s.accent === "champagne" && "text-[#D4AF8C]",
                    s.accent === "muted" && "text-white",
                  )}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          <button type="button" onClick={onComplete} className={cn(APPLY_BTN_PRIMARY, "mt-8")}>
            {ui.typingContinue}
          </button>
        </div>
      </ApplyStepShell>
    );
  }

  if (phase === "ready") {
    return (
      <ApplyStepShell>
        <div className="px-6 py-8 sm:px-8">
          <p className={APPLY_EYEBROW}>{ui.typingTitle}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {ui.typingReady}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/50">{ui.typingIntro}</p>
          <label className={cn("mt-6 block", APPLY_LABEL)}>
            {ui.typingPassageLang}
            <select
              value={passageLang}
              onChange={(e) => setPassageLang(e.target.value as PipelineLanguage)}
              className={cn(APPLY_INPUT, "mt-2")}
            >
              <option value="en">{ui.english}</option>
              <option value="el">{ui.greek}</option>
            </select>
          </label>
          <button type="button" onClick={start} className={cn(APPLY_BTN_PRIMARY, "mt-6")}>
            {ui.typingStart}
          </button>
        </div>
      </ApplyStepShell>
    );
  }

  return (
    <ApplyStepShell>
      <div className="border-b border-white/8 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={APPLY_EYEBROW}>{ui.typingTitle}</p>
          <div className="flex flex-wrap gap-2">
            <StatPill label={ui.typingWpm} value={live?.wpm ?? 0} accent="pink" />
            <StatPill
              label={ui.typingAccuracy}
              value={`${live?.accuracy_percent ?? 0}%`}
              accent="champagne"
            />
            <StatPill label="" value={`${mm}:${ss}`} accent="muted" />
          </div>
        </div>
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
        <div
          className={cn(
            APPLY_SURFACE,
            "select-none p-4 text-sm leading-relaxed text-white/70 sm:p-5",
          )}
        >
          {passage?.text.split("").map((ch, i) => {
            let cls = "text-white/35";
            if (i < typed.length) {
              cls = typed[i] === ch ? "text-[#D4AF8C]" : "text-rose-400 bg-rose-500/15 rounded-sm";
            } else if (i === typed.length) {
              cls = "text-white border-b-2 border-[#FF1493]";
            }
            return (
              <span key={i} className={cls}>
                {ch}
              </span>
            );
          })}
        </div>
        <textarea
          ref={inputRef}
          value={typed}
          onChange={(e) => onTypedChange(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className={cn(APPLY_INPUT, "min-h-[160px] resize-none font-mono text-sm leading-relaxed")}
          placeholder="…"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="button"
          disabled={submitting || typed.trim().length < 20}
          onClick={() => void finish()}
          className={APPLY_BTN_PRIMARY}
        >
          {submitting ? ui.submitting : ui.typingFinished}
        </button>
      </div>
    </ApplyStepShell>
  );
}
