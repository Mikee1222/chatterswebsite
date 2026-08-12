/**
 * Sync ClarioSuite Instagram insights into Supabase for linked models.
 */

import {
  ClarioSuiteApiError,
  computeEngagementRate,
  computePostEngagementScore,
  getClarioSuiteAccountInsights,
  getClarioSuiteAudience,
  getClarioSuiteMediaInsights,
  isClarioSuiteConfigured,
  listClarioSuiteMedia,
  logClarioSuiteFailure,
} from "@/lib/clariosuite-api";
import { publicId } from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  listAllClarioSuiteModelAccounts,
  resolvePrimaryIgUserId,
  type ClarioSuiteModelAccount,
} from "@/services/clariosuite-model-accounts";
import { listAllModelss } from "@/services/modelss";
import type { ClarioSuiteTimeSeriesPoint } from "@/types/clariosuite";
import type { ModelRecord } from "@/types";

const TOP_POSTS_PER_MODEL = 25;
const MEDIA_FETCH_LIMIT = 25;
/** Trailing days to refresh on each daily sync (late Meta updates). */
const DEFAULT_INSIGHTS_RANGE = 14;

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

async function upsertTopPosts(link: SyncLink): Promise<number> {
  const { data: media } = await listClarioSuiteMedia(link.igUserId, MEDIA_FETCH_LIMIT);
  const scored: Array<{
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
    posted_at: string | null;
  }> = [];

  for (const item of media) {
    if (!item?.id) continue;
    try {
      const insight = await getClarioSuiteMediaInsights(item.id);
      const likes = Math.round(insight.likes ?? item.likeCount ?? 0);
      const comments = Math.round(insight.comments ?? item.commentsCount ?? 0);
      const shares = Math.round(insight.shares ?? 0);
      const saved = Math.round(insight.saved ?? 0);
      const reach = Math.round(insight.reach ?? insight.carouselAlbumReach ?? 0);
      const views = Math.round(insight.views ?? insight.videoViews ?? 0);
      const totalInteractions =
        insight.totalInteractions != null && Number.isFinite(insight.totalInteractions)
          ? Math.round(insight.totalInteractions)
          : undefined;
      scored.push({
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
          reach,
          views,
          totalInteractions,
        }),
        reach,
        likes,
        comments,
        shares,
        saved,
        views,
        posted_at: item.timestamp || null,
      });
    } catch (err) {
      logClarioSuiteFailure("upsertTopPosts media insight", err, {
        igUserId: link.igUserId,
        mediaId: item.id,
      });
    }
  }

  scored.sort((a, b) => (b.engagement_score ?? -1) - (a.engagement_score ?? -1));
  const top = scored.slice(0, TOP_POSTS_PER_MODEL);
  const sb = getSupabaseServiceClient();

  // Replace this account's top posts set for a clean leaderboard.
  const { error: delErr } = await sb
    .from("clariosuite_top_posts")
    .delete()
    .eq("ig_user_id", link.igUserId);
  if (delErr) throw new Error(`delete clariosuite_top_posts: ${delErr.message}`);

  if (!top.length) return 0;

  const now = new Date().toISOString();
  const payload = top.map((row, idx) => ({
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
  return payload.length;
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
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("clariosuite_daily_insights")
    .select(
      "date,reach,views,total_interactions,follower_count,engagement_rate,ig_user_id,model_record_id,model_name"
    )
    .gte("date", params.startYmd)
    .lte("date", params.endYmd)
    .order("date", { ascending: true });
  if (params.igUserId) q = q.eq("ig_user_id", params.igUserId);
  if (params.modelRecordId) q = q.eq("model_record_id", params.modelRecordId);
  const { data, error } = await q;
  if (error) throw new Error(`query clariosuite_daily_insights: ${error.message}`);
  return (data ?? []).map((row) => ({
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

export async function getClarioSuiteAudienceSnapshot(params: {
  igUserId?: string;
  modelRecordId?: string;
}): Promise<Record<string, unknown> | null> {
  const sb = getSupabaseServiceClient();
  let q = sb.from("clariosuite_audience_snapshots").select("*").limit(1);
  if (params.igUserId) q = q.eq("ig_user_id", params.igUserId);
  if (params.modelRecordId) q = q.eq("model_record_id", params.modelRecordId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`query clariosuite_audience_snapshots: ${error.message}`);
  return data;
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
    posted_at: string | null;
    rank: number;
  }>
> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("clariosuite_top_posts")
    .select(
      "media_id,permalink,media_type,media_product_type,caption,image_url,engagement_score,reach,likes,comments,shares,saved,views,posted_at,rank"
    )
    .order("rank", { ascending: true })
    .limit(params.limit ?? TOP_POSTS_PER_MODEL);
  if (params.igUserId) q = q.eq("ig_user_id", params.igUserId);
  if (params.modelRecordId) q = q.eq("model_record_id", params.modelRecordId);
  const { data, error } = await q;
  if (error) throw new Error(`query clariosuite_top_posts: ${error.message}`);
  return (data ?? []).map((row) => ({
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
    views: n(row.views),
    posted_at: row.posted_at != null ? String(row.posted_at) : null,
    rank: n(row.rank),
  }));
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
