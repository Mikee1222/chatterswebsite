/**
 * Reupload queue — a trial-grid outlier whose SAME file is reuploaded to the main grid.
 * No posting brief is involved:
 *   1. Supervisor sends the trial outlier to the reupload queue (Winners Hub).
 *   2. Marketing Manager presses "Notify VAs" → the VAs assigned to the model are notified.
 *   3. A VA reuploads the file, pastes the new grid link and presses Done.
 *      From then on the entry is a GRID post: the trial link is replaced and the
 *      nightly scan scores the new post against the main-grid baseline.
 * Server-only (kept out of services/winner-sourcing, which client components import).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { notify } from "@/services/notification-service";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import { getAssignedVaIdsForModel } from "@/services/posting-briefs";
import { listUsersWithPermission } from "@/services/users";
import { getWinnerSubmission } from "@/services/winner-sourcing";
import { instagramShortcode } from "@/services/winner-auto-detect";

export type ReuploadTask = {
  /** recreation_queue_items.id */
  id: string;
  model_id: string;
  model_name: string;
  /** The post to reupload: the trial link while pending, the grid link once done. */
  trial_link: string;
  grid_link: string | null;
  outlier_multiple: number | null;
  view_count: number;
  tier: string;
  notified_at: string | null;
  done_at: string | null;
  /** From the original trial's posting brief, when we know it. */
  account_handle: string;
  video_name: string;
  video_location_path: string;
};

type QueueRow = {
  id: string;
  winner_submission_id: string;
  decision?: string;
  bunch_id?: string | null;
  grid_posted_at?: string | null;
  reupload_notified_at?: string | null;
  reupload_notified_by?: string | null;
  reupload_url?: string | null;
  original_trial_link?: string | null;
};

