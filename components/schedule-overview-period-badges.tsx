import type { ScheduleOverviewPeriodIndicator } from "@/lib/schedule-overview-page-data";
import { cn } from "@/lib/utils";
import { formatDateOnlyEuropean } from "@/lib/format";

type Audience = "admin" | "va";

type Props = {
  summary: ScheduleOverviewPeriodIndicator | undefined;
  audience: Audience;
  className?: string;
};

function formatShortDate(ymd: string | null | undefined): string {
  if (!ymd) return "";
  return formatDateOnlyEuropean(ymd);
}

function formatDateShort(ymd: string): string {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Rose/amber/red pills plus next/last meta for schedule overview rows (admin + VA). */
export function ScheduleOverviewPeriodBadges({ summary, audience, className }: Props) {
  if (!summary?.trackingEnabled) return null;

  const du = summary.daysUntilNext;
  const inPeriod = summary.currentlyInPeriod;
  const dayNumber = summary.dayNumber;
  const currentEndDate = summary.current?.end_date ?? null;
  const nextExpected = summary.nextExpectedDate;
  const lastStart = summary.lastStart ?? summary.lastPeriodDate;

  const overdue = !inPeriod && nextExpected != null && du != null && du < 0;
  const soon = !inPeriod && nextExpected != null && du != null && du >= 0 && du <= 5;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {inPeriod ? (
        <span className="rounded-full border border-rose-500/25 bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-400">
          🩸 Period{dayNumber != null ? ` · Day ${dayNumber}` : ""}
          {currentEndDate ? ` · until ${formatDateShort(currentEndDate)}` : ""}
        </span>
      ) : null}

      {overdue ? (
        <span className="rounded-full border border-red-500/25 bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
          ⚠️ Overdue {Math.abs(du!)}d
        </span>
      ) : null}

      {soon ? (
        <span className="rounded-full border border-dashed border-amber-400/45 bg-amber-500/12 px-2 py-0.5 text-xs text-amber-200">
          {audience === "va" ? `🗓 In ${du}d` : `⏰ In ${du}d`}
        </span>
      ) : null}

      {nextExpected ? (
        <span className="text-xs text-white/30">Next: {formatShortDate(nextExpected)}</span>
      ) : null}

      {lastStart ? (
        <span className="text-xs text-white/20">Last: {formatShortDate(lastStart)}</span>
      ) : null}
    </div>
  );
}
