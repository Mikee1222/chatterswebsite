"use client";

import * as React from "react";
import { Loader2, LogOut, Pause, Play } from "lucide-react";
import { VA_BTN_PRIMARY } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type ShiftButtonProps = {
  variant: "start" | "end" | "pause" | "resume";
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  size?: "md" | "lg";
  children?: React.ReactNode;
};

const SIZE_CLASS = {
  md: "min-h-11 px-5 py-2.5 text-sm",
  lg: "min-h-12 px-8 py-3.5 text-base",
} as const;

const DEFAULT_LABEL: Record<ShiftButtonProps["variant"], { idle: string; loading: string }> = {
  start: { idle: "Start shift", loading: "Starting…" },
  end: { idle: "End shift", loading: "Ending…" },
  pause: { idle: "Pause", loading: "Pausing…" },
  resume: { idle: "Resume", loading: "Resuming…" },
};

export function ShiftButton({
  variant,
  loading = false,
  disabled = false,
  onClick,
  className,
  size = "md",
  children,
}: ShiftButtonProps) {
  const defaults = DEFAULT_LABEL[variant];
  const label = children ?? (loading ? defaults.loading : defaults.idle);

  const variantClass =
    variant === "start"
      ? cn(VA_BTN_PRIMARY, "rounded-xl", size === "lg" && "[&_svg]:h-5 [&_svg]:w-5")
      : variant === "end"
        ? cn(
            "rounded-xl border border-red-500/40 bg-gradient-to-br from-red-500/20 via-amber-500/15 to-red-600/10 text-red-200",
            "shadow-[0_0_24px_-6px_rgba(239,68,68,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]",
            "hover:border-red-400/55 hover:from-red-500/28 hover:via-amber-500/22 hover:to-red-600/18 hover:text-red-100",
          )
        : variant === "pause"
          ? cn(
              "rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-500/12 via-stone-500/10 to-amber-600/8 text-amber-100/90",
              "shadow-[0_0_20px_-8px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]",
              "hover:border-amber-400/50 hover:from-amber-500/18 hover:text-amber-50",
            )
          : cn(
              "rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/18 via-teal-500/12 to-emerald-600/10 text-emerald-100",
              "shadow-[0_0_24px_-6px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]",
              "hover:border-emerald-400/55 hover:from-emerald-500/26 hover:text-emerald-50",
            );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
        "touch-manipulation",
        variantClass,
        SIZE_CLASS[size],
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : variant === "start" || variant === "resume" ? (
        <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden />
      ) : variant === "pause" ? (
        <Pause className="h-4 w-4 shrink-0 fill-current" aria-hidden />
      ) : (
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {label}
    </button>
  );
}
