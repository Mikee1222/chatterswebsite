"use client";

import * as React from "react";
import { Loader2, LogOut, Play } from "lucide-react";
import { VA_BTN_PRIMARY } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type ShiftButtonProps = {
  variant: "start" | "end";
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  size?: "md" | "lg";
  children?: React.ReactNode;
};

const SIZE_CLASS = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-base",
} as const;

export function ShiftButton({
  variant,
  loading = false,
  disabled = false,
  onClick,
  className,
  size = "md",
  children,
}: ShiftButtonProps) {
  const isStart = variant === "start";
  const label = children ?? (loading ? (isStart ? "Starting…" : "Ending…") : isStart ? "Start shift" : "End shift");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
        isStart
          ? cn(
              VA_BTN_PRIMARY,
              "rounded-xl",
              size === "lg" && "[&_svg]:h-5 [&_svg]:w-5",
            )
          : cn(
              "rounded-xl border border-red-500/40 bg-gradient-to-br from-red-500/20 via-amber-500/15 to-red-600/10 text-red-200",
              "shadow-[0_0_24px_-6px_rgba(239,68,68,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]",
              "hover:border-red-400/55 hover:from-red-500/28 hover:via-amber-500/22 hover:to-red-600/18 hover:text-red-100",
            ),
        SIZE_CLASS[size],
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : isStart ? (
        <Play className="h-4 w-4 shrink-0 fill-white" aria-hidden />
      ) : (
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {label}
    </button>
  );
}
