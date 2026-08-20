/**
 * Auto-detect Winner / Super Winner from already-synced ClarioSuite Instagram posts.
 *
 * Classification is one-time permanent per media_id:
 * - Already-classified posts are never re-evaluated (threshold changes are non-retroactive)
 * - Unclassified posts are rechecked each sync as views grow
 */

import { classifyIgPost } from "@/lib/instagram-insights-ui";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  DEFAULT_MODEL_WINNER_THRESHOLDS,
  tierFromViewCount,
  type WinnerTier,
} from "@/lib/winner-sourcing-helpers";
import {
  defaultModelWinnerThresholds,
  listModelWinnerThresholdsMap,
} from "@/services/model-winner-thresholds";
import { createWinnerSubmission, type WinnerSubmission } from "@/services/winner-sourcing";

export const CLARIOSUITE_AUTO_SUBMITTER_ID = "clariosuite_auto";
export const CLARIOSUITE_AUTO_SUBMITTER_NAME = "ClarioSuite Auto-detect";

export type WinnerAutoDetectResult = {
  scanned: number;
  classified: number;
  skippedAlreadyClassified: number;
  skippedNotVideo: number;
  skippedBelowThreshold: number;
  skippedNoPermalink: number;
  skippedDuplicateLink: number;
  errors: Array<{ media_id: string; message: string }>;
  created: WinnerSubmission[];
};

type TopPostCandidate = {
  media_id: string;
  permalink: string | null;
  media_type: string | null;
  media_product_type: string | null;
  caption: string | null;
  image_url: string | null;
  views: number;
  posted_at: string | null;
  model_record_id: string | null;
  model_stable_id: string | null;
  model_name: string | null;
};

function isVideoCandidate(post: TopPostCandidate): boolean {
  const group = classifyIgPost({
    mediaType: post.media_type,
    mediaProductType: post.media_product_type,
  });
  if (group === "reels") return true;
  const type = String(post.media_type ?? "").toUpperCase();
  const product = String(post.media_product_type ?? "").toUpperCase();
  if (product === "REELS") return true;
  if (type === "VIDEO") return true;
  // IMAGE / plain FEED posts without meaningful video views
  return false;
}

function normalizePermalink(link: string): string {
  return link.trim().replace(/\/+$/, "").toLowerCase();
}

async function loadAlreadyClassifiedMediaIds(): Promise<Set<string>> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("winner_submissions")
    .select("clariosuite_media_id")
    .not("clariosuite_media_id", "is", null);
  if (error) throw new Error(`load classified media: ${error.message}`);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const id = String((row as { clariosuite_media_id?: string }).clariosuite_media_id ?? "").trim();
    if (id) set.add(id);
  }
  return set;
}

async function loadExistingVideoLinks(): Promise<Set<string>> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from("winner_submissions").select("video_link");
  if (error) throw new Error(`load video links: ${error.message}`);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const link = String((row as { video_link?: string }).video_link ?? "").trim();
    if (link) set.add(normalizePermalink(link));
  }
  return set;
}

async function loadTopPostCandidates(opts?: {
  modelRecordId?: string;
}): Promise<TopPostCandidate[]> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("clariosuite_top_posts")
    .select(
      "media_id,permalink,media_type,media_product_type,caption,image_url,views,video_views,posted_at,model_record_id,model_stable_id,model_name",
    )
    .order("views", { ascending: false });
  if (opts?.modelRecordId) q = q.eq("model_record_id", opts.modelRecordId);
  const { data, error } = await q;
  if (error) throw new Error(`load top posts: ${error.message}`);
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const views = Number(r.views) || 0;
    const videoViews = Number(r.video_views) || 0;
    return {
      media_id: String(r.media_id ?? ""),
      permalink: r.permalink != null ? String(r.permalink) : null,
      media_type: r.media_type != null ? String(r.media_type) : null,
      media_product_type: r.media_product_type != null ? String(r.media_product_type) : null,
      caption: r.caption != null ? String(r.caption) : null,
      image_url: r.image_url != null ? String(r.image_url) : null,
      views: views > 0 ? views : videoViews,
      posted_at: r.posted_at != null ? String(r.posted_at) : null,
      model_record_id: r.model_record_id != null ? String(r.model_record_id) : null,
      model_stable_id: r.model_stable_id != null ? String(r.model_stable_id) : null,
      model_name: r.model_name != null ? String(r.model_name) : null,
    };
  });
}

