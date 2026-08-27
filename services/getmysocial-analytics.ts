/**
 * Query cached GetMySocial analytics + IG→bio→OF funnel for UI.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  listAllGetMySocialModelLinks,
  listGetMySocialModelLinks,
  type GetMySocialModelLink,
  type GetMySocialLinkRole,
} from "@/services/getmysocial-model-links";
import { queryClarioSuiteDailyInsights } from "@/services/clariosuite-sync";
import { listClarioSuiteModelAccounts, resolvePrimaryIgUserId } from "@/services/clariosuite-model-accounts";
import {
  listCreatorDailyStats,
  listCreatorRevenueByAthensDay,
} from "@/services/infloww-creator-earnings";
import { getModelById } from "@/services/modelss";
import {
  addDaysAthensYmd,
  getMondayOfWeekFromYmdAthens,
  getTodayYmdAthens,
} from "@/lib/airtable-datetime";
import {
  computePctChange,
  previousPeriodRange,
  type PeriodChangeMetric,
} from "@/services/infloww-analytics";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";
import {
  clickToSubRatePct,
  computeAbConversionCorrelation,
  generateGmsTalkingPoints,
  pickGmsLinkWinner,
  type GmsAbConversionCorrelation,
  type GmsLinkWinner,
} from "@/lib/getmysocial-insights";
import type { GetMySocialTimeframe } from "@/types/getmysocial";

export type LinkRoleStats = {
  role: GetMySocialLinkRole;
  link: GetMySocialModelLink | null;
  pageviews: number;
  button_clicks: number;
  unique_visitors: number;
  ctr_pct: number | null;
  shield_blocked_pct: number;
};

export type GetMySocialFunnelDay = {
  date: string;
  ig_reach: number;
  bio_pageviews: number;
  bio_button_clicks: number;
  of_new_subscribers: number;
  of_revenue: number;
};

export type GetMySocialVisitorInsights = {
  sample_size: number;
  bot_count: number;
  bot_pct: number | null;
  proxy_count: number;
  hours: Array<{ hour: number; count: number }>;
  peak_hour_athens: number | null;
};

export type GetMySocialButtonStat = {
  link_role: GetMySocialLinkRole | null;
  shortcode: string | null;
  label: string;
  clicks: number;
  url: string | null;
};

export type GetMySocialConversionStats = {
  /** new_subscribers ÷ button_clicks × 100 for the selected period. */
  rate_pct: number | null;
  new_subscribers: number;
  button_clicks: number;
  framing: "period_correlation";
  wow: PeriodChangeMetric;
  mom: PeriodChangeMetric;
  link_ab: GmsAbConversionCorrelation;
  agency_avg_rate_pct: number | null;
  agency_rank: number | null;
  agency_model_count: number;
};

export type GetMySocialAnalyticsSummary = {
  modelId: string;
  modelName: string;
  range: { startYmd: string; endYmd: string };
  links: GetMySocialModelLink[];
  lastSyncedAt: string | null;
  linkA: LinkRoleStats;
  linkB: LinkRoleStats;
  totals: {
    pageviews: number;
    button_clicks: number;
    unique_visitors: number;
    ctr_pct: number | null;
    shield_blocked_pct: number;
    shield_blocked_count: number;
  };
  daily: Array<{
    date: string;
    pageviews: number;
    button_clicks: number;
    getmysocial_link_id: string;
    link_role: string | null;
    link_label: string | null;
  }>;
  /** Daily CTR % series for trend chart. */
  ctrTrend: Array<{
    date: string;
    pageviews: number;
    button_clicks: number;
    ctr_pct: number | null;
  }>;
  funnel: GetMySocialFunnelDay[];
  funnelTotals: {
    ig_reach: number;
    bio_pageviews: number;
    bio_button_clicks: number;
    of_new_subscribers: number;
    of_revenue: number;
  };
  conversion: GetMySocialConversionStats;
  buttons: GetMySocialButtonStat[];
  storyLinks: { link_a_url: string | null; link_b_url: string | null };
  referrers: Array<{ referrer: string; count: number; link_role: string | null }>;
  countries: Array<{ label: string; label_code: string | null; count: number }>;
  devices: Array<{ label: string; count: number }>;
  browsers: Array<{ label: string; count: number }>;
  /** Device share that looks mobile / phone. */
  mobile_device_pct: number | null;
  visitorInsights: GetMySocialVisitorInsights;
  trends: {
    clicks_dod: PeriodChangeMetric;
    clicks_wow: PeriodChangeMetric;
    clicks_mom: PeriodChangeMetric;
    pageviews_dod: PeriodChangeMetric;
    pageviews_wow: PeriodChangeMetric;
    pageviews_mom: PeriodChangeMetric;
    ctr_wow: PeriodChangeMetric;
    ctr_mom: PeriodChangeMetric;
  };
  winners: {
    today: GmsLinkWinner | null;
    this_week: GmsLinkWinner | null;
    period: GmsLinkWinner | null;
  };
  talking_points: string;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function emptyRole(role: GetMySocialLinkRole): LinkRoleStats {
  return {
    role,
    link: null,
    pageviews: 0,
    button_clicks: 0,
    unique_visitors: 0,
    ctr_pct: null,
    shield_blocked_pct: 0,
  };
}

function athensHourFromIso(iso: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Athens",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date(iso));
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    if (!Number.isFinite(h)) return null;
    // en-GB hourCycle sometimes yields 24 for midnight
    return h === 24 ? 0 : h;
  } catch {
    return null;
  }
}

function isMobileDeviceLabel(label: string): boolean {
  const s = label.toLowerCase();
  return (
    s.includes("mobile") ||
    s.includes("phone") ||
    s.includes("iphone") ||
    s.includes("android") ||
    s.includes("ipad") ||
    s.includes("tablet")
  );
}

