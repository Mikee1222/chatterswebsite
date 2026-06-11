import { listAllRecords, createRecord, type AirtableRecord } from "@/lib/airtable-server";
import {
  LINK_PAGE_ANALYTICS_TABLE,
  LINK_PAGE_ANALYTICS_FIELDS,
} from "@/lib/link-pages-schema";
import type {
  AnalyticsSummary,
  LinkPageAnalyticsEventType,
  LinkPageDeviceType,
} from "@/types";

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

/** Fire-and-forget page view tracking. Never throws. */
export function trackPageView(ctx: TrackContext): void {
  void writeEvent("page_view", ctx);
}

/** Fire-and-forget link click tracking. Never throws. */
export function trackLinkClick(ctx: TrackContext): void {
  void writeEvent("link_click", ctx);
}

function mapAnalyticsRecord(rec: AirtableRecord<AnalyticsFields>) {
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
    timestamp: f.timestamp ?? "",
    utm_source: f.utm_source ?? "",
    utm_medium: f.utm_medium ?? "",
    utm_campaign: f.utm_campaign ?? "",
  };
}

function ymdFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export async function getPageAnalytics(pageId: string, days = 30): Promise<AnalyticsSummary> {
  const pid = pageId.trim();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const records = await listAllRecords<AnalyticsFields>(LINK_PAGE_ANALYTICS_TABLE, {
    filterByFormula: `AND({page_id}='${pid.replace(/'/g, "\\'")}', IS_AFTER({timestamp}, '${sinceIso}'))`,
    sort: [{ field: LINK_PAGE_ANALYTICS_FIELDS.timestamp, direction: "desc" }],
    _caller: "link-page-analytics",
  }).catch(() => []);

  const events = records.map(mapAnalyticsRecord);
  const pageViews = events.filter((e) => e.event_type === "page_view").length;
  const linkClicks = events.filter((e) => e.event_type === "link_click").length;
  const sessions = new Set(events.map((e) => e.session_id).filter(Boolean));
  const uniqueVisitors = sessions.size || pageViews;

  const clicksByBlock = new Map<string, { label: string; clicks: number }>();
  for (const e of events) {
    if (e.event_type !== "link_click" || !e.block_id) continue;
    const cur = clicksByBlock.get(e.block_id) ?? { label: e.block_id, clicks: 0 };
    cur.clicks += 1;
    clicksByBlock.set(e.block_id, cur);
  }
  const topLinks = [...clicksByBlock.entries()]
    .map(([block_id, v]) => ({ block_id, label: v.label, clicks: v.clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  const viewsByDayMap = new Map<string, { views: number; clicks: number }>();
  for (const e of events) {
    const date = ymdFromIso(e.timestamp);
    if (!date) continue;
    const cur = viewsByDayMap.get(date) ?? { views: 0, clicks: 0 };
    if (e.event_type === "page_view") cur.views += 1;
    else cur.clicks += 1;
    viewsByDayMap.set(date, cur);
  }
  const viewsByDay = [...viewsByDayMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const deviceMap = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "page_view") continue;
    const key = e.device_type || "unknown";
    deviceMap.set(key, (deviceMap.get(key) ?? 0) + 1);
  }
  const deviceBreakdown = [...deviceMap.entries()].map(([device, count]) => ({ device, count }));

  const countryMap = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "page_view") continue;
    const key = e.country || "Unknown";
    countryMap.set(key, (countryMap.get(key) ?? 0) + 1);
  }
  const countryBreakdown = [...countryMap.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const referrerMap = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "page_view") continue;
    const ref = e.referrer?.trim() || "Direct";
    referrerMap.set(ref, (referrerMap.get(ref) ?? 0) + 1);
  }
  const referrerBreakdown = [...referrerMap.entries()]
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    pageViews,
    linkClicks,
    uniqueVisitors,
    topLinks,
    viewsByDay,
    deviceBreakdown,
    countryBreakdown,
    referrerBreakdown,
  };
}

export async function getRealtimeVisitors(pageId: string): Promise<number> {
  const pid = pageId.trim();
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const records = await listAllRecords<AnalyticsFields>(LINK_PAGE_ANALYTICS_TABLE, {
    filterByFormula: `AND({page_id}='${pid.replace(/'/g, "\\'")}', {event_type}='page_view', IS_AFTER({timestamp}, '${since}'))`,
    _caller: "link-page-realtime",
  }).catch(() => []);
  const sessions = new Set(
    records.map((r) => r.fields.session_id).filter((s): s is string => typeof s === "string" && !!s.trim())
  );
  return sessions.size || records.length;
}

export function extractClientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    ""
  );
}
