/**
 * Shared Instagram Insights (ClarioSuite) copy, formatters, and recommendation helpers.
 */

export const IG_STAT_INFO = {
  reach:
    "Unique accounts that saw this creator’s content at least once in the selected range (sum of daily reach).",
  views: "Total content views (plays/impressions-style) across the selected range.",
  engagement_rate:
    "Average of daily (total interactions ÷ reach × 100). Measures how actively the audience responds when they see content.",
  follower_growth:
    "Change in reconstructed follower count from the first to last day with follower data in this range.",
  follower_trend: "Daily follower count reconstructed from growth deltas + current followers.",
  age: "Audience age mix from Instagram demographics (latest audience snapshot).",
  countries: "Top countries where followers are located (latest audience snapshot).",
  gender: "Audience gender split from Instagram demographics (latest audience snapshot).",
  best_time:
    "When the most followers are typically online (onlineFollowers by UTC hour). Peak window is the best time to post.",
  top_posts:
    "Posts ranked by engagement score: (likes + comments + shares + saved) ÷ reach × 100.",
  comparison: "Linked models ranked by reach, engagement rate, and follower growth in this range.",
  connection:
    "ClarioSuite API key health (/me), linked model count, and when audience/insights were last synced.",
} as const;

export type IgStatMetricId = keyof typeof IG_STAT_INFO;

export const CHART_TOOLTIP_STYLE = {
  background: "#121218",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
} as const;

const COUNTRY_NAMES: Record<string, string> = {
  GR: "Greece",
  CY: "Cyprus",
  DE: "Germany",
  US: "United States",
  GB: "United Kingdom",
  UK: "United Kingdom",
  IT: "Italy",
  TR: "Turkey",
  AL: "Albania",
  FR: "France",
  ES: "Spain",
  NL: "Netherlands",
  BE: "Belgium",
  AT: "Austria",
  CH: "Switzerland",
  AU: "Australia",
  CA: "Canada",
  BR: "Brazil",
  MX: "Mexico",
  PL: "Poland",
  RO: "Romania",
  BG: "Bulgaria",
  RS: "Serbia",
  MK: "North Macedonia",
  AE: "UAE",
  SA: "Saudi Arabia",
  IN: "India",
  PH: "Philippines",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  PT: "Portugal",
  CZ: "Czechia",
  HU: "Hungary",
  UA: "Ukraine",
  RU: "Russia",
  JP: "Japan",
  KR: "South Korea",
  NZ: "New Zealand",
  ZA: "South Africa",
};

export function countryLabel(code: string): string {
  const c = code.trim().toUpperCase();
  return COUNTRY_NAMES[c] ?? code;
}

export function genderLabel(raw: string): string {
  const g = raw.trim().toUpperCase();
  if (g === "M" || g === "MALE") return "Men";
  if (g === "F" || g === "FEMALE") return "Women";
  if (g === "U" || g === "UNKNOWN" || g === "UNDISCLOSED") return "Undisclosed";
  return raw;
}

export const GENDER_COLORS: Record<string, string> = {
  Men: "#FF1493",
  Women: "#D4AF8C",
  Undisclosed: "rgba(255,255,255,0.35)",
};