function mobileShare(devices: Array<{ label: string; count: number }>): number | null {
  const total = devices.reduce((s, d) => s + d.count, 0);
  if (total <= 0) return null;
  const mobile = devices
    .filter((d) => isMobileDeviceLabel(d.label))
    .reduce((s, d) => s + d.count, 0);
  return Math.round((mobile / total) * 1000) / 10;
}

/** Best-effort GetMySocial timeframe for referrer/breakdown caches. */
export function resolveGmsTimeframeForRange(
  startYmd: string,
  endYmd: string
): GetMySocialTimeframe {
  const today = getTodayYmdAthens();
  const yesterday = addDaysAthensYmd(today, -1);
  if (startYmd === endYmd) {
    if (startYmd === today) return "today";
    if (startYmd === yesterday) return "yesterday";
  }
  const weekStart = getMondayOfWeekFromYmdAthens(today);
  if (startYmd === weekStart && endYmd === today) return "thisWeek";
  const priorWeekStart = addDaysAthensYmd(weekStart, -7);
  const priorWeekEnd = addDaysAthensYmd(weekStart, -1);
  if (startYmd === priorWeekStart && endYmd === priorWeekEnd) return "lastWeek";
  const monthStart = `${today.slice(0, 7)}-01`;
  if (startYmd === monthStart && endYmd === today) return "thisMonth";
  return "thisMonth";
}

function sumOfNewSubsFromRows(
  rows: Array<{ date: string; new_subscribers: number }>,
  startYmd: string,
  endYmd: string
): number {
  return rows
    .filter((r) => r.date >= startYmd && r.date <= endYmd)
    .reduce((s, r) => s + n(r.new_subscribers), 0);
}

/**
 * Button CTR breakdown used to hit live GetMySocial (~500ms rate-limit gap per link)
 * on every page load. Prefer empty here — Traffic tab still has referrers/devices from cache.
 * Sync cron remains the source of truth for click totals.
 */
async function loadButtonBreakdown(
  _links: GetMySocialModelLink[],
  _startYmd: string,
  _endYmd: string,
  _timeframe: GetMySocialTimeframe
): Promise<GetMySocialButtonStat[]> {
  return [];
}

async function loadAgencyConversionRanking(
  startYmd: string,
  endYmd: string
): Promise<{
  avg_rate_pct: number | null;
  ranked: Array<{ modelId: string; rate: number }>;
}> {
  const allLinks = await listAllGetMySocialModelLinks();
  if (!allLinks.length) return { avg_rate_pct: null, ranked: [] };
  const modelIds = [...new Set(allLinks.map((l) => l.model_id))];
  const linkIds = allLinks.map((l) => l.getmysocial_link_id);
  const sb = getSupabaseServiceClient();

  const [analyticsRes, ofRows] = await Promise.all([
    sb
      .from("getmysocial_daily_analytics")
      .select("date,button_clicks,getmysocial_link_id")
      .in("getmysocial_link_id", linkIds)
      .gte("date", startYmd)
      .lte("date", endYmd),
    listCreatorDailyStats({ startYmd, endYmd }),
  ]);
  if (analyticsRes.error) throw new Error(analyticsRes.error.message);

  const linkToModel = new Map(allLinks.map((l) => [l.getmysocial_link_id, l.model_id]));
  const clicksByModel = new Map<string, number>();
  for (const mid of modelIds) clicksByModel.set(mid, 0);
  for (const row of analyticsRes.data ?? []) {
    const mid = linkToModel.get(String(row.getmysocial_link_id));
    if (!mid) continue;
    clicksByModel.set(mid, (clicksByModel.get(mid) ?? 0) + n(row.button_clicks));
  }

  const subsByModel = new Map<string, number>();
  for (const row of ofRows) {
    const mid = row.model_record_id;
    if (!mid || !clicksByModel.has(mid)) continue;
    subsByModel.set(mid, (subsByModel.get(mid) ?? 0) + n(row.new_subscribers));
  }

  const ranked = modelIds
    .map((modelId) => {
      const clicks = clicksByModel.get(modelId) ?? 0;
      const subs = subsByModel.get(modelId) ?? 0;
      const rate = clickToSubRatePct(subs, clicks);
      return rate == null ? null : { modelId, rate };
    })
    .filter((x): x is { modelId: string; rate: number } => Boolean(x))
    .sort((a, b) => b.rate - a.rate);

  const avg_rate_pct = ranked.length
    ? Math.round((ranked.reduce((s, m) => s + m.rate, 0) / ranked.length) * 10) / 10
    : null;
  return { avg_rate_pct, ranked };
}

function sumClicksOnDate(
  rows: Array<{ date: string; button_clicks: number; pageviews: number; link_role: string | null }>,
  ymd: string,
  role?: GetMySocialLinkRole
): { button_clicks: number; pageviews: number } {
  let button_clicks = 0;
  let pageviews = 0;
  for (const r of rows) {
    if (r.date !== ymd) continue;
    if (role && r.link_role !== role) continue;
    button_clicks += r.button_clicks;
    pageviews += r.pageviews;
  }
  return { button_clicks, pageviews };
}

function sumClicksInRange(
  rows: Array<{ date: string; button_clicks: number; pageviews: number; link_role: string | null }>,
  startYmd: string,
  endYmd: string,
  role?: GetMySocialLinkRole
): { button_clicks: number; pageviews: number; ctr_pct: number | null } {
  let button_clicks = 0;
  let pageviews = 0;
  for (const r of rows) {
    if (r.date < startYmd || r.date > endYmd) continue;
    if (role && r.link_role !== role) continue;
    button_clicks += r.button_clicks;
    pageviews += r.pageviews;
  }
  return {
    button_clicks,
    pageviews,
    ctr_pct: pageviews > 0 ? Math.round((button_clicks / pageviews) * 1000) / 10 : null,
  };
}

