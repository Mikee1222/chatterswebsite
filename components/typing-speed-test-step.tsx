"use client";

import { memo, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";
import { pipelineUi } from "@/lib/application-pipeline-i18n";
import {
  computeTypingStats,
  pickRandomTypingPassage,
  type TypingPassage,
} from "@/lib/application-typing-passages";
import {
  APPLY_EYEBROW,
  APPLY_INPUT,
  APPLY_SURFACE,
} from "@/lib/application-ui-tokens";
import { ApplyButton } from "@/components/application-ui-buttons";
import { ApplyStepShell } from "@/components/application-public-chrome";
import { ArrowRight, Check, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  preferredLanguage: PipelineLanguage;
  ensureSession: () => Promise<string>;
  onComplete: () => void;
};

type Phase = "idle" | "typing" | "results";

const STATS_INTERVAL_MS = 300;

function detectClientDevice(): "desktop" | "mobile" | "tablet" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile/.test(ua)) return "mobile";
  return "desktop";
}

/** Run-length highlight: few spans instead of one per character. */
const PassageHighlight = memo(function PassageHighlight({
  passage,
  typed,
}: {
  passage: string;
  typed: string;
}) {
  const nodes: ReactNode[] = [];
  const typedLen = Math.min(typed.length, passage.length);
  let i = 0;

  while (i < typedLen) {
    const correct = typed[i] === passage[i];
    let j = i + 1;
    while (j < typedLen && (typed[j] === passage[j]) === correct) j += 1;
    nodes.push(
      <span
        key={i}
        className={
          correct ? "text-[#D4AF8C]" : "rounded-sm bg-rose-500/15 text-rose-400"
        }
      >
        {passage.slice(i, j)}
      </span>,
    );
    i = j;
  }

  if (typedLen < passage.length) {
    nodes.push(
      <span key="cursor" className="border-b-2 border-[#FF1493] text-white">
        {passage[typedLen]}
      </span>,
    );
    if (typedLen + 1 < passage.length) {
      nodes.push(
        <span key="rest" className="text-white/35">
          {passage.slice(typedLen + 1)}
        </span>,
      );
    }
  }

  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{nodes}</p>
  );
});

