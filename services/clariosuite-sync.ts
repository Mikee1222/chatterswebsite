/**
 * Sync ClarioSuite Instagram insights into Supabase for linked models.
 */

import {
  ClarioSuiteApiError,
  computeEngagementRate,
  computePostEngagementScore,
  fetchMediaInsights,
  isClarioSuiteConfigured,
  isMediaInsightUnavailable,
  listClarioSuiteMedia,
  logClarioSuiteFailure,
  mediaInsightUnavailableReason,
  getClarioSuiteAccountInsights,
  getClarioSuiteAudience,
} from "@/lib/clariosuite-api";
import { publicId, sbSelectWhere, type SbRow } from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  listAllClarioSuiteModelAccounts,
  resolvePrimaryIgUserId,
  type ClarioSuiteModelAccount,
} from "@/services/clariosuite-model-accounts";
import { listAllModelss } from "@/services/modelss";
import type {
  ClarioSuiteMediaInsight,
  ClarioSuiteMediaItem,
  ClarioSuiteTimeSeriesPoint,
} from "@/types/clariosuite";
import type { ModelRecord } from "@/types";

/**
 * Cap per-account leaderboard size for daily sync + default queries.
 * Weekly Progress / Compare pull up to 50 — keep at least that many ranked rows.
 */
const TOP_POSTS_PER_MODEL = 50;
/** How many recent media items to score via GET /media/:id/insights on daily sync. */
const MEDIA_FETCH_LIMIT = 80;
/** Historical backfill ceiling per IG account (media list + insights). */
const MEDIA_BACKFILL_LIMIT = 2000;
/** Default historical lookback for per-post insights (media list has no 90-day cap). */
export const MEDIA_INSIGHTS_BACKFILL_SINCE_YMD = "2026-01-01";
/** Trailing days to refresh on each daily sync (late Meta updates). Views series is still ~2 weeks from Meta. */
const DEFAULT_INSIGHTS_RANGE = 30;

export type LinkedClarioSuiteAccount = {
  accountId: string;
  igUserId: string;
  label: string;
  isPrimary: boolean;
};

export type LinkedClarioSuiteModel = {
  modelRecordId: string;
  modelStableId: string;
  modelName: string;
  /** @deprecated Use accounts — kept for callers that need a single primary id */
  igUserId: string;
  accounts: LinkedClarioSuiteAccount[];
};

export type ClarioSuiteSyncResult = {
  skipped: boolean;
  skipReason?: string;
  modelsTargeted: number;
  dailyRowsUpserted: number;
  audienceUpserted: number;
  topPostsUpserted: number;
  winnersAutoDetected: number;
  winnerAutoDetectErrors: number;
  errors: Array<{ igUserId: string; modelName?: string; message: string; code?: string }>;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function seriesMap(points: ClarioSuiteTimeSeriesPoint[] | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of points ?? []) {
    if (!p?.date) continue;
    m.set(p.date.slice(0, 10), n(p.value));
  }
  return m;
}

/**
 * Reconstruct absolute follower counts from current followersCount + daily growth deltas.
 * Works backwards from the latest date in the growth series.
 */
function reconstructFollowerCounts(
  growthByDate: Map<string, number>,
  currentFollowers: number | null
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const dates = [...growthByDate.keys()].sort();
  if (!dates.length) return out;
  if (currentFollowers == null || !Number.isFinite(currentFollowers)) {
    for (const d of dates) out.set(d, null);
    return out;
  }
  let cursor = currentFollowers;
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = dates[i]!;
    out.set(d, Math.max(0, Math.round(cursor)));
    const growth = growthByDate.get(d) ?? 0;
    cursor -= growth;
  }
  return out;
}

function dimResults(
  demographics: Array<{ dimension: string; results: Array<{ label: string; value: number }> }>,
  dimension: string
): Array<{ label: string; value: number }> {
  const hit = demographics.find((d) => d.dimension?.toLowerCase() === dimension.toLowerCase());
  return Array.isArray(hit?.results) ? hit.results : [];
}

type SyncLink = LinkedClarioSuiteModel & LinkedClarioSuiteAccount;

