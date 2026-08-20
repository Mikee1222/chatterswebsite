/**
 * Shared Gunzo luxury tokens for the Application / Recruitment system.
 * Aligns with VA_TASKS / FormField / glass-card — dark base, pink + champagne accents.
 */

export const APPLY = {
  bg: "#030712", // gray-950
  bgWarm: "#0D0B0D",
  card: "#151315",
  cardElevated: "#1a1618",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  pink: "#FF1493",
  champagne: "#D4AF8C",
  champagneSoft: "#E8D0B0",
  body: "#B8B4B8",
  muted: "rgba(184,180,184,0.55)",
  white: "#FFFFFF",
} as const;

/** Public apply page shell (layout + chrome). */
export const APPLY_SHELL =
  "relative min-h-dvh overflow-x-hidden bg-gray-950 text-white";

/** Layered glass panel for candidate steps. */
export const APPLY_GLASS =
  "overflow-hidden rounded-3xl border border-white/10 bg-[rgba(20,20,25,0.72)] shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl";

/** Inner elevated surface inside glass. */
export const APPLY_SURFACE =
  "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

/** Champagne eyebrow label. */
export const APPLY_EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/80";

/** Pink field label (FormField parity). */
export const APPLY_LABEL = "text-sm font-medium text-[#FF1493]";

/** Luxury text / select / textarea control. */
export const APPLY_INPUT =
  "w-full min-h-[52px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 outline-none transition-[border-color,box-shadow,background-color,transform] duration-200 [color-scheme:dark] hover:border-[#FF1493]/30 hover:bg-white/[0.07] focus:border-[#FF1493] focus:ring-2 focus:ring-[#FF1493]/25 md:rounded-xl md:bg-[#1a1a1a] md:hover:bg-[#1f1f1f]";

/** Primary CTA — pink gradient. */
export const APPLY_BTN_PRIMARY =
  "inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF1493] via-[#E91E8C] to-[#DB2777] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_32px_-8px_rgba(255,20,147,0.55),0_2px_8px_-2px_rgba(0,0,0,0.4)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40";

/** Secondary / outline CTA. */
export const APPLY_BTN_SECONDARY =
  "inline-flex items-center justify-center rounded-2xl border border-[#D4AF8C]/35 bg-transparent px-5 py-3 text-sm font-medium text-[#D4AF8C] shadow-[inset_0_1px_0_rgba(212,175,140,0.12)] transition hover:border-[#D4AF8C]/55 hover:bg-[#D4AF8C]/[0.06] disabled:opacity-40";

/** Ghost / back button. */
export const APPLY_BTN_GHOST =
  "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/70 transition hover:border-white/20 hover:text-white disabled:opacity-40";

/** Progress track + fill. */
export const APPLY_PROGRESS_TRACK = "h-1.5 overflow-hidden rounded-full bg-white/10";
export const APPLY_PROGRESS_FILL =
  "h-full rounded-full bg-gradient-to-r from-[#D4AF8C] via-[#FF1493] to-[#FF1493] transition-all duration-300";

/** Admin response status pills. */
export const RESPONSE_STATUS_STYLE = {
  new: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  reviewed: "border-white/15 bg-white/5 text-white/65",
  shortlisted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-300",
  hired:
    "border-[#D4AF8C]/45 bg-gradient-to-r from-[#D4AF8C]/20 to-[#FF1493]/10 text-[#E8D0B0] shadow-[0_0_20px_-6px_rgba(212,175,140,0.45)]",
} as const;

/** Recharts series colors. */
export const APPLY_CHART = {
  primary: "#FF1493",
  secondary: "#D4AF8C",
  grid: "rgba(255,255,255,0.06)",
  tick: "rgba(255,255,255,0.4)",
  tooltipBg: "#121218",
  tooltipBorder: "rgba(255,255,255,0.1)",
} as const;

export const APPLY_CHART_TOOLTIP = {
  background: APPLY_CHART.tooltipBg,
  border: `1px solid ${APPLY_CHART.tooltipBorder}`,
  borderRadius: 12,
  fontSize: 12,
  color: "#fff",
} as const;