function formatClock(elapsedMs: number) {
  const seconds = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function TypingSpeedTestStep({
  slug,
  preferredLanguage,
  ensureSession,
  onComplete,
}: Props) {
  const ui = pipelineUi(preferredLanguage);
  const [phase, setPhase] = useState<Phase>("idle");
  const [passage, setPassage] = useState<TypingPassage | null>(null);
  const [highlightTyped, setHighlightTyped] = useState("");
  const [canFinish, setCanFinish] = useState(false);
  const [displayStats, setDisplayStats] = useState({
    wpm: 0,
    accuracy_percent: 0,
    elapsedMs: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalStats, setFinalStats] = useState<{
    wpm: number;
    accuracy_percent: number;
    elapsedMs: number;
  } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typedRef = useRef("");
  const lockedPrefix = useRef("");
  const startedAt = useRef<number | null>(null);
  const rafPending = useRef(false);
  const passageRef = useRef<TypingPassage | null>(null);

  useEffect(() => {
    passageRef.current = passage;
  }, [passage]);

  // Throttled live stats — not on every keystroke
  useEffect(() => {
    if (phase !== "typing") return;
    const tick = () => {
      const p = passageRef.current;
      if (!p) return;
      const elapsedMs = startedAt.current ? Date.now() - startedAt.current : 0;
      const stats = computeTypingStats({
        passage: p.text,
        typed: typedRef.current,
        elapsedMs: Math.max(elapsedMs, 1),
      });
      setDisplayStats({
        wpm: startedAt.current ? stats.wpm : 0,
        accuracy_percent: typedRef.current.length ? stats.accuracy_percent : 0,
        elapsedMs,
      });
      setCanFinish(typedRef.current.trim().length >= 20);
    };
    tick();
    const id = setInterval(tick, STATS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase]);

  function start() {
    const p = pickRandomTypingPassage(preferredLanguage);
    passageRef.current = p;
    setPassage(p);
    typedRef.current = "";
    lockedPrefix.current = "";
    startedAt.current = null;
    setHighlightTyped("");
    setCanFinish(false);
    setDisplayStats({ wpm: 0, accuracy_percent: 0, elapsedMs: 0 });
    setFinalStats(null);
    setError(null);
    setPhase("typing");
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
    });
  }

  function syncHighlight() {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      setHighlightTyped(typedRef.current);
    });
  }

  function applyTyped(next: string) {
    const lock = lockedPrefix.current;
    if (lock && !next.startsWith(lock)) {
      next = lock + next.slice(lock.length).replace(/^[^\s]*/, "");
      if (!next.startsWith(lock)) next = lock;
    }

    const p = passageRef.current;
    if (p) {
      let matchLen = 0;
      const limit = Math.min(next.length, p.text.length);
      for (let i = 0; i < limit; i++) {
        if (next[i] === p.text[i]) matchLen = i + 1;
        else break;
      }
      const lastSpace = p.text.lastIndexOf(" ", Math.max(0, matchLen - 1));
      const newLock = lastSpace >= 0 ? p.text.slice(0, lastSpace + 1) : "";
      if (newLock.length > lockedPrefix.current.length) {
        lockedPrefix.current = newLock;
      }
    }

    typedRef.current = next;
    if (!startedAt.current && next.length > 0) {
      startedAt.current = Date.now();
    }
    syncHighlight();
  }

  function onInput(e: FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const before = el.value;
    applyTyped(before);
    if (el.value !== typedRef.current) {
      el.value = typedRef.current;
    }
  }

  async function finish() {
    const p = passageRef.current;
    if (!p || !startedAt.current) return;
    const typed = typedRef.current;
    setSubmitting(true);
    setError(null);
    try {
      const session_id = await ensureSession();
      const elapsedMs = Date.now() - startedAt.current;
      const elapsed = Math.round(elapsedMs / 1000);
      const stats = computeTypingStats({
        passage: p.text,
        typed,
        elapsedMs,
      });
      const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_typing",
          session_id,
          passage: p.text,
          typed,
          passage_id: p.id,
          passage_language: preferredLanguage,
          device_type: detectClientDevice(),
          time_taken_seconds: elapsed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setFinalStats({
        wpm: data.result?.wpm ?? stats.wpm,
        accuracy_percent: data.result?.accuracy_percent ?? stats.accuracy_percent,
        elapsedMs,
      });
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

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
              {
                label: ui.typingTime,
                value: formatClock(finalStats.elapsedMs),
                accent: "muted" as const,
              },
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
          <ApplyButton
            variant="primary"
            iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}
            onClick={onComplete}
            className="mt-8"
          >
            {ui.typingContinue}
          </ApplyButton>
        </div>
      </ApplyStepShell>
    );
  }

  if (phase === "idle") {
    return (
      <ApplyStepShell>
        <div className="px-6 py-8 sm:px-8">
          <p className={APPLY_EYEBROW}>{ui.typingTitle}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {ui.typingStart}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/50">{ui.typingIntro}</p>
          <ApplyButton
            variant="primary"
            iconLeft={<Play className="h-4 w-4" aria-hidden />}
            onClick={start}
            className="mt-6"
          >
            {ui.typingStart}
          </ApplyButton>
        </div>
      </ApplyStepShell>
    );
  }

  return (
    <ApplyStepShell>
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3 sm:px-6">
        <p className={APPLY_EYEBROW}>{ui.typingTitle}</p>
        <p className="font-mono text-xs tabular-nums text-white/45">
          <span className="text-[#FF1493]">{displayStats.wpm}</span>
          <span className="mx-1.5 text-white/25">·</span>
          <span className="text-[#D4AF8C]">{displayStats.accuracy_percent}%</span>
          <span className="mx-1.5 text-white/25">·</span>
          {formatClock(displayStats.elapsedMs)}
        </p>
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
        <div className={cn(APPLY_SURFACE, "select-none p-4 sm:p-5")}>
          {passage ? (
            <PassageHighlight passage={passage.text} typed={highlightTyped} />
          ) : null}
        </div>
        <textarea
          ref={inputRef}
          defaultValue=""
          onInput={onInput}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          className={cn(APPLY_INPUT, "min-h-[160px] resize-none font-mono text-sm leading-relaxed")}
          placeholder="…"
          aria-label={ui.typingTitle}
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <ApplyButton
          variant="primary"
          loading={submitting}
          disabled={!canFinish}
          iconRight={<Check className="h-4 w-4" aria-hidden />}
          onClick={() => void finish()}
        >
          {submitting ? ui.submitting : ui.typingFinished}
        </ApplyButton>
      </div>
    </ApplyStepShell>
  );
}
