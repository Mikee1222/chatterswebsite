/**
 * Rule-based Talking Points + Link A/B winner helpers for GetMySocial Link Funnel.
 * Mirrors Instagram Weekly Progress — judgment OK, not LLM-generated.
 */

import type { PeriodChangeMetric } from "@/services/infloww-analytics";
import type { GetMySocialLinkRole } from "@/services/getmysocial-model-links";

export type GmsLinkWinnerMetric = "button_clicks" | "pageviews" | "ctr_pct";

export type GmsLinkWinner = {
  role: GetMySocialLinkRole;
  metric: GmsLinkWinnerMetric;
  a_value: number;
  b_value: number;
  margin_pct: number | null;
  tie: boolean;
};

export function pickGmsLinkWinner(
  a: { button_clicks: number; pageviews: number; ctr_pct: number | null },
  b: { button_clicks: number; pageviews: number; ctr_pct: number | null },
  preferred: GmsLinkWinnerMetric = "button_clicks"
): GmsLinkWinner {
  const metric = preferred;
  const aVal =
    metric === "ctr_pct"
      ? a.ctr_pct ?? 0
      : metric === "pageviews"
        ? a.pageviews
        : a.button_clicks;
  const bVal =
    metric === "ctr_pct"
      ? b.ctr_pct ?? 0
      : metric === "pageviews"
        ? b.pageviews
        : b.button_clicks;

  if (aVal === 0 && bVal === 0) {
    return { role: "A", metric, a_value: aVal, b_value: bVal, margin_pct: null, tie: true };
  }
  if (aVal === bVal) {
    return { role: "A", metric, a_value: aVal, b_value: bVal, margin_pct: 0, tie: true };
  }
  const winner: GetMySocialLinkRole = aVal > bVal ? "A" : "B";
  const hi = Math.max(aVal, bVal);
  const lo = Math.min(aVal, bVal);
  const margin_pct = lo > 0 ? Math.round(((hi - lo) / lo) * 1000) / 10 : null;
  return { role: winner, metric, a_value: aVal, b_value: bVal, margin_pct, tie: false };
}

/** Click → new-sub period conversion as a display %. Null when no clicks. */
export function clickToSubRatePct(newSubscribers: number, buttonClicks: number): number | null {
  if (buttonClicks <= 0) return null;
  return Math.round((newSubscribers / buttonClicks) * 1000) / 10;
}

export type GmsAbConversionCorrelation = {
  framing: "dominant_day_correlation";
  a_dominant_days: number;
  b_dominant_days: number;
  a_clicks: number;
  b_clicks: number;
  a_correlated_subs: number;
  b_correlated_subs: number;
  a_rate_pct: number | null;
  b_rate_pct: number | null;
  correlated_winner: GetMySocialLinkRole | null;
  note: string;
};

/**
 * Link A vs B "conversion" via dominant-day correlation:
 * on days where A out-clicked B (and vice versa), compare same-day OF new-subs ÷ bio clicks.
 * NOT per-click attribution — GetMySocial has no OF conversion join.
 */
export function computeAbConversionCorrelation(
  days: Array<{ a_clicks: number; b_clicks: number; of_new_subscribers: number }>
): GmsAbConversionCorrelation {
  let a_dominant_days = 0;
  let b_dominant_days = 0;
  let a_clicks = 0;
  let b_clicks = 0;
  let a_correlated_subs = 0;
  let b_correlated_subs = 0;

  for (const d of days) {
    const a = Math.max(0, d.a_clicks);
    const b = Math.max(0, d.b_clicks);
    const subs = Math.max(0, d.of_new_subscribers);
    if (a === b) continue;
    if (a > b) {
      a_dominant_days += 1;
      a_clicks += a + b;
      a_correlated_subs += subs;
    } else {
      b_dominant_days += 1;
      b_clicks += a + b;
      b_correlated_subs += subs;
    }
  }

  const a_rate_pct = clickToSubRatePct(a_correlated_subs, a_clicks);
  const b_rate_pct = clickToSubRatePct(b_correlated_subs, b_clicks);

  let correlated_winner: GetMySocialLinkRole | null = null;
  if (a_rate_pct != null && b_rate_pct != null && a_rate_pct !== b_rate_pct) {
    correlated_winner = a_rate_pct > b_rate_pct ? "A" : "B";
  } else if (a_rate_pct != null && b_rate_pct == null) {
    correlated_winner = "A";
  } else if (b_rate_pct != null && a_rate_pct == null) {
    correlated_winner = "B";
  }

  return {
    framing: "dominant_day_correlation",
    a_dominant_days,
    b_dominant_days,
    a_clicks,
    b_clicks,
    a_correlated_subs,
    b_correlated_subs,
    a_rate_pct,
    b_rate_pct,
    correlated_winner,
    note:
      "CORRELATION: compares OF new-sub rates on Link-A-dominant vs Link-B-dominant days — not proven per-click conversion.",
  };
}