function buildModelLinks(
  models: ModelRecord[],
  accountRows: ClarioSuiteModelAccount[]
): LinkedClarioSuiteModel[] {
  const byModel = new Map<string, ClarioSuiteModelAccount[]>();
  for (const a of accountRows) {
    const list = byModel.get(a.model_id) ?? [];
    list.push(a);
    byModel.set(a.model_id, list);
  }

  const out: LinkedClarioSuiteModel[] = [];
  for (const m of models) {
    const rows = byModel.get(m.id) ?? [];
    const accounts: LinkedClarioSuiteAccount[] = rows.map((a) => ({
      accountId: a.id,
      igUserId: a.clariosuite_ig_user_id,
      label: a.account_label,
      isPrimary: a.is_primary,
    }));

    // Legacy fallback when accounts table empty but column set
    if (!accounts.length) {
      const ig = (m.clariosuite_ig_user_id ?? "").trim();
      if (!ig) continue;
      accounts.push({
        accountId: "",
        igUserId: ig,
        label: "Main",
        isPrimary: true,
      });
    }

    const primaryIg = resolvePrimaryIgUserId(m, rows) ?? accounts[0]!.igUserId;
    out.push({
      modelRecordId: m.id,
      modelStableId: m.model_id,
      modelName: m.model_name,
      igUserId: primaryIg,
      accounts,
    });
  }
  return out;
}

function flattenSyncLinks(linked: LinkedClarioSuiteModel[]): SyncLink[] {
  const out: SyncLink[] = [];
  for (const m of linked) {
    for (const a of m.accounts) {
      out.push({ ...m, ...a });
    }
  }
  return out;
}

export async function listLinkedClarioSuiteModels(): Promise<LinkedClarioSuiteModel[]> {
  const [models, accountRows] = await Promise.all([
    listAllModelss(),
    listAllClarioSuiteModelAccounts().catch(() => [] as ClarioSuiteModelAccount[]),
  ]);
  return buildModelLinks(models, accountRows);
}

async function upsertDailyInsights(link: SyncLink, rangeDays: number): Promise<number> {
  const insights = await getClarioSuiteAccountInsights(link.igUserId, rangeDays);
  const reach = seriesMap(insights.series?.reach);
  const views = seriesMap(insights.series?.views);
  const interactions = seriesMap(insights.series?.interactions);
  const growth = seriesMap(insights.series?.followerGrowth);

  let currentFollowers: number | null = null;
  try {
    const audience = await getClarioSuiteAudience(link.igUserId);
    currentFollowers =
      audience.followersCount != null && Number.isFinite(audience.followersCount)
        ? audience.followersCount
        : null;
  } catch (err) {
    logClarioSuiteFailure("upsertDailyInsights audience for followers", err, {
      igUserId: link.igUserId,
    });
  }
  const followerByDate = reconstructFollowerCounts(growth, currentFollowers);

  const dates = new Set<string>([
    ...reach.keys(),
    ...views.keys(),
    ...interactions.keys(),
    ...growth.keys(),
  ]);
  const sorted = [...dates].sort();
  if (!sorted.length) return 0;

  const now = new Date().toISOString();
  const payload = sorted.map((date) => {
    const r = Math.round(reach.get(date) ?? 0);
    const v = Math.round(views.get(date) ?? 0);
    // Interactions series is often empty from Meta/ClarioSuite — do not invent 0% ER.
    const hasInteractions = interactions.has(date);
    const ti = hasInteractions ? Math.round(interactions.get(date) ?? 0) : 0;
    const er = hasInteractions ? computeEngagementRate(ti, r) : null;
    return {
      ig_user_id: link.igUserId,
      clariosuite_model_account_id: link.accountId || null,
      model_record_id: link.modelRecordId,
      model_stable_id: link.modelStableId,
      model_name: link.modelName,
      date,
      reach: r,
      views: v,
      total_interactions: ti,
      follower_count: followerByDate.get(date) ?? null,
      engagement_rate: er,
      synced_at: now,
      updated_at: now,
    };
  });

  const sb = getSupabaseServiceClient();
  const { error, count } = await sb.from("clariosuite_daily_insights").upsert(payload, {
    onConflict: "ig_user_id,date",
    count: "exact",
  });
  if (error) throw new Error(`upsert clariosuite_daily_insights: ${error.message}`);
  return count ?? payload.length;
}

async function upsertAudienceSnapshot(link: SyncLink): Promise<number> {
  const audience = await getClarioSuiteAudience(link.igUserId);
  const demos = Array.isArray(audience.demographics) ? audience.demographics : [];
  const now = new Date().toISOString();
  const payload = {
    ig_user_id: link.igUserId,
    clariosuite_model_account_id: link.accountId || null,
    model_record_id: link.modelRecordId,
    model_stable_id: link.modelStableId,
    model_name: link.modelName,
    followers_count: audience.followersCount,
    age_ranges: dimResults(demos, "age"),
    countries: dimResults(demos, "country"),
    gender_split: dimResults(demos, "gender"),
    cities: dimResults(demos, "city"),
    locales: dimResults(demos, "locale"),
    online_followers_by_hour: Array.isArray(audience.onlineFollowers)
      ? audience.onlineFollowers
      : [],
    synced_at: now,
    updated_at: now,
  };
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from("clariosuite_audience_snapshots").upsert(payload, {
    onConflict: "ig_user_id",
  });
  if (error) throw new Error(`upsert clariosuite_audience_snapshots: ${error.message}`);
  return 1;
}

