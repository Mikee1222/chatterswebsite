/**
 * Sync GetMySocial analytics into Supabase for linked model links.
 */

import {
  GetMySocialApiError,
  getGetMySocialAnalyticsOverview,
  getGetMySocialBreakdown,
  getGetMySocialButtonsTimeSeries,
  getGetMySocialTimeSeries,
  isGetMySocialConfigured,
  listGetMySocialReferrers,
  listGetMySocialVisitors,
  logGetMySocialFailure,
} from "@/lib/getmysocial-api";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  listAllGetMySocialModelLinks,
  type GetMySocialModelLink,
} from "@/services/getmysocial-model-links";
import { listAllModelss } from "@/services/modelss";
import type { GetMySocialBreakdownDimension, GetMySocialTimeframe } from "@/types/getmysocial";
import type { ModelRecord } from "@/types";

const DEFAULT_TIMEFRAME: GetMySocialTimeframe = "thisMonth";
const BREAKDOWN_DIMENSIONS: GetMySocialBreakdownDimension[] = [
  "countries",
  "devices",
  "browsers",
];
const LINK_SYNC_CONCURRENCY = 2;
const VISITOR_RETENTION_DAYS = 90;
const VISITOR_FETCH_LIMIT = 50;

export type GetMySocialSyncResult = {
  skipped: boolean;
  skipReason?: string;
  linksTargeted: number;
  analyticsRowsUpserted: number;
  referrerRowsUpserted: number;
  breakdownRowsUpserted: number;
  visitorRowsUpserted: number;
  visitorsPruned: number;
  errors: Array<{ linkId: string; modelName?: string; message: string; code?: string }>;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function bucketToYmd(bucket: string): string | null {
  if (!bucket) return null;
  const m = bucket.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const out: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}

type SyncTarget = GetMySocialModelLink & {
  modelName: string;
};

function buildTargets(
  models: ModelRecord[],
  links: GetMySocialModelLink[]
): SyncTarget[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  return links.map((link) => ({
    ...link,
    modelName: byId.get(link.model_id)?.model_name ?? link.link_label,
  }));
}

function breakdownLabel(
  dimension: string,
  row: Record<string, unknown>
): { label: string; code: string | null } {
  if (dimension === "countries") {
    const country = typeof row.country === "string" ? row.country : "";
    const code = typeof row.country_code === "string" ? row.country_code : null;
    return { label: country || code || "Unknown", code };
  }
  if (dimension === "devices") {
    return { label: typeof row.device === "string" ? row.device : "unknown", code: null };
  }
  if (dimension === "browsers") {
    return { label: typeof row.browser === "string" ? row.browser : "Unknown", code: null };
  }
  const first = Object.values(row).find((v) => typeof v === "string");
  return { label: typeof first === "string" ? first : "Unknown", code: null };
}

async function syncOneLink(
  target: SyncTarget,
  timeframe: GetMySocialTimeframe,
  opts: { syncVisitors: boolean }
): Promise<{
  analytics: number;
  referrers: number;
  breakdowns: number;
  visitors: number;
}> {
  const sb = getSupabaseServiceClient();
  const linkId = target.getmysocial_link_id;
  const now = new Date().toISOString();
  const scope = { link_id: linkId, timeframe };

  const [overview, pageTs, buttonTs, referrers] = await Promise.all([
    getGetMySocialAnalyticsOverview(scope),
    getGetMySocialTimeSeries({ ...scope, interval: "day" }),
    getGetMySocialButtonsTimeSeries({ ...scope, interval: "day" }),
    listGetMySocialReferrers({ ...scope, top: 50 }),
  ]);

  const buttonByDate = new Map<string, number>();
  for (const p of buttonTs.data ?? []) {
    const d = bucketToYmd(p.bucket);
    if (!d) continue;
    buttonByDate.set(d, n(p.button_clicks ?? p.clicks));
  }

  const analyticsRows: Record<string, unknown>[] = [];
  for (const p of pageTs.data ?? []) {
    const date = bucketToYmd(p.bucket);
    if (!date) continue;
    const pageviews = n(p.pageviews ?? p.clicks);
    const button_clicks = buttonByDate.get(date) ?? 0;
    analyticsRows.push({
      model_id: target.model_id,
      getmysocial_link_id: linkId,
      getmysocial_link_row_id: target.id || null,
      link_role: target.link_role,
      model_name: target.modelName,
      shortcode: target.shortcode,
      link_label: target.link_label,
      date,
      pageviews,
      button_clicks,
      unique_visitors: 0,
      ctr_pct: pageviews > 0 ? Math.round((button_clicks / pageviews) * 1000) / 10 : null,
      shield_blocked_pct: overview.shield?.blocked_pct ?? 0,
      shield_blocked_count: overview.shield?.blocked_count ?? 0,
      timeframe,
      overview_json: {},
      synced_at: now,
      updated_at: now,
    });
  }

  const latestDate =
    analyticsRows
      .map((r) => String(r.date))
      .sort()
      .at(-1) ?? now.slice(0, 10);
  const snapshotIdx = analyticsRows.findIndex((r) => r.date === latestDate);
  const snapshot = {
    unique_visitors: n(overview.unique_visitors),
    pageviews: n(overview.total_pageviews),
    button_clicks: n(overview.total_button_clicks),
    ctr_pct:
      overview.total_pageviews > 0
        ? Math.round((n(overview.total_button_clicks) / n(overview.total_pageviews)) * 1000) / 10
        : null,
    shield_blocked_pct: overview.shield?.blocked_pct ?? 0,
    shield_blocked_count: overview.shield?.blocked_count ?? 0,
    overview_json: overview,
  };
  if (snapshotIdx >= 0) {
    Object.assign(analyticsRows[snapshotIdx]!, {
      unique_visitors: snapshot.unique_visitors,
      ctr_pct: snapshot.ctr_pct,
      shield_blocked_pct: snapshot.shield_blocked_pct,
      shield_blocked_count: snapshot.shield_blocked_count,
      overview_json: snapshot.overview_json,
    });
  } else {
    analyticsRows.push({
      model_id: target.model_id,
      getmysocial_link_id: linkId,
      getmysocial_link_row_id: target.id || null,
      link_role: target.link_role,
      model_name: target.modelName,
      shortcode: target.shortcode,
      link_label: target.link_label,
      date: latestDate,
      ...snapshot,
      timeframe,
      synced_at: now,
      updated_at: now,
    });
  }

  let analytics = 0;
  if (analyticsRows.length) {
    const { error } = await sb.from("getmysocial_daily_analytics").upsert(analyticsRows, {
      onConflict: "getmysocial_link_id,date",
    });
    if (error) throw new Error(`upsert daily_analytics: ${error.message}`);
    analytics = analyticsRows.length;
  }

  await sb
    .from("getmysocial_referrers")
    .delete()
    .eq("getmysocial_link_id", linkId)
    .eq("timeframe", timeframe);

  const referrerRows = (referrers.data ?? []).map((r) => ({
    model_id: target.model_id,
    getmysocial_link_id: linkId,
    getmysocial_link_row_id: target.id || null,
    link_role: target.link_role,
    timeframe,
    referrer: (r.referrer || "Direct / None").slice(0, 2000),
    count: n(r.count),
    synced_at: now,
  }));
  let referrerCount = 0;
  if (referrerRows.length) {
    const { error } = await sb.from("getmysocial_referrers").insert(referrerRows);
    if (error) throw new Error(`insert referrers: ${error.message}`);
    referrerCount = referrerRows.length;
  }

  let breakdowns = 0;
  for (const dimension of BREAKDOWN_DIMENSIONS) {
    const res = await getGetMySocialBreakdown(dimension, scope);
    await sb
      .from("getmysocial_breakdowns")
      .delete()
      .eq("getmysocial_link_id", linkId)
      .eq("dimension", dimension)
      .eq("timeframe", timeframe);

    const rows = (res.data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      const { label, code } = breakdownLabel(dimension, row);
      return {
        model_id: target.model_id,
        getmysocial_link_id: linkId,
        getmysocial_link_row_id: target.id || null,
        link_role: target.link_role,
        dimension,
        timeframe,
        label: label.slice(0, 500),
        label_code: code,
        count: n(row.count),
        payload: row,
        synced_at: now,
      };
    });
    if (rows.length) {
      const { error } = await sb.from("getmysocial_breakdowns").insert(rows);
      if (error) throw new Error(`insert breakdowns ${dimension}: ${error.message}`);
      breakdowns += rows.length;
    }
  }

  let visitors = 0;
  if (opts.syncVisitors) {
    try {
      const visitRes = await listGetMySocialVisitors({
        link_id: linkId,
        timeframe: "today",
        limit: VISITOR_FETCH_LIMIT,
      });
      const events = visitRes.data ?? [];
      if (events.length) {
        // Delete today's prior pull for this link to avoid dupes on re-sync
        const dayStart = new Date();
        dayStart.setUTCHours(0, 0, 0, 0);
        await sb
          .from("getmysocial_visitor_events")
          .delete()
          .eq("getmysocial_link_id", linkId)
          .gte("event_timestamp", dayStart.toISOString());

        const rows = events.map((e) => ({
          model_id: target.model_id,
          getmysocial_link_id: linkId,
          getmysocial_link_row_id: target.id || null,
          link_role: target.link_role,
          event_timestamp: e.timestamp,
          country: e.country,
          country_code: e.country_code,
          region: e.region,
          city: e.city,
          device: e.device,
          browser: e.browser,
          os: e.os,
          referrer: e.referrer,
          is_bot: e.is_bot === true,
          is_proxy: e.is_proxy === true,
          is_hosting: e.is_hosting === true,
          safe_page_triggered: e.safe_page_triggered === true,
          link_shortcode: e.link_shortcode,
          link_display_name: e.link_display_name,
          synced_at: now,
        }));
        const { error } = await sb.from("getmysocial_visitor_events").insert(rows);
        if (error) throw new Error(`insert visitor_events: ${error.message}`);
        visitors = rows.length;
      }
    } catch (err) {
      logGetMySocialFailure("visitors", err, { linkId });
    }
  }

  return { analytics, referrers: referrerCount, breakdowns, visitors };
}

