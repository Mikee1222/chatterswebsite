/**
 * Parse legacy free-text price strings into structured min/max/plus/text fields.
 * Does not change numeric values — only structures them.
 */

export type ParsedPrice = {
  price_min: number | null;
  price_max: number | null;
  price_plus: boolean;
  neg_min: number | null;
  neg_max: number | null;
  neg_text: string | null;
  unparsed: boolean;
};

const RANGE_RE =
  /^\s*(\d+(?:\.\d+)?)\s*[–\-—~to]+\s*(\d+(?:\.\d+)?)(\+)?\s*$/i;
const PLUS_RE = /^\s*(\d+(?:\.\d+)?)\s*\+\s*$/;
const SINGLE_RE = /^\s*(\d+(?:\.\d+)?)\s*$/;

function parseNumericSide(raw: string): {
  min: number | null;
  max: number | null;
  plus: boolean;
  text: string | null;
  unparsed: boolean;
} {
  const s = String(raw ?? "").trim();
  if (!s || s === "-") {
    return { min: null, max: null, plus: false, text: s || null, unparsed: false };
  }
  const upper = s.toUpperCase();
  if (upper === "TW" || upper === "NO NEGOTIATION" || /^[A-Za-z]/.test(s)) {
    return { min: null, max: null, plus: false, text: s, unparsed: false };
  }

  const range = s.match(RANGE_RE);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    const plus = Boolean(range[3]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { min: a, max: b, plus, text: null, unparsed: false };
    }
  }

  const plusOnly = s.match(PLUS_RE);
  if (plusOnly) {
    const a = Number(plusOnly[1]);
    if (Number.isFinite(a)) {
      return { min: a, max: null, plus: true, text: null, unparsed: false };
    }
  }

  const single = s.match(SINGLE_RE);
  if (single) {
    const a = Number(single[1]);
    if (Number.isFinite(a)) {
      return { min: a, max: a, plus: false, text: null, unparsed: false };
    }
  }

  return { min: null, max: null, plus: false, text: s, unparsed: true };
}

/** Parse a normal price string (expects numeric range or N+). */
export function parsePriceNormal(raw: string): Pick<ParsedPrice, "price_min" | "price_max" | "price_plus" | "unparsed"> {
  const p = parseNumericSide(raw);
  return {
    price_min: p.min,
    price_max: p.max,
    price_plus: p.plus,
    unparsed: p.unparsed || (p.min == null && !p.text),
  };
}

/** Parse a negotiation price string (may be TW / No Negotiation / range). */
export function parsePriceNegotiation(raw: string): Pick<
  ParsedPrice,
  "neg_min" | "neg_max" | "neg_text" | "unparsed"
> & { price_plus?: boolean } {
  const p = parseNumericSide(raw);
  if (p.text != null && p.min == null) {
    return { neg_min: null, neg_max: null, neg_text: p.text, unparsed: p.unparsed };
  }
  return {
    neg_min: p.min,
    neg_max: p.max,
    neg_text: p.plus && p.max == null ? null : p.text,
    unparsed: p.unparsed,
    price_plus: p.plus,
  };
}

export function parseLegacyPrices(
  price_normal: string,
  price_negotiation: string
): ParsedPrice {
  const n = parsePriceNormal(price_normal);
  const g = parsePriceNegotiation(price_negotiation);
  // Negotiation "N+" → store as neg_min + mark via neg_text if needed; keep plus on normal only.
  let neg_text = g.neg_text;
  if (g.price_plus && g.neg_max == null && g.neg_min != null && !neg_text) {
    // Structured as min with open end — encode open via null max (no separate neg_plus column).
    neg_text = null;
  }
  return {
    price_min: n.price_min,
    price_max: n.price_max,
    price_plus: n.price_plus || Boolean(g.price_plus && g.neg_max == null && n.price_plus),
    neg_min: g.neg_min,
    neg_max: g.neg_max,
    neg_text,
    unparsed: n.unparsed || g.unparsed,
  };
}

/** Format structured price back to display string (preserves raw when available). */
export function formatPriceDisplay(opts: {
  min: number | null;
  max: number | null;
  plus?: boolean;
  text?: string | null;
  raw?: string | null;
}): string {
  if (opts.raw?.trim()) return opts.raw.trim();
  if (opts.text?.trim()) return opts.text.trim();
  if (opts.min == null) return "";
  if (opts.max != null && opts.max !== opts.min) {
    return `${opts.min} – ${opts.max}${opts.plus ? "+" : ""}`;
  }
  if (opts.plus) return `${opts.min}+`;
  return String(opts.min);
}

/** Simple Levenshtein distance for fuzzy model-name suggestions. */
export function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export type FuzzySuggestion = {
  legacy_name: string;
  suggested_model_id: string;
  suggested_model_name: string;
  distance: number;
  score: number;
};

