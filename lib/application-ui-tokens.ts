/**
 * Shared Gunzo luxury tokens for the Application / Recruitment system.
 * Aligns with VA_TASKS / FormField / formGradientButton / Chatter Performance —
 * dark base, pink + champagne accents, substantial primary CTAs.
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

/** Section card — SopFormSection / flagship parity. */
export const APPLY_SECTION =
  "rounded-2xl border border-white/10 bg-gradient-to-br from-[#151315]/90 via-[#0D0B0D]/80 to-[#120810]/70 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)]";

/** Champagne eyebrow label. */
export const APPLY_EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/80";

/** Pink field label (FormField parity). */
export const APPLY_LABEL = "text-sm font-medium text-[#FF1493]";

/** FormField-style field shell (desktop card). */
export const APPLY_FIELD_SHELL =
  "space-y-2.5 transition-[border-color,box-shadow] duration-200 ease-out max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 md:rounded-xl md:border md:border-white/10 md:bg-[#1a1a1a] md:p-4 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:focus-within:border-[#FF1493]/40 md:focus-within:ring-1 md:focus-within:ring-[#FF1493]/20";

/** Luxury text / select / textarea control (FormInput parity). */
export const APPLY_INPUT =
  "w-full min-h-[52px] origin-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 outline-none transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out [color-scheme:dark] hover:border-[#FF1493]/30 hover:bg-white/[0.07] focus:border-[#FF1493] focus:ring-2 focus:ring-[#FF1493]/25 md:rounded-xl md:border-white/12 md:bg-[#1a1a1a] md:py-4 md:hover:bg-[#1f1f1f] md:focus:scale-[1.01] md:focus:bg-[#1f1f1f]";

/** Shared size / spacing for all apply CTAs. */
export const APPLY_BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold tracking-tight transition-[transform,box-shadow,background-color,border-color,filter,opacity,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1493]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none";

export const APPLY_BTN_SIZE_MD = "min-h-[52px] px-6 py-3.5";
export const APPLY_BTN_SIZE_SM = "min-h-[44px] px-4 py-2.5 text-xs";
export const APPLY_BTN_SIZE_LG = "min-h-[56px] px-7 py-4 text-[15px]";

/**
 * Primary CTA — rich #FF1493 gradient with depth, glow, hover lift, pressed scale.
 * Matches FormSubmitButton / VA_BTN_PRIMARY quality bar.
 */
export const APPLY_BTN_PRIMARY = [
  APPLY_BTN_BASE,
  APPLY_BTN_SIZE_MD,
  "w-full border border-transparent bg-gradient-to-br from-[#FF1493] via-[#E91E8C] to-[#DB2777] text-white",
  "shadow-[0_8px_32px_-8px_rgba(255,20,147,0.55),0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.22)]",
  "hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_44px_-10px_rgba(255,20,147,0.65),0_0_36px_-6px_rgba(236,72,153,0.4)]",
  "active:translate-y-0 active:scale-[0.98] active:brightness-95",
].join(" ");

/** Compact primary (inline nav Next / Finish). */
export const APPLY_BTN_PRIMARY_INLINE = [
  APPLY_BTN_BASE,
  APPLY_BTN_SIZE_MD,
  "w-auto min-w-[132px] border border-transparent bg-gradient-to-br from-[#FF1493] via-[#E91E8C] to-[#DB2777] text-white",
  "shadow-[0_8px_32px_-8px_rgba(255,20,147,0.55),0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.22)]",
  "hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_44px_-10px_rgba(255,20,147,0.65)]",
  "active:translate-y-0 active:scale-[0.98]",
].join(" ");

/** Secondary / outline — champagne subordinate CTA. */
export const APPLY_BTN_SECONDARY = [
  APPLY_BTN_BASE,
  APPLY_BTN_SIZE_MD,
  "border border-[#D4AF8C]/40 bg-transparent text-[#D4AF8C]",
  "shadow-[inset_0_1px_0_rgba(212,175,140,0.14)]",
  "hover:border-[#D4AF8C]/65 hover:bg-[#D4AF8C]/[0.08] hover:text-[#E8D0B0]",
  "active:scale-[0.98]",
].join(" ");

/** Ghost / back — polished quiet control. */
export const APPLY_BTN_GHOST = [
  APPLY_BTN_BASE,
  APPLY_BTN_SIZE_MD,
  "border border-white/12 bg-white/[0.03] text-white/70",
  "hover:border-white/22 hover:bg-white/[0.06] hover:text-white",
  "active:scale-[0.98]",
].join(" ");

/** Admin compact primary (Publish / Save / New form). */
export const APPLY_BTN_ADMIN_PRIMARY = [
  APPLY_BTN_BASE,
  APPLY_BTN_SIZE_SM,
  "border border-transparent bg-gradient-to-br from-[#FF1493] via-[#E91E8C] to-[#DB2777] text-white",
  "shadow-[0_6px_24px_-8px_rgba(255,20,147,0.5),inset_0_1px_0_rgba(255,255,255,0.18)]",
  "hover:-translate-y-px hover:brightness-110",
  "active:scale-[0.98]",
].join(" ");

/** Admin compact secondary / outline. */
export const APPLY_BTN_ADMIN_SECONDARY = [
  APPLY_BTN_BASE,
  APPLY_BTN_SIZE_SM,
  "border border-white/12 bg-white/[0.03] text-white/75",
  "hover:border-[#D4AF8C]/35 hover:bg-[#D4AF8C]/[0.06] hover:text-[#D4AF8C]",
  "active:scale-[0.98]",
].join(" ");

/** Champagne solid admin CTA (Create / Publish alternate). */
export const APPLY_BTN_ADMIN_CHAMPAGNE = [
  APPLY_BTN_BASE,
  APPLY_BTN_SIZE_SM,
  "border border-[#D4AF8C]/50 bg-gradient-to-br from-[#E8D0B0] to-[#D4AF8C] text-[#0D0B0D]",
  "shadow-[0_6px_20px_-8px_rgba(212,175,140,0.45),inset_0_1px_0_rgba(255,255,255,0.35)]",
  "hover:-translate-y-px hover:brightness-105",
  "active:scale-[0.98]",
].join(" ");

/** Choice option (MCQ / language card). */
export const APPLY_CHOICE =
  "w-full rounded-xl border px-4 py-3.5 text-left text-sm transition duration-200";
export const APPLY_CHOICE_IDLE =
  "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.05]";
export const APPLY_CHOICE_ACTIVE =
  "border-[#FF1493]/45 bg-[#FF1493]/12 text-white shadow-[0_0_24px_-10px_rgba(255,20,147,0.45)]";
export const APPLY_CHOICE_ACTIVE_CHAMPAGNE =
  "border-[#D4AF8C]/45 bg-[#D4AF8C]/12 text-white shadow-[0_0_24px_-10px_rgba(212,175,140,0.4)]";

/** Progress track + fill. */
export const APPLY_PROGRESS_TRACK =
  "h-2 overflow-hidden rounded-full bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]";
export const APPLY_PROGRESS_FILL =
  "h-full rounded-full bg-gradient-to-r from-[#D4AF8C] via-[#FF1493] to-[#FF1493] shadow-[0_0_12px_-2px_rgba(255,20,147,0.55)] transition-all duration-300 ease-out";

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
