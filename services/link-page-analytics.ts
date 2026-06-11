import { listAllRecords, createRecord, type AirtableRecord } from "@/lib/airtable-server";
import {
  LINK_PAGE_ANALYTICS_TABLE,
  LINK_PAGE_ANALYTICS_FIELDS,
} from "@/lib/link-pages-schema";
import type {
  AnalyticsPeriodMetrics,
  AnalyticsSummary,
  GlobalAnalyticsSummary,
  LinkPageAnalyticsEventType,
  LinkPageDeviceType,
} from "@/types";
import { getLinkPageBlocksFresh, listLinkPages } from "@/services/link-pages";
import { listRedirectsForPage } from "@/services/link-redirects";
import { detectLinkPlatform } from "@/lib/link-page-styles";
import {
  athensDayStart,
  cleanReferrerLabel,
  computeTrend,
  countryToFlag,
  getReferrerIcon,
  hourInAthens,
  last7DayLabels,
  withPercent,
  ymdInAthens,
} from "@/lib/link-page-analytics-utils";

type AnalyticsFields = {
  event_id?: string;
  page_id?: string;
  block_id?: string;
  event_type?: string;
  ip_address?: string;
  country?: string;
  city?: string;
  region?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  referrer?: string;
  user_agent?: string;
  session_id?: string;
  visitor_id?: string;
  is_new_visitor?: boolean;
  is_new_session?: boolean;
  timestamp?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export type TrackContext = {
  pageId: string;
  blockId?: string;
  ip?: string;
  userAgent?: string;
  referrer?: string;
  sessionId?: string;
  visitorId?: string;
  isNewVisitor?: boolean;
  isNewSession?: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

type ParsedUa = {
  device_type: LinkPageDeviceType;
  browser: string;
  os: string;
};

type GeoInfo = {
  country: string;
  city: string;
  region: string;
};

type MappedEvent = {
  id: string;
  event_id: string;
  page_id: string;
  block_id: string;
  event_type: LinkPageAnalyticsEventType;
  ip_address: string;
  country: string;
  city: string;
  region: string;
  device_type: LinkPageDeviceType;
  browser: string;
  os: string;
  referrer: string;
  user_agent: string;
  session_id: string;
  visitor_id: string;
  is_new_visitor: boolean;
  is_new_session: boolean;
  timestamp: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

function visitorKey(e: Pick<MappedEvent, "visitor_id" | "session_id">): string {
  return e.visitor_id?.trim() || e.session_id?.trim() || "";
}

const BOT_UA_PATTERNS = [
  "bot",
  "crawler",
  "spider",
  "preview",
  "facebot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "telegrambot",
  "whatsapp",
  "slackbot",
  "googlebot",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function isBotUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => lower.includes(p));
}

function isInternalAdminReferrer(referrer: string): boolean {
  const r = referrer.toLowerCase();
  return r.includes("/admin") || r.includes("admin/link-pages");
}

function parseUserAgent(ua: string): ParsedUa {
  const lower = ua.toLowerCase();
  let device_type: LinkPageDeviceType = "desktop";
  if (/mobile|iphone|android.*mobile|windows phone/.test(lower)) device_type = "mobile";
  else if (/ipad|tablet|android(?!.*mobile)/.test(lower)) device_type = "tablet";

  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/opera|opr\//i.test(ua)) browser = "Opera";

  let os = "Unknown";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return { device_type, browser, os };
}

async function lookupGeo(ip: string): Promise<GeoInfo> {
  const empty = { country: "", city: "", region: "" };
  if (!ip || ip === "127.0.0.1" || ip.startsWith("::") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return empty;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,regionName`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      city?: string;
      regionName?: string;
    };
    if (data.status !== "success") return empty;
    return {
      country: data.country ?? "",
      city: data.city ?? "",
      region: data.regionName ?? "",
    };
  } catch {
    return empty;
  }
}

function newEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function writeEvent(eventType: LinkPageAnalyticsEventType, ctx: TrackContext): Promise<void> {
  try {
    const ua = ctx.userAgent ?? "";
    if (isBotUserAgent(ua)) return;
    if (eventType === "page_view" && isInternalAdminReferrer(ctx.referrer ?? "")) return;

    const parsed = parseUserAgent(ua);
    const geo = ctx.ip ? await lookupGeo(ctx.ip) : { country: "", city: "", region: "" };
    const now = new Date().toISOString();
    const fields: AnalyticsFields = {
      event_id: newEventId(),
      page_id: ctx.pageId,
      block_id: ctx.blockId ?? "",
      event_type: eventType,
      ip_address: ctx.ip ?? "",
      country: geo.country,
      city: geo.city,
      region: geo.region,
      device_type: parsed.device_type,
      browser: parsed.browser,
      os: parsed.os,
      referrer: (ctx.referrer ?? "").slice(0, 500),
      user_agent: ua.slice(0, 2000),
      session_id: ctx.sessionId ?? "",
      visitor_id: ctx.visitorId ?? "",
      is_new_visitor: ctx.isNewVisitor === true,
      is_new_session: ctx.isNewSession === true,
      timestamp: now,
      utm_source: ctx.utmSource ?? "",
      utm_medium: ctx.utmMedium ?? "",
      utm_campaign: ctx.utmCampaign ?? "",
    };
    await createRecord<AnalyticsFields>(LINK_PAGE_ANALYTICS_TABLE, fields);
  } catch {
    // fire-and-forget — never throw
  }
}

export type EnhancedTrackContext = TrackContext & {
  eventType?: LinkPageAnalyticsEventType;
};

/** Client fingerprint tracking — page views and enhanced metadata. Never throws. */
export function writeEnhancedEvent(ctx: EnhancedTrackContext): Promise<void> {
  const eventType = ctx.eventType === "link_click" ? "link_click" : "page_view";
  return writeEvent(eventType, ctx);
}

/** Fire-and-forget page view tracking. Never throws. */
export function trackPageView(ctx: TrackContext): Promise<void> {
  return writeEvent("page_view", ctx);
}

/** Fire-and-forget link click tracking. Never throws. */
export function trackLinkClick(ctx: TrackContext): void {
  void writeEvent("link_click", ctx);
}

function mapAnalyticsRecord(rec: AirtableRecord<AnalyticsFields>): MappedEvent {
  const f = rec.fields;
  return {
    id: rec.id,
    event_id: f.event_id ?? "",
    page_id: f.page_id ?? "",
    block_id: f.block_id ?? "",
    event_type: (f.event_type === "link_click" ? "link_click" : "page_view") as LinkPageAnalyticsEventType,
    ip_address: f.ip_address ?? "",
    country: f.country ?? "",
    city: f.city ?? "",
    region: f.region ?? "",
    device_type: (["mobile", "desktop", "tablet"].includes(f.device_type ?? "")
      ? f.device_type
      : "desktop") as LinkPageDeviceType,
    browser: f.browser ?? "",
    os: f.os ?? "",
    referrer: f.referrer ?? "",
    user_agent: f.user_agent ?? "",
    session_id: f.session_id ?? "",
    visitor_id: f.visitor_id ?? "",
    is_new_visitor: f.is_new_visitor === true,
    is_new_session: f.is_new_session === true,
    timestamp: f.timestamp ?? "",
    utm_source: f.utm_source ?? "",
    utm_medium: f.utm_medium ?? "",
    utm_campaign: f.utm_campaign ?? "",
  };
}

function dayOfWeekFromIso(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return -1;
  return d.getUTCDay();
}

function getPeriodBounds(days: number): { currentStart: Date; previousStart: Date; fetchSince: Date } {
  const effectiveDays = Math.max(1, days);
  if (effectiveDays === 1) {
    const currentStart = athensDayStart(0);
    const previousStart = athensDayStart(-1);
    return { currentStart, previousStart, fetchSince: previousStart };
  }
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - effectiveDays);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - effectiveDays);
  return { currentStart, previousStart, fetchSince: previousStart };
}

function filterEventsInRange(events: MappedEvent[], start: Date, end?: Date): MappedEvent[] {
  const startMs = start.getTime();
  const endMs = end?.getTime();
  return events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    if (Number.isNaN(t)) return false;
    if (t < startMs) return false;
    if (endMs != null && t >= endMs) return false;
    return true;
  });
}

function computeCoreMetrics(events: MappedEvent[]): AnalyticsPeriodMetrics {
  const pageViews = events.filter((e) => e.event_type === "page_view").length;
  const linkClicks = events.filter((e) => e.event_type === "link_click").length;
  const visitorsWithView = new Set<string>();
  const visitorsWithClick = new Set<string>();
  const newVisitorIds = new Set<string>();

  for (const e of events) {
    const vid = visitorKey(e);
    if (!vid) continue;
    if (e.event_type === "page_view") {
      visitorsWithView.add(vid);
      if (e.is_new_visitor) newVisitorIds.add(vid);
    }
    if (e.event_type === "link_click") visitorsWithClick.add(vid);
  }

  const uniqueVisitors = visitorsWithView.size || pageViews;
  const newVisitors = newVisitorIds.size;
  const returningVisitors = Math.max(0, uniqueVisitors - newVisitors);
  const returningRate = uniqueVisitors > 0 ? Math.round((returningVisitors / uniqueVisitors) * 100) : 0;
  const uniqueClickers = visitorsWithClick.size;
  const trueCtr = uniqueVisitors > 0 ? Math.round((uniqueClickers / uniqueVisitors) * 100) : 0;
  const visitsWithClicks = [...visitorsWithView].filter((v) => visitorsWithClick.has(v)).length;

  return {
    pageViews,
    linkClicks,
    uniqueVisitors,
    newVisitors,
    returningVisitors,
    returningRate,
    uniqueClickers,
    trueCtr,
    visitsWithClicks,
    ctr: trueCtr,
  };
}

function buildPreviousComparison(
  current: AnalyticsPeriodMetrics,
  previous: AnalyticsPeriodMetrics
): AnalyticsSummary["previousPeriodComparison"] {
  return {
    pageViews: computeTrend(current.pageViews, previous.pageViews),
    linkClicks: computeTrend(current.linkClicks, previous.linkClicks),
    uniqueVisitors: computeTrend(current.uniqueVisitors, previous.uniqueVisitors),
    newVisitors: computeTrend(current.newVisitors, previous.newVisitors),
    trueCtr: computeTrend(current.trueCtr, previous.trueCtr),
    visitsWithClicks: computeTrend(current.visitsWithClicks, previous.visitsWithClicks),
    ctr: computeTrend(current.ctr, previous.ctr),
  };
}

function buildHourlyDistribution(events: MappedEvent[]): { hourlyDistribution: AnalyticsSummary["hourlyDistribution"]; peakHour: number } {
  const hourlyMap = new Map<number, { views: number; clicks: number }>();
  for (let h = 0; h < 24; h++) hourlyMap.set(h, { views: 0, clicks: 0 });
  for (const e of events) {
    const hour = hourInAthens(e.timestamp);
    if (hour < 0 || hour > 23) continue;
    const cur = hourlyMap.get(hour)!;
    if (e.event_type === "page_view") cur.views += 1;
    else cur.clicks += 1;
  }
  const hourlyDistribution = [...hourlyMap.entries()]
    .map(([hour, v]) => ({ hour, ...v }))
    .sort((a, b) => a.hour - b.hour);
  const peakHour = hourlyDistribution.reduce(
    (best, row) => (row.clicks > best.clicks ? row : best),
    hourlyDistribution[0] ?? { hour: 0, views: 0, clicks: 0 }
  ).hour;
  return { hourlyDistribution, peakHour };
}

function buildReferrerBreakdown(events: MappedEvent[]): AnalyticsSummary["referrerBreakdown"] {
  const labelMap = new Map<string, { referrer: string; count: number }>();
  for (const e of events) {
    if (e.event_type !== "page_view") continue;
    const raw = e.referrer?.trim() || "Direct";
    const label = cleanReferrerLabel(raw);
    const cur = labelMap.get(label) ?? { referrer: raw, count: 0 };
    cur.count += 1;
    labelMap.set(label, cur);
  }
  const total = [...labelMap.values()].reduce((s, x) => s + x.count, 0);
  return [...labelMap.entries()]
    .map(([label, { referrer, count }]) => ({
      referrer,
      label,
      icon: getReferrerIcon(label),
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function buildDeviceBreakdown(events: MappedEvent[]): AnalyticsSummary["deviceBreakdown"] {
  const deviceMap = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "page_view") continue;
    const key = e.device_type || "unknown";
    deviceMap.set(key, (deviceMap.get(key) ?? 0) + 1);
  }
  const total = [...deviceMap.values()].reduce((s, n) => s + n, 0);
  return withPercent(
    [...deviceMap.entries()].map(([device, count]) => ({ device, count })),
    total
  );
}

function buildCountryBreakdown(events: MappedEvent[]): AnalyticsSummary["countryBreakdown"] {
  const countryMap = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "page_view") continue;
    const key = e.country || "Unknown";
    countryMap.set(key, (countryMap.get(key) ?? 0) + 1);
  }
  const total = [...countryMap.values()].reduce((s, n) => s + n, 0);
  return withPercent(
    [...countryMap.entries()]
      .map(([country, count]) => ({ country, count, flag: countryToFlag(country) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    total
  );
}

function buildCityBreakdown(events: MappedEvent[]): AnalyticsSummary["cityBreakdown"] {
  const cityMap = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "page_view") continue;
    const key = e.city?.trim();
    if (!key) continue;
    cityMap.set(key, (cityMap.get(key) ?? 0) + 1);
  }
  const total = [...cityMap.values()].reduce((s, n) => s + n, 0);
  return withPercent(
    [...cityMap.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    total
  );
}

function buildViewsByDay(events: MappedEvent[]): AnalyticsSummary["viewsByDay"] {
  const viewsByDayMap = new Map<string, { views: number; clicks: number }>();
  for (const e of events) {
    const date = ymdInAthens(e.timestamp);
    if (!date) continue;
    const cur = viewsByDayMap.get(date) ?? { views: 0, clicks: 0 };
    if (e.event_type === "page_view") cur.views += 1;
    else cur.clicks += 1;
    viewsByDayMap.set(date, cur);
  }
  return [...viewsByDayMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildSparklineForBlock(allEvents: MappedEvent[], blockId: string): number[] {
  const dayLabels = last7DayLabels();
  const clicksByDay = new Map<string, number>();
  for (const label of dayLabels) clicksByDay.set(label, 0);
  for (const e of allEvents) {
    if (e.event_type !== "link_click" || e.block_id !== blockId) continue;
    const date = ymdInAthens(e.timestamp);
    if (clicksByDay.has(date)) {
      clicksByDay.set(date, (clicksByDay.get(date) ?? 0) + 1);
    }
  }
  return dayLabels.map((d) => clicksByDay.get(d) ?? 0);
}

export { cleanReferrerLabel } from "@/lib/link-page-analytics-utils";

export async function getPageAnalytics(pageId: string, days = 1): Promise<AnalyticsSummary> {
  const pid = pageId.trim();
  const { currentStart, previousStart, fetchSince } = getPeriodBounds(days);

  const [records, blocks, redirects] = await Promise.all([
    listAllRecords<AnalyticsFields>(LINK_PAGE_ANALYTICS_TABLE, {
      filterByFormula: `AND({page_id}='${pid.replace(/'/g, "\\'")}', IS_AFTER({timestamp}, '${fetchSince.toISOString()}'))`,
      sort: [{ field: LINK_PAGE_ANALYTICS_FIELDS.timestamp, direction: "desc" }],
      _caller: "link-page-analytics",
    }).catch(() => []),
    getLinkPageBlocksFresh(pid).catch(() => []),
    listRedirectsForPage(pid).catch(() => []),
  ]);

  const blockMap = new Map(blocks.map((b) => [b.block_id, b]));
  const allEvents = records.map(mapAnalyticsRecord);
  const currentEvents = filterEventsInRange(allEvents, currentStart);
  const previousEvents = filterEventsInRange(allEvents, previousStart, currentStart);

  const core = computeCoreMetrics(currentEvents);
  const previousCore = computeCoreMetrics(previousEvents);

  const clicksByBlock = new Map<string, number>();
  const uniqueClicksByBlock = new Map<string, Set<string>>();
  for (const e of currentEvents) {
    if (e.event_type !== "link_click" || !e.block_id) continue;
    clicksByBlock.set(e.block_id, (clicksByBlock.get(e.block_id) ?? 0) + 1);
    const vid = visitorKey(e);
    if (vid) {
      const set = uniqueClicksByBlock.get(e.block_id) ?? new Set<string>();
      set.add(vid);
      uniqueClicksByBlock.set(e.block_id, set);
    }
  }
  const topLinks = [...clicksByBlock.entries()]
    .map(([block_id, clicks]) => {
      const block = blockMap.get(block_id);
      const url = block?.url ?? "";
      return {
        block_id,
        label: block?.label?.trim() || url.trim() || block_id,
        url,
        clicks,
        uniqueClicks: uniqueClicksByBlock.get(block_id)?.size ?? 0,
        platform: detectLinkPlatform({
          platform: block?.platform ?? "",
          icon: block?.icon ?? "",
          url,
        }),
        sparkline: buildSparklineForBlock(allEvents, block_id),
      };
    })
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  const redirectClicks = redirects
    .map((r) => ({
      redirect_id: r.redirect_id,
      slug: r.slug,
      label: r.label?.trim() || r.slug,
      clicks: r.click_count,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const utmMap = new Map<string, number>();
  for (const e of currentEvents) {
    if (e.event_type !== "link_click") continue;
    const source = e.utm_source?.trim();
    if (!source) continue;
    const campaign = e.utm_campaign?.trim() || "—";
    const key = `${source}\0${campaign}`;
    utmMap.set(key, (utmMap.get(key) ?? 0) + 1);
  }
  const utmBreakdown = [...utmMap.entries()]
    .map(([key, count]) => {
      const [source, campaign] = key.split("\0");
      return { source: source ?? "", campaign: campaign ?? "—", count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const { hourlyDistribution, peakHour } = buildHourlyDistribution(currentEvents);

  return {
    ...core,
    topLinks,
    redirectClicks,
    viewsByDay: buildViewsByDay(currentEvents),
    deviceBreakdown: buildDeviceBreakdown(currentEvents),
    countryBreakdown: buildCountryBreakdown(currentEvents),
    cityBreakdown: buildCityBreakdown(currentEvents),
    referrerBreakdown: buildReferrerBreakdown(currentEvents),
    utmBreakdown,
    hourlyDistribution,
    peakHour,
    previousPeriodComparison: buildPreviousComparison(core, previousCore),
  };
}

export async function getRealtimeVisitors(pageId: string): Promise<number> {
  const pid = pageId.trim();
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const records = await listAllRecords<AnalyticsFields>(LINK_PAGE_ANALYTICS_TABLE, {
    filterByFormula: `AND({page_id}='${pid.replace(/'/g, "\\'")}', {event_type}='page_view', IS_AFTER({timestamp}, '${since}'))`,
    _caller: "link-page-realtime",
  }).catch(() => []);
  const visitors = new Set(
    records
      .map((r) => r.fields.visitor_id?.trim() || r.fields.session_id?.trim())
      .filter((s): s is string => typeof s === "string" && !!s)
  );
  return visitors.size || records.length;
}

export function extractClientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    ""
  );
}

export async function getGlobalAnalytics(days = 1): Promise<GlobalAnalyticsSummary> {
  const { currentStart, previousStart, fetchSince } = getPeriodBounds(days);

  const [records, pages] = await Promise.all([
    listAllRecords<AnalyticsFields>(LINK_PAGE_ANALYTICS_TABLE, {
      filterByFormula: `IS_AFTER({timestamp}, '${fetchSince.toISOString()}')`,
      sort: [{ field: LINK_PAGE_ANALYTICS_FIELDS.timestamp, direction: "desc" }],
      _caller: "link-page-global-analytics",
    }).catch(() => []),
    listLinkPages(),
  ]);

  const pageMeta = new Map(pages.map((p) => [p.page_id, { title: p.title, slug: p.slug }]));
  const allEvents = records.map(mapAnalyticsRecord);
  const currentEvents = filterEventsInRange(allEvents, currentStart);
  const previousEvents = filterEventsInRange(allEvents, previousStart, currentStart);

  const core = computeCoreMetrics(currentEvents);
  const previousCore = computeCoreMetrics(previousEvents);

  const viewsByPageDay = new Map<string, Map<string, number>>();
  const pageStats = new Map<string, { views: number; clicks: number }>();
  const dayOfWeekMap = new Map<number, { views: number; clicks: number }>();
  for (let d = 0; d < 7; d++) dayOfWeekMap.set(d, { views: 0, clicks: 0 });

  for (const e of currentEvents) {
    const pid = e.page_id || "unknown";
    const stats = pageStats.get(pid) ?? { views: 0, clicks: 0 };
    const dow = dayOfWeekFromIso(e.timestamp);

    if (e.event_type === "page_view") {
      stats.views += 1;
      const date = ymdInAthens(e.timestamp);
      if (date) {
        const dayMap = viewsByPageDay.get(date) ?? new Map<string, number>();
        dayMap.set(pid, (dayMap.get(pid) ?? 0) + 1);
        viewsByPageDay.set(date, dayMap);
      }
      if (dow >= 0 && dow <= 6) {
        const cur = dayOfWeekMap.get(dow)!;
        cur.views += 1;
      }
    } else if (e.event_type === "link_click") {
      stats.clicks += 1;
      if (dow >= 0 && dow <= 6) {
        const cur = dayOfWeekMap.get(dow)!;
        cur.clicks += 1;
      }
    }
    pageStats.set(pid, stats);
  }

  const viewsByDayByPage = [...viewsByPageDay.entries()]
    .map(([date, dayMap]) => ({ date, pages: Object.fromEntries(dayMap) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const viewsByDay = buildViewsByDay(currentEvents);

  const leaderboard = [...pageStats.entries()]
    .map(([page_id, s]) => ({
      page_id,
      title: pageMeta.get(page_id)?.title ?? page_id,
      slug: pageMeta.get(page_id)?.slug ?? "",
      views: s.views,
      clicks: s.clicks,
    }))
    .sort((a, b) => b.views - a.views);

  const pageBreakdown = leaderboard.map(({ page_id, title, views }) => ({ page_id, title, views }));
  const { hourlyDistribution, peakHour } = buildHourlyDistribution(currentEvents);

  const bestDayOfWeek = [...dayOfWeekMap.entries()]
    .map(([dow, v]) => ({ day: DAY_NAMES[dow] ?? String(dow), ...v }))
    .sort((a, b) => b.views - a.views);

  return {
    totalPageViews: core.pageViews,
    totalLinkClicks: core.linkClicks,
    totalUniqueVisitors: core.uniqueVisitors,
    totalNewVisitors: core.newVisitors,
    totalReturningVisitors: core.returningVisitors,
    returningRate: core.returningRate,
    totalUniqueClickers: core.uniqueClickers,
    visitsWithClicks: core.visitsWithClicks,
    trueCtr: core.trueCtr,
    ctr: core.ctr,
    viewsByDayByPage,
    viewsByDay,
    leaderboard,
    deviceBreakdown: buildDeviceBreakdown(currentEvents),
    pageBreakdown,
    countryBreakdown: buildCountryBreakdown(currentEvents),
    referrerBreakdown: buildReferrerBreakdown(currentEvents),
    hourlyDistribution,
    peakHour,
    bestDayOfWeek,
    previousPeriodComparison: buildPreviousComparison(core, previousCore),
  };
}