/**
 * Scan synced ClarioSuite top posts and create Winner Hub submissions for newly
 * qualifying Reels/videos. Never reclassifies already-classified media.
 */
export async function detectWinnersFromClarioSuitePosts(opts?: {
  modelRecordId?: string;
}): Promise<WinnerAutoDetectResult> {
  const result: WinnerAutoDetectResult = {
    scanned: 0,
    classified: 0,
    skippedAlreadyClassified: 0,
    skippedNotVideo: 0,
    skippedBelowThreshold: 0,
    skippedNoPermalink: 0,
    skippedDuplicateLink: 0,
    errors: [],
    created: [],
  };

  const [posts, classifiedMedia, existingLinks, thresholdsMap] = await Promise.all([
    loadTopPostCandidates({ modelRecordId: opts?.modelRecordId }),
    loadAlreadyClassifiedMediaIds(),
    loadExistingVideoLinks(),
    listModelWinnerThresholdsMap(),
  ]);

  result.scanned = posts.length;

  for (const post of posts) {
    if (!post.media_id) continue;

    if (classifiedMedia.has(post.media_id)) {
      result.skippedAlreadyClassified += 1;
      continue;
    }

    if (!isVideoCandidate(post)) {
      result.skippedNotVideo += 1;
      continue;
    }

    const permalink = (post.permalink ?? "").trim();
    if (!permalink) {
      result.skippedNoPermalink += 1;
      continue;
    }

    const linkKey = normalizePermalink(permalink);
    if (existingLinks.has(linkKey)) {
      result.skippedDuplicateLink += 1;
      continue;
    }

    const modelId = (post.model_record_id || post.model_stable_id || "").trim();
    if (!modelId) continue;

    const thresholds =
      thresholdsMap.get(modelId) ??
      thresholdsMap.get(post.model_stable_id ?? "") ??
      defaultModelWinnerThresholds(modelId);

    const views = Math.round(post.views);
    const tier: WinnerTier | null = tierFromViewCount(views, thresholds);
    if (!tier) {
      result.skippedBelowThreshold += 1;
      continue;
    }

    try {
      const submission = await createWinnerSubmission({
        model_id: modelId,
        model_name: post.model_name?.trim() || "Creator",
        video_link: permalink,
        view_count: views,
        submitted_by_id: CLARIOSUITE_AUTO_SUBMITTER_ID,
        submitted_by_name: CLARIOSUITE_AUTO_SUBMITTER_NAME,
        source: "auto_detected",
        clariosuite_media_id: post.media_id,
        thumbnail_url: post.image_url ?? "",
        caption: post.caption ?? "",
        posted_at: post.posted_at,
        thresholds: {
          winner_threshold_views: thresholds.winner_threshold_views,
          super_winner_threshold_views: thresholds.super_winner_threshold_views,
        },
        skipNotify: false,
      });
      result.classified += 1;
      result.created.push(submission);
      classifiedMedia.add(post.media_id);
      existingLinks.add(linkKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Unique violation = already classified in a race — treat as skip
      if (/duplicate|unique/i.test(message)) {
        result.skippedAlreadyClassified += 1;
        classifiedMedia.add(post.media_id);
        continue;
      }
      result.errors.push({ media_id: post.media_id, message });
    }
  }

  return result;
}

export { DEFAULT_MODEL_WINNER_THRESHOLDS };
