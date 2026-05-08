/** Admin/UI prize kinds vs legacy Airtable `prize_type` single-select values. */

export const SPIN_PRIZE_UI_TYPES = ["points", "bonus", "break", "double_points", "custom"] as const;
export type SpinPrizeUiType = (typeof SPIN_PRIZE_UI_TYPES)[number];

export function spinPrizeDbToUi(db: string): SpinPrizeUiType {
  const t = String(db ?? "").trim().toLowerCase();
  if (t === "cash") return "bonus";
  if (t === "extra_break") return "break";
  if ((SPIN_PRIZE_UI_TYPES as readonly string[]).includes(t)) return t as SpinPrizeUiType;
  /** mystery, empty string, or older values — safest editor default */
  return "custom";
}

/** Map UI selection to Airtable `prize_type` (backward compatible with existing bases). */
export function spinPrizeUiToDb(ui: SpinPrizeUiType): string {
  switch (ui) {
    case "bonus":
      return "cash";
    case "break":
      return "extra_break";
    case "points":
      return "points";
    case "double_points":
      return "double_points";
    case "custom":
      return "custom";
    default:
      return "points";
  }
}

export const SPIN_PRIZE_UI_HEX: Record<SpinPrizeUiType, string> = {
  points: "#22c55e",
  bonus: "#f59e0b",
  break: "#38bdf8",
  double_points: "#a855f7",
  custom: "#ec4899",
};

export function defaultHexForSpinPrizeUi(ui: SpinPrizeUiType): string {
  return SPIN_PRIZE_UI_HEX[ui] ?? SPIN_PRIZE_UI_HEX.points;
}

export function spinPrizeTypeBadgeClass(ui: SpinPrizeUiType): string {
  switch (ui) {
    case "points":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "bonus":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "break":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    case "double_points":
      return "border-violet-500/40 bg-violet-500/15 text-violet-200";
    case "custom":
      return "border-pink-500/40 bg-pink-500/15 text-pink-200";
    default:
      return "border-white/20 bg-white/10 text-white/80";
  }
}