export async function syncGetMySocialAnalytics(opts?: {
  timeframe?: GetMySocialTimeframe;
  modelId?: string;
  syncVisitors?: boolean;
}): Promise<GetMySocialSyncResult> {
  if (!isGetMySocialConfigured()) {
    return {
      skipped: true,
      skipReason:
        "GETMYSOCIAL_API_KEY is not configured. Mint a key in GetMySocial → Dashboard → Settings → API Keys and set it in Vercel Production.",
      linksTargeted: 0,
      analyticsRowsUpserted: 0,
      referrerRowsUpserted: 0,
      breakdownRowsUpserted: 0,
      visitorRowsUpserted: 0,
      visitorsPruned: 0,
      errors: [],
    };
  }

  const timeframe = opts?.timeframe ?? DEFAULT_TIMEFRAME;
  const syncVisitors = opts?.syncVisitors !== false;
  const [models, allLinks] = await Promise.all([
    listAllModelss(),
    listAllGetMySocialModelLinks(),
  ]);
  const links = opts?.modelId
    ? allLinks.filter((l) => l.model_id === opts.modelId)
    : allLinks;

  if (!links.length) {
    return {
      skipped: true,
      skipReason: "No models linked to GetMySocial links yet.",
      linksTargeted: 0,
      analyticsRowsUpserted: 0,
      referrerRowsUpserted: 0,
      breakdownRowsUpserted: 0,
      visitorRowsUpserted: 0,
      visitorsPruned: 0,
      errors: [],
    };
  }

  const targets = buildTargets(models, links);
  const errors: GetMySocialSyncResult["errors"] = [];
  let analyticsRowsUpserted = 0;
  let referrerRowsUpserted = 0;
  let breakdownRowsUpserted = 0;
  let visitorRowsUpserted = 0;

  await mapWithConcurrency(targets, LINK_SYNC_CONCURRENCY, async (target) => {
    try {
      const r = await syncOneLink(target, timeframe, { syncVisitors });
      analyticsRowsUpserted += r.analytics;
      referrerRowsUpserted += r.referrers;
      breakdownRowsUpserted += r.breakdowns;
      visitorRowsUpserted += r.visitors;
    } catch (err) {
      logGetMySocialFailure("sync link", err, {
        linkId: target.getmysocial_link_id,
        modelId: target.model_id,
      });
      errors.push({
        linkId: target.getmysocial_link_id,
        modelName: target.modelName,
        message: err instanceof Error ? err.message : String(err),
        code: err instanceof GetMySocialApiError ? err.code : undefined,
      });
    }
  });

  let visitorsPruned = 0;
  try {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - VISITOR_RETENTION_DAYS);
    const sb = getSupabaseServiceClient();
    const { data, error } = await sb
      .from("getmysocial_visitor_events")
      .delete()
      .lt("event_timestamp", cutoff.toISOString())
      .select("id");
    if (!error) visitorsPruned = data?.length ?? 0;
  } catch (err) {
    console.error("[getmysocial] prune visitors", err);
  }

  return {
    skipped: false,
    linksTargeted: targets.length,
    analyticsRowsUpserted,
    referrerRowsUpserted,
    breakdownRowsUpserted,
    visitorRowsUpserted,
    visitorsPruned,
    errors,
  };
}