export function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtDelta(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n).toLocaleString()}`;
}

/** Format a UTC hour as 12h clock, e.g. 19 → "7 PM". */
export function fmtHour12(hourUtc: number): string {
  const h = ((Math.round(hourUtc) % 24) + 24) % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

export type BestTimeRecommendation = {
  hourUtc: number;
  value: number;
  /** Short window label, e.g. "7–9 PM UTC" */
  windowLabel: string;
  /** Compelling recommendation sentence */
  recommendation: string;
  /** Optional Athens-local window when audience skews Greece */
  athensHint: string | null;
};

/**
 * Find peak online hour and a contiguous ±1h window for a “Post at …” card.
 */
export function buildBestTimeRecommendation(
  onlineFollowers: Array<{ hour: number; value: number }>,
  opts?: { topCountryCode?: string | null; modelName?: string | null; friendly?: boolean }
): BestTimeRecommendation | null {
  if (!onlineFollowers.length) return null;
  let best = onlineFollowers[0]!;
  for (const row of onlineFollowers) {
    if (row.value > best.value) best = row;
  }
  const peak = ((Math.round(best.hour) % 24) + 24) % 24;
  const end = (peak + 2) % 24;
  const windowLabel = `${fmtHour12(peak)}–${fmtHour12(end)} UTC`;

  const top = (opts?.topCountryCode ?? "").trim().toUpperCase();
  const useAthens = top === "GR" || top === "CY";
  let athensHint: string | null = null;
  if (useAthens) {
    // Athens = UTC+3 in summer (EEST); keep simple fixed offset for marketing copy.
    const aStart = (peak + 3) % 24;
    const aEnd = (end + 3) % 24;
    athensHint = `${fmtHour12(aStart)}–${fmtHour12(aEnd)} Athens time`;
  }

  const recommendation = opts?.friendly
    ? athensHint
      ? `Post around ${athensHint} — that’s when most of your followers are online.`
      : `Post around ${windowLabel} — that’s when most of your followers are online.`
    : athensHint
      ? `Best window: ${athensHint} (≈ ${windowLabel}). Schedule posts when the audience is most active.`
      : `Best window: ${windowLabel}. Schedule posts when the most followers are typically online.`;

  return {
    hourUtc: peak,
    value: best.value,
    windowLabel: athensHint ?? windowLabel,
    recommendation,
    athensHint,
  };
}

export function warmAudienceSummary(params: {
  countries: Array<{ label: string; value: number }>;
  ageRanges: Array<{ label: string; value: number }>;
  genders: Array<{ label: string; value: number }>;
  followersCount?: number | null;
}): string | null {
  const { countries, ageRanges, genders, followersCount } = params;
  const parts: string[] = [];
  if (countries.length) {
    const top = countries.slice(0, 2).map((c) => countryLabel(c.label));
    if (top.length === 1) parts.push(`mostly from ${top[0]}`);
    else parts.push(`mostly from ${top[0]} and ${top[1]}`);
  }
  if (ageRanges.length) {
    const topAge = [...ageRanges].sort((a, b) => b.value - a.value)[0];
    if (topAge) parts.push(`with the largest group aged ${topAge.label}`);
  }
  if (genders.length) {
    const mapped = genders.map((g) => ({ label: genderLabel(g.label), value: g.value }));
    const total = mapped.reduce((s, g) => s + g.value, 0);
    const topG = [...mapped].sort((a, b) => b.value - a.value)[0];
    if (topG && total > 0) {
      const pct = Math.round((topG.value / total) * 100);
      parts.push(`${pct}% ${topG.label.toLowerCase()}`);
    }
  }
  if (!parts.length) return null;
  const lead =
    followersCount != null && followersCount > 0
      ? `Your ${followersCount.toLocaleString()} followers are `
      : "Your followers are ";
  return lead + parts.join(", ") + ".";
}

export function rankMedal(
  rank: number
): { badge: string; className: string; badgeClass: string; label: string } | null {
  if (rank === 1)
    return {
      badge: "1",
      label: "Gold",
      badgeClass: "bg-amber-400 text-black",
      className:
        "border-amber-400/40 bg-gradient-to-br from-amber-500/25 to-amber-900/10 text-amber-100",
    };
  if (rank === 2)
    return {
      badge: "2",
      label: "Silver",
      badgeClass: "bg-slate-200 text-slate-900",
      className:
        "border-slate-300/35 bg-gradient-to-br from-slate-200/15 to-slate-800/20 text-slate-100",
    };
  if (rank === 3)
    return {
      badge: "3",
      label: "Bronze",
      badgeClass: "bg-orange-400 text-orange-950",
      className:
        "border-orange-400/35 bg-gradient-to-br from-orange-500/20 to-orange-950/15 text-orange-100",
    };
  return null;
}

export function formatRelativeSync(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
