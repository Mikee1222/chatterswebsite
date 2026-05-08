import { cn } from "@/lib/utils";
import { formatDateOnlyEuropean } from "@/lib/format";

export type PeriodStatusBannerProps = {
  periodTrackingEnabled: boolean;
  currentlyInPeriod: boolean;
  currentPeriodDay: number | null;
  lastPeriodDate: string | null;
  nextExpectedDate: string | null;
  /** Calendar-day offset from today to next expected (negative = overdue). */
  daysUntilNext: number | null;
};

export function PeriodStatusBanner({
  periodTrackingEnabled,
  currentlyInPeriod,
  currentPeriodDay,
  lastPeriodDate,
  nextExpectedDate,
  daysUntilNext,
}: PeriodStatusBannerProps) {
  if (!periodTrackingEnabled) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-3">
      {currentlyInPeriod ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/15 px-4 py-2">
          <span className="text-sm text-rose-400">🩸</span>
          <span className="text-sm font-medium text-rose-400">Period active</span>
          {currentPeriodDay != null ? (
            <span className="text-xs text-rose-300/60">Day {currentPeriodDay}</span>
          ) : null}
        </div>
      ) : null}

      {lastPeriodDate ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
          <span className="text-xs uppercase tracking-widest text-white/40">Last</span>
          <span className="text-sm text-white/70">{formatDateOnlyEuropean(lastPeriodDate)}</span>
        </div>
      ) : null}

      {nextExpectedDate ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2",
            daysUntilNext != null && daysUntilNext <= 3
              ? "border-amber-500/25 bg-amber-500/15 text-amber-400"
              : "border-white/10 bg-white/5 text-white/70"
          )}
        >
          <span className="text-xs uppercase tracking-widest opacity-60">Next expected</span>
          <span className="text-sm font-medium">{formatDateOnlyEuropean(nextExpectedDate)}</span>
          {daysUntilNext != null ? (
            <span className="text-xs opacity-60">
              {daysUntilNext === 0
                ? "Today"
                : daysUntilNext < 0
                  ? `${Math.abs(daysUntilNext)}d overdue`
                  : `in ${daysUntilNext}d`}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