export function suggestModelMatches(
  legacyNames: string[],
  models: { id: string; model_name: string }[],
  opts?: { maxDistance?: number; topN?: number }
): FuzzySuggestion[] {
  const maxDistance = opts?.maxDistance ?? 6;
  const topN = opts?.topN ?? 1;
  const out: FuzzySuggestion[] = [];
  for (const legacy of legacyNames) {
    const scored = models
      .map((m) => {
        const distance = levenshtein(legacy.trim(), m.model_name.trim());
        const legacyLower = legacy.toLowerCase();
        const modelLower = m.model_name.toLowerCase();
        const contains =
          legacyLower.includes(modelLower) || modelLower.includes(legacyLower.split(/\s+/)[0] ?? "");
        const score = contains ? Math.max(0, 10 - distance) + 5 : Math.max(0, 10 - distance);
        return { ...m, distance, score };
      })
      .filter((x) => x.distance <= maxDistance || x.score >= 5)
      .sort((a, b) => b.score - a.score || a.distance - b.distance)
      .slice(0, topN);
    for (const s of scored) {
      out.push({
        legacy_name: legacy,
        suggested_model_id: s.id,
        suggested_model_name: s.model_name,
        distance: s.distance,
        score: s.score,
      });
    }
  }
  return out;
}

/** Known Greek → English translations for USA menu copies. */
export const EL_TO_EN_DESCRIPTION: Record<string, string> = {
  "Με ρούχα, τρίβεσαι, sexy κινήσεις, λίγο tease.":
    "Clothed, grinding, sexy moves, light tease.",
  "Γδύσιμο, δείχνεις στήθος": "Undressing, showing breasts.",
  "Γυμνή, τρίβεσαι ή στοματικό σε dildo.": "Nude, grinding or oral on a dildo.",
  "Παίζει με το μουνί της / τρίβει πούτσα": "Playing with her pussy / stroking cock.",
  "Δονητής μέσα σε μουνί, σε τρανς πίσω τρύπα":
    "Vibrator in pussy; for trans models, in ass.",
  Χύνεις: "Orgasm / finish.",
  "Φωτό όχι nude με εσώρουχα": "Non-nude photo in lingerie/underwear.",
  "Παλιό σκριπτ — Με ρούχα, τρίβεσαι, sexy κινήσεις, λίγο tease.":
    "Legacy script — clothed, grinding, sexy moves, light tease.",
  "Παλιό σκριπτ — Γδύσιμο, δείχνεις στήθος": "Legacy script — undressing, showing breasts.",
  "Παλιό σκριπτ — Γυμνή, τρίβεσαι ή στοματικό σε dildo.":
    "Legacy script — nude, grinding or oral on a dildo.",
  "Παλιό σκριπτ — Παίζει με το μουνί της / τρίβει πούτσα":
    "Legacy script — playing with her pussy / stroking cock.",
  "Παλιό σκριπτ — Δονητής μέσα σε μουνί, σε τρανς πίσω τρύπα":
    "Legacy script — vibrator in pussy; for trans models, in ass.",
  "Παλιό σκριπτ — Χύνεις": "Legacy script — orgasm / finish.",
  "5 – 15 λεπτά": "5 – 15 minutes.",
  "10 – 15 λεπτά": "10 – 15 minutes.",
};

export const EL_TO_EN_NOTES: Record<string, string> = {
  "Μπορείς να δώσεις και δώρο φωτό στο negotiation (nude no pussy)":
    "You may include a gift photo in negotiation (nude, no pussy).",
  "Μπορείς να δώσεις και δώρο φωτό στο negotiation (nude, no pussy)":
    "You may include a gift photo in negotiation (nude, no pussy).",
  "Μπορείς να δώσεις και δώρο βίντεο μικρής διάρκειας τύπου mass message":
    "You may include a short mass-message-style gift video.",
  "Μπορείς να δώσεις δώρο βιντεάκι παλιό 1 λεπτό":
    "You may include an older ~1 minute gift clip.",
};

export const EL_TO_EN_SPECIAL_DESC: Record<string, string> = {
  "Sextapes κάτω από 1 λεπτό μπορούν να πουληθούν και 150. Αναλόγως πάντα τον spender και το model — Ask Mike ":
    "Sextapes under 1 minute can also sell around 150. Always depends on the spender and model — ask Mike.",
  "Αναλόγως το custom πάντα. 1. Customs πάνω από 2-3 λεπτά με fully nude περιεχόμενο είναι 200. 2. ANAL Customs (αν κάνει το μοντέλ) είναι πάνω από 300.":
    "Always depends on the custom. 1. Customs over 2–3 minutes with fully nude content are around 200. 2. Anal customs (if the model does them) are 300+.",
  "5 – 15 λεπτά": "5 – 15 minutes.",
};

export function translateElToEn(
  text: string,
  map: Record<string, string>
): { translated: string; untranslated: boolean } {
  const t = String(text ?? "").trim();
  if (!t) return { translated: "", untranslated: false };
  if (map[t]) return { translated: map[t], untranslated: false };
  // Try prefix match for truncated specials
  for (const [k, v] of Object.entries(map)) {
    if (t.startsWith(k.slice(0, 40)) || k.startsWith(t.slice(0, 40))) {
      return { translated: v, untranslated: false };
    }
  }
  return { translated: t, untranslated: /[\u0370-\u03FF]/.test(t) };
}
