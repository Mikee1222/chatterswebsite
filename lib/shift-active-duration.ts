/** True when a shift is paused / on break (empty break_started_at does not count). */
export function isShiftPausedOrOnBreak(shift: {
  status?: string | null;
  break_started_at?: string | null;
} | null | undefined): boolean {
  if (!shift) return false;
  return shift.status === "on_break" || Boolean(shift.break_started_at?.trim());
}

/**
 * Active (worked) seconds for a shift — wall-clock minus closed pauses,
 * and minus the open pause segment when status is on_break.
 */
export function shiftActiveSeconds(
  shift: {
    start_time?: string | null;
    end_time?: string | null;
    break_started_at?: string | null;
    break_minutes?: number | null;
    paused_seconds?: number | null;
    status?: string | null;
  },
  nowMs: number = Date.now(),
): number {
  const startMs = shift.start_time ? new Date(shift.start_time).getTime() : NaN;
  if (!Number.isFinite(startMs)) return 0;

  const endMs =
    shift.end_time && Number.isFinite(new Date(shift.end_time).getTime())
      ? new Date(shift.end_time).getTime()
      : nowMs;
  const wallSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

  let paused = Math.max(0, Math.floor(Number(shift.paused_seconds ?? 0)));
  // Legacy rows may only have break_minutes (chatter breaks).
  if (paused === 0 && (shift.break_minutes ?? 0) > 0) {
    paused = Math.max(0, Math.floor(Number(shift.break_minutes) * 60));
  }

  const onBreak = isShiftPausedOrOnBreak(shift);
  if (onBreak && shift.break_started_at?.trim()) {
    const pauseStart = new Date(shift.break_started_at).getTime();
    if (Number.isFinite(pauseStart)) {
      paused += Math.max(0, Math.floor((Math.min(endMs, nowMs) - pauseStart) / 1000));
    }
  }

  return Math.max(0, wallSeconds - paused);
}

export function formatActiveDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
