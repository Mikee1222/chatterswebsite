"use client";

import * as React from "react";

/**
 * Formats elapsed ms as HH:MM:SS. Same output on server and client when ms is 0.
 */
function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export type LiveTimerMode = "duration" | "break";

export type LiveTimerProps = {
  /** ISO start time for duration, or when break started for mode="break" */
  startTime: string | null;
  /** Use "break" for break elapsed; "duration" for shift elapsed */
  mode?: LiveTimerMode;
  /** Optional end time (future: countdown). Not used in current implementation. */
  endTime?: string | null;
  /** Placeholder shown before mount (must match server/first client render). */
  placeholder?: string;
  className?: string;
  /** Render as child of this element; default span */
  as?: "span" | "p" | "div";
};

const STABLE_PLACEHOLDER = "00:00:00";

/**
 * Client-only live timer. Renders a stable placeholder (00:00:00) on server and
 * on first client render to avoid hydration mismatch; after mount, updates every
 * second with the real elapsed duration.
 */
export function LiveTimer({
  startTime,
  mode = "duration",
  placeholder = STABLE_PLACEHOLDER,
  className,
  as: Tag = "span",
}: LiveTimerProps) {
  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState(0);

  const startMs = startTime ? new Date(startTime).getTime() : 0;
  const elapsedMs = mounted && startMs ? now - startMs : 0;
  const display = mounted && startMs ? formatDurationMs(elapsedMs) : placeholder;

  React.useEffect(() => {
    setMounted(true);
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <Tag className={className}>{display}</Tag>;
}