async function loadVisitorInsights(
  linkIds: string[],
  startYmd?: string,
  endYmd?: string
): Promise<GetMySocialVisitorInsights> {
  const empty: GetMySocialVisitorInsights = {
    sample_size: 0,
    bot_count: 0,
    bot_pct: null,
    proxy_count: 0,
    hours: [],
    peak_hour_athens: null,
  };
  if (!linkIds.length) return empty;

  const sb = getSupabaseServiceClient();
  let q = sb
    .from("getmysocial_visitor_events")
    .select("event_timestamp,is_bot,is_proxy")
    .in("getmysocial_link_id", linkIds)
    .order("event_timestamp", { ascending: false })
    .limit(2000);
  if (startYmd) {
    const startMs = Date.parse(`${startYmd}T00:00:00+03:00`);
    if (Number.isFinite(startMs)) q = q.gte("event_timestamp", new Date(startMs).toISOString());
  }
  if (endYmd) {
    const endMs = Date.parse(`${endYmd}T23:59:59.999+03:00`);
    if (Number.isFinite(endMs)) q = q.lte("event_timestamp", new Date(endMs).toISOString());
  }

  const { data, error } = await q;
  if (error || !data?.length) return empty;

  const hourCounts = new Map<number, number>();
  let bot_count = 0;
  let proxy_count = 0;
  for (const row of data) {
    if (row.is_bot === true) bot_count += 1;
    if (row.is_proxy === true) proxy_count += 1;
    const ts = typeof row.event_timestamp === "string" ? row.event_timestamp : null;
    if (!ts) continue;
    const hour = athensHourFromIso(ts);
    if (hour == null) continue;
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  const hours = [...hourCounts.entries()]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);
  let peak_hour_athens: number | null = null;
  let peakCount = 0;
  for (const h of hours) {
    if (h.count > peakCount) {
      peakCount = h.count;
      peak_hour_athens = h.hour;
    }
  }

  const sample_size = data.length;
  return {
    sample_size,
    bot_count,
    bot_pct: sample_size > 0 ? Math.round((bot_count / sample_size) * 1000) / 10 : null,
    proxy_count,
    hours,
    peak_hour_athens,
  };
}

