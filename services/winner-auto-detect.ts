/**
 * Auto-detect Winner / Super Winner from already-synced ClarioSuite Instagram posts.
 *
 * Content Flow v1.1 — RELATIVE rule, the only rule, per account (ig_user_id) AND per
 * feed (grid | trial), each feed with its own baseline:
 *   baseline = average views of the latest N (default 9) Reels of that account+feed
 *   every Reel of that feed posted in the last `scan_days` (default 20) is compared to it
 *   ≥ outlier_multiple (2.5×) → Winner · ≥ hot_multiple (10×) → Super Winner
 * There are no absolute view thresholds in the auto-detect any more (owner decision,
 * 2026-10-31): a Winner is defined only relative to the account's own average.
 * Posts younger than 24h are excluded from the BASELINE only (views still accumulating
 * would drag the average down). They are still checked as candidates — a post that
 * blows up in a few hours is caught on the same sync, and re-checked on later syncs.
 *
 * Feed detection (2026-11-02): the ClarioSuite media list DOES include trial reels, but
 * carries no flag for them. A reel is a TRIAL when its link matches a posting-brief post
 * with placement = 'trial' (the Marketing Executive pastes the live link when marking
 * the post as posted). Everything else is GRID. Trial reels never enter the grid
 * baseline and grid reels never enter the trial one. Matched trial posts also get their
 * ClarioSuite views written back to posting_brief_posts, so the Trial Check tab reflects
 * them without manual entry (manual entry stays as the fallback).
 *
 * The multiple is LIVE (owner decision, 2026-11-03): every night, every auto-detected
 * submission still inside the scan window is re-scored against that night's baseline —
 * view_count, outlier_multiple and tier are updated so all cards of an account compare
 * to the same average. A submission that falls below outlier_multiple is withdrawn
 * (deleted) unless it is already in the recreation queue / a bunch — those keep their
 * place and only get the refreshed ×N. Posts older than the window are left as they are.
 */

import { classifyIgPost } from "@/lib/instagram-insights-ui";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  DEFAULT_MODEL_WINNER_THRESHOLDS,
  type WinnerTier,
} from "@/lib/winner-sourcing-helpers";
import {
  cacheWinnerThumbnailFromUrl,
  needsWinnerThumbnailCache,
} from "@/lib/winner-thumbnail-cache";
import {
  createWinnerSubmission,
  deleteWinnerSubmission,
  getWinnerSubmissionDeleteImpact,
  type WinnerSubmission,
} from "@/services/winner-sourcing";
import { getCycleSettings, type ContentCycleSettings } from "@/services/content-cycles";

export const CLARIOSUITE_AUTO_SUBMITTER_ID = "clariosuite_auto";
export const CLARIOSUITE_AUTO_SUBMITTER_NAME = "ClarioSuite Auto-detect";

export type WinnerFeed = "grid" | "trial";

export type WinnerAutoDetectResult = {
  /** true = nothing was written; `wouldClassify` lists what a real run would create. */
  dryRun?: boolean;
  wouldClassify?: Array<{
    model_name: string;
    media_id: string;
    permalink: string;
    feed: WinnerFeed;
    views: number;
    tier: WinnerTier;
    multiple: number | null;
    baseline_avg: number | null;
  }>;
  scanned: number;
  /** Reels recognised as trials via a posting-brief link (placement = trial). */
  trialMatched: number;
  /** Candidates inside the window with no usable views (0 / insights missing). */
  skippedNoViews: number;
  /** Candidates inside the window whose account+feed has fewer than 3 baseline posts. */
  skippedNoBaseline: number;
  /** Existing auto-detected submissions inside the window re-scored against tonight's baseline. */
  rescored: number;
  /** Re-scored submissions that fell below the outlier multiple and were removed. */
  withdrawn: number;
  /** Below the multiple but kept because they are queued / in a bunch (×N refreshed only). */
  keptBelowThreshold: number;
  /** Dry run: what a real run would withdraw. */
  wouldWithdraw?: Array<{ model_name: string; media_id: string; views: number; multiple: number | null }>;
  /** Per account+feed baseline, for diagnostics. */
  baselines: Array<{
    model_name: string;
    ig_user_id: string;
    feed: WinnerFeed;
    baseline_avg: number | null;
    baseline_count: number;
    candidates: number;
  }>;
  classified: number;
  skippedAlreadyClassified: number;
  skippedNotVideo: number;
  skippedBelowThreshold: number;
  /** Reels older than the scan window (not candidates, only part of the baseline). */
  skippedOutsideWindow: number;
  skippedNoPermalink: number;
  skippedDuplicateLink: number;
  errors: Array<{ media_id: string; message: string }>;
  created: WinnerSubmission[];
  /** Existing submissions whose ephemeral IG CDN thumb was re-cached to Storage. */
  thumbnailsCached: number;
};