function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

function fmtPct(change: PeriodChangeMetric | null | undefined, label: string): string | null {
  if (!change) return null;
  if (change.display_note === "new_activity") return `new ${label} activity`;
  if (change.display_note === "insufficient_baseline" || change.display_note === "insufficient_history") {
    return null;
  }
  if (change.pct_change == null || change.direction === "na") return null;
  const sign = change.pct_change > 0 ? "+" : "";
  const cap = change.pct_capped ? "+" : "";
  return `${sign}${change.pct_change.toFixed(0)}${cap}% ${label}`;
}

export type GmsTalkingPointsContext = {
  modelName: string;
  pageviews: number;
  button_clicks: number;
  unique_visitors: number;
  ctr_pct: number | null;
  shield_blocked_pct: number;
  bot_visitor_pct: number | null;
  mobile_device_pct: number | null;
  winnerToday: GmsLinkWinner | null;
  winnerWeek: GmsLinkWinner | null;
  clicksDod: PeriodChangeMetric | null;
  clicksWow: PeriodChangeMetric | null;
  igReach: number;
  ofNewSubs: number;
  ofRevenue: number;
  peakHourAthens: number | null;
  /** Period click→sub conversion % (new_subs ÷ bio clicks). */
  clickToSubRatePct?: number | null;
  clickToSubWow?: PeriodChangeMetric | null;
  agencyAvgClickToSubRatePct?: number | null;
  abConversion?: GmsAbConversionCorrelation | null;
};

