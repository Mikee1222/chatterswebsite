"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CountUp } from "@/components/infloww-performance-ui";
import { VA_CARD, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export type MarketingTabId = "accounts" | "phones" | "reports" | "funnels" | "platforms";

export const ADMIN_MARKETING_TABS: { id: MarketingTabId; label: string }[] = [
  { id: "accounts", label: "Social Accounts" },
  { id: "phones", label: "Phones" },
  { id: "reports", label: "Shadowban Reports" },
  { id: "funnels", label: "Funnel Links" },
  { id: "platforms", label: "Platforms" },
];

export const VA_MARKETING_TABS: { id: Exclude<MarketingTabId, "platforms">; label: string }[] = [
  { id: "accounts", label: "Social Accounts" },
  { id: "phones", label: "Phones" },
  { id: "reports", label: "Shadowban Reports" },
  { id: "funnels", label: "Funnel Links" },
];

type StatAccent = "champagne" | "emerald" | "amber" | "red" | "pink" | "blue";

const STAT_ACCENT: Record<
  StatAccent,
  { border: string; bg: string; text: string; glow: string }
> = {
  champagne: {
    border: "border-[#D4AF8C]/25",
    bg: "bg-[#D4AF8C]/8",
    text: "text-[#D4AF8C]",
    glow: "rgba(212,175,140,0.2)",
  },
  emerald: {
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/8",
    text: "text-emerald-300",
    glow: "rgba(52,211,153,0.18)",
  },
  amber: {
    border: "border-amber-500/25",
    bg: "bg-amber-500/8",
    text: "text-amber-300",
    glow: "rgba(245,158,11,0.18)",
  },
  red: {
    border: "border-red-500/25",
    bg: "bg-red-500/10",
    text: "text-red-300",
    glow: "rgba(239,68,68,0.18)",
  },
  pink: {
    border: "border-[#FF1493]/25",
    bg: "bg-[#FF1493]/8",
    text: "text-[#FFB3D9]",
    glow: "rgba(255,20,147,0.2)",
  },
  blue: {
    border: "border-blue-500/25",
    bg: "bg-blue-500/8",
    text: "text-blue-300",
    glow: "rgba(59,130,246,0.18)",
  },
};

export function MarketingStatCard({
  label,
  value,
  accent = "champagne",
  suffix,
}: {
  label: string;
  value: number;
  accent?: StatAccent;
  suffix?: string;
}) {
  const cfg = STAT_ACCENT[accent];
  return (
    <div
      className={cn(
        VA_CARD,
        "relative overflow-hidden p-4 transition duration-300 hover:border-white/12",
        cfg.border,
        cfg.bg,
      )}
    >
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-40 blur-2xl"
        style={{ background: `radial-gradient(circle, ${cfg.glow}, transparent 70%)` }}
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-bold tabular-nums", cfg.text)}>
        <CountUp value={value} />
        {suffix ? <span className="ml-1 text-sm font-medium text-white/35">{suffix}</span> : null}
      </p>
    </div>
  );
}

export function MarketingControlRoomHero({
  eyebrow,
  title,
  description,
  actions,
  stats,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  stats: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-8 md:px-8">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,20,147,0.35), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(212,175,140,0.25), transparent 70%)" }}
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
            {eyebrow}
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-white via-white to-[#FF1493]/90 bg-clip-text text-3xl font-semibold tracking-tight text-transparent md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#B8B4B8]/70">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{stats}</div>
    </div>
  );
}

export function MarketingTabBar<T extends string>({
  tabs,
  active,
  onChange,
  badgeByTab,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  badgeByTab?: Partial<Record<T, number>>;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-white/[0.06] bg-[#0D0B0D]/80 p-1.5">
      {tabs.map((t) => {
        const badge = badgeByTab?.[t.id];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "relative rounded-xl px-4 py-2.5 text-sm font-medium transition",
              active === t.id ? "text-white" : "text-[#B8B4B8]/55 hover:text-[#B8B4B8]",
            )}
          >
            {active === t.id ? (
              <motion.span
                layoutId="marketing-control-room-tab"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#FF1493]/20 to-[#D4AF8C]/10 ring-1 ring-[#FF1493]/25"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-2">
              {t.label}
              {badge && badge > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">
                  {badge}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MarketingFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
  chips,
  onClear,
  showClear,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  children?: React.ReactNode;
  chips?: React.ReactNode;
  onClear?: () => void;
  showClear?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0D0B0D]/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="relative min-w-48 flex-1">
          <input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full")}
          />
        </div>
        {children}
        {showClear && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-[#B8B4B8]/50 hover:text-white"
          >
            Clear
          </button>
        ) : null}
      </div>
      {chips ? <div className="flex flex-wrap gap-2">{chips}</div> : null}
    </div>
  );
}

export function MarketingEmptyCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn(VA_CARD, "flex flex-col items-center px-6 py-16 text-center")}>
      <div className="mb-4 text-[#D4AF8C]/35">{icon}</div>
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-md text-sm text-[#B8B4B8]/55">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
