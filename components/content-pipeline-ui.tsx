"use client";

/**
 * Shared luxury UI for content pipeline pages:
 * Bunches Pipeline · Filming Calendar · Shoot/Edit Assignments · iCloud.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CalendarDays, MapPin } from "lucide-react";
import {
  formatDaysRemaining,
  formatMaterialDateShort,
  formatShootTime12h,
  MATERIAL_RUNWAY_LABELS,
  MATERIAL_RUNWAY_STYLES,
  type MaterialRunwayTier,
} from "@/lib/icloud-helpers";
import {
  VA_CARD,
  VA_CARD_GLOW,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export const PIPELINE_STAGES = ["Sourcing", "Scripting", "Filming", "Editing", "iCloud"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Rich champagne/pink stage ribbon (prefer over badge-row steppers). */
export function PipelineStageStepper({
  active,
  className,
  compact,
}: {
  active: number;
  className?: string;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn(
        "flex w-full items-center gap-0",
        compact ? "gap-0" : "gap-0.5",
        className,
      )}
      role="list"
      aria-label="Pipeline stages"
    >
      {PIPELINE_STAGES.map((label, i) => {
        const done = i < active;
        const current = i === active;
        const isLast = i === PIPELINE_STAGES.length - 1;
        return (
          <React.Fragment key={label}>
            <div
              role="listitem"
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1.5",
                compact && "gap-1",
              )}
            >
              <motion.span
                initial={false}
                animate={
                  reduce
                    ? undefined
                    : current
                      ? { scale: [1, 1.15, 1] }
                      : { scale: 1 }
                }
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "relative flex items-center justify-center rounded-full border-2",
                  compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
                  current
                    ? "border-[#FF1493] bg-[#FF1493] shadow-[0_0_12px_-2px_rgba(255,20,147,0.7)]"
                    : done
                      ? "border-[#D4AF8C] bg-[#D4AF8C]"
                      : "border-[#D4AF8C]/30 bg-[#151315]",
                )}
                aria-current={current ? "step" : undefined}
              />
              <span
                className={cn(
                  "text-center font-semibold uppercase tracking-[0.1em]",
                  compact ? "text-[8px] leading-tight" : "text-[9px] sm:text-[10px]",
                  current
                    ? "text-[#FF1493]"
                    : done
                      ? "text-[#D4AF8C]/90"
                      : "text-white/30",
                )}
              >
                {label}
              </span>
            </div>
            {!isLast ? (
              <div
                className={cn(
                  "mb-4 h-px min-w-[8px] flex-1 sm:mb-5",
                  compact && "mb-3",
                  done || current ? "bg-gradient-to-r from-[#D4AF8C]/70 to-[#FF1493]/40" : "bg-white/10",
                )}
                aria-hidden
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function ContentPipelineHero({
  eyebrow,
  title,
  description,
  actions,
  stats,
  className,
  orb = "pink",
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: React.ReactNode;
  className?: string;
  orb?: "pink" | "champagne" | "both";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-5 py-7 sm:px-6 md:px-8 md:py-8",
        className,
      )}
    >
      {(orb === "pink" || orb === "both") && (
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,20,147,0.35), transparent 70%)" }}
        />
      )}
      {(orb === "champagne" || orb === "both") && (
        <div
          className="pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(212,175,140,0.25), transparent 70%)" }}
        />
      )}
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {title}
          </h1>
          {description ? (
            <div className="mt-2 max-w-xl text-sm text-[#B8B4B8]/70">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {stats ? <div className="relative mt-6">{stats}</div> : null}
    </div>
  );
}

