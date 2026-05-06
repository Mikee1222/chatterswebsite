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
  /** Larger tabular display for shift / break hero */
  variant?: "default" | "hero";
  /** Soft glow pulse after mount while the clock is running */
  glowPulse?: boolean;
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
  variant = "default",
  glowPulse = false,
}: LiveTimerProps) {
  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState(0);

  const startMs = startTime ? new Date(startTime).getTime() : 0;
  const elapsedMs = mounted && startMs ? now - startMs : 0;
  const display = mounted && startMs ? formatDurationMs(elapsedMs) : placeholder;
  const running = mounted && !!startMs;
  const pulse = glowPulse && running && display !== placeholder;

  React.useEffect(() => {
    setMounted(true);
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const heroClass =
    "block font-bold tabular-nums tracking-tight text-[clamp(2rem,6vw,3.25rem)] leading-none md:text-[3.5rem] [font-variant-numeric:tabular-nums] " +
    (mode === "break" ? "text-amber-50" : "text-pink-50");
  const pulseClass =
    pulse && (mode === "break" ? "live-timer-break-pulse" : "live-timer-hero-pulse");
  const merged =
    variant === "hero"
      ? [heroClass, pulseClass, className].filter(Boolean).join(" ")
      : [className].filter(Boolean).join(" ");

  return (
    <>
      <Tag className={merged}>{display}</Tag>
      <style jsx global>{`
        @keyframes live-timer-glow-pulse {
          0%,
          100% {
            text-shadow: 0 0 14px rgba(236, 72, 153, 0.5), 0 0 2px rgba(255, 255, 255, 0.12);
          }
          50% {
            text-shadow: 0 0 32px rgba(236, 72, 153, 0.85), 0 0 6px rgba(253, 224, 255, 0.25);
          }
        }
        @keyframes live-timer-break-pulse {
          0%,
          100% {
            text-shadow: 0 0 12px rgba(251, 191, 36, 0.45);
          }
          50% {
            text-shadow: 0 0 28px rgba(251, 191, 36, 0.9);
          }
        }
        .live-timer-hero-pulse {
          animation: live-timer-glow-pulse 2.2s ease-in-out infinite;
        }
        .live-timer-break-pulse {
          animation: live-timer-break-pulse 2.2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
