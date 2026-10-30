/**
 * Trial check — Content Flow v1.1.
 *
 * Instagram exposes no API for trial reels (listing or insights), so the
 * Account Supervisor types the views from the Instagram app, in batch, every
 * ~3 days. The grid is handled automatically by the ClarioSuite auto-detect
 * (services/winner-auto-detect.ts) with the same rule.
 *
 * Rule, per model + account + feed=trial (posts younger than 24h are excluded from
 * both the baseline and the check — views are still accumulating):
 *   baseline = average views of the latest N (default 9) trial posts that have views
 *   every trial post of the last `scan_days` (default 20) is compared to it
 *   ≥ outlier_multiple → Winner, ≥ hot_multiple → Super Winner
 * Outliers become a winner_submission (source posted_24h) + a recreation-queue
 * item (lane urgent when hot) — once per post.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import { listUsersWithPermission } from "@/services/users";
import { getCycleSettings } from "@/services/content-cycles";
import { addSubmissionToRecreationQueue, createWinnerSubmission } from "@/services/winner-sourcing";
import { getModelById } from "@/services/modelss";
import { MAX_RECREATION_GENERATION } from "@/lib/winner-sourcing-helpers";
import type { PostOutlierStatus } from "@/services/posting-briefs";

export type TrialCheckPost = {
  post_id: string;
  brief_id: string;
  brief_title: string;
  model_id: string;
  account_handle: string;
  position: number;
  video_name: string;
  content_source: string;
  posted_url: string | null;
  posted_at: string;
  views_24h: number | null;
  views_checked_at: string | null;
  outlier_multiple: number | null;
  outlier_status: PostOutlierStatus;
};

export type TrialCheckAccount = {
  model_id: string;
  model_name: string;
  account_handle: string;
  baseline_avg: number | null;
  baseline_count: number;
  baseline_posts: number;
  scan_days: number;
  outlier_multiple: number;
  hot_multiple: number;
  last_checked_at: string | null;
  /** Trial posts without views, inside the scan window. */
  pending: number;
  posts: TrialCheckPost[];
};

type Row = {
  post: TrialCheckPost;
};

function num(v: unknown): number | null {
  return v == null ? null : Number(v);
}

async function loadTrialPosts(params: {
  modelId?: string;
  sinceIso?: string;
}): Promise<TrialCheckPost[]> {
  const sb = getSupabaseServiceClient();
  let bq = sb.from("posting_briefs").select("id, title, model_id, account_handle");
  if (params.modelId) bq = bq.eq("model_id", params.modelId);
  const { data: briefs, error: bErr } = await bq;
  if (bErr) throw new Error(bErr.message);
  const briefById = new Map(
    (briefs ?? []).map((b) => {
      const r = b as { id: string; title: string; model_id: string; account_handle: string };
      return [r.id, r] as const;
    }),
  );
  if (!briefById.size) return [];

  let pq = sb
    .from("posting_brief_posts")
    .select(
      "id, brief_id, position, video_name, content_source, posted_url, posted_at, views_24h, views_checked_at, outlier_multiple, outlier_status",
    )
    .in("brief_id", [...briefById.keys()])
    .eq("placement", "trial")
    .not("posted_at", "is", null)
    .order("posted_at", { ascending: false });
  if (params.sinceIso) pq = pq.gte("posted_at", params.sinceIso);
  const { data, error } = await pq;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const brief = briefById.get(String(r.brief_id))!;
    const st = r.outlier_status;
    return {
      post_id: String(r.id),
      brief_id: brief.id,
      brief_title: brief.title,
      model_id: brief.model_id,
      account_handle: brief.account_handle ?? "",
      position: Number(r.position ?? 0),
      video_name: String(r.video_name ?? ""),
      content_source: String(r.content_source ?? ""),
      posted_url: r.posted_url ? String(r.posted_url) : null,
      posted_at: String(r.posted_at),
      views_24h: num(r.views_24h),
      views_checked_at: r.views_checked_at ? String(r.views_checked_at) : null,
      outlier_multiple: num(r.outlier_multiple),
      outlier_status: st === "normal" || st === "outlier" || st === "hot" ? st : "",
    };
  });
}

const MATURE_MS = 24 * 60 * 60 * 1000;
function isMature(p: { posted_at: string }): boolean {
  const t = Date.parse(p.posted_at);
  return Number.isFinite(t) && Date.now() - t >= MATURE_MS;
}

function accountKey(p: { model_id: string; account_handle: string }): string {
  return `${p.model_id}::${p.account_handle.trim().toLowerCase()}`;
}