type ScoredTopPost = {
  media_id: string;
  permalink: string | null;
  media_type: string | null;
  media_product_type: string | null;
  caption: string | null;
  image_url: string | null;
  engagement_score: number | null;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  views: number;
  total_interactions: number;
  video_views: number;
  quartile_p95: number | null;
  carousel_album_engagement: number | null;
  carousel_album_impressions: number | null;
  carousel_album_reach: number | null;
  carousel_album_saved: number | null;
  insights_available: boolean;
  insights_error: string | null;
  posted_at: string | null;
};

function compareScoredTopPosts(a: ScoredTopPost, b: ScoredTopPost): number {
  const scoreDiff = (b.engagement_score ?? -1) - (a.engagement_score ?? -1);
  if (scoreDiff !== 0) return scoreDiff;
  const viewsDiff = b.views - a.views;
  if (viewsDiff !== 0) return viewsDiff;
  return b.likes + b.comments - (a.likes + a.comments);
}

function scoreMediaWithInsight(
  item: ClarioSuiteMediaItem,
  insight: ClarioSuiteMediaInsight
): ScoredTopPost {
  const unavailable = isMediaInsightUnavailable(insight);
  const insightsError = unavailable ? mediaInsightUnavailableReason(insight) : null;
  const likes = Math.round(insight.likes ?? item.likeCount ?? 0);
  const comments = Math.round(insight.comments ?? item.commentsCount ?? 0);
  const shares = Math.round(insight.shares ?? 0);
  const saved = Math.round(insight.saved ?? 0);
  const reachRaw = Math.round(insight.reach ?? insight.carouselAlbumReach ?? 0);
  const videoViews = Math.round(insight.videoViews ?? 0);
  const views = Math.round(insight.views ?? (videoViews > 0 ? videoViews : 0));
  // REELS often omit reach from Meta; views/plays are the usable proxy at sync time.
  const reach = reachRaw > 0 ? reachRaw : views;
  const totalInteractions =
    insight.totalInteractions != null && Number.isFinite(insight.totalInteractions)
      ? Math.round(insight.totalInteractions)
      : likes + comments + shares + saved;
  const insightsAvailable =
    !unavailable &&
    (reachRaw > 0 ||
      views > 0 ||
      videoViews > 0 ||
      (insight.likes != null && Number.isFinite(insight.likes)) ||
      (insight.totalInteractions != null && Number.isFinite(insight.totalInteractions)));

  return {
    media_id: item.id,
    permalink: item.permalink,
    media_type: item.mediaType ?? null,
    media_product_type: item.mediaProductType ?? null,
    caption: item.caption,
    image_url: item.imageUrl || null,
    engagement_score: computePostEngagementScore({
      likes,
      comments,
      shares,
      saved,
      reach: reachRaw > 0 ? reachRaw : 0,
      views: views > 0 ? views : undefined,
      totalInteractions: totalInteractions > 0 ? totalInteractions : undefined,
    }),
    reach,
    likes,
    comments,
    shares,
    saved,
    views,
    total_interactions: totalInteractions,
    video_views: videoViews,
    quartile_p95:
      insight.quartileP95 != null && Number.isFinite(insight.quartileP95)
        ? insight.quartileP95
        : null,
    carousel_album_engagement:
      insight.carouselAlbumEngagement != null && Number.isFinite(insight.carouselAlbumEngagement)
        ? Math.round(insight.carouselAlbumEngagement)
        : null,
    carousel_album_impressions:
      insight.carouselAlbumImpressions != null && Number.isFinite(insight.carouselAlbumImpressions)
        ? Math.round(insight.carouselAlbumImpressions)
        : null,
    carousel_album_reach:
      insight.carouselAlbumReach != null && Number.isFinite(insight.carouselAlbumReach)
        ? Math.round(insight.carouselAlbumReach)
        : null,
    carousel_album_saved:
      insight.carouselAlbumSaved != null && Number.isFinite(insight.carouselAlbumSaved)
        ? Math.round(insight.carouselAlbumSaved)
        : null,
    insights_available: insightsAvailable,
    insights_error: insightsError,
    posted_at: item.timestamp || null,
  };
}

function scoreMediaFallback(item: ClarioSuiteMediaItem, err: unknown): ScoredTopPost {
  const likes = Math.round(item.likeCount ?? 0);
  const comments = Math.round(item.commentsCount ?? 0);
  return {
    media_id: item.id,
    permalink: item.permalink,
    media_type: item.mediaType ?? null,
    media_product_type: item.mediaProductType ?? null,
    caption: item.caption,
    image_url: item.imageUrl || null,
    engagement_score: null,
    reach: 0,
    likes,
    comments,
    shares: 0,
    saved: 0,
    views: 0,
    total_interactions: likes + comments,
    video_views: 0,
    quartile_p95: null,
    carousel_album_engagement: null,
    carousel_album_impressions: null,
    carousel_album_reach: null,
    carousel_album_saved: null,
    insights_available: false,
    insights_error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    posted_at: item.timestamp || null,
  };
}

