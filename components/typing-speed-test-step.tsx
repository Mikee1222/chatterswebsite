"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";
import { pipelineUi } from "@/lib/application-pipeline-i18n";
import {
  computeTypingStats,
  pickRandomTypingPassage,
  type TypingPassage,
} from "@/lib/application-typing-passages";

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
    // Anti-cheat: disallow shrinking already-committed correct prefix (no easy back-edit)
    const lock = lockedPrefix.current;
    if (lock && !next.startsWith(lock)) {
      next = lock + next.slice(lock.length).replace(/^[^\s]*/, "");
      if (!next.startsWith(lock)) next = lock;
    }
    if (!passage) {
      setTyped(next);
      return;
    }
    // Extend lock as characters match the passage
    let matchLen = 0;
    const limit = Math.min(next.length, passage.text.length);
    for (let i = 0; i < limit; i++) {
      if (next[i] === passage.text[i]) matchLen = i + 1;
      else break;
    }
    // Only lock completed words (up to last space) so typos can still be fixed within current word
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
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-3xl border border-black/5 bg-[#F7F3EE] p-6 shadow-lg text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B6914]">{ui.typingTitle}</p>
          <h2 className="mt-2 font-serif text-2xl text-[#1a1512]">{ui.typingResults}</h2>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/80 p-3">
              <p className="text-[10px] uppercase text-zinc-450 text-zinc-500">{ui.typingWpm}</p>
              <p className="mt-1 text-2xl font-semibold text-[#1a1512]">{finalStats.wpm}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3">
              <p className="text-[10px] uppercase text-zinc-500">{ui.typingAccuracy}</p>
              <p className="mt-1 text-2xl font-semibold text-[#1a1512]">
                {finalStats.accuracy_percent}%
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3">
              <p className="text-[10px] uppercase text-zinc-500">{ui.typingTime}</p>
              <p className="mt-1 text-2xl font-semibold text-[#1a1512]">
                {mm}:{ss}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="mt-8 w-full rounded-2xl bg-[#1a1512] py-3.5 text-sm font-medium text-white"
          >
            {ui.typingContinue}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-3xl border border-black/5 bg-[#F7F3EE] p-6 shadow-lg">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B6914]">{ui.typingTitle}</p>
          <h2 className="mt-2 font-serif text-2xl text-[#1a1512]">{ui.typingReady}</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">{ui.typingIntro}</p>
          <label className="mt-5 block text-xs font-medium text-zinc-600">
            {ui.typingPassageLang}
            <select
              value={passageLang}
              onChange={(e) => setPassageLang(e.target.value as PipelineLanguage)}
              className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm"
            >
              <option value="en">{ui.english}</option>
              <option value="el">{ui.greek}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={start}
            className="mt-6 w-full rounded-2xl bg-[#1a1512] py-3.5 text-sm font-medium text-white"
          >
            {ui.typingStart}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B6914]">{ui.typingTitle}</p>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-[#1a1512] px-2.5 py-1 font-mono text-[#D4AF8C]">
            {live?.wpm ?? 0} {ui.typingWpm}
          </span>
          <span className="rounded-full border border-black/10 bg-white px-2.5 py-1">
            {live?.accuracy_percent ?? 0}% {ui.typingAccuracy}
          </span>
          <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 font-mono">
            {mm}:{ss}
          </span>
        </div>
      </div>
      <div className="rounded-3xl border border-black/5 bg-[#F7F3EE] p-5 shadow-lg sm:p-6">
        <p className="rounded-2xl bg-white/70 p-4 text-sm leading-relaxed text-zinc-800 select-none">
          {passage?.text}
        </p>
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
          className="mt-4 min-h-[160px] w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm leading-relaxed text-zinc-900 outline-none focus:border-[#C4A484] focus:ring-2 focus:ring-[#C4A484]/25"
          placeholder="…"
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={submitting || typed.trim().length < 20}
          onClick={() => void finish()}
          className="mt-5 w-full rounded-2xl bg-[#1a1512] py-3.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? ui.submitting : ui.typingFinished}
        </button>
      </div>
    </div>
  );
}
