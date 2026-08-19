"use client";

import * as React from "react";
import { BarChart3, Check, Instagram, Layers, Moon, Star, Sun, SunMedium, Sunset } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole, WeeklyProgramShiftType } from "@/types";
import {
  getShiftTypeLabel,
  WEEKLY_PROGRAM_SHIFT_TYPE_DEFINITIONS,
} from "@/lib/weekly-program-shift-types";

function initialsFromName(name: string, max = 2): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, max).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export function AdminRowAvatar({
  name,
  className,
  size = "md",
}: {
  name: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const initials = initialsFromName(name);
  const sz = size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border border-white/12 bg-gradient-to-br from-white/[0.12] to-pink-500/10 font-semibold tracking-tight text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        sz,
        className
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Generic record status (e.g. modelss.status, users.status). */
export function RecordStatusBadge({ status }: { status: string }) {
  const s = (status || "").trim().toLowerCase();
  const active = s === "active" || s === "enabled" || s === "live";
  const inactive = s === "inactive" || s === "disabled" || s === "paused" || s === "off";
  const variant = active ? "emerald" : inactive ? "slate" : "amber";
  const styles = {
    emerald: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
    slate: "border-white/12 bg-white/[0.06] text-white/65",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-200/90",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex max-w-[140px] items-center truncate rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        styles[variant]
      )}
      title={status || undefined}
    >
      {status?.trim() || "—"}
    </span>
  );
}

export function UserRoleBadge({ role }: { role: UserRole }) {
  const label = role.replace(/_/g, "");
  const styles: Record<UserRole, string> = {
    chatter: "border-sky-500/30 bg-sky-500/12 text-sky-200",
    virtual_assistant: "border-fuchsia-500/30 bg-fuchsia-500/12 text-fuchsia-200",
    admin: "border-amber-500/30 bg-amber-500/12 text-amber-100",
    manager: "border-orange-500/30 bg-orange-500/12 text-orange-100",
    model: "border-emerald-500/30 bg-emerald-500/12 text-emerald-100",
    client: "border-violet-500/30 bg-violet-500/12 text-violet-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        styles[role] ?? "border-white/12 bg-white/[0.06] text-white/70"
      )}
    >
      {label}
    </span>
  );
}

export function ShiftTypeBadge({
  shiftType,
  className,
}: {
  shiftType: string;
  className?: string;
}) {
  const def =
    shiftType !== "Custom"
      ? WEEKLY_PROGRAM_SHIFT_TYPE_DEFINITIONS[
          shiftType as keyof typeof WEEKLY_PROGRAM_SHIFT_TYPE_DEFINITIONS
        ]
      : null;
  const t = def ? getShiftTypeLabel(shiftType as WeeklyProgramShiftType) : shiftType === "Custom" ? "Custom" : shiftType;
  const Icon =
    def?.icon === "sunrise"
      ? SunMedium
      : def?.icon === "sunset"
        ? Sunset
        : def?.icon === "moon"
          ? Moon
          : def?.icon === "stars"
            ? Star
            : def?.icon === "sun"
              ? Sun
              : Layers;
  const chip = def?.badgeClass ?? "border-pink-400/35 bg-pink-500/12 text-pink-100";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        chip,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      {t}
    </span>
  );
}

/** Coverage matrix cell segment (covered / gap / uncovered). */
/** Infloww / ClarioSuite integration link status for model rows. */
export function IntegrationLinkBadge({
  kind,
  linked,
  className,
}: {
  kind: "infloww" | "instagram";
  linked: boolean;
  className?: string;
}) {
  const isInfloww = kind === "infloww";
  const Icon = isInfloww ? BarChart3 : Instagram;
  const label = isInfloww ? "Infloww" : "IG";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        linked
          ? isInfloww
            ? "border-sky-500/35 bg-sky-500/12 text-sky-200"
            : "border-fuchsia-500/35 bg-fuchsia-500/12 text-fuchsia-200"
          : "border-white/10 bg-white/[0.03] text-white/35",
        className
      )}
      title={
        linked
          ? isInfloww
            ? "Infloww creator ID linked"
            : "ClarioSuite IG user ID linked"
          : isInfloww
            ? "No Infloww creator ID"
            : "No ClarioSuite IG user ID"
      }
    >
      <Icon className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
      {label}
      <span className="sr-only">{linked ? "linked" : "not linked"}</span>
    </span>
  );
}

export function AdminStatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        accent
          ? "border-pink-500/25 bg-gradient-to-br from-pink-500/10 to-fuchsia-500/5"
          : "border-white/10 bg-white/[0.04]"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

export function CoverageSlotChip({
  tone,
  text,
}: {
  tone: "covered" | "gap" | "uncovered";
  text: string;
}) {
  const cls =
    tone === "covered"
      ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-100"
      : tone === "gap"
        ? "border-amber-500/35 bg-amber-500/12 text-amber-100"
        : "border-rose-500/35 bg-rose-500/12 text-rose-100";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-left text-[11px] font-medium leading-tight",
        cls
      )}
    >
      {tone === "covered" ? <Check className="h-3 w-3 shrink-0 opacity-80" aria-hidden /> : null}
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}