export async function getGetMySocialAnalyticsForModel(
  modelId: string,
  opts?: { startYmd?: string; endYmd?: string; timeframe?: string }
): Promise<GetMySocialAnalyticsSummary | null> {
  const mid = modelId.trim();
  const links = await listGetMySocialModelLinks(mid);
  if (!links.length) return null;

  const model = await getModelById(mid).catch(() => null);
  const linkIds = links.map((l) => l.getmysocial_link_id);
  const sb = getSupabaseServiceClient();

  const defaultRange = resolveInflowwStatsRange("this_month", null, null);
  const startYmd = (opts?.startYmd?.trim() || defaultRange.startYmd).slice(0, 10);
  const endYmd = (opts?.endYmd?.trim() || defaultRange.endYmd).slice(0, 10);
  const rangeStart = startYmd <= endYmd ? startYmd : endYmd;
  const rangeEnd = startYmd <= endYmd ? endYmd : startYmd;
  const timeframe = (opts?.timeframe?.trim() ||
    resolveGmsTimeframeForRange(rangeStart, rangeEnd)) as GetMySocialTimeframe;

  const prior = previousPeriodRange(rangeStart, rangeEnd);
  const todayYmd = getTodayYmdAthens();
  const yesterdayYmd = addDaysAthensYmd(todayYmd, -1);
  const weekStart = getMondayOfWeekFromYmdAthens(todayYmd);
  const priorWeekStart = addDaysAthensYmd(weekStart, -7);
  const priorWeekEnd = addDaysAthensYmd(weekStart, -1);
  const lookbackStart = [rangeStart, prior.startYmd, priorWeekStart].sort()[0]!;

  let analyticsQ = sb
    .from("getmysocial_daily_analytics")
    .select(
      "date,pageviews,button_clicks,unique_visitors,ctr_pct,shield_blocked_pct,shield_blocked_count,getmysocial_link_id,link_role,link_label,synced_at,overview_json"
    )
    .in("getmysocial_link_id", linkIds)
    .gte("date", lookbackStart)
    .lte("date", rangeEnd > todayYmd ? rangeEnd : todayYmd)
    .order("date", { ascending: true });

  const [analyticsRes, referrersRes, countriesRes, devicesRes, browsersRes, storyRes, visitorInsights, buttons] =
    await Promise.all([
      analyticsQ,
      sb
        .from("getmysocial_referrers")
        .select("referrer,count,link_role")
        .in("getmysocial_link_id", linkIds)
        .eq("timeframe", timeframe)
        .order("count", { ascending: false })
        .limit(40),
      sb
        .from("getmysocial_breakdowns")
        .select("label,label_code,count")
        .in("getmysocial_link_id", linkIds)
        .eq("dimension", "countries")
        .eq("timeframe", timeframe)
        .order("count", { ascending: false })
        .limit(15),
      sb
        .from("getmysocial_breakdowns")
        .select("label,count")
        .in("getmysocial_link_id", linkIds)
        .eq("dimension", "devices")
        .eq("timeframe", timeframe)
        .order("count", { ascending: false })
        .limit(10),
      sb
        .from("getmysocial_breakdowns")
        .select("label,count")
        .in("getmysocial_link_id", linkIds)
        .eq("dimension", "browsers")
        .eq("timeframe", timeframe)
        .order("count", { ascending: false })
        .limit(10),
      sb
        .from("model_story_link_config")
        .select("link_a_url,link_b_url")
        .eq("model_id", mid)
        .maybeSingle(),
      loadVisitorInsights(linkIds, rangeStart, rangeEnd),
      loadButtonBreakdown(links, rangeStart, rangeEnd, timeframe),
    ]);

  if (analyticsRes.error) throw new Error(analyticsRes.error.message);

  const allDaily = (analyticsRes.data ?? []).map((r) => ({
    date: String(r.date).slice(0, 10),
    pageviews: n(r.pageviews),
    button_clicks: n(r.button_clicks),
    getmysocial_link_id: String(r.getmysocial_link_id),
    link_role: (r.link_role as string | null) ?? null,
    link_label: (r.link_label as string | null) ?? null,
  }));
  const daily = allDaily.filter((d) => d.date >= rangeStart && d.date <= rangeEnd);

  const roleStats = (role: GetMySocialLinkRole): LinkRoleStats => {
    const link = links.find((l) => l.link_role === role) ?? null;
    if (!link) return emptyRole(role);
    const rows = daily.filter((r) => r.getmysocial_link_id === link.getmysocial_link_id);
    const pageviews = rows.reduce((s, r) => s + r.pageviews, 0);
    const button_clicks = rows.reduce((s, r) => s + r.button_clicks, 0);
    const uvRows = (analyticsRes.data ?? []).filter(
      (r) =>
        String(r.getmysocial_link_id) === link.getmysocial_link_id &&
        String(r.date).slice(0, 10) >= rangeStart &&
        String(r.date).slice(0, 10) <= rangeEnd
    );
    const uv = Math.max(0, ...uvRows.map((r) => n(r.unique_visitors)), 0);
    const shield = Math.max(0, ...uvRows.map((r) => n(r.shield_blocked_pct)), 0);
    return {
      role,
      link,
      pageviews,
      button_clicks,
      unique_visitors: uv,
      ctr_pct: pageviews > 0 ? Math.round((button_clicks / pageviews) * 1000) / 10 : null,
      shield_blocked_pct: shield,
    };
  };

  const linkA = roleStats("A");
  const linkB = roleStats("B");
  const pageviews = linkA.pageviews + linkB.pageviews;
  const button_clicks = linkA.button_clicks + linkB.button_clicks;
  const unique_visitors = linkA.unique_visitors + linkB.unique_visitors;
  const lastSyncedAt =
    (analyticsRes.data ?? [])
      .map((r) => (typeof r.synced_at === "string" ? r.synced_at : null))
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;

  // Fill every day in the selected range so single-day picks still render.
  const dates: string[] = [];
  for (let d = rangeStart; d <= rangeEnd; d = addDaysAthensYmd(d, 1)) {
    dates.push(d);
    if (dates.length > 400) break;
  }

  const bioByDate = new Map<string, { pageviews: number; button_clicks: number; a: number; b: number }>();
  for (const d of daily) {
    const cur = bioByDate.get(d.date) ?? { pageviews: 0, button_clicks: 0, a: 0, b: 0 };
    cur.pageviews += d.pageviews;
    cur.button_clicks += d.button_clicks;
    if (d.link_role === "B") cur.b += d.button_clicks;
    else cur.a += d.button_clicks;
    bioByDate.set(d.date, cur);
  }

  const funnelMap = new Map<string, GetMySocialFunnelDay>();
  for (const date of dates) {
    const bio = bioByDate.get(date) ?? { pageviews: 0, button_clicks: 0, a: 0, b: 0 };
    funnelMap.set(date, {
      date,
      ig_reach: 0,
      bio_pageviews: bio.pageviews,
      bio_button_clicks: bio.button_clicks,
      of_new_subscribers: 0,
      of_revenue: 0,
    });
  }

  let ofRowsForConversion: Array<{ date: string; new_subscribers: number }> = [];
  let agencyRankingResult: {
    avg_rate_pct: number | null;
    ranked: Array<{ modelId: string; rate: number }>;
  } = { avg_rate_pct: null, ranked: [] };

  if (model && rangeStart && rangeEnd) {
    const creatorId = model.infloww_creator_id?.trim();
    const [igResult, ofResult, revenueResult, agencyRanking] = await Promise.all([
      (async () => {
        try {
          const accounts = await listClarioSuiteModelAccounts(model.id);
          const ig = resolvePrimaryIgUserId(model, accounts);
          if (!ig) return [] as Awaited<ReturnType<typeof queryClarioSuiteDailyInsights>>;
          return queryClarioSuiteDailyInsights({
            igUserId: ig,
            startYmd: rangeStart,
            endYmd: rangeEnd,
          });
        } catch (err) {
          console.error("[getmysocial] funnel ig", err);
          return [] as Awaited<ReturnType<typeof queryClarioSuiteDailyInsights>>;
        }
      })(),
      (async () => {
        try {
          return creatorId
            ? await listCreatorDailyStats({
                creatorInflowwId: creatorId,
                startYmd: lookbackStart,
                endYmd: rangeEnd,
              })
            : await listCreatorDailyStats({
                modelRecordId: mid,
                startYmd: lookbackStart,
                endYmd: rangeEnd,
              });
        } catch (err) {
          console.error("[getmysocial] funnel of", err);
          return [] as Awaited<ReturnType<typeof listCreatorDailyStats>>;
        }
      })(),
      // Prefer Athens-day RPC over fetchAll transactions (Weekly Progress pattern)
      (async () => {
        try {
          return await listCreatorRevenueByAthensDay({
            modelRecordId: mid,
            startYmd: rangeStart,
            endYmd: rangeEnd,
          });
        } catch (err) {
          console.error("[getmysocial] funnel revenue", err);
          return [] as Awaited<ReturnType<typeof listCreatorRevenueByAthensDay>>;
        }
      })(),
      loadAgencyConversionRanking(rangeStart, rangeEnd).catch((err) => {
        console.error("[getmysocial] agency conversion", err);
        return {
          avg_rate_pct: null as number | null,
          ranked: [] as Array<{ modelId: string; rate: number }>,
        };
      }),
    ]);

    for (const row of igResult) {
      const date = String(row.date).slice(0, 10);
      const f = funnelMap.get(date);
      if (!f) continue;
      f.ig_reach += n(row.reach);
    }

    ofRowsForConversion = ofResult.map((r) => ({
      date: String(r.date).slice(0, 10),
      new_subscribers: n(r.new_subscribers),
    }));
    for (const row of ofRowsForConversion) {
      if (row.date < rangeStart || row.date > rangeEnd) continue;
      const f = funnelMap.get(row.date);
      if (!f) continue;
      f.of_new_subscribers += row.new_subscribers;
    }

    for (const row of revenueResult) {
      const f = funnelMap.get(row.date);
      if (!f) continue;
      f.of_revenue += row.revenue;
    }

    agencyRankingResult = agencyRanking;
  }

  const funnel = [...funnelMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const funnelTotals = funnel.reduce(
    (acc, d) => {
      acc.ig_reach += d.ig_reach;
      acc.bio_pageviews += d.bio_pageviews;
      acc.bio_button_clicks += d.bio_button_clicks;
      acc.of_new_subscribers += d.of_new_subscribers;
      acc.of_revenue += d.of_revenue;
      return acc;
    },
    {
      ig_reach: 0,
      bio_pageviews: 0,
      bio_button_clicks: 0,
      of_new_subscribers: 0,
      of_revenue: 0,
    }
  );

  const ctrTrend = funnel.map((d) => ({
    date: d.date,
    pageviews: d.bio_pageviews,
    button_clicks: d.bio_button_clicks,
    ctr_pct:
      d.bio_pageviews > 0
        ? Math.round((d.bio_button_clicks / d.bio_pageviews) * 1000) / 10
        : null,
  }));

  const shieldRows = (analyticsRes.data ?? []).filter((r) => {
    const date = String(r.date).slice(0, 10);
    return date >= rangeStart && date <= rangeEnd;
  });
  const shield_blocked_count = Math.max(0, ...shieldRows.map((r) => n(r.shield_blocked_count)), 0);
  const shield_blocked_pct = Math.max(0, ...shieldRows.map((r) => n(r.shield_blocked_pct)), 0);

  const devices = (devicesRes.data ?? []).map((r) => ({
    label: String(r.label),
    count: n(r.count),
  }));
  const mobile_device_pct = mobileShare(devices);

  const todayClicks = sumClicksOnDate(allDaily, todayYmd);
  const yesterdayClicks = sumClicksOnDate(allDaily, yesterdayYmd);
  const weekClicks = sumClicksInRange(allDaily, weekStart, todayYmd);
  const priorWeekClicks = sumClicksInRange(allDaily, priorWeekStart, priorWeekEnd);
  const periodClicks = sumClicksInRange(allDaily, rangeStart, rangeEnd);
  const priorPeriodClicks = sumClicksInRange(allDaily, prior.startYmd, prior.endYmd);

  const periodCtr = periodClicks.ctr_pct ?? 0;
  const priorCtr = priorPeriodClicks.ctr_pct ?? 0;
  const weekCtr = weekClicks.ctr_pct ?? 0;
  const priorWeekCtr = priorWeekClicks.ctr_pct ?? 0;

  const trends = {
    clicks_dod: computePctChange(todayClicks.button_clicks, yesterdayClicks.button_clicks),
    clicks_wow: computePctChange(weekClicks.button_clicks, priorWeekClicks.button_clicks),
    clicks_mom: computePctChange(periodClicks.button_clicks, priorPeriodClicks.button_clicks),
    pageviews_dod: computePctChange(todayClicks.pageviews, yesterdayClicks.pageviews),
    pageviews_wow: computePctChange(weekClicks.pageviews, priorWeekClicks.pageviews),
    pageviews_mom: computePctChange(periodClicks.pageviews, priorPeriodClicks.pageviews),
    ctr_wow: computePctChange(weekCtr, priorWeekCtr),
    ctr_mom: computePctChange(periodCtr, priorCtr),
  };

  const todayA = sumClicksOnDate(allDaily, todayYmd, "A");
  const todayB = sumClicksOnDate(allDaily, todayYmd, "B");
  const weekA = sumClicksInRange(allDaily, weekStart, todayYmd, "A");
  const weekB = sumClicksInRange(allDaily, weekStart, todayYmd, "B");

  const winners = {
    today: pickGmsLinkWinner(
      {
        ...todayA,
        ctr_pct:
          todayA.pageviews > 0
            ? Math.round((todayA.button_clicks / todayA.pageviews) * 1000) / 10
            : null,
      },
      {
        ...todayB,
        ctr_pct:
          todayB.pageviews > 0
            ? Math.round((todayB.button_clicks / todayB.pageviews) * 1000) / 10
            : null,
      }
    ),
    this_week: pickGmsLinkWinner(weekA, weekB),
    period: pickGmsLinkWinner(linkA, linkB),
  };

  // Conversion: period + WoW (Athens week) + MoM (equal-length prior window)
  // Reuse already-fetched OF daily stats — no extra N+1 listCreatorDailyStats calls.
  const periodRate = clickToSubRatePct(funnelTotals.of_new_subscribers, button_clicks);

  const weekSubs = sumOfNewSubsFromRows(ofRowsForConversion, weekStart, todayYmd);
  const priorWeekSubs = sumOfNewSubsFromRows(ofRowsForConversion, priorWeekStart, priorWeekEnd);
  const priorPeriodSubs = sumOfNewSubsFromRows(
    ofRowsForConversion,
    prior.startYmd,
    prior.endYmd
  );
  const weekRate = clickToSubRatePct(weekSubs, weekClicks.button_clicks) ?? 0;
  const priorWeekRate = clickToSubRatePct(priorWeekSubs, priorWeekClicks.button_clicks) ?? 0;
  const priorPeriodRate =
    clickToSubRatePct(priorPeriodSubs, priorPeriodClicks.button_clicks) ?? 0;

  const abDays = dates.map((date) => {
    const bio = bioByDate.get(date) ?? { pageviews: 0, button_clicks: 0, a: 0, b: 0 };
    return {
      a_clicks: bio.a,
      b_clicks: bio.b,
      of_new_subscribers: funnelMap.get(date)?.of_new_subscribers ?? 0,
    };
  });
  const link_ab = computeAbConversionCorrelation(abDays);

  const agency_avg_rate_pct = agencyRankingResult.avg_rate_pct;
  const agency_model_count = agencyRankingResult.ranked.length;
  const agencyRankIdx = agencyRankingResult.ranked.findIndex((m) => m.modelId === mid);
  const agency_rank = agencyRankIdx >= 0 ? agencyRankIdx + 1 : null;

  const conversion: GetMySocialConversionStats = {
    rate_pct: periodRate,
    new_subscribers: funnelTotals.of_new_subscribers,
    button_clicks,
    framing: "period_correlation",
    wow: computePctChange(weekRate, priorWeekRate),
    mom: computePctChange(periodRate ?? 0, priorPeriodRate),
    link_ab,
    agency_avg_rate_pct,
    agency_rank,
    agency_model_count,
  };

  const talking_points = generateGmsTalkingPoints({
    modelName: model?.model_name ?? links[0]?.link_label ?? mid,
    pageviews,
    button_clicks,
    unique_visitors,
    ctr_pct: pageviews > 0 ? Math.round((button_clicks / pageviews) * 1000) / 10 : null,
    shield_blocked_pct,
    bot_visitor_pct: visitorInsights.bot_pct,
    mobile_device_pct,
    winnerToday: winners.today,
    winnerWeek: winners.this_week,
    clicksDod: trends.clicks_dod,
    clicksWow: trends.clicks_wow,
    igReach: funnelTotals.ig_reach,
    ofNewSubs: funnelTotals.of_new_subscribers,
    ofRevenue: funnelTotals.of_revenue,
    peakHourAthens: visitorInsights.peak_hour_athens,
    clickToSubRatePct: periodRate,
    clickToSubWow: conversion.wow,
    agencyAvgClickToSubRatePct: agency_avg_rate_pct,
    abConversion: link_ab,
  });

  return {
    modelId: mid,
    modelName: model?.model_name ?? links[0]?.link_label ?? mid,
    range: { startYmd: rangeStart, endYmd: rangeEnd },
    links,
    lastSyncedAt,
    linkA,
    linkB,
    totals: {
      pageviews,
      button_clicks,
      unique_visitors,
      ctr_pct: pageviews > 0 ? Math.round((button_clicks / pageviews) * 1000) / 10 : null,
      shield_blocked_pct,
      shield_blocked_count,
    },
    daily,
    ctrTrend,
    funnel,
    funnelTotals,
    conversion,
    buttons,
    storyLinks: {
      link_a_url: (storyRes.data?.link_a_url as string | null) ?? null,
      link_b_url: (storyRes.data?.link_b_url as string | null) ?? null,
    },
    referrers: (referrersRes.data ?? []).map((r) => ({
      referrer: String(r.referrer),
      count: n(r.count),
      link_role: (r.link_role as string | null) ?? null,
    })),
    countries: (countriesRes.data ?? []).map((r) => ({
      label: String(r.label),
      label_code: (r.label_code as string | null) ?? null,
      count: n(r.count),
    })),
    devices,
    browsers: (browsersRes.data ?? []).map((r) => ({
      label: String(r.label),
      count: n(r.count),
    })),
    mobile_device_pct,
    visitorInsights,
    trends,
    winners,
    talking_points,
  };
}

export type GetMySocialAgencyModelDay = {
  modelId: string;
  modelName: string;
  today_button_clicks: number;
  today_pageviews: number;
  week_button_clicks: number;
  period_button_clicks: number;
  period_pageviews: number;
  period_unique_visitors: number;
  period_ctr_pct: number | null;
  period_new_subscribers: number;
  period_click_to_sub_rate_pct: number | null;
  winner_today: GmsLinkWinner | null;
  winner_week: GmsLinkWinner | null;
  lastSyncedAt: string | null;
};

export type GetMySocialAgencyOverview = {
  range: { startYmd: string; endYmd: string };
  todayYmd: string;
  lastSyncedAt: string | null;
  totals: {
    pageviews: number;
    button_clicks: number;
    unique_visitors: number;
    ctr_pct: number | null;
    shield_blocked_pct: number;
    new_subscribers: number;
    click_to_sub_rate_pct: number | null;
  };
  today: {
    button_clicks: number;
    pageviews: number;
    by_model: Array<{
      modelId: string;
      modelName: string;
      button_clicks: number;
      pageviews: number;
      winner: GmsLinkWinner | null;
    }>;
  };
  /** Models ranked by click→sub conversion (highest first). */
  conversion_ranking: Array<{
    modelId: string;
    modelName: string;
    button_clicks: number;
    new_subscribers: number;
    rate_pct: number;
  }>;
  models: GetMySocialAgencyModelDay[];
};

/** Agency rollup of cached GMS daily analytics for Instagram Insights Overview. */
export async function getGetMySocialAgencyOverview(opts: {
  startYmd: string;
  endYmd: string;
}): Promise<GetMySocialAgencyOverview> {
  const allLinks = await listAllGetMySocialModelLinks();
  const todayYmd = getTodayYmdAthens();
  const weekStart = getMondayOfWeekFromYmdAthens(todayYmd);
  const empty: GetMySocialAgencyOverview = {
    range: { startYmd: opts.startYmd, endYmd: opts.endYmd },
    todayYmd,
    lastSyncedAt: null,
    totals: {
      pageviews: 0,
      button_clicks: 0,
      unique_visitors: 0,
      ctr_pct: null,
      shield_blocked_pct: 0,
      new_subscribers: 0,
      click_to_sub_rate_pct: null,
    },
    today: { button_clicks: 0, pageviews: 0, by_model: [] },
    conversion_ranking: [],
    models: [],
  };
  if (!allLinks.length) return empty;

  const linkIds = allLinks.map((l) => l.getmysocial_link_id);
  const modelIds = [...new Set(allLinks.map((l) => l.model_id))];
  const sb = getSupabaseServiceClient();

  const lookbackStart =
    opts.startYmd < weekStart ? opts.startYmd : addDaysAthensYmd(weekStart, -7);

  // Parallel: GMS analytics + OF daily stats + batched model names (was N+1 getModelById)
  const [analyticsRes, ofRows, nameRes] = await Promise.all([
    sb
      .from("getmysocial_daily_analytics")
      .select(
        "date,pageviews,button_clicks,unique_visitors,ctr_pct,shield_blocked_pct,getmysocial_link_id,link_role,synced_at,model_name"
      )
      .in("getmysocial_link_id", linkIds)
      .gte("date", lookbackStart)
      .lte("date", opts.endYmd > todayYmd ? opts.endYmd : todayYmd)
      .order("date", { ascending: true }),
    listCreatorDailyStats({
      startYmd: opts.startYmd,
      endYmd: opts.endYmd,
    }).catch((err) => {
      console.error("[getmysocial] agency of stats", err);
      return [] as Awaited<ReturnType<typeof listCreatorDailyStats>>;
    }),
    sb.from("modelss").select("id,airtable_id,model_name").in("airtable_id", modelIds),
  ]);

  if (analyticsRes.error) throw new Error(analyticsRes.error.message);
  const data = analyticsRes.data;

  const nameCache = new Map<string, string>();
  for (const row of nameRes.data ?? []) {
    const r = row as { id: string; airtable_id?: string | null; model_name?: string | null };
    const name = r.model_name?.trim();
    if (!name) continue;
    if (r.airtable_id) nameCache.set(String(r.airtable_id), name);
    if (r.id) nameCache.set(String(r.id), name);
  }
  // Fallback: model_name stamped on daily analytics rows during sync
  for (const row of data ?? []) {
    const link = allLinks.find((l) => l.getmysocial_link_id === String(row.getmysocial_link_id));
    if (!link) continue;
    if (nameCache.has(link.model_id)) continue;
    const stamped = typeof row.model_name === "string" ? row.model_name.trim() : "";
    if (stamped) nameCache.set(link.model_id, stamped);
    else if (link.link_label) {
      nameCache.set(
        link.model_id,
        link.link_label.replace(/\s+Link\s+[AB]$/i, "").trim() || link.model_id
      );
    }
  }
  for (const mid of modelIds) {
    if (!nameCache.has(mid)) nameCache.set(mid, mid);
  }

  const linkToModel = new Map(allLinks.map((l) => [l.getmysocial_link_id, l]));

  type Agg = {
    modelId: string;
    modelName: string;
    period_pageviews: number;
    period_button_clicks: number;
    period_uv: number;
    period_shield: number;
    today_pageviews: number;
    today_button_clicks: number;
    week_button_clicks: number;
    todayA: number;
    todayB: number;
    todayAViews: number;
    todayBViews: number;
    weekA: number;
    weekB: number;
    weekAViews: number;
    weekBViews: number;
    lastSyncedAt: string | null;
  };

  const byModel = new Map<string, Agg>();
  for (const mid of modelIds) {
    byModel.set(mid, {
      modelId: mid,
      modelName: nameCache.get(mid) ?? mid,
      period_pageviews: 0,
      period_button_clicks: 0,
      period_uv: 0,
      period_shield: 0,
      today_pageviews: 0,
      today_button_clicks: 0,
      week_button_clicks: 0,
      todayA: 0,
      todayB: 0,
      todayAViews: 0,
      todayBViews: 0,
      weekA: 0,
      weekB: 0,
      weekAViews: 0,
      weekBViews: 0,
      lastSyncedAt: null,
    });
  }

  for (const row of data ?? []) {
    const linkId = String(row.getmysocial_link_id);
    const link = linkToModel.get(linkId);
    if (!link) continue;
    const agg = byModel.get(link.model_id);
    if (!agg) continue;
    const date = String(row.date).slice(0, 10);
    const pv = n(row.pageviews);
    const clicks = n(row.button_clicks);
    const role = row.link_role === "B" ? "B" : "A";

    if (date >= opts.startYmd && date <= opts.endYmd) {
      agg.period_pageviews += pv;
      agg.period_button_clicks += clicks;
      agg.period_uv = Math.max(agg.period_uv, n(row.unique_visitors));
      agg.period_shield = Math.max(agg.period_shield, n(row.shield_blocked_pct));
    }
    if (date === todayYmd) {
      agg.today_pageviews += pv;
      agg.today_button_clicks += clicks;
      if (role === "A") {
        agg.todayA += clicks;
        agg.todayAViews += pv;
      } else {
        agg.todayB += clicks;
        agg.todayBViews += pv;
      }
    }
    if (date >= weekStart && date <= todayYmd) {
      agg.week_button_clicks += clicks;
      if (role === "A") {
        agg.weekA += clicks;
        agg.weekAViews += pv;
      } else {
        agg.weekB += clicks;
        agg.weekBViews += pv;
      }
    }
    const synced = typeof row.synced_at === "string" ? row.synced_at : null;
    if (synced && (!agg.lastSyncedAt || synced > agg.lastSyncedAt)) {
      agg.lastSyncedAt = synced;
    }
  }

  const subsByModel = new Map<string, number>();
  for (const row of ofRows) {
    const mid = row.model_record_id;
    if (!mid || !byModel.has(mid)) continue;
    subsByModel.set(mid, (subsByModel.get(mid) ?? 0) + n(row.new_subscribers));
  }

  const models: GetMySocialAgencyModelDay[] = [...byModel.values()]
    .map((a) => {
      const winner_today = pickGmsLinkWinner(
        {
          button_clicks: a.todayA,
          pageviews: a.todayAViews,
          ctr_pct:
            a.todayAViews > 0 ? Math.round((a.todayA / a.todayAViews) * 1000) / 10 : null,
        },
        {
          button_clicks: a.todayB,
          pageviews: a.todayBViews,
          ctr_pct:
            a.todayBViews > 0 ? Math.round((a.todayB / a.todayBViews) * 1000) / 10 : null,
        }
      );
      const winner_week = pickGmsLinkWinner(
        {
          button_clicks: a.weekA,
          pageviews: a.weekAViews,
          ctr_pct:
            a.weekAViews > 0 ? Math.round((a.weekA / a.weekAViews) * 1000) / 10 : null,
        },
        {
          button_clicks: a.weekB,
          pageviews: a.weekBViews,
          ctr_pct:
            a.weekBViews > 0 ? Math.round((a.weekB / a.weekBViews) * 1000) / 10 : null,
        }
      );
      const period_new_subscribers = subsByModel.get(a.modelId) ?? 0;
      return {
        modelId: a.modelId,
        modelName: a.modelName,
        today_button_clicks: a.today_button_clicks,
        today_pageviews: a.today_pageviews,
        week_button_clicks: a.week_button_clicks,
        period_button_clicks: a.period_button_clicks,
        period_pageviews: a.period_pageviews,
        period_unique_visitors: a.period_uv,
        period_ctr_pct:
          a.period_pageviews > 0
            ? Math.round((a.period_button_clicks / a.period_pageviews) * 1000) / 10
            : null,
        period_new_subscribers,
        period_click_to_sub_rate_pct: clickToSubRatePct(
          period_new_subscribers,
          a.period_button_clicks
        ),
        winner_today: a.todayA + a.todayB > 0 ? winner_today : null,
        winner_week: a.weekA + a.weekB > 0 ? winner_week : null,
        lastSyncedAt: a.lastSyncedAt,
      };
    })
    .sort((a, b) => b.today_button_clicks - a.today_button_clicks || b.period_button_clicks - a.period_button_clicks);

  const totals = models.reduce(
    (acc, m) => {
      acc.pageviews += m.period_pageviews;
      acc.button_clicks += m.period_button_clicks;
      acc.unique_visitors += m.period_unique_visitors;
      acc.new_subscribers += m.period_new_subscribers;
      return acc;
    },
    { pageviews: 0, button_clicks: 0, unique_visitors: 0, new_subscribers: 0 }
  );

  const shield = Math.max(0, ...[...byModel.values()].map((a) => a.period_shield), 0);
  const lastSyncedAt =
    models
      .map((m) => m.lastSyncedAt)
      .filter((x): x is string => Boolean(x))
      .sort()
      .reverse()[0] ?? null;

  const conversion_ranking = models
    .filter((m) => m.period_click_to_sub_rate_pct != null)
    .map((m) => ({
      modelId: m.modelId,
      modelName: m.modelName,
      button_clicks: m.period_button_clicks,
      new_subscribers: m.period_new_subscribers,
      rate_pct: m.period_click_to_sub_rate_pct as number,
    }))
    .sort((a, b) => b.rate_pct - a.rate_pct);

  return {
    range: { startYmd: opts.startYmd, endYmd: opts.endYmd },
    todayYmd,
    lastSyncedAt,
    totals: {
      pageviews: totals.pageviews,
      button_clicks: totals.button_clicks,
      unique_visitors: totals.unique_visitors,
      ctr_pct:
        totals.pageviews > 0
          ? Math.round((totals.button_clicks / totals.pageviews) * 1000) / 10
          : null,
      shield_blocked_pct: shield,
      new_subscribers: totals.new_subscribers,
      click_to_sub_rate_pct: clickToSubRatePct(totals.new_subscribers, totals.button_clicks),
    },
    today: {
      button_clicks: models.reduce((s, m) => s + m.today_button_clicks, 0),
      pageviews: models.reduce((s, m) => s + m.today_pageviews, 0),
      by_model: models
        .filter((m) => m.today_button_clicks > 0 || m.today_pageviews > 0)
        .map((m) => ({
          modelId: m.modelId,
          modelName: m.modelName,
          button_clicks: m.today_button_clicks,
          pageviews: m.today_pageviews,
          winner: m.winner_today,
        })),
    },
    conversion_ranking,
    models,
  };
}