/** Built from rule-based signals — not LLM-generated. */
export function generateGmsTalkingPoints(ctx: GmsTalkingPointsContext): string {
  const parts: string[] = [];
  const name = ctx.modelName.trim() || "This model";

  if (ctx.button_clicks > 0) {
    const dod = fmtPct(ctx.clicksDod, "DoD");
    const wow = fmtPct(ctx.clicksWow, "WoW");
    const trendBits = [dod, wow].filter(Boolean).join(", ");
    parts.push(
      `${name} drove ${fmtCompact(ctx.button_clicks)} bio clicks` +
        (ctx.pageviews > 0 ? ` on ${fmtCompact(ctx.pageviews)} pageviews` : "") +
        (ctx.ctr_pct != null ? ` (${ctx.ctr_pct}% CTR)` : "") +
        (trendBits ? ` — ${trendBits}` : "") +
        "."
    );
  } else if (ctx.pageviews > 0) {
    parts.push(
      `${name} saw ${fmtCompact(ctx.pageviews)} bio pageviews but almost no button clicks — check CTA placement and OF destination.`
    );
  } else {
    parts.push(
      `${name} has little/no GetMySocial traffic in this window — confirm Link A/B mapping and sync cadence.`
    );
  }

  if (ctx.clickToSubRatePct != null && ctx.button_clicks > 0) {
    const convWow = fmtPct(ctx.clickToSubWow ?? null, "WoW on conversion");
    const team =
      ctx.agencyAvgClickToSubRatePct != null
        ? ` vs the team average of ${ctx.agencyAvgClickToSubRatePct}%`
        : "";
    const lift =
      ctx.agencyAvgClickToSubRatePct != null &&
      ctx.clickToSubRatePct > ctx.agencyAvgClickToSubRatePct * 1.15
        ? ` — her/their CTA copy may be worth testing on other models`
        : ctx.agencyAvgClickToSubRatePct != null &&
            ctx.clickToSubRatePct < ctx.agencyAvgClickToSubRatePct * 0.75
          ? ` — below team pace; review bio CTA vs peers`
          : "";
    parts.push(
      `${name}'s bio link converts at ${ctx.clickToSubRatePct}%` +
        team +
        lift +
        (convWow ? ` (${convWow})` : "") +
        " (period correlation: OF new subs ÷ bio clicks)."
    );
  } else if (ctx.ofNewSubs > 0 || ctx.ofRevenue > 0) {
    parts.push(
      `Downstream OF: ${fmtCompact(ctx.ofNewSubs)} new subs` +
        (ctx.ofRevenue > 0 ? `, $${Math.round(ctx.ofRevenue).toLocaleString()} revenue` : "") +
        " in the aligned window (correlation, not hard attribution)."
    );
  }

  if (ctx.abConversion?.correlated_winner && ctx.abConversion.a_rate_pct != null && ctx.abConversion.b_rate_pct != null) {
    const w = ctx.abConversion.correlated_winner;
    const wr = w === "A" ? ctx.abConversion.a_rate_pct : ctx.abConversion.b_rate_pct;
    const lr = w === "A" ? ctx.abConversion.b_rate_pct : ctx.abConversion.a_rate_pct;
    parts.push(
      `CORRELATION: Link ${w} days associate with a higher click→sub rate (${wr}% vs ${lr}%) — not proven per-click attribution.`
    );
  }

  if (ctx.winnerToday && !ctx.winnerToday.tie) {
    const margin =
      ctx.winnerToday.margin_pct != null ? ` by ${ctx.winnerToday.margin_pct}%` : "";
    parts.push(`Link ${ctx.winnerToday.role} is winning today${margin} on bio clicks.`);
  } else if (ctx.winnerWeek && !ctx.winnerWeek.tie) {
    const margin =
      ctx.winnerWeek.margin_pct != null ? ` by ${ctx.winnerWeek.margin_pct}%` : "";
    parts.push(`This week Link ${ctx.winnerWeek.role} leads${margin} — lean story rotation toward it.`);
  }

  if (ctx.igReach > 5000 && ctx.button_clicks > 0) {
    const rate = (ctx.button_clicks / ctx.igReach) * 100;
    if (rate < 0.15) {
      parts.push(
        `High IG reach (${fmtCompact(ctx.igReach)}) vs soft bio click-through (~${rate.toFixed(2)}%) — story/bio CTA may be under-converting.`
      );
    } else if (rate > 1) {
      parts.push(
        `Strong reach→bio conversion (~${rate.toFixed(2)}%) — keep the current CTA style.`
      );
    }
  } else if (ctx.igReach > 5000 && ctx.button_clicks === 0) {
    parts.push(
      `${fmtCompact(ctx.igReach)} IG reach with zero bio clicks — verify the bio/link-in-bio destination is live.`
    );
  }

  if (ctx.shield_blocked_pct >= 20 || (ctx.bot_visitor_pct != null && ctx.bot_visitor_pct >= 15)) {
    const botBit =
      ctx.bot_visitor_pct != null ? ` · ~${Math.round(ctx.bot_visitor_pct)}% bot visits` : "";
    parts.push(
      `Shield blocked ${Math.round(ctx.shield_blocked_pct)}% of traffic${botBit} — treat UV/CTR as lower-bound human demand.`
    );
  }

  if (ctx.mobile_device_pct != null && ctx.mobile_device_pct >= 70) {
    parts.push(`Traffic is mobile-heavy (~${Math.round(ctx.mobile_device_pct)}%) — keep pages thumb-friendly.`);
  }

  if (ctx.peakHourAthens != null) {
    const h = ctx.peakHourAthens;
    const label = `${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00 Athens`;
    parts.push(`Peak visitor hour cluster around ${label}.`);
  }

  return parts.slice(0, 6).join(" ");
}
