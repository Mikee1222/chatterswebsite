/**
 * Lazy per-media ClarioSuite insights (not part of daily sync payload).
 */

import {
  computePostEngagementScore,
  getClarioSuiteAccount,
  getClarioSuiteMediaInsights,
  listClarioSuiteCarouselChildren,
  listClarioSuiteMedia,
  logClarioSuiteFailure,
} from "@/lib/clariosuite-api";
import { classifyIgPost } from "@/lib/instagram-insights-ui";
import type { ClarioSuiteCarouselChild, ClarioSuiteIgProfile } from "@/types/clariosuite";
import {
  getClarioSuiteTopPostByMediaId,
  queryClarioSuiteTopPosts,
} from "@/services/clariosuite-sync";

function n(v: unknown): number | null {
  if (v == null) return null;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

export type ClarioSuiteMediaDetailPayload = {
  media_id: string;
  ig_user_id: string;
  permalink: string | null;
  media_type: string | null;
  media_product_type: string | null;
  group: ReturnType<typeof classifyIgPost>;
  caption: string | null;
  image_url: string | null;
  posted_at: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  views: number | null;
  video_views: number | null;
  total_interactions: number | null;
  engagement_score: number | null;
  quartile_p95: number | null;
  carousel_album_engagement: number | null;
  carousel_album_impressions: number | null;
  carousel_album_reach: number | null;
  carousel_album_saved: number | null;
  /** Slide thumbnails only — ClarioSuite does not expose per-slide performance. */
  children: ClarioSuiteCarouselChild[];
  children_note: string | null;
  source: "live";
};

export async function getClarioSuiteMediaDetail(params: {
  igUserId: string;
  mediaId: string;
  modelRecordId?: string;
}): Promise<ClarioSuiteMediaDetailPayload> {
  const igUserId = params.igUserId.trim();
  const mediaId = params.mediaId.trim();
  if (!igUserId || !mediaId) {
    throw new Error("igUserId and mediaId are required");
  }

  const cached = await getClarioSuiteTopPostByMediaId({
    mediaId,
    igUserId,
    modelRecordId: params.modelRecordId,
  });

  // When opening from the profile grid, the post may not be in top_posts — hydrate from media list.
  let liveMedia: Awaited<ReturnType<typeof listClarioSuiteMedia>>["data"][number] | null = null;
  if (!cached) {
    try {
      const { data: media } = await listClarioSuiteMedia(igUserId, 50);
      liveMedia = media.find((m) => m.id === mediaId) ?? null;
    } catch (err) {
      logClarioSuiteFailure("media list hydrate", err, { igUserId, mediaId });
    }
  }

  const insight = await getClarioSuiteMediaInsights(mediaId);

  let children: ClarioSuiteCarouselChild[] = Array.isArray(insight.children)
    ? insight.children
    : [];
  const productType =
    (cached?.media_product_type != null ? String(cached.media_product_type) : null) ||
    liveMedia?.mediaProductType ||
    null;
  let resolvedType =
    (cached?.media_type != null ? String(cached.media_type) : null) ||
    liveMedia?.mediaType ||
    (children.length ? "CAROUSEL_ALBUM" : null);

  if (resolvedType === "CAROUSEL_ALBUM" && !children.length) {
    try {
      const res = await listClarioSuiteCarouselChildren(igUserId, mediaId);
      if (res.data.length) children = res.data;
    } catch (err) {
      logClarioSuiteFailure("carousel children", err, { igUserId, mediaId });
    }
  }

  const likes = n(insight.likes) ?? n(cached?.likes) ?? n(liveMedia?.likeCount);
  const comments = n(insight.comments) ?? n(cached?.comments) ?? n(liveMedia?.commentsCount);
  const shares = n(insight.shares) ?? n(cached?.shares);
  const saved = n(insight.saved) ?? n(cached?.saved);
  const reach =
    n(insight.reach) ?? n(insight.carouselAlbumReach) ?? n(cached?.reach);
  const views = n(insight.views) ?? n(insight.videoViews) ?? n(cached?.views);
  const engagement =
    computePostEngagementScore({
      likes: likes ?? 0,
      comments: comments ?? 0,
      shares: shares ?? 0,
      saved: saved ?? 0,
      reach: reach ?? 0,
    }) ?? n(cached?.engagement_score);

  return {
    media_id: mediaId,
    ig_user_id: igUserId,
    permalink:
      (cached?.permalink != null ? String(cached.permalink) : null) ||
      liveMedia?.permalink ||
      null,
    media_type: resolvedType,
    media_product_type: productType,
    group: classifyIgPost({
      mediaType: resolvedType,
      mediaProductType: productType,
    }),
    caption:
      (cached?.caption != null ? String(cached.caption) : null) || liveMedia?.caption || null,
    image_url:
      (cached?.image_url != null ? String(cached.image_url) : null) ||
      liveMedia?.imageUrl ||
      children[0]?.mediaUrl ||
      null,
    posted_at:
      (cached?.posted_at != null ? String(cached.posted_at) : null) ||
      liveMedia?.timestamp ||
      null,
    reach,
    likes,
    comments,
    shares,
    saved,
    views,
    video_views: n(insight.videoViews),
    total_interactions: n(insight.totalInteractions),
    engagement_score: engagement,
    quartile_p95: n(insight.quartileP95),
    carousel_album_engagement: n(insight.carouselAlbumEngagement),
    carousel_album_impressions: n(insight.carouselAlbumImpressions),
    carousel_album_reach: n(insight.carouselAlbumReach),
    carousel_album_saved: n(insight.carouselAlbumSaved),
    children,
    children_note: children.length
      ? "Carousel slides include thumbnails only — Instagram does not expose per-slide performance via ClarioSuite."
      : null,
    source: "live",
  };
}

export type ClarioSuiteProfileSimulatorPayload = {
  profile: ClarioSuiteIgProfile;
  highlightsAvailable: false;
  highlightsNote: string;
  posts: Array<{
    media_id: string;
    permalink: string | null;
    media_type: string | null;
    media_product_type: string | null;
    caption: string | null;
    image_url: string | null;
    posted_at: string | null;
    like_count: number | null;
    comments_count: number | null;
    views_count: number | null;
    group: ReturnType<typeof classifyIgPost>;
  }>;
};

export async function getClarioSuiteProfileSimulator(
  igUserId: string
): Promise<ClarioSuiteProfileSimulatorPayload> {
  const profile = await getClarioSuiteAccount(igUserId);
  if (!profile) {
    throw Object.assign(new Error("Instagram account not found in ClarioSuite"), {
      status: 404,
    });
  }
  const [{ data: media }, syncedTopPosts] = await Promise.all([
    listClarioSuiteMedia(igUserId, 30),
    queryClarioSuiteTopPosts({ igUserId, limit: 50 }).catch(() => []),
  ]);
  const viewsByMediaId = new Map(
    syncedTopPosts.map((p) => [p.media_id, p.views > 0 ? p.views : null] as const)
  );
  const posts = media
    .filter((m) => m?.id)
    .map((m) => ({
      media_id: m.id,
      permalink: m.permalink,
      media_type: m.mediaType ?? null,
      media_product_type: m.mediaProductType ?? null,
      caption: m.caption,
      image_url: m.imageUrl || null,
      posted_at: m.timestamp || null,
      like_count: m.likeCount,
      comments_count: m.commentsCount,
      views_count: viewsByMediaId.get(m.id) ?? null,
      group: classifyIgPost({
        mediaType: m.mediaType,
        mediaProductType: m.mediaProductType,
      }),
    }));

  return {
    profile,
    // ClarioSuite GET /accounts does not expose IG verification (see llm.txt IgProfile).
    // isVerified is parsed if the API adds it later; badge is omitted when false/undefined.
    highlightsAvailable: false,
    highlightsNote:
      "Instagram highlights are not available from the ClarioSuite API — omitted from the simulator.",
    posts,
  };
}