export function AssignmentProgressBar({
  done,
  total,
  className,
  widthClass = "w-40",
}: {
  done: number;
  total: number;
  className?: string;
  widthClass?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className={cn("mt-2 h-1.5 overflow-hidden rounded-full bg-white/10", widthClass, className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#FF1493] to-[#D4AF8C] transition-all duration-300 motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function formatShootWhen(
  shoot: { schedule_date: string; start_time?: string | null } | null | undefined,
): string {
  if (!shoot?.schedule_date) return "";
  const date = formatMaterialDateShort(shoot.schedule_date);
  const time = formatShootTime12h(shoot.start_time);
  return time ? `${date} at ${time}` : date;
}

export function MaterialRunwayUrgencyCard({
  modelName,
  furthestMaterialUntil,
  daysRemaining,
  alert,
  nextShoot,
  lastShoot,
  className,
}: {
  modelName: string;
  furthestMaterialUntil?: string | null;
  daysRemaining?: number | null;
  /** healthy | low | urgent | none — same tiers as iCloud Management. */
  alert: "healthy" | "low" | "urgent" | "none" | "ok" | "soon" | "past";
  nextShoot?: { schedule_date: string; start_time?: string | null; location?: string | null } | null;
  lastShoot?: { schedule_date: string } | null;
  className?: string;
}) {
  // Normalize legacy ok/soon/past aliases from older call sites.
  const tier: MaterialRunwayTier =
    alert === "ok"
      ? "healthy"
      : alert === "soon"
        ? "low"
        : alert === "past"
          ? "urgent"
          : alert;
  const attention = tier === "urgent" || tier === "low" || tier === "none";
  const hasCoverage = Boolean(furthestMaterialUntil?.trim());
  const coverageLine = hasCoverage
    ? `Content runs through ${formatMaterialDateShort(furthestMaterialUntil)} · ${formatDaysRemaining(daysRemaining ?? null)}`
    : "No coverage date yet";
  const nextLine = nextShoot
    ? `Next shoot: ${formatShootWhen(nextShoot)}`
    : "Next shoot: No upcoming shoot";
  const lastLine = lastShoot
    ? `Last shoot: ${formatMaterialDateShort(lastShoot.schedule_date)}`
    : "Last shoot: No shoots yet";
  const location = nextShoot?.location?.trim() || "";

  return (
    <div
      className={cn(
        VA_CARD,
        VA_CARD_GLOW,
        "relative overflow-hidden p-4",
        tier === "urgent"
          ? "border-red-500/30 ring-1 ring-red-500/15"
          : tier === "low"
            ? "border-amber-500/30 ring-1 ring-amber-500/15"
            : tier === "none"
              ? "border-white/[0.12]"
              : "border-white/[0.08]",
        className,
      )}
    >
      {attention ? (
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl"
          style={{
            background:
              tier === "urgent"
                ? "radial-gradient(circle, rgba(239,68,68,0.35), transparent 70%)"
                : tier === "low"
                  ? "radial-gradient(circle, rgba(251,191,36,0.3), transparent 70%)"
                  : "radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)",
          }}
        />
      ) : null}
      <div className="relative space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {tier === "urgent" || tier === "low" ? (
              <AlertTriangle
                className={cn(
                  "h-4 w-4 shrink-0",
                  tier === "urgent" ? "text-red-300" : "text-amber-300",
                )}
              />
            ) : null}
            <p className="min-w-0 text-base font-semibold text-white">{modelName}</p>
          </div>
          <span className={cn(VA_STATUS_BADGE, MATERIAL_RUNWAY_STYLES[tier])}>
            {MATERIAL_RUNWAY_LABELS[tier]}
          </span>
        </div>

        <p className="text-xs font-medium text-[#D4AF8C]/85">{coverageLine}</p>

        <div className="space-y-1.5 text-[11px] leading-relaxed text-[#B8B4B8]/60">
          <p className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3 shrink-0 text-[#D4AF8C]/70" aria-hidden />
            <span>{nextLine}</span>
          </p>
          <p>{lastLine}</p>
          {location ? (
            <p className="inline-flex items-center gap-1.5 text-[#D4AF8C]/75">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span>Location: {location}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NextShootHeroCard({
  modelName,
  scheduleDate,
  startTime,
  endTime,
  location,
  className,
}: {
  modelName: string;
  scheduleDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        VA_CARD,
        VA_CARD_GLOW,
        "relative overflow-hidden border border-[#FF1493]/25 p-5",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,20,147,0.35), transparent 70%)" }}
      />
      <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
        Next shoot
      </p>
      <p className="relative mt-2 text-2xl font-semibold tracking-tight text-white">{modelName}</p>
      <p className="relative mt-1 text-sm text-[#B8B4B8]/70">
        {scheduleDate}
        {startTime || endTime
          ? ` · ${[startTime, endTime].filter(Boolean).join(" – ")}`
          : ""}
      </p>
      {location ? (
        <p className="relative mt-2 inline-flex items-center gap-1.5 text-sm text-[#D4AF8C]/85">
          <MapPin className="h-4 w-4" /> {location}
        </p>
      ) : null}
    </div>
  );
}

export function SlotChecklistSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/65">
        {title}
      </p>
      <div className="mt-1 text-sm text-[#B8B4B8]/85">{children}</div>
    </div>
  );
}