async function fetchAndScoreMediaItem(
  link: SyncLink,
  item: ClarioSuiteMediaItem,
  logContext: string
): Promise<ScoredTopPost> {
  try {
    const insight = await fetchMediaInsights(item.id);
    return scoreMediaWithInsight(item, insight);
  } catch (err) {
    logClarioSuiteFailure(logContext, err, {
      igUserId: link.igUserId,
      mediaId: item.id,
    });
    return scoreMediaFallback(item, err);
  }
}

async function upsertScoredTopPosts(
  link: SyncLink,
  scored: ScoredTopPost[],
  opts?: { keepLimit?: number; reRankAccount?: boolean }
): Promise<number> {
  if (!scored.length) return 0;
  const keepLimit = opts?.keepLimit ?? TOP_POSTS_PER_MODEL;
  const ranked = [...scored].sort(compareScoredTopPosts).slice(0, keepLimit);
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const payload = ranked.map((row, idx) => ({
    ig_user_id: link.igUserId,
    clariosuite_model_account_id: link.accountId || null,
    model_record_id: link.modelRecordId,
    model_stable_id: link.modelStableId,
    model_name: link.modelName,
    ...row,
    rank: idx + 1,
    synced_at: now,
    updated_at: now,
  }));

  const { error } = await sb.from("clariosuite_top_posts").upsert(payload, {
    onConflict: "ig_user_id,media_id",
  });
  if (error) throw new Error(`upsert clariosuite_top_posts: ${error.message}`);

  if (opts?.reRankAccount) {
    await reRankTopPostsForAccount(link.igUserId);
  }
  return payload.length;
}