async function loadReuploadRow(queueItemId: string): Promise<QueueRow> {
  const sb = getSupabaseServiceClient();
  const { data: row, error } = await sb
    .from("recreation_queue_items")
    .select("*")
    .eq("id", queueItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Queue item not found");
  const item = row as QueueRow;
  if (item.decision !== "grid" || item.bunch_id) {
    throw new Error("This item is not in the reupload queue");
  }
  return item;
}

export async function notifyReuploadToAssignedVas(input: {
  queue_item_id: string;
  actor_id: string;
}): Promise<{ notified: number; notified_at: string }> {
  const sb = getSupabaseServiceClient();
  const item = await loadReuploadRow(input.queue_item_id);
  if (item.grid_posted_at) throw new Error("Already reuploaded");
  const sub = await getWinnerSubmission(String(item.winner_submission_id));
  if (!sub) throw new Error("Submission not found");

  const vaIds = (await getAssignedVaIdsForModel(sub.model_id)).filter(
    (id) => id && id !== input.actor_id,
  );
  if (!vaIds.length) {
    throw new Error(
      `No VA is assigned to ${sub.model_name || "this model"}'s social accounts — assign one in Marketing first.`,
    );
  }

  const multiple = sub.outlier_multiple != null ? ` ×${sub.outlier_multiple}` : "";
  const title = `Reupload to MAIN grid: ${sub.model_name || "model"}`;
  const body = `Trial outlier${multiple} — post the SAME file to the main grid, then open Reuploads, paste the new link and press Done. Trial post: ${sub.video_link}`;

  await Promise.all(
    vaIds.map((user_id) =>
      notify({
        user_id,
        event_type: NOTIFICATION_EVENT.REUPLOAD_REQUESTED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title,
        body,
        entity_type: NOTIFICATION_ENTITY.REUPLOAD,
        entity_id: input.queue_item_id,
        actor_user_id: input.actor_id,
        _triggerSource: "reupload_queue_notify",
      }).catch((err) => console.error("[reupload_queue_notify] notify failed", err)),
    ),
  );

  const notified_at = new Date().toISOString();
  const { error: upErr } = await sb
    .from("recreation_queue_items")
    .update({ reupload_notified_at: notified_at, reupload_notified_by: input.actor_id })
    .eq("id", input.queue_item_id);
  if (upErr) {
    throw new Error(
      `VAs were notified, but the queue item could not be updated (is migration 20261111170000 applied?): ${upErr.message}`,
    );
  }
  return { notified: vaIds.length, notified_at };
}

/**
 * Reupload tasks for the Reuploads page. `modelIds` undefined = every model (managers);
 * otherwise only those models (assigned VAs). Only items the Marketing Manager has
 * already sent to the VAs are listed; done items stay visible for 14 days.
 */
export async function listReuploadTasks(opts: { modelIds?: string[] }): Promise<ReuploadTask[]> {
  if (opts.modelIds && !opts.modelIds.length) return [];
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("recreation_queue_items")
    .select("*")
    .eq("decision", "grid")
    .is("bunch_id", null)
    .not("reupload_notified_at", "is", null)
    .order("reupload_notified_at", { ascending: false });
  if (error) throw new Error(`listReuploadTasks: ${error.message}`);
  const cutoff = Date.now() - 14 * 86_400_000;
  const rows = ((data ?? []) as QueueRow[]).filter(
    (r) => !r.grid_posted_at || Date.parse(String(r.grid_posted_at)) >= cutoff,
  );
  if (!rows.length) return [];

  const { data: subs } = await sb
    .from("winner_submissions")
    .select("id, model_id, model_name, video_link, view_count, tier, outlier_multiple, posting_brief_post_id")
    .in("id", [...new Set(rows.map((r) => String(r.winner_submission_id)))]);
  type SubRow = {
    id: string;
    model_id: string;
    model_name: string | null;
    video_link: string | null;
    view_count: number | null;
    tier: string | null;
    outlier_multiple: number | null;
    posting_brief_post_id: string | null;
  };
  const subById = new Map(((subs ?? []) as SubRow[]).map((s) => [String(s.id), s]));

  // File name + iCloud path come from the original trial's posting brief post.
  const postIds = [...subById.values()].map((s) => s.posting_brief_post_id).filter(Boolean) as string[];
  const postById = new Map<string, { video_name: string; brief_id: string }>();
  const briefById = new Map<string, { account_handle: string; video_location_path: string }>();
  if (postIds.length) {
    const { data: posts } = await sb
      .from("posting_brief_posts")
      .select("id, brief_id, video_name")
      .in("id", postIds);
    for (const p of (posts ?? []) as { id: string; brief_id: string; video_name: string | null }[]) {
      postById.set(String(p.id), { video_name: String(p.video_name ?? ""), brief_id: String(p.brief_id) });
    }
    const briefIds = [...new Set([...postById.values()].map((p) => p.brief_id))];
    if (briefIds.length) {
      const { data: briefs } = await sb
        .from("posting_briefs")
        .select("id, account_handle, video_location_path")
        .in("id", briefIds);
      for (const b of (briefs ?? []) as {
        id: string;
        account_handle: string | null;
        video_location_path: string | null;
      }[]) {
        briefById.set(String(b.id), {
          account_handle: String(b.account_handle ?? ""),
          video_location_path: String(b.video_location_path ?? ""),
        });
      }
    }
  }

  const allowed = opts.modelIds ? new Set(opts.modelIds) : null;
  const out: ReuploadTask[] = [];
  for (const r of rows) {
    const sub = subById.get(String(r.winner_submission_id));
    if (!sub) continue;
    if (allowed && !allowed.has(String(sub.model_id))) continue;
    const post = sub.posting_brief_post_id ? postById.get(String(sub.posting_brief_post_id)) : undefined;
    const brief = post ? briefById.get(post.brief_id) : undefined;
    const done = Boolean(r.grid_posted_at);
    out.push({
      id: String(r.id),
      model_id: String(sub.model_id),
      model_name: String(sub.model_name ?? ""),
      trial_link: done ? String(r.original_trial_link ?? "") : String(sub.video_link ?? ""),
      grid_link: done ? String(r.reupload_url ?? sub.video_link ?? "") : null,
      outlier_multiple: sub.outlier_multiple != null ? Number(sub.outlier_multiple) : null,
      view_count: Number(sub.view_count) || 0,
      tier: String(sub.tier ?? "winner"),
      notified_at: r.reupload_notified_at ? String(r.reupload_notified_at) : null,
      done_at: r.grid_posted_at ? String(r.grid_posted_at) : null,
      account_handle: brief?.account_handle ?? "",
      video_name: post?.video_name ?? "",
      video_location_path: brief?.video_location_path ?? "",
    });
  }
  return out;
}

function normalizeGridUrl(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) throw new Error("Paste the link of the new main-grid post");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("That is not a valid link");
  }
  if (withScheme.length > 2048) throw new Error("Post link is too long");
  if (!instagramShortcode(parsed.toString())) {
    throw new Error("Paste the Instagram link of the post (instagram.com/reel/… or /p/…)");
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

/**
 * A VA finished the reupload: store the new grid link and turn the entry into a GRID
 * post. The trial link is replaced on the Winners Hub card (kept on the queue item as
 * original_trial_link so the nightly scan never re-detects the old trial post).
 * Views and ×N restart from the new post at the next ClarioSuite sync.
 */
export async function completeReupload(input: {
  queue_item_id: string;
  url: string;
  actor_id: string;
  /** undefined = may complete any model (manager); otherwise only these models. */
  allowedModelIds?: string[];
}): Promise<{ grid_link: string }> {
  const sb = getSupabaseServiceClient();
  const item = await loadReuploadRow(input.queue_item_id);
  if (item.grid_posted_at) throw new Error("Already marked as reuploaded");
  const sub = await getWinnerSubmission(String(item.winner_submission_id));
  if (!sub) throw new Error("Submission not found");
  if (input.allowedModelIds && !input.allowedModelIds.includes(sub.model_id)) {
    throw new Error("You are not assigned to this model");
  }

  const gridLink = normalizeGridUrl(input.url);
  const newCode = instagramShortcode(gridLink);
  if (newCode && newCode === instagramShortcode(sub.video_link)) {
    throw new Error("That is the trial post's link. Paste the link of the NEW main-grid post.");
  }
  // Exact shortcode match. ILIKE only narrows the candidates (its wildcards _ and % are
  // escaped, and a longer code that merely starts with ours is filtered out below).
  if (newCode) {
    const escaped = newCode.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: candidates, error: dupErr } = await sb
      .from("winner_submissions")
      .select("id, video_link")
      .ilike("video_link", `%${escaped}%`)
      .neq("id", sub.id);
    if (dupErr) throw new Error(`Could not check for duplicates: ${dupErr.message}`);
    const clash = (candidates ?? []).some(
      (r) => instagramShortcode(String((r as { video_link?: string }).video_link ?? "")) === newCode,
    );
    if (clash) throw new Error("This link is already in the Winners Hub");
  }

  // One transaction (migration 20261111190000): the queue item and the hub entry change
  // together or not at all, so a failure never leaves the item "done" and un-retryable.
  const { error: rpcErr } = await sb.rpc("complete_reupload_atomic", {
    p_queue_item_id: input.queue_item_id,
    p_grid_link: gridLink,
    p_actor_id: input.actor_id,
  });
  if (rpcErr) {
    const missing = /complete_reupload_atomic|PGRST202|schema cache/i.test(rpcErr.message);
    throw new Error(
      missing
        ? "Could not save the reupload: migration 20261111190000 (complete_reupload_atomic) is not applied yet."
        : `Could not save the reupload: ${rpcErr.message}`,
    );
  }

  // Tell the Marketing Manager who sent it (fallback: posting-brief managers).
  const recipients = new Set<string>();
  const notifier = String(item.reupload_notified_by ?? "").trim();
  if (notifier) recipients.add(notifier);
  else {
    const holders = await listUsersWithPermission(PERMISSIONS.POSTING_BRIEFS_MANAGE).catch(() => []);
    for (const u of holders) if (u.id) recipients.add(u.id);
  }
  await Promise.all(
    [...recipients]
      .filter((id) => id && id !== input.actor_id)
      .map((user_id) =>
        notify({
          user_id,
          event_type: NOTIFICATION_EVENT.REUPLOAD_DONE,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: `Reuploaded to main grid: ${sub.model_name || "model"}`,
          body: `The trial outlier is now live on the main grid — ${gridLink}`,
          entity_type: NOTIFICATION_ENTITY.REUPLOAD,
          entity_id: input.queue_item_id,
          actor_user_id: input.actor_id,
          _triggerSource: "reupload_queue_done",
        }).catch((err) => console.error("[reupload_queue_done] notify failed", err)),
      ),
  );
  return { grid_link: gridLink };
}
