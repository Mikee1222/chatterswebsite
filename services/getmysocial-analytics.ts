/**
 * Query cached GetMySocial analytics + IG→bio→OF funnel for UI.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  listGetMySocialModelLinks,
  type GetMySocialModelLink,
  type GetMySocialLinkRole,
} from "@/services/getmysocial-model-links";
import { queryClarioSuiteDailyInsights } from "@/services/clariosuite-sync";
import { listClarioSuiteModelAccounts, resolvePrimaryIgUserId } from "@/services/clariosuite-model-accounts";
import {
  creatorTxRevenueAmount,
  listCreatorDailyStats,
  listCreatorTransactions,
} from "@/services/infloww-creator-earnings";
import { getModelById } from "@/services/modelss";
import { ymdInAthens } from "@/lib/airtable-datetime";

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

export type GetMySocialAnalyticsSummary = {
  modelId: string;
  modelName: string;
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
  funnel: GetMySocialFunnelDay[];
  funnelTotals: {
    ig_reach: number;
    bio_pageviews: number;
    bio_button_clicks: number;
    of_new_subscribers: number;
    of_revenue: number;
  };
  storyLinks: { link_a_url: string | null; link_b_url: string | null };
  referrers: Array<{ referrer: string; count: number; link_role: string | null }>;
  countries: Array<{ label: string; label_code: string | null; count: number }>;
  devices: Array<{ label: string; count: number }>;
  browsers: Array<{ label: string; count: number }>;
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
  const timeframe = opts?.timeframe ?? "thisMonth";

  let analyticsQ = sb
    .from("getmysocial_daily_analytics")
    .select(
      "date,pageviews,button_clicks,unique_visitors,ctr_pct,shield_blocked_pct,shield_blocked_count,getmysocial_link_id,link_role,link_label,synced_at,overview_json"
    )
    .in("getmysocial_link_id", linkIds)
    .order("date", { ascending: true });
  if (opts?.startYmd) analyticsQ = analyticsQ.gte("date", opts.startYmd);
  if (opts?.endYmd) analyticsQ = analyticsQ.lte("date", opts.endYmd);

  const [analyticsRes, referrersRes, countriesRes, devicesRes, browsersRes, storyRes] =
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
    ]);

  if (analyticsRes.error) throw new Error(analyticsRes.error.message);

  const daily = (analyticsRes.data ?? []).map((r) => ({
    date: String(r.date).slice(0, 10),
    pageviews: n(r.pageviews),
    button_clicks: n(r.button_clicks),
    getmysocial_link_id: String(r.getmysocial_link_id),
    link_role: (r.link_role as string | null) ?? null,
    link_label: (r.link_label as string | null) ?? null,
  }));

  const roleStats = (role: GetMySocialLinkRole): LinkRoleStats => {
    const link = links.find((l) => l.link_role === role) ?? null;
    if (!link) return emptyRole(role);
    const rows = (analyticsRes.data ?? []).filter(
      (r) => String(r.getmysocial_link_id) === link.getmysocial_link_id
    );
    const pageviews = rows.reduce((s, r) => s + n(r.pageviews), 0);
    const button_clicks = rows.reduce((s, r) => s + n(r.button_clicks), 0);
    const uv = Math.max(0, ...rows.map((r) => n(r.unique_visitors)));
    const shield = Math.max(0, ...rows.map((r) => n(r.shield_blocked_pct)));
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

  // Funnel: IG reach (ClarioSuite) → bio clicks (GMS) → OF subs/revenue (Infloww)
  const dates = [...new Set(daily.map((d) => d.date))].sort();
  const startYmd = opts?.startYmd ?? dates[0];
  const endYmd = opts?.endYmd ?? dates[dates.length - 1];
  const bioByDate = new Map<string, { pageviews: number; button_clicks: number }>();
  for (const d of daily) {
    const cur = bioByDate.get(d.date) ?? { pageviews: 0, button_clicks: 0 };
    cur.pageviews += d.pageviews;
    cur.button_clicks += d.button_clicks;
    bioByDate.set(d.date, cur);
  }

  const funnelMap = new Map<string, GetMySocialFunnelDay>();
  for (const date of dates) {
    const bio = bioByDate.get(date) ?? { pageviews: 0, button_clicks: 0 };
    funnelMap.set(date, {
      date,
      ig_reach: 0,
      bio_pageviews: bio.pageviews,
      bio_button_clicks: bio.button_clicks,
      of_new_subscribers: 0,
      of_revenue: 0,
    });
  }

  if (model && startYmd && endYmd) {
    try {
      const accounts = await listClarioSuiteModelAccounts(model.id);
      const ig = resolvePrimaryIgUserId(model, accounts);
      if (ig) {
        const igRows = await queryClarioSuiteDailyInsights({
          igUserId: ig,
          startYmd,
          endYmd,
        });
        for (const row of igRows) {
          const date = String(row.date).slice(0, 10);
          const f = funnelMap.get(date) ?? {
            date,
            ig_reach: 0,
            bio_pageviews: 0,
            bio_button_clicks: 0,
            of_new_subscribers: 0,
            of_revenue: 0,
          };
          f.ig_reach += n(row.reach);
          funnelMap.set(date, f);
        }
      }
    } catch (err) {
      console.error("[getmysocial] funnel ig", err);
    }

    try {
      const creatorId = model.infloww_creator_id?.trim();
      if (creatorId) {
        const ofRows = await listCreatorDailyStats({
          creatorInflowwId: creatorId,
          startYmd,
          endYmd,
        });
        for (const row of ofRows) {
          const date = String(row.date).slice(0, 10);
          const f = funnelMap.get(date) ?? {
            date,
            ig_reach: 0,
            bio_pageviews: 0,
            bio_button_clicks: 0,
            of_new_subscribers: 0,
            of_revenue: 0,
          };
          f.of_new_subscribers += n(row.new_subscribers);
          funnelMap.set(date, f);
        }

        const txs = await listCreatorTransactions({
          creatorInflowwId: creatorId,
          startYmd,
          endYmd,
          fetchAll: true,
          revenueOnly: true,
        });
        for (const tx of txs) {
          const date = ymdInAthens(tx.created_time);
          if (!date) continue;
          const f = funnelMap.get(date);
          if (!f) continue;
          f.of_revenue += creatorTxRevenueAmount(tx);
        }
      }
    } catch (err) {
      console.error("[getmysocial] funnel of", err);
    }
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

  const shieldRows = analyticsRes.data ?? [];
  const shield_blocked_count = Math.max(0, ...shieldRows.map((r) => n(r.shield_blocked_count)));
  const shield_blocked_pct = Math.max(0, ...shieldRows.map((r) => n(r.shield_blocked_pct)));

  return {
    modelId: mid,
    modelName: model?.model_name ?? links[0]?.link_label ?? mid,
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
    funnel,
    funnelTotals,
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
    devices: (devicesRes.data ?? []).map((r) => ({
      label: String(r.label),
      count: n(r.count),
    })),
    browsers: (browsersRes.data ?? []).map((r) => ({
      label: String(r.label),
      count: n(r.count),
    })),
  };
}