/** Trial posts of the last `scan_days` grouped per model + account, with the current baseline. */
export async function listTrialCheckAccounts(params: {
  modelId?: string;
}): Promise<TrialCheckAccount[]> {
  // Baseline needs the latest N posts even if older than the window → load without a date filter.
  const posts = await loadTrialPosts({ modelId: params.modelId });
  const groups = new Map<string, TrialCheckPost[]>();
  for (const p of posts) {
    const k = accountKey(p);
    const list = groups.get(k) ?? [];
    list.push(p);
    groups.set(k, list);
  }
  const out: TrialCheckAccount[] = [];
  for (const list of groups.values()) {
    const first = list[0];
    const settings = await getCycleSettings(first.model_id);
    const model = await getModelById(first.model_id).catch(() => null);
    const latest = list.filter((p) => p.views_24h != null && isMature(p)).slice(0, settings.baseline_posts);
    const avg = latest.length ? latest.reduce((a, p) => a + (p.views_24h ?? 0), 0) / latest.length : null;
    const since = Date.now() - settings.outlier_scan_days * 86_400_000;
    const inWindow = list.filter((p) => Date.parse(p.posted_at) >= since && isMature(p));
    const lastChecked = list
      .map((p) => p.views_checked_at)
      .filter((v): v is string => !!v)
      .sort()
      .pop() ?? null;
    out.push({
      model_id: first.model_id,
      model_name: model?.model_name || first.model_id,
      account_handle: first.account_handle,
      baseline_avg: avg,
      baseline_count: latest.length,
      baseline_posts: settings.baseline_posts,
      scan_days: settings.outlier_scan_days,
      outlier_multiple: settings.outlier_multiple,
      hot_multiple: settings.hot_multiple,
      last_checked_at: lastChecked,
      pending: inWindow.filter((p) => p.views_24h == null).length,
      posts: inWindow,
    });
  }
  return out.sort((a, b) => a.model_name.localeCompare(b.model_name) || a.account_handle.localeCompare(b.account_handle));
}

export type SaveTrialViewsResult = {
  saved: number;
  accounts: TrialCheckAccount[];
  newOutliers: Array<{ post_id: string; status: PostOutlierStatus; multiple: number | null }>;
};

/**
 * Save views for one or more trial posts, then re-evaluate every affected account:
 * recompute the baseline from the latest N posts (the checked post included) and
 * flag all posts inside the scan window. New outliers go to the Winners Hub + queue.
 */
export async function saveTrialViews(params: {
  entries: Array<{ post_id: string; views: number }>;
  actorUserId: string;
  actorName?: string;
}): Promise<SaveTrialViewsResult> {
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const ids = params.entries.map((e) => e.post_id.trim()).filter(Boolean);
  if (!ids.length) throw new Error("No posts");

  // Save raw views first.
  let saved = 0;
  for (const e of params.entries) {
    const views = Math.round(Number(e.views));
    if (!Number.isFinite(views) || views < 0) continue;
    const { error } = await sb
      .from("posting_brief_posts")
      .update({ views_24h: views, views_checked_at: now, views_checked_by: params.actorUserId, updated_at: now })
      .eq("id", e.post_id.trim())
      .eq("placement", "trial");
    if (error) throw new Error(error.message);
    saved += 1;
  }

  // Which accounts are affected?
  const all = await loadTrialPosts({});
  const touched = new Set(all.filter((p) => ids.includes(p.post_id)).map(accountKey));
  const newOutliers: SaveTrialViewsResult["newOutliers"] = [];

  for (const key of touched) {
    const list = all.filter((p) => accountKey(p) === key); // newest first
    const first = list[0];
    const settings = await getCycleSettings(first.model_id);
    const latest = list.filter((p) => p.views_24h != null && isMature(p)).slice(0, settings.baseline_posts);
    const avg = latest.length ? latest.reduce((a, p) => a + (p.views_24h ?? 0), 0) / latest.length : null;
    const since = Date.now() - settings.outlier_scan_days * 86_400_000;
    const model = await getModelById(first.model_id).catch(() => null);

    for (const p of list) {
      if (p.views_24h == null || Date.parse(p.posted_at) < since || !isMature(p)) continue;
      let multiple: number | null = null;
      let status: PostOutlierStatus = "normal";
      if (avg && avg > 0 && latest.length >= 3) {
        multiple = Math.round((p.views_24h / avg) * 100) / 100;
        if (multiple >= settings.hot_multiple) status = "hot";
        else if (multiple >= settings.outlier_multiple) status = "outlier";
      }
      // Never downgrade a post that already went to the hub.
      const wasFlagged = p.outlier_status === "outlier" || p.outlier_status === "hot";
      const nextStatus: PostOutlierStatus = wasFlagged && status === "normal" ? p.outlier_status : status;
      await sb
        .from("posting_brief_posts")
        .update({ outlier_multiple: multiple, outlier_status: nextStatus, updated_at: now })
        .eq("id", p.post_id);

      if (!wasFlagged && (status === "outlier" || status === "hot")) {
        const generation = p.content_source === "recreation" ? 2 : 1;
        if (generation > MAX_RECREATION_GENERATION) continue;
        const submission = await createWinnerSubmission({
          model_id: first.model_id,
          model_name: model?.model_name || first.model_id,
          video_link: p.posted_url || `posting-brief:${p.brief_id}#${p.post_id}`,
          view_count: p.views_24h,
          submitted_by_id: params.actorUserId,
          submitted_by_name: params.actorName || "Account Supervisor",
          source: "posted_24h",
          posted_at: p.posted_at,
          skipNotify: true,
          tierOverride: status === "hot" ? "super_winner" : "winner",
          posting_brief_post_id: p.post_id,
          feed: "trial",
          outlier_multiple: multiple,
        });
        await addSubmissionToRecreationQueue(submission.id, {
          lane: status === "hot" ? "urgent" : "next_bunch",
          generation,
          feed: "trial",
        });
        newOutliers.push({ post_id: p.post_id, status, multiple });
        await notifyTrialOutlier({
          post: p,
          modelName: model?.model_name || first.model_id,
          status,
          multiple,
          actorUserId: params.actorUserId,
        });
      }
    }
  }

  const accounts = await listTrialCheckAccounts({});
  return { saved, accounts: accounts.filter((a) => touched.has(accountKey(a))), newOutliers };
}

