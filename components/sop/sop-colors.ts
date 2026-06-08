import type { SopColor, CadenceType } from "@/types";

export const SOP_COLOR_STYLES: Record<
  SopColor,
  { badge: string; dot: string; border: string; text: string; glow: string }
> = {
  blue: {
    badge: "border-blue-500/30 bg-blue-500/15 text-blue-200",
    dot: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.55)]",
    border: "border-blue-500/25",
    text: "text-blue-200",
    glow: "shadow-[0_0_20px_-6px_rgba(59,130,246,0.35)]",
  },
  pink: {
    badge: "border-pink-500/30 bg-pink-500/15 text-pink-200",
    dot: "bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.55)]",
    border: "border-pink-500/25",
    text: "text-pink-200",
    glow: "shadow-[0_0_20px_-6px_rgba(236,72,153,0.38)]",
  },
  green: {
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]",
    border: "border-emerald-500/25",
    text: "text-emerald-200",
    glow: "shadow-[0_0_20px_-6px_rgba(16,185,129,0.35)]",
  },
  orange: {
    badge: "border-orange-500/30 bg-orange-500/15 text-orange-200",
    dot: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.55)]",
    border: "border-orange-500/25",
    text: "text-orange-200",
    glow: "shadow-[0_0_20px_-6px_rgba(249,115,22,0.35)]",
  },
  purple: {
    badge: "border-violet-500/30 bg-violet-500/15 text-violet-200",
    dot: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.55)]",
    border: "border-violet-500/25",
    text: "text-violet-200",
    glow: "shadow-[0_0_20px_-6px_rgba(139,92,246,0.35)]",
  },
  gray: {
    badge: "border-white/15 bg-white/10 text-white/65",
    dot: "bg-white/45",
    border: "border-white/12",
    text: "text-white/65",
    glow: "shadow-[0_0_16px_-8px_rgba(255,255,255,0.12)]",
  },
};

export const CADENCE_STYLES: Record<CadenceType, { badge: string; glow: string }> = {
  daily: {
    badge: "border-emerald-500/30 bg-emerald-500/12 text-emerald-200",
    glow: "shadow-[0_0_16px_-6px_rgba(16,185,129,0.3)]",
  },
  per_shift: {
    badge: "border-sky-500/30 bg-sky-500/12 text-sky-200",
    glow: "shadow-[0_0_16px_-6px_rgba(14,165,233,0.3)]",
  },
  weekly: {
    badge: "border-violet-500/30 bg-violet-500/12 text-violet-200",
    glow: "shadow-[0_0_16px_-6px_rgba(139,92,246,0.3)]",
  },
  biweekly: {
    badge: "border-amber-500/30 bg-amber-500/12 text-amber-200",
    glow: "shadow-[0_0_16px_-6px_rgba(245,158,11,0.3)]",
  },
  monthly: {
    badge: "border-pink-500/30 bg-pink-500/12 text-pink-200",
    glow: "shadow-[0_0_16px_-6px_rgba(236,72,153,0.3)]",
  },
  ad_hoc: {
    badge: "border-white/15 bg-white/10 text-white/60",
    glow: "shadow-[0_0_12px_-8px_rgba(255,255,255,0.1)]",
  },
};
