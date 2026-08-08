"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type VaTaskActionTone = "edit" | "delete" | "duplicate" | "neutral" | "remind";

const TONE: Record<VaTaskActionTone, string> = {
  edit:
    "border-[#D4AF8C]/30 bg-transparent text-[#D4AF8C]/75 hover:border-[#D4AF8C]/55 hover:bg-[#D4AF8C]/12 hover:text-[#D4AF8C] hover:shadow-[0_0_16px_-6px_rgba(212,175,140,0.35)]",
  delete:
    "border-white/10 bg-transparent text-[#B8B4B8]/45 hover:border-red-500/45 hover:bg-red-500/12 hover:text-red-300 hover:shadow-[0_0_16px_-6px_rgba(239,68,68,0.35)]",
  duplicate:
    "border-[#FF1493]/25 bg-transparent text-[#FF1493]/70 hover:border-[#FF1493]/50 hover:bg-[#FF1493]/12 hover:text-[#FF1493] hover:shadow-[0_0_16px_-6px_rgba(255,20,147,0.35)]",
  remind:
    "border-amber-500/30 bg-transparent text-amber-300/80 hover:border-amber-500/50 hover:bg-amber-500/12 hover:text-amber-200 hover:shadow-[0_0_16px_-6px_rgba(245,158,11,0.3)]",
  neutral:
    "border-white/12 bg-transparent text-white/55 hover:border-white/22 hover:bg-white/[0.06] hover:text-white/85",
};

export const VA_TASK_ACTION_BTN =
  "inline-flex min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium tracking-wide touch-manipulation transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF8C]/40";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: VaTaskActionTone;
  /** Icon-only compact control — still keeps a usable tap area via padding. */
  iconOnly?: boolean;
};

/**
 * Shared Tasks action control (Edit / Delete / Duplicate / Remind).
 * Visual-only — callers own click handlers and permissions.
 */
export function VaTaskActionButton({
  tone = "neutral",
  iconOnly = false,
  className,
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        VA_TASK_ACTION_BTN,
        TONE[tone],
        iconOnly && "min-h-[36px] min-w-[36px] px-2",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
