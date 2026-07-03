/** Luxury boutique design tokens — VA Tasks (VA + Admin). */
export const VA_TASKS = {
  bgBase: "#0A0A0A",
  bgWarm: "#0D0B0D",
  card: "#151315",
  cardGradient: "linear-gradient(135deg, #151315 0%, #1A1618 100%)",
  cardBorder: "rgba(255,255,255,0.06)",
  pink: "#FF1493",
  champagne: "#D4AF8C",
  champagneMuted: "rgba(212,175,140,0.35)",
  bodyText: "#B8B4B8",
  bodyMuted: "rgba(184,180,184,0.55)",
} as const;

/** Gradient card surface with champagne border ring (see globals `.va-card`). */
export const VA_CARD =
  "va-card rounded-2xl transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65),0_0_32px_-8px_rgba(255,20,147,0.12)]";

export const VA_CARD_GLOW =
  "relative before:pointer-events-none before:absolute before:-inset-6 before:-z-10 before:rounded-[28px] before:bg-[radial-gradient(ellipse_at_center,rgba(255,20,147,0.14)_0%,transparent_70%)] before:opacity-80 before:blur-2xl";

export const VA_FILTER_INPUT =
  "h-10 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0D0B0D]/90 px-3 text-sm text-[#B8B4B8] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition placeholder:text-[#B8B4B8]/35 focus:border-[#FF1493]/50 focus:ring-1 focus:ring-[#FF1493]/20";

export const VA_STATUS_BADGE =
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur-sm";

export const VA_MODEL_TAG =
  "rounded-full border border-[#D4AF8C]/40 bg-[#D4AF8C]/[0.06] px-2.5 py-0.5 text-xs font-medium text-[#D4AF8C] shadow-[0_0_12px_-4px_rgba(212,175,140,0.35)]";

export const VA_CHAMPAGNE_DIVIDER = "va-champagne-divider h-px w-full";

export const VA_BTN_PRIMARY =
  "rounded-xl bg-gradient-to-br from-[#FF1493] via-[#E91E8C] to-[#DB2777] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_-8px_rgba(255,20,147,0.55),0_2px_8px_-2px_rgba(0,0,0,0.4)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40";

export const VA_BTN_SECONDARY =
  "rounded-xl border border-[#D4AF8C]/35 bg-transparent px-5 py-3 text-sm font-medium text-[#D4AF8C] shadow-[inset_0_1px_0_rgba(212,175,140,0.12)] transition hover:border-[#D4AF8C]/55 hover:bg-[#D4AF8C]/[0.06]";
