/** Luxury boutique design tokens — VA Tasks (VA + Admin). */
export const VA_TASKS = {
  bgBase: "#0A0A0A",
  bgWarm: "#0D0B0D",
  card: "#151315",
  cardBorder: "rgba(255,255,255,0.06)",
  pink: "#FF1493",
  champagne: "#D4AF8C",
  champagneMuted: "rgba(212,175,140,0.35)",
  bodyText: "#B8B4B8",
  bodyMuted: "rgba(184,180,184,0.55)",
} as const;

export const VA_CARD =
  "rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#151315] transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:border-[rgba(212,175,140,0.18)] hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)]";

export const VA_FILTER_INPUT =
  "h-10 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0D0B0D] px-3 text-sm text-[#B8B4B8] outline-none transition placeholder:text-[#B8B4B8]/35 focus:border-[#FF1493]/50 focus:ring-1 focus:ring-[#FF1493]/20";

export const VA_STATUS_BADGE =
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]";

export const VA_MODEL_TAG =
  "rounded-full border border-[#D4AF8C]/40 bg-transparent px-2.5 py-0.5 text-xs font-medium text-[#D4AF8C]";