async function notifyTrialOutlier(params: {
  post: TrialCheckPost;
  modelName: string;
  status: PostOutlierStatus;
  multiple: number | null;
  actorUserId: string;
}): Promise<void> {
  const { post, modelName, status, multiple, actorUserId } = params;
  const [cds, homs, mms] = await Promise.all([
    listUsersWithPermission(PERMISSIONS.WINNER_SOURCING_MANAGE).catch(() => []),
    listUsersWithPermission(PERMISSIONS.EXPERIMENTAL_BUNCH_MANAGE).catch(() => []),
    listUsersWithPermission(PERMISSIONS.POSTING_BRIEFS_MANAGE).catch(() => []),
  ]);
  const ids = new Set([...cds, ...homs, ...mms].map((u) => u.id).filter(Boolean));
  const label = post.video_name || `Post ${post.position + 1}`;
  const title =
    status === "hot"
      ? `🔥 HOT trial ×${multiple ?? "?"} — ${modelName}`
      : `Trial outlier ×${multiple ?? "?"} — ${modelName}`;
  const body = `${label} (@${post.account_handle}) did ${(post.views_24h ?? 0).toLocaleString()} views — move the same file to the grid, then recreation.${status === "hot" ? " Urgent lane." : ""}`;
  await Promise.all(
    [...ids]
      .filter((id) => id !== actorUserId)
      .map((user_id) =>
        notify({
          user_id,
          event_type: NOTIFICATION_EVENT.WINNER_VIDEO_SUBMITTED,
          priority: status === "hot" ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.NORMAL,
          title,
          body,
          entity_type: NOTIFICATION_ENTITY.POSTING_BRIEF,
          entity_id: post.brief_id,
          actor_user_id: actorUserId,
          _triggerSource: "trial_check_outlier",
        }).catch((err) => console.error("[trial_check_outlier] notify failed", err)),
      ),
  );
}

/**
 * Daily reminder (called from the ClarioSuite sync cron): accounts with trial posts
 * in the window whose last check is older than `everyDays` → notify posting managers.
 */
export async function notifyTrialChecksDue(opts?: { everyDays?: number }): Promise<number> {
  const everyDays = opts?.everyDays ?? 3;
  const accounts = await listTrialCheckAccounts({});
  const due = accounts.filter((a) => {
    if (!a.posts.length || a.pending === 0) return false;
    if (!a.last_checked_at) return true;
    return Date.now() - Date.parse(a.last_checked_at) >= everyDays * 86_400_000;
  });
  if (!due.length) return 0;
  const managers = await listUsersWithPermission(PERMISSIONS.POSTING_BRIEFS_MANAGE).catch(() => []);
  const lines = due.map((a) => `${a.model_name} @${a.account_handle} (${a.pending} unchecked)`);
  await Promise.all(
    managers.map((u) =>
      notify({
        user_id: u.id,
        event_type: NOTIFICATION_EVENT.POSTING_BRIEF_UPDATED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: `Trial check due: ${due.length} account${due.length === 1 ? "" : "s"}`,
        body: lines.join(" · "),
        entity_type: NOTIFICATION_ENTITY.POSTING_BRIEF,
        entity_id: due[0].posts[0]?.brief_id ?? "",
        _triggerSource: "trial_check_due",
      }).catch((err) => console.error("[trial_check_due] notify failed", err)),
    ),
  );
  return due.length;
}
