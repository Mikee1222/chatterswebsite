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

type ShiftHoursInput = {
  start_time?: string | null;
  end_time?: string | null;
  break_started_at?: string | null;
  break_minutes?: number | null;
  paused_seconds?: number | null;
  worked_minutes?: number | null;
  total_minutes?: number | null;
  total_hours_decimal?: number | null;
  status?: string | null;
};

/**
 * Hours for reporting (VA Statistics, Shift Activity, Hours).
 *
 * Prefer authoritative end-shift totals (`worked_minutes` / `total_minutes` /
 * `total_hours_decimal` — written from pause-aware active duration).
 * Open shifts use live `shiftActiveSeconds`.
 *
 * Completed rows with null totals must NOT fall back to raw wall-clock when the
 * span looks like an abandoned overnight shift (no pause data, wall > 12h) —
 * that path produced false "56.5h worked" for Stacy.
 */
export function shiftWorkedHours(shift: ShiftHoursInput, nowMs: number = Date.now()): number {
  if (typeof shift.worked_minutes === "number" && Number.isFinite(shift.worked_minutes) && shift.worked_minutes > 0) {
    return shift.worked_minutes / 60;
  }
  if (typeof shift.total_minutes === "number" && Number.isFinite(shift.total_minutes) && shift.total_minutes > 0) {
    return shift.total_minutes / 60;
  }
  if (
    typeof shift.total_hours_decimal === "number" &&
    Number.isFinite(shift.total_hours_decimal) &&
    shift.total_hours_decimal > 0
  ) {
    return shift.total_hours_decimal;
  }

  const isOpen =
    shift.status === "active" ||
    shift.status === "on_break" ||
    (Boolean(shift.start_time?.trim()) && !shift.end_time?.trim());

  if (isOpen) {
    const activeH = shiftActiveSeconds(shift, nowMs) / 3600;
    // Stuck open shifts (forgotten end / pause left on for days) must not inflate
    // weekly stats — e.g. Nikolis on_break since 2026-08-06 with ~44h wall.
    if (activeH > 12) return 0;
    return activeH;
  }

  if (!shift.start_time?.trim() || !shift.end_time?.trim()) return 0;

  const startMs = new Date(shift.start_time).getTime();
  const endMs = new Date(shift.end_time).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  const wallSeconds = Math.floor((endMs - startMs) / 1000);
  let paused = Math.max(0, Math.floor(Number(shift.paused_seconds ?? 0)));
  if (paused === 0 && (shift.break_minutes ?? 0) > 0) {
    paused = Math.max(0, Math.floor(Number(shift.break_minutes) * 60));
  }

  // Abandoned overnight ends: no pause tracking + multi-day wall → unreliable.
  if (paused === 0 && wallSeconds > 12 * 3600) return 0;

  return shiftActiveSeconds(shift, nowMs) / 3600;
}

export function shiftWorkedMinutesFromActive(shift: ShiftHoursInput, nowMs: number = Date.now()): number {
  return Math.max(0, Math.floor(shiftWorkedHours(shift, nowMs) * 60));
}
