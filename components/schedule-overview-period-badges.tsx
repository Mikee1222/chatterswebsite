import type { ScheduleOverviewPeriodIndicator } from "@/lib/schedule-overview-page-data";
import { cn } from "@/lib/utils";
import { formatDateOnlyEuropean } from "@/lib/format";

type Audience = "admin" | "va";

type Props = {
  summary: ScheduleOverviewPeriodIndicator | undefined;
  audience: Audience;
  className?: string;
};

function soonDaysThreshold(audience: Audience): number {
  return audience === "va" ? 5 : 3;
}

/** Rose/amber/red pills for schedule overview rows (admin + VA). */
export function ScheduleOverviewPeriodBadges({ summary, audience, className }: Props) {
  if (!summary?.trackingEnabled) return null;

  const soonThreshold = soonDaysThreshold(audience);
  const du = summary.daysUntilNext;
  const overdue = summary.nextExpectedDate != null && du != null && du < 0 && !summary.currentlyInPeriod;
  const soon =
    summary.nextExpectedDate != null &&
    du != null &&
    du <= soonThreshold &&
    du >= 0 &&
    !summary.currentlyInPeriod;

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {summary.currentlyInPeriod ? (
        <span className="rounded-full border border-rose-500/25 bg-rose-500/15 px-2 py-0.5 text-xs text-rose-400">
          🩸 Period
        </span>
      ) : null}
      {soon ? (
        <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
          {audience === "va" ? `🗓 Period in ${du}d` : `⚠️ Period in ${du}d`}
        </span>
      ) : null}
      {overdue ? (
        <span className="rounded-full border border-red-500/25 bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
          ⚠️ Period overdue
        </span>
      ) : null}
    </div>
  );
}

export function ScheduleOverviewPeriodMetaRow({ summary }: { summary: ScheduleOverviewPeriodIndicator | undefined }) {
  if (!summary?.trackingEnabled || (!summary.lastPeriodDate && !summary.nextExpectedDate)) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/40">
      {summary.lastPeriodDate ? <span>Last: {formatDateOnlyEuropean(summary.lastPeriodDate)}</span> : null}
      {summary.nextExpectedDate ? <span>Next: {formatDateOnlyEuropean(summary.nextExpectedDate)}</span> : null}
    </div>
  );
}