type TopPostCandidate = {
  ig_user_id: string;
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

/**
 * Instagram shortcode of a post link (`/reel/<code>/`, `/p/<code>/`, `/tv/<code>/`),
 * case preserved — the same post can be linked as /reel/ or /p/ with the same code.
 */
export function instagramShortcode(link: string | null | undefined): string | null {
  const raw = String(link ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

type TrialLinkRef = { post_id: string; brief_id: string };

/**
 * Links of posting-brief posts with placement = 'trial' (the only place we learn that a
 * reel is a trial). Keyed by Instagram shortcode, with the normalized URL as fallback.
 */
async function loadTrialLinkIndex(): Promise<Map<string, TrialLinkRef>> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("posting_brief_posts")
    .select("id, brief_id, posted_url")
    .eq("placement", "trial")
    .not("posted_url", "is", null);
  if (error) throw new Error(`load trial links: ${error.message}`);
  const index = new Map<string, TrialLinkRef>();
  for (const row of data ?? []) {
    const r = row as { id: string; brief_id: string; posted_url: string | null };
    const url = String(r.posted_url ?? "").trim();
    if (!url) continue;
    const ref = { post_id: String(r.id), brief_id: String(r.brief_id) };
    const code = instagramShortcode(url);
    if (code) index.set(`code:${code}`, ref);
    index.set(`url:${normalizePermalink(url)}`, ref);
  }
  return index;
}

function lookupTrial(index: Map<string, TrialLinkRef>, permalink: string | null): TrialLinkRef | null {
  if (!permalink) return null;
  const code = instagramShortcode(permalink);
  if (code) {
    const hit = index.get(`code:${code}`);
    if (hit) return hit;
  }
  return index.get(`url:${normalizePermalink(permalink)}`) ?? null;
}

/**
 * Mirror ClarioSuite views onto the matched trial post so the Trial Check tab shows them
 * without manual entry. Never writes 0 (insights missing → keep whatever is there).
 */
async function writeBackTrialViews(params: {
  postId: string;
  views: number;
  multiple: number | null;
  tier: WinnerTier | null;
  hasBaseline: boolean;
}): Promise<void> {
  if (params.views <= 0) return;
  const sb = getSupabaseServiceClient();
  const status = !params.hasBaseline
    ? ""
    : params.tier === "super_winner"
      ? "hot"
      : params.tier === "winner"
        ? "outlier"
        : "normal";
  const { error } = await sb
    .from("posting_brief_posts")
    .update({
      views_24h: params.views,
      views_checked_at: new Date().toISOString(),
      outlier_multiple: params.multiple,
      outlier_status: status,
    })
    .eq("id", params.postId);
  if (error) throw new Error(`write back trial views: ${error.message}`);
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
      "ig_user_id,media_id,permalink,media_type,media_product_type,caption,image_url,views,video_views,posted_at,model_record_id,model_stable_id,model_name",
    )
    .order("posted_at", { ascending: false, nullsFirst: false });
  if (opts?.modelRecordId) q = q.eq("model_record_id", opts.modelRecordId);
  const { data, error } = await q;
  if (error) throw new Error(`load top posts: ${error.message}`);
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const views = Number(r.views) || 0;
    const videoViews = Number(r.video_views) || 0;
    return {
      ig_user_id: String(r.ig_user_id ?? ""),
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
  /** Report what would be classified without writing anything. */
  dryRun?: boolean;
}): Promise<WinnerAutoDetectResult> {
  const result: WinnerAutoDetectResult = {
    dryRun: opts?.dryRun === true,
    wouldClassify: opts?.dryRun ? [] : undefined,
    scanned: 0,
    trialMatched: 0,
    skippedNoViews: 0,
    skippedNoBaseline: 0,
    rescored: 0,
    withdrawn: 0,
    keptBelowThreshold: 0,
    wouldWithdraw: opts?.dryRun ? [] : undefined,
    baselines: [],
    classified: 0,
    skippedAlreadyClassified: 0,
    skippedNotVideo: 0,
    skippedBelowThreshold: 0,
    skippedOutsideWindow: 0,
    skippedNoPermalink: 0,
    skippedDuplicateLink: 0,
    errors: [],
    created: [],
    thumbnailsCached: 0,
  };

  const [posts, classifiedMedia, existingLinks, trialIndex] = await Promise.all([
    loadTopPostCandidates({ modelRecordId: opts?.modelRecordId }),
    loadAlreadyClassifiedMediaIds(),
    loadExistingVideoLinks(),
    loadTrialLinkIndex(),
  ]);

  result.scanned = posts.length;

  /* ── Feed of every reel: trial when its link is a posting-brief trial post ── */
  const feedOf = (post: TopPostCandidate): WinnerFeed =>
    lookupTrial(trialIndex, post.permalink) ? "trial" : "grid";
  const accountKeyOf = (post: TopPostCandidate) =>
    post.ig_user_id || post.model_record_id || post.model_stable_id || "";
  const baselineKey = (accountKey: string, feed: WinnerFeed) => `${accountKey}::${feed}`;

  /* ── Relative baseline per account + feed: average of the latest N Reels ── */
  const byAccount = new Map<string, TopPostCandidate[]>();
  for (const post of posts) {
    if (!post.media_id || !isVideoCandidate(post)) continue;
    const accountKey = accountKeyOf(post);
    if (!accountKey) continue;
    const feed = feedOf(post);
    if (feed === "trial") result.trialMatched += 1;
    const key = baselineKey(accountKey, feed);
    const list = byAccount.get(key) ?? [];
    list.push(post);
    byAccount.set(key, list);
  }
  const settingsByModel = new Map<string, ContentCycleSettings>();
  async function settingsFor(modelId: string): Promise<ContentCycleSettings> {
    const hit = settingsByModel.get(modelId);
    if (hit) return hit;
    const s = await getCycleSettings(modelId);
    settingsByModel.set(modelId, s);
    return s;
  }
  type Baseline = {
    avg: number | null;
    count: number;
    scanDays: number;
    outlier: number;
    hot: number;
    candidates: number;
  };
  const baselineByAccount = new Map<string, Baseline>();
  const now = Date.now();
  const MATURE_MS = 24 * 60 * 60 * 1000;
  const isMature = (p: TopPostCandidate) =>
    !!p.posted_at && Number.isFinite(Date.parse(p.posted_at)) && now - Date.parse(p.posted_at) >= MATURE_MS;
  for (const [key, list] of byAccount) {
    const modelId = (list[0]?.model_record_id || list[0]?.model_stable_id || "").trim();
    const s = await settingsFor(modelId);
    // Latest N Reels that are at least 24h old (views still accumulating before that).
    const latest = list
      .filter(isMature)
      .sort((a, b) => Date.parse(b.posted_at!) - Date.parse(a.posted_at!))
      .slice(0, Math.max(1, s.baseline_posts));
    const withViews = latest.filter((p) => p.views > 0);
    const avg = withViews.length
      ? withViews.reduce((acc, p) => acc + p.views, 0) / withViews.length
      : null;
    baselineByAccount.set(key, {
      avg,
      count: withViews.length,
      scanDays: s.outlier_scan_days,
      outlier: s.outlier_multiple,
      hot: s.hot_multiple,
      candidates: 0,
    });
  }
  /* ── Live ×N: re-score existing auto-detected submissions against tonight's baseline ── */
  try {
    const postByMedia = new Map<string, TopPostCandidate>();
    for (const post of posts) if (post.media_id) postByMedia.set(post.media_id, post);
    const sb = getSupabaseServiceClient();
    let subQ = sb
      .from("winner_submissions")
      .select("id, model_id, model_name, clariosuite_media_id, view_count, tier, status, outlier_multiple, feed, posted_at")
      .eq("source", "auto_detected")
      .not("clariosuite_media_id", "is", null);
    if (opts?.modelRecordId) subQ = subQ.eq("model_id", opts.modelRecordId);
    const { data: subs, error: subErr } = await subQ;
    if (subErr) throw new Error(`load auto-detected submissions: ${subErr.message}`);
    for (const row of subs ?? []) {
      const r = row as {
        id: string;
        model_id: string;
        model_name: string | null;
        clariosuite_media_id: string;
        view_count: number | null;
        tier: string;
        status: string;
        outlier_multiple: number | null;
        feed: string | null;
        posted_at: string | null;
      };
      const post = postByMedia.get(String(r.clariosuite_media_id));
      if (!post) continue;
      const postedMs = post.posted_at ? Date.parse(post.posted_at) : NaN;
      const feed: WinnerFeed = r.feed === "trial" ? "trial" : feedOf(post);
      const accountKey = accountKeyOf(post);
      const baseline = baselineByAccount.get(baselineKey(accountKey, feed));
      const scanDays = baseline?.scanDays ?? 20;
      if (Number.isFinite(postedMs) && now - postedMs > scanDays * 86_400_000) continue; // outside window: frozen
      const views = Math.round(post.views);
      if (views <= 0) continue; // insights missing tonight — leave as is
      if (!baseline || !baseline.avg || baseline.avg <= 0 || baseline.count < 3) continue;
      const multiple = Math.round((views / baseline.avg) * 100) / 100;
      const tier: WinnerTier | null =
        multiple >= baseline.hot ? "super_winner" : multiple >= baseline.outlier ? "winner" : null;
      result.rescored += 1;
      if (!tier) {
        // Fell below the multiple. Withdraw only when nothing downstream depends on it.
        // Queued / in a bunch = the team already acted on it → keep, only refresh ×N.
        const impact = opts?.dryRun || r.status !== "pending" ? null : await getWinnerSubmissionDeleteImpact(r.id);
        const simple =
          r.status === "pending" &&
          (opts?.dryRun ? true : !!impact && impact.is_simple_delete && impact.recreation_queue_items === 0);
        if (simple) {
          if (opts?.dryRun) {
            result.wouldWithdraw!.push({
              model_name: r.model_name?.trim() || r.model_id,
              media_id: String(r.clariosuite_media_id),
              views,
              multiple,
            });
          } else {
            await deleteWinnerSubmission(r.id);
            classifiedMedia.delete(String(r.clariosuite_media_id));
            if (post.permalink) existingLinks.delete(normalizePermalink(post.permalink));
          }
          result.withdrawn += 1;
          continue;
        }
        result.keptBelowThreshold += 1;
      }
      if (opts?.dryRun) continue;
      const changed =
        Math.round(Number(r.view_count ?? 0)) !== views ||
        Number(r.outlier_multiple ?? -1) !== multiple ||
        (tier && tier !== r.tier) ||
        (r.feed || "") !== feed;
      if (!changed) continue;
      const { error: upErr } = await sb
        .from("winner_submissions")
        .update({
          view_count: views,
          outlier_multiple: multiple,
          feed,
          ...(tier ? { tier } : {}),
        })
        .eq("id", r.id);
      if (upErr) result.errors.push({ media_id: String(r.clariosuite_media_id), message: `rescore: ${upErr.message}` });
    }
  } catch (err) {
    result.errors.push({ media_id: "rescore", message: err instanceof Error ? err.message : String(err) });
  }

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


    const views = Math.round(post.views);
    const feed = feedOf(post);
    const trialRef = feed === "trial" ? lookupTrial(trialIndex, permalink) : null;
    const accountKey = accountKeyOf(post) || modelId;
    const baseline = baselineByAccount.get(baselineKey(accountKey, feed));

    // Relative tier (Content Flow v1.1) — the only rule; only Reels inside the scan
    // window; needs a baseline of at least 3 Reels with views.
    const postedMs = post.posted_at ? Date.parse(post.posted_at) : NaN;
    const scanDays = baseline?.scanDays ?? 20;
    // Candidates: everything inside the scan window, fresh posts included (a blow-up in
    // the first hours must be caught now; unclassified posts are re-checked every sync).
    const insideWindow = !Number.isFinite(postedMs) || now - postedMs <= scanDays * 86_400_000;
    let multiple: number | null = null;
    let relativeTier: WinnerTier | null = null;
    if (!insideWindow) {
      result.skippedOutsideWindow += 1;
      continue;
    }
    if (baseline) baseline.candidates += 1;
    const baselineAvg = baseline && baseline.avg && baseline.avg > 0 && baseline.count >= 3 ? baseline.avg : null;
    const hasBaseline = baselineAvg != null && !!baseline;
    if (baselineAvg != null && baseline) {
      multiple = Math.round((views / baselineAvg) * 100) / 100;
      if (multiple >= baseline.hot) relativeTier = "super_winner";
      else if (multiple >= baseline.outlier) relativeTier = "winner";
    }
    const tier: WinnerTier | null = relativeTier;

    // Trial post from a posting brief: mirror the ClarioSuite views onto it so the
    // Trial Check tab shows them (also when it is not an outlier). Dry runs write nothing.
    if (trialRef && !opts?.dryRun) {
      try {
        await writeBackTrialViews({ postId: trialRef.post_id, views, multiple, tier, hasBaseline });
      } catch (err) {
        result.errors.push({
          media_id: post.media_id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (views <= 0) {
      // ClarioSuite returned no insights for this media (views = 0) — nothing to judge.
      result.skippedNoViews += 1;
      continue;
    }
    if (!hasBaseline) {
      result.skippedNoBaseline += 1;
      continue;
    }
    if (!tier) {
      result.skippedBelowThreshold += 1;
      continue;
    }

    if (opts?.dryRun) {
      result.wouldClassify!.push({
        model_name: post.model_name?.trim() || modelId,
        media_id: post.media_id,
        permalink,
        feed,
        views,
        tier,
        multiple,
        baseline_avg: baseline?.avg ?? null,
      });
      result.classified += 1;
      classifiedMedia.add(post.media_id);
      existingLinks.add(linkKey);
      continue;
    }

    try {
      const ephemeralThumb = (post.image_url ?? "").trim();
      const submission = await createWinnerSubmission({
        model_id: modelId,
        model_name: post.model_name?.trim() || "Creator",
        video_link: permalink,
        view_count: views,
        submitted_by_id: CLARIOSUITE_AUTO_SUBMITTER_ID,
        submitted_by_name: CLARIOSUITE_AUTO_SUBMITTER_NAME,
        source: "auto_detected",
        clariosuite_media_id: post.media_id,
        // Prefer durable Storage cache; fall back to CDN URL until cache succeeds.
        thumbnail_url: ephemeralThumb,
        caption: post.caption ?? "",
        posted_at: post.posted_at,
        // No absolute thresholds: the tier comes from the relative rule (tierOverride).
        thresholds: null,
        tierOverride: tier,
        feed,
        outlier_multiple: multiple,
        posting_brief_post_id: trialRef?.post_id ?? null,
        skipNotify: false,
      });

      if (ephemeralThumb && needsWinnerThumbnailCache(ephemeralThumb)) {
        const cached = await cacheWinnerThumbnailFromUrl({
          sourceUrl: ephemeralThumb,
          submissionId: submission.id,
        });
        if (cached) {
          await updateSubmissionThumbnail(submission.id, cached);
          submission.thumbnail_url = cached;
          result.thumbnailsCached += 1;
        }
      }

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

  for (const [key, b] of baselineByAccount) {
    const [accountKey, feed] = key.split("::") as [string, WinnerFeed];
    const sample = byAccount.get(key)?.[0];
    result.baselines.push({
      model_name: sample?.model_name?.trim() || sample?.model_record_id || accountKey,
      ig_user_id: accountKey,
      feed,
      baseline_avg: b.avg == null ? null : Math.round(b.avg),
      baseline_count: b.count,
      candidates: b.candidates,
    });
  }
  result.baselines.sort((a, b) => a.model_name.localeCompare(b.model_name) || a.feed.localeCompare(b.feed));

  if (opts?.dryRun) return result;

  // After classify: re-cache any existing winners still pointing at expired IG CDN URLs,
  // using freshly-synced clariosuite_top_posts.image_url from this sync cycle.
  try {
    const refreshed = await refreshWinnerThumbnailsFromTopPosts({
      modelRecordId: opts?.modelRecordId,
    });
    result.thumbnailsCached += refreshed.cached;
    for (const err of refreshed.errors) {
      result.errors.push(err);
    }
  } catch (err) {
    result.errors.push({
      media_id: "thumbnail-refresh",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

async function updateSubmissionThumbnail(id: string, thumbnailUrl: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb
    .from("winner_submissions")
    .update({ thumbnail_url: thumbnailUrl })
    .eq("id", id);
  if (error) throw new Error(`update thumbnail: ${error.message}`);
}

/**
 * For winner_submissions still holding ephemeral Instagram CDN URLs (or empty),
 * download the current clariosuite_top_posts.image_url and store an sb:// token.
 * Falls back to a live ClarioSuite media list when the stored CDN URL is already expired.
 */
export async function refreshWinnerThumbnailsFromTopPosts(opts?: {
  modelRecordId?: string;
}): Promise<{
  scanned: number;
  cached: number;
  skipped: number;
  errors: Array<{ media_id: string; message: string }>;
}> {
  const out = { scanned: 0, cached: 0, skipped: 0, errors: [] as Array<{ media_id: string; message: string }> };
  const sb = getSupabaseServiceClient();

  let subQ = sb
    .from("winner_submissions")
    .select("id, thumbnail_url, clariosuite_media_id, model_id")
    .not("clariosuite_media_id", "is", null);
  if (opts?.modelRecordId) subQ = subQ.eq("model_id", opts.modelRecordId);
  const { data: subs, error: subErr } = await subQ;
  if (subErr) throw new Error(`load winner_submissions: ${subErr.message}`);

  const needing = (subs ?? []).filter((row) =>
    needsWinnerThumbnailCache(String((row as { thumbnail_url?: string }).thumbnail_url ?? "")),
  );
  out.scanned = needing.length;
  if (!needing.length) return out;

  const mediaIds = [
    ...new Set(
      needing
        .map((r) => String((r as { clariosuite_media_id?: string }).clariosuite_media_id ?? "").trim())
        .filter(Boolean),
    ),
  ];

  let postQ = sb
    .from("clariosuite_top_posts")
    .select("media_id, image_url, ig_user_id, model_record_id")
    .in("media_id", mediaIds);
  if (opts?.modelRecordId) postQ = postQ.eq("model_record_id", opts.modelRecordId);
  const { data: posts, error: postErr } = await postQ;
  if (postErr) throw new Error(`load top posts for thumbs: ${postErr.message}`);

  const imageByMedia = new Map<string, string>();
  const igUserByMedia = new Map<string, string>();
  for (const row of posts ?? []) {
    const mediaId = String((row as { media_id?: string }).media_id ?? "").trim();
    const imageUrl = String((row as { image_url?: string }).image_url ?? "").trim();
    const igUserId = String((row as { ig_user_id?: string }).ig_user_id ?? "").trim();
    if (mediaId && imageUrl) imageByMedia.set(mediaId, imageUrl);
    if (mediaId && igUserId) igUserByMedia.set(mediaId, igUserId);
  }

  /** Lazily load live media lists per IG account when top_posts CDN URL is dead. */
  const liveImageByMedia = new Map<string, string>();
  const liveLoadedAccounts = new Set<string>();
  const permalinkByMedia = new Map<string, string>();

  // Need permalinks for oEmbed fallback when media drops out of ClarioSuite list.
  {
    const { data: linkRows } = await sb
      .from("winner_submissions")
      .select("clariosuite_media_id, video_link")
      .in("clariosuite_media_id", mediaIds);
    for (const row of linkRows ?? []) {
      const mid = String((row as { clariosuite_media_id?: string }).clariosuite_media_id ?? "").trim();
      const link = String((row as { video_link?: string }).video_link ?? "").trim();
      if (mid && link) permalinkByMedia.set(mid, link);
    }
  }

  async function ensureLiveImage(mediaId: string): Promise<string> {
    const cached = liveImageByMedia.get(mediaId);
    if (cached) return cached;
    const igUserId = igUserByMedia.get(mediaId);
    if (igUserId && !liveLoadedAccounts.has(igUserId)) {
      liveLoadedAccounts.add(igUserId);
      try {
        const { listClarioSuiteMedia } = await import("@/lib/clariosuite-api");
        // Winner reels may be older than the default page — pull a deeper slice.
        const { data } = await listClarioSuiteMedia(igUserId, 250);
        for (const item of data) {
          const id = String(item.id ?? "").trim();
          const url = String(item.imageUrl ?? "").trim();
          if (id && url) liveImageByMedia.set(id, url);
        }
      } catch (err) {
        out.errors.push({
          media_id: mediaId,
          message: `live media list ${igUserId}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
    const fromList = liveImageByMedia.get(mediaId) ?? "";
    if (fromList) return fromList;

    const permalink = permalinkByMedia.get(mediaId) ?? "";
    if (!permalink) return "";
    try {
      const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(permalink)}`;
      const res = await fetch(oembedUrl, {
        headers: { Accept: "application/json", "User-Agent": "GunzoAgencyWinnerThumbCache/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return "";
      const json = (await res.json()) as { thumbnail_url?: string };
      const thumb = String(json.thumbnail_url ?? "").trim();
      if (thumb) {
        liveImageByMedia.set(mediaId, thumb);
        return thumb;
      }
    } catch (err) {
      out.errors.push({
        media_id: mediaId,
        message: `oembed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    return "";
  }

  for (const row of needing) {
    const id = String((row as { id?: string }).id ?? "");
    const mediaId = String((row as { clariosuite_media_id?: string }).clariosuite_media_id ?? "").trim();
    if (!id || !mediaId) {
      out.skipped += 1;
      continue;
    }

    let sourceUrl = imageByMedia.get(mediaId) ?? "";
    try {
      let cached = sourceUrl
        ? await cacheWinnerThumbnailFromUrl({ sourceUrl, submissionId: id })
        : null;

      if (!cached) {
        sourceUrl = await ensureLiveImage(mediaId);
        if (sourceUrl) {
          cached = await cacheWinnerThumbnailFromUrl({ sourceUrl, submissionId: id });
          // Keep top_posts in sync with a fresh signed URL for other surfaces.
          if (cached) {
            await sb
              .from("clariosuite_top_posts")
              .update({ image_url: sourceUrl, updated_at: new Date().toISOString() })
              .eq("media_id", mediaId);
          }
        }
      }

      if (!cached) {
        out.skipped += 1;
        continue;
      }
      await updateSubmissionThumbnail(id, cached);
      out.cached += 1;
    } catch (err) {
      out.errors.push({
        media_id: mediaId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return out;
}

export { DEFAULT_MODEL_WINNER_THRESHOLDS };