/** Recompute rank 1..N by engagement_score for one IG account (preserves historical rows). */
async function reRankTopPostsForAccount(igUserId: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("clariosuite_top_posts")
    .select("id,engagement_score,views,likes,comments")
    .eq("ig_user_id", igUserId);
  if (error) throw new Error(`reRank top posts select: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: string;
    engagement_score: number | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
  }>;
  rows.sort((a, b) => {
    const scoreDiff = (Number(b.engagement_score) || -1) - (Number(a.engagement_score) || -1);
    if (scoreDiff !== 0) return scoreDiff;
    const viewsDiff = (Number(b.views) || 0) - (Number(a.views) || 0);
    if (viewsDiff !== 0) return viewsDiff;
    return (Number(b.likes) || 0) + (Number(b.comments) || 0) - ((Number(a.likes) || 0) + (Number(a.comments) || 0));
  });
  const now = new Date().toISOString();
  const chunkSize = 40;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((row, offset) =>
        sb
          .from("clariosuite_top_posts")
          .update({ rank: i + offset + 1, updated_at: now })
          .eq("id", row.id)
          .then(({ error: upErr }) => {
            if (upErr) throw new Error(`reRank top posts update: ${upErr.message}`);
          })
      )
    );
  }
}

async function upsertTopPosts(link: SyncLink): Promise<number> {
  const { data: media } = await listClarioSuiteMedia(link.igUserId, MEDIA_FETCH_LIMIT);
  const scored: ScoredTopPost[] = [];
  for (const item of media) {
    if (!item?.id) continue;
    scored.push(await fetchAndScoreMediaItem(link, item, "upsertTopPosts media insight"));
  }

  // Upsert all scored recent media — do not wipe historical backfill rows.
  return upsertScoredTopPosts(link, scored, {
    keepLimit: scored.length,
    reRankAccount: true,
  });
}

export type MediaInsightsResyncResult = {
  skipped: boolean;
  skipReason?: string;
  sinceYmd: string;
  accountsTargeted: number;
  mediaListed: number;
  insightsFetched: number;
  upserted: number;
  availableTrue: number;
  availableFalse: number;
  errors: Array<{ igUserId: string; modelName?: string; mediaId?: string; message: string }>;
};

/**
 * Full historical per-post insights resync for all linked models / multi-IG accounts.
 * Media list + GET /media/:id/insights are not bound to the ~90-day daily insights window.
 * Order: retry failed/unavailable rows first, then recent→older backfill since `sinceYmd`.
 */
export async function resyncClarioSuiteMediaInsights(opts?: {
  sinceYmd?: string;
  modelRecordId?: string;
  mediaLimitPerAccount?: number;
}): Promise<MediaInsightsResyncResult> {
  const sinceYmd = opts?.sinceYmd ?? MEDIA_INSIGHTS_BACKFILL_SINCE_YMD;
  const mediaLimit = opts?.mediaLimitPerAccount ?? MEDIA_BACKFILL_LIMIT;

  if (!isClarioSuiteConfigured()) {
    return {
      skipped: true,
      skipReason: "CLARIOSUITE_API_KEY not configured",
      sinceYmd,
      accountsTargeted: 0,
      mediaListed: 0,
      insightsFetched: 0,
      upserted: 0,
      availableTrue: 0,
      availableFalse: 0,
      errors: [],
    };
  }

  let linked = await listLinkedClarioSuiteModels();
  if (opts?.modelRecordId) {
    linked = linked.filter((l) => l.modelRecordId === opts.modelRecordId);
  }
  const syncLinks = flattenSyncLinks(linked);
  const result: MediaInsightsResyncResult = {
    skipped: false,
    sinceYmd,
    accountsTargeted: syncLinks.length,
    mediaListed: 0,
    insightsFetched: 0,
    upserted: 0,
    availableTrue: 0,
    availableFalse: 0,
    errors: [],
  };

  const sb = getSupabaseServiceClient();

  for (const link of syncLinks) {
    try {
      const { data: failedRows, error: failedErr } = await sb
        .from("clariosuite_top_posts")
        .select("media_id,posted_at,insights_available,insights_error")
        .eq("ig_user_id", link.igUserId)
        .or("insights_available.eq.false,insights_error.not.is.null");
      if (failedErr) throw new Error(`load failed insights rows: ${failedErr.message}`);

      const { data: media } = await listClarioSuiteMedia(link.igUserId, mediaLimit, {
        sinceYmd,
      });
      result.mediaListed += media.length;

      const byId = new Map<string, ClarioSuiteMediaItem>();
      for (const item of media) {
        if (item?.id) byId.set(item.id, item);
      }

      // Failed DB rows first (even if no longer in the media page — still retry when listed).
      const failedIds: string[] = [];
      const failedSeen = new Set<string>();
      for (const row of failedRows ?? []) {
        const mid = String((row as { media_id?: string }).media_id ?? "");
        if (!mid || failedSeen.has(mid) || !byId.has(mid)) continue;
        failedSeen.add(mid);
        failedIds.push(mid);
      }

      const rest = media
        .filter((m) => m?.id && !failedSeen.has(m.id))
        .sort((a, b) => {
          const ta = Date.parse(a.timestamp || "") || 0;
          const tb = Date.parse(b.timestamp || "") || 0;
          return tb - ta; // recent first
        });

      const orderedIds = [...failedIds, ...rest.map((m) => m.id)];
      const scored: ScoredTopPost[] = [];

      for (const mediaId of orderedIds) {
        const item = byId.get(mediaId);
        if (!item) continue;
        const row = await fetchAndScoreMediaItem(
          link,
          item,
          "resync media insight"
        );
        result.insightsFetched += 1;
        if (row.insights_available) result.availableTrue += 1;
        else {
          result.availableFalse += 1;
          if (row.insights_error) {
            result.errors.push({
              igUserId: link.igUserId,
              modelName: link.modelName,
              mediaId,
              message: row.insights_error,
            });
          }
        }
        scored.push(row);
      }

      // Store all scored historical posts (not just top 50).
      result.upserted += await upsertScoredTopPosts(link, scored, {
        keepLimit: scored.length,
        reRankAccount: true,
      });
    } catch (err) {
      logClarioSuiteFailure("resync media insights account", err, {
        igUserId: link.igUserId,
      });
      result.errors.push({
        igUserId: link.igUserId,
        modelName: link.modelName,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Sync all models with `clariosuite_ig_user_id` set.
 * No-ops gracefully when CLARIOSUITE_API_KEY is missing.
 */
export async function syncClarioSuiteInsights(opts?: {
  rangeDays?: number;
  modelRecordId?: string;
}): Promise<ClarioSuiteSyncResult> {
  if (!isClarioSuiteConfigured()) {
    return {
      skipped: true,
      skipReason: "CLARIOSUITE_API_KEY not configured",
      modelsTargeted: 0,
      dailyRowsUpserted: 0,
      audienceUpserted: 0,
      topPostsUpserted: 0,
      winnersAutoDetected: 0,
      winnerAutoDetectErrors: 0,
      errors: [],
    };
  }

  const rangeDays = opts?.rangeDays ?? DEFAULT_INSIGHTS_RANGE;
  let linked = await listLinkedClarioSuiteModels();
  if (opts?.modelRecordId) {
    linked = linked.filter((l) => l.modelRecordId === opts.modelRecordId);
  }
  const syncLinks = flattenSyncLinks(linked);

  const result: ClarioSuiteSyncResult = {
    skipped: false,
    modelsTargeted: syncLinks.length,
    dailyRowsUpserted: 0,
    audienceUpserted: 0,
    topPostsUpserted: 0,
    winnersAutoDetected: 0,
    winnerAutoDetectErrors: 0,
    errors: [],
  };

  for (const link of syncLinks) {
    try {
      result.dailyRowsUpserted += await upsertDailyInsights(link, rangeDays);
    } catch (err) {
      logClarioSuiteFailure("sync daily insights", err, { igUserId: link.igUserId });
      result.errors.push({
        igUserId: link.igUserId,
        modelName: link.modelName,
        message: err instanceof Error ? err.message : String(err),
        code: err instanceof ClarioSuiteApiError ? err.code : undefined,
      });
    }

    try {
      result.audienceUpserted += await upsertAudienceSnapshot(link);
    } catch (err) {
      logClarioSuiteFailure("sync audience", err, { igUserId: link.igUserId });
      result.errors.push({
        igUserId: link.igUserId,
        modelName: link.modelName,
        message: err instanceof Error ? err.message : String(err),
        code: err instanceof ClarioSuiteApiError ? err.code : undefined,
      });
    }

    try {
      result.topPostsUpserted += await upsertTopPosts(link);
    } catch (err) {
      logClarioSuiteFailure("sync top posts", err, { igUserId: link.igUserId });
      result.errors.push({
        igUserId: link.igUserId,
        modelName: link.modelName,
        message: err instanceof Error ? err.message : String(err),
        code: err instanceof ClarioSuiteApiError ? err.code : undefined,
      });
    }
  }

  // After insights + top posts: classify newly qualifying Reels into Winner Videos Hub.
  // Threshold changes are non-retroactive — already-classified media_ids are skipped.
  try {
    const { detectWinnersFromClarioSuitePosts } = await import(
      "@/services/winner-auto-detect"
    );
    const detect = await detectWinnersFromClarioSuitePosts({
      modelRecordId: opts?.modelRecordId,
    });
    result.winnersAutoDetected = detect.classified;
    result.winnerAutoDetectErrors = detect.errors.length;
    for (const err of detect.errors) {
      result.errors.push({
        igUserId: "auto-detect",
        message: `${err.media_id}: ${err.message}`,
      });
    }
  } catch (err) {
    logClarioSuiteFailure("winner auto-detect", err, {});
    result.errors.push({
      igUserId: "auto-detect",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

export async function queryClarioSuiteDailyInsights(params: {
  igUserId?: string;
  modelRecordId?: string;
  startYmd: string;
  endYmd: string;
}): Promise<
  Array<{
    date: string;
    reach: number;
    views: number;
    total_interactions: number;
    follower_count: number | null;
    engagement_rate: number | null;
    ig_user_id: string;
    model_record_id: string | null;
    model_name: string | null;
  }>
> {
  type DailyRow = SbRow & {
    date: string;
    reach: unknown;
    views: unknown;
    total_interactions: unknown;
    follower_count: unknown;
    engagement_rate: unknown;
    ig_user_id: string;
    model_record_id: string | null;
    model_name: string | null;
  };
  const rows = await sbSelectWhere<DailyRow>(
    "clariosuite_daily_insights",
    (q) => {
      let next = q
        .gte("date", params.startYmd)
        .lte("date", params.endYmd)
        .order("date", { ascending: true })
        .order("ig_user_id", { ascending: true });
      if (params.igUserId) next = next.eq("ig_user_id", params.igUserId);
      if (params.modelRecordId) next = next.eq("model_record_id", params.modelRecordId);
      return next;
    },
    "date,reach,views,total_interactions,follower_count,engagement_rate,ig_user_id,model_record_id,model_name,id"
  );
  return rows.map((row) => ({
    date: String(row.date).slice(0, 10),
    reach: n(row.reach),
    views: n(row.views),
    total_interactions: n(row.total_interactions),
    follower_count: row.follower_count == null ? null : n(row.follower_count),
    engagement_rate: row.engagement_rate == null ? null : n(row.engagement_rate),
    ig_user_id: String(row.ig_user_id),
    model_record_id: row.model_record_id != null ? String(row.model_record_id) : null,
    model_name: row.model_name != null ? String(row.model_name) : null,
  }));
}

/**
 * Period `totals.views` from ClarioSuite (trailing N days). Daily `series.views` only
 * covers ~2 weeks, so summing stored daily views under/over-states the dashboard card.
 */
export async function fetchClarioSuitePeriodViewsByAccount(
  igUserIds: string[],
  rangeDays: number
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!isClarioSuiteConfigured()) return out;
  const unique = [...new Set(igUserIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return out;
  const results = await Promise.allSettled(
    unique.map(async (id) => {
      const insights = await getClarioSuiteAccountInsights(id, rangeDays);
      return { id, insights };
    })
  );
  for (const result of results) {
    if (result.status !== "fulfilled") {
      logClarioSuiteFailure("fetchClarioSuitePeriodViewsByAccount", result.reason, {});
      continue;
    }
    const raw = result.value.insights.totals?.views;
    const v = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(v) && v > 0) out.set(result.value.id, Math.round(v));
  }
  return out;
}

export function sumClarioSuitePeriodViews(
  byAccount: Map<string, number>,
  igUserIds: string[]
): number | null {
  let views = 0;
  let any = false;
  for (const id of igUserIds) {
    const v = byAccount.get(id);
    if (v != null && v > 0) {
      views += v;
      any = true;
    }
  }
  return any ? views : null;
}

export async function fetchClarioSuitePeriodViewTotals(
  igUserIds: string[],
  rangeDays: number
): Promise<number | null> {
  const byAccount = await fetchClarioSuitePeriodViewsByAccount(igUserIds, rangeDays);
  return sumClarioSuitePeriodViews(byAccount, igUserIds);
}

export async function queryClarioSuiteAudienceSnapshots(params: {
  igUserId?: string;
  modelRecordId?: string;
}): Promise<Array<Record<string, unknown>>> {
  type SnapRow = SbRow & Record<string, unknown>;
  return sbSelectWhere<SnapRow>("clariosuite_audience_snapshots", (q) => {
    let next = q.order("synced_at", { ascending: false });
    if (params.igUserId) next = next.eq("ig_user_id", params.igUserId);
    if (params.modelRecordId) next = next.eq("model_record_id", params.modelRecordId);
    return next;
  });
}

export function sumAudienceFollowers(rows: Array<Record<string, unknown>>): number | null {
  if (!rows.length) return null;
  let sum = 0;
  let any = false;
  for (const row of rows) {
    const raw = row.followers_count;
    const v = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(v) && v > 0) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : null;
}

export async function getClarioSuiteAudienceSnapshot(params: {
  igUserId?: string;
  modelRecordId?: string;
}): Promise<Record<string, unknown> | null> {
  const rows = await queryClarioSuiteAudienceSnapshots(params);
  return rows[0] ?? null;
}

export async function queryClarioSuiteTopPosts(params: {
  igUserId?: string;
  modelRecordId?: string;
  limit?: number;
}): Promise<
  Array<{
    media_id: string;
    permalink: string | null;
    media_type: string | null;
    media_product_type: string | null;
    caption: string | null;
    image_url: string | null;
    engagement_score: number | null;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saved: number;
    views: number;
    total_interactions: number;
    video_views: number;
    quartile_p95: number | null;
    carousel_album_engagement: number | null;
    carousel_album_impressions: number | null;
    carousel_album_reach: number | null;
    carousel_album_saved: number | null;
    insights_available: boolean;
    insights_error: string | null;
    posted_at: string | null;
    rank: number;
  }>
> {
  type PostRow = SbRow & Record<string, unknown>;
  const rows = await sbSelectWhere<PostRow>(
    "clariosuite_top_posts",
    (q) => {
      let next = q.order("engagement_score", { ascending: false });
      if (params.igUserId) next = next.eq("ig_user_id", params.igUserId);
      if (params.modelRecordId) next = next.eq("model_record_id", params.modelRecordId);
      return next;
    },
    "id,media_id,permalink,media_type,media_product_type,caption,image_url,engagement_score,reach,likes,comments,shares,saved,views,total_interactions,video_views,quartile_p95,carousel_album_engagement,carousel_album_impressions,carousel_album_reach,carousel_album_saved,insights_available,insights_error,posted_at,rank"
  );
  const limit = params.limit ?? TOP_POSTS_PER_MODEL;
  return rows.slice(0, limit).map((row) => ({
    media_id: String(row.media_id),
    permalink: row.permalink != null ? String(row.permalink) : null,
    media_type: row.media_type != null ? String(row.media_type) : null,
    media_product_type: row.media_product_type != null ? String(row.media_product_type) : null,
    caption: row.caption != null ? String(row.caption) : null,
    image_url: row.image_url != null ? String(row.image_url) : null,
    engagement_score: row.engagement_score == null ? null : n(row.engagement_score),
    reach: n(row.reach),
    likes: n(row.likes),
    comments: n(row.comments),
    shares: n(row.shares),
    saved: n(row.saved),
    views: n(row.views) > 0 ? n(row.views) : n(row.video_views),
    total_interactions: n(row.total_interactions),
    video_views: n(row.video_views),
    quartile_p95: row.quartile_p95 == null ? null : n(row.quartile_p95),
    carousel_album_engagement:
      row.carousel_album_engagement == null ? null : n(row.carousel_album_engagement),
    carousel_album_impressions:
      row.carousel_album_impressions == null ? null : n(row.carousel_album_impressions),
    carousel_album_reach: row.carousel_album_reach == null ? null : n(row.carousel_album_reach),
    carousel_album_saved: row.carousel_album_saved == null ? null : n(row.carousel_album_saved),
    insights_available: Boolean(row.insights_available),
    insights_error: row.insights_error != null ? String(row.insights_error) : null,
    posted_at: row.posted_at != null ? String(row.posted_at) : null,
    rank: n(row.rank),
  }));
}

export type ClarioSuiteTopPostRow = Awaited<ReturnType<typeof queryClarioSuiteTopPosts>>[number];

/** Fetch top posts for many models in one query (avoids per-account round trips). */
export async function queryClarioSuiteTopPostsForModels(params: {
  modelRecordIds: string[];
  limitPerModel?: number;
}): Promise<Map<string, ClarioSuiteTopPostRow[]>> {
  const out = new Map<string, ClarioSuiteTopPostRow[]>();
  const ids = [...new Set(params.modelRecordIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return out;
  for (const id of ids) out.set(id, []);

  type PostRow = SbRow & Record<string, unknown>;
  const rows = await sbSelectWhere<PostRow>(
    "clariosuite_top_posts",
    (q) => q.in("model_record_id", ids).order("engagement_score", { ascending: false }),
    "id,media_id,permalink,media_type,media_product_type,caption,image_url,engagement_score,reach,likes,comments,shares,saved,views,total_interactions,video_views,quartile_p95,carousel_album_engagement,carousel_album_impressions,carousel_album_reach,carousel_album_saved,insights_available,insights_error,posted_at,rank,model_record_id"
  );

  const limitPerModel = params.limitPerModel ?? TOP_POSTS_PER_MODEL;
  const grouped = new Map<string, PostRow[]>();
  for (const row of rows) {
    const modelId = row.model_record_id != null ? String(row.model_record_id) : "";
    if (!modelId || !out.has(modelId)) continue;
    const list = grouped.get(modelId) ?? [];
    list.push(row);
    grouped.set(modelId, list);
  }

  for (const [modelId, modelRows] of grouped) {
    out.set(
      modelId,
      modelRows.slice(0, limitPerModel).map((row) => ({
        media_id: String(row.media_id),
        permalink: row.permalink != null ? String(row.permalink) : null,
        media_type: row.media_type != null ? String(row.media_type) : null,
        media_product_type:
          row.media_product_type != null ? String(row.media_product_type) : null,
        caption: row.caption != null ? String(row.caption) : null,
        image_url: row.image_url != null ? String(row.image_url) : null,
        engagement_score:
          row.engagement_score == null ? null : n(row.engagement_score),
        reach: n(row.reach),
        likes: n(row.likes),
        comments: n(row.comments),
        shares: n(row.shares),
        saved: n(row.saved),
        views: n(row.views) > 0 ? n(row.views) : n(row.video_views),
        total_interactions: n(row.total_interactions),
        video_views: n(row.video_views),
        quartile_p95: row.quartile_p95 == null ? null : n(row.quartile_p95),
        carousel_album_engagement:
          row.carousel_album_engagement == null ? null : n(row.carousel_album_engagement),
        carousel_album_impressions:
          row.carousel_album_impressions == null ? null : n(row.carousel_album_impressions),
        carousel_album_reach:
          row.carousel_album_reach == null ? null : n(row.carousel_album_reach),
        carousel_album_saved:
          row.carousel_album_saved == null ? null : n(row.carousel_album_saved),
        insights_available: Boolean(row.insights_available),
        insights_error: row.insights_error != null ? String(row.insights_error) : null,
        posted_at: row.posted_at != null ? String(row.posted_at) : null,
        rank: n(row.rank),
      }))
    );
  }

  return out;
}

/** Look up a cached top-post row (for detail enrichment / auth scoping). */
export async function getClarioSuiteTopPostByMediaId(params: {
  mediaId: string;
  igUserId?: string;
  modelRecordId?: string;
}): Promise<Record<string, unknown> | null> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("clariosuite_top_posts")
    .select("*")
    .eq("media_id", params.mediaId.trim())
    .limit(1);
  if (params.igUserId) q = q.eq("ig_user_id", params.igUserId);
  if (params.modelRecordId) q = q.eq("model_record_id", params.modelRecordId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`query clariosuite_top_posts by media: ${error.message}`);
  return data;
}

/** Resolve linked IG id for a model record (public id). */
export function modelClarioSuiteIgUserId(model: ModelRecord | null | undefined): string | null {
  const id = model?.clariosuite_ig_user_id?.trim();
  return id || null;
}

export { publicId };
