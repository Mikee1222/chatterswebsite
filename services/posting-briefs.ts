/**
 * Posting Briefs — Creative Director structured briefs for Marketing Executives.
 * Permission-gated (posting_briefs:view / manage). Captions/text preserved exactly.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { notify } from "@/services/notification-service";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { getAccountsByModel, getAccountsByVA } from "@/services/marketing";
import type { NotificationPriority } from "@/types";

export type PostingBriefAccountType = "main" | "secondary";
export type PostingBriefRegion = "USA" | "Greece" | "Global";
export type PostingBriefContentType =
  | "Trial Reels"
  | "Reels"
  | "Stories"
  | "Carousel"
  | "Other";
export type PostingBriefPriority = "normal" | "urgent";
export type PostingBriefStatus = "active" | "archived";

export type PostingBriefPost = {
  id: string;
  brief_id: string;
  position: number;
  video_name: string;
  text_on_screen: string | null;
  caption: string;
  pinned_comment: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PostingBrief = {
  id: string;
  title: string;
  model_id: string;
  account_handle: string;
  account_type: PostingBriefAccountType;
  region: PostingBriefRegion;
  content_type: PostingBriefContentType;
  priority: PostingBriefPriority;
  instructions_notes: string;
  video_location_path: string;
  sound_name: string;
  sound_link: string;
  sound_notes: string;
  text_style_notes: string;
  timing_notes: string;
  final_checklist: string[];
  status: PostingBriefStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  posts: PostingBriefPost[];
};

export type PostingBriefPostInput = {
  video_name?: string;
  text_on_screen?: string | null;
  caption?: string;
  pinned_comment?: string | null;
  notes?: string | null;
};

export type PostingBriefInput = {
  title: string;
  model_id: string;
  account_handle?: string;
  account_type?: PostingBriefAccountType;
  region?: PostingBriefRegion;
  content_type?: PostingBriefContentType;
  priority?: PostingBriefPriority;
  instructions_notes?: string;
  video_location_path?: string;
  sound_name?: string;
  sound_link?: string;
  sound_notes?: string;
  text_style_notes?: string;
  timing_notes?: string;
  final_checklist?: string[];
  status?: PostingBriefStatus;
  posts?: PostingBriefPostInput[];
  created_by?: string;
};

export type ListPostingBriefsFilters = {
  model_id?: string;
  account_handle?: string;
  status?: PostingBriefStatus | "all";
  priority?: PostingBriefPriority | "all";
  /** When set (view-only users), only briefs for these model ids. */
  model_ids?: string[];
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : String(v);
}

function parseChecklist(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => (typeof x === "string" ? x : String(x ?? "")));
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => (typeof x === "string" ? x : String(x ?? "")));
      }
    } catch {
      return raw.split("\n").map((l) => l);
    }
  }
  return [];
}

function mapPost(row: Record<string, unknown>): PostingBriefPost {
  return {
    id: asString(row.id),
    brief_id: asString(row.brief_id),
    position: typeof row.position === "number" ? row.position : Number(row.position) || 0,
    video_name: asString(row.video_name),
    text_on_screen: asNullableString(row.text_on_screen),
    caption: asString(row.caption),
    pinned_comment: asNullableString(row.pinned_comment),
    notes: asNullableString(row.notes),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  };
}

function mapBrief(row: Record<string, unknown>, posts: PostingBriefPost[]): PostingBrief {
  return {
    id: asString(row.id),
    title: asString(row.title),
    model_id: asString(row.model_id),
    account_handle: asString(row.account_handle),
    account_type: (asString(row.account_type) || "main") as PostingBriefAccountType,
    region: (asString(row.region) || "Global") as PostingBriefRegion,
    content_type: (asString(row.content_type) || "Trial Reels") as PostingBriefContentType,
    priority: (asString(row.priority) || "normal") as PostingBriefPriority,
    instructions_notes: asString(row.instructions_notes),
    video_location_path: asString(row.video_location_path),
    sound_name: asString(row.sound_name),
    sound_link: asString(row.sound_link),
    sound_notes: asString(row.sound_notes),
    text_style_notes: asString(row.text_style_notes),
    timing_notes: asString(row.timing_notes),
    final_checklist: parseChecklist(row.final_checklist),
    status: (asString(row.status) || "active") as PostingBriefStatus,
    created_by: asString(row.created_by),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    posts: [...posts].sort((a, b) => a.position - b.position),
  };
}

async function loadPostsForBriefIds(briefIds: string[]): Promise<Map<string, PostingBriefPost[]>> {
  const map = new Map<string, PostingBriefPost[]>();
  if (!briefIds.length) return map;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("posting_brief_posts")
    .select("*")
    .in("brief_id", briefIds)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const post = mapPost(row as Record<string, unknown>);
    const list = map.get(post.brief_id) ?? [];
    list.push(post);
    map.set(post.brief_id, list);
  }
  return map;
}

function sortBriefs(briefs: PostingBrief[]): PostingBrief[] {
  return [...briefs].sort((a, b) => {
    if (a.priority === "urgent" && b.priority !== "urgent") return -1;
    if (b.priority === "urgent" && a.priority !== "urgent") return 1;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
}

/** Model ids a VA/ME is assigned to via marketing social accounts. */
export async function getAssignedModelIdsForUser(userId: string): Promise<string[]> {
  const uid = userId.trim();
  if (!uid) return [];
  const accounts = await getAccountsByVA(uid).catch(() => []);
  const ids = new Set<string>();
  for (const acc of accounts) {
    const mid = acc.model_id?.trim();
    if (mid) ids.add(mid);
  }
  return [...ids];
}

/** Unique assigned VA user ids for a model (from social accounts). */
export async function getAssignedVaIdsForModel(modelId: string): Promise<string[]> {
  const mid = modelId.trim();
  if (!mid) return [];
  const accounts = await getAccountsByModel(mid).catch(() => []);
  const ids = new Set<string>();
  for (const acc of accounts) {
    const va = acc.assigned_va_id?.trim();
    if (va) ids.add(va);
  }
  return [...ids];
}

async function notifyAssignedVas(params: {
  brief: PostingBrief;
  event: "published" | "updated";
  actorUserId?: string;
}): Promise<void> {
  const { brief, event, actorUserId } = params;
  const vaIds = await getAssignedVaIdsForModel(brief.model_id);
  if (!vaIds.length) return;

  const isUrgent = brief.priority === "urgent";
  const priority: NotificationPriority = isUrgent
    ? NOTIFICATION_PRIORITY.HIGH
    : NOTIFICATION_PRIORITY.NORMAL;
  const eventType =
    event === "published"
      ? NOTIFICATION_EVENT.POSTING_BRIEF_PUBLISHED
      : NOTIFICATION_EVENT.POSTING_BRIEF_UPDATED;
  const handle = brief.account_handle?.trim() || "account";
  const title =
    event === "published"
      ? isUrgent
        ? `Urgent posting brief: ${brief.title}`
        : `New posting brief: ${brief.title}`
      : `Posting brief updated: ${brief.title}`;
  const body =
    event === "published"
      ? `${brief.content_type} for ${handle} — ${brief.posts.length} post${brief.posts.length === 1 ? "" : "s"}`
      : `Updated brief for ${handle} — open to see the latest instructions`;

  await Promise.all(
    vaIds
      .filter((id) => id && id !== actorUserId)
      .map((user_id) =>
        notify({
          user_id,
          event_type: eventType,
          priority,
          title,
          body,
          entity_type: NOTIFICATION_ENTITY.POSTING_BRIEF,
          entity_id: brief.id,
          actor_user_id: actorUserId,
          _triggerSource:
            event === "published" ? "posting_brief_published" : "posting_brief_updated",
        }).catch((err) => {
          console.error(`[posting_brief_${event}] notify failed`, err);
        }),
      ),
  );
}

export async function listPostingBriefs(
  filters: ListPostingBriefsFilters = {},
): Promise<PostingBrief[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from("posting_briefs").select("*");

  const status = filters.status ?? "active";
  if (status !== "all") q = q.eq("status", status);
  if (filters.model_id?.trim()) q = q.eq("model_id", filters.model_id.trim());
  if (filters.account_handle?.trim()) {
    q = q.ilike("account_handle", `%${filters.account_handle.trim().replace(/^@/, "")}%`);
  }
  if (filters.priority && filters.priority !== "all") q = q.eq("priority", filters.priority);
  if (filters.model_ids) {
    if (!filters.model_ids.length) return [];
    q = q.in("model_id", filters.model_ids);
  }

  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const postsMap = await loadPostsForBriefIds(rows.map((r) => asString(r.id)));
  return sortBriefs(rows.map((r) => mapBrief(r, postsMap.get(asString(r.id)) ?? [])));
}

export async function getPostingBriefById(id: string): Promise<PostingBrief | null> {
  const bid = id.trim();
  if (!bid) return null;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from("posting_briefs").select("*").eq("id", bid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const postsMap = await loadPostsForBriefIds([bid]);
  return mapBrief(data as Record<string, unknown>, postsMap.get(bid) ?? []);
}

async function replacePosts(
  briefId: string,
  posts: PostingBriefPostInput[],
): Promise<PostingBriefPost[]> {
  const sb = getSupabaseServiceClient();
  const { error: delErr } = await sb.from("posting_brief_posts").delete().eq("brief_id", briefId);
  if (delErr) throw new Error(delErr.message);

  if (!posts.length) return [];

  const now = new Date().toISOString();
  const rows = posts.map((p, i) => ({
    brief_id: briefId,
    position: i,
    video_name: p.video_name ?? "",
    text_on_screen: p.text_on_screen ?? null,
    caption: p.caption ?? "",
    pinned_comment: p.pinned_comment ?? null,
    notes: p.notes ?? null,
    created_at: now,
    updated_at: now,
  }));

  const { data, error } = await sb.from("posting_brief_posts").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapPost(r as Record<string, unknown>));
}

export async function createPostingBrief(
  input: PostingBriefInput,
  opts?: { notify?: boolean; actorUserId?: string },
): Promise<PostingBrief> {
  const title = (input.title ?? "").trim();
  if (!title) throw new Error("Title is required");
  const modelId = (input.model_id ?? "").trim();
  if (!modelId) throw new Error("Model is required");

  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const checklist = Array.isArray(input.final_checklist) ? input.final_checklist : [];

  const { data, error } = await sb
    .from("posting_briefs")
    .insert({
      title,
      model_id: modelId,
      account_handle: input.account_handle ?? "",
      account_type: input.account_type ?? "main",
      region: input.region ?? "Global",
      content_type: input.content_type ?? "Trial Reels",
      priority: input.priority ?? "normal",
      instructions_notes: input.instructions_notes ?? "",
      video_location_path: input.video_location_path ?? "",
      sound_name: input.sound_name ?? "",
      sound_link: input.sound_link ?? "",
      sound_notes: input.sound_notes ?? "",
      text_style_notes: input.text_style_notes ?? "",
      timing_notes: input.timing_notes ?? "",
      final_checklist: checklist,
      status: input.status ?? "active",
      created_by: input.created_by ?? "",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const briefId = asString((data as Record<string, unknown>).id);
  const posts = await replacePosts(briefId, input.posts ?? []);
  const brief = mapBrief(data as Record<string, unknown>, posts);

  if (opts?.notify !== false && brief.status === "active") {
    await notifyAssignedVas({
      brief,
      event: "published",
      actorUserId: opts?.actorUserId,
    });
  }

  return brief;
}

export async function updatePostingBrief(
  id: string,
  input: Partial<PostingBriefInput>,
  opts?: { notify?: boolean; actorUserId?: string },
): Promise<PostingBrief> {
  const existing = await getPostingBriefById(id);
  if (!existing) throw new Error("Brief not found");

  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };

  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new Error("Title is required");
    patch.title = t;
  }
  if (input.model_id !== undefined) {
    const m = input.model_id.trim();
    if (!m) throw new Error("Model is required");
    patch.model_id = m;
  }
  if (input.account_handle !== undefined) patch.account_handle = input.account_handle;
  if (input.account_type !== undefined) patch.account_type = input.account_type;
  if (input.region !== undefined) patch.region = input.region;
  if (input.content_type !== undefined) patch.content_type = input.content_type;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.instructions_notes !== undefined) patch.instructions_notes = input.instructions_notes;
  if (input.video_location_path !== undefined) patch.video_location_path = input.video_location_path;
  if (input.sound_name !== undefined) patch.sound_name = input.sound_name;
  if (input.sound_link !== undefined) patch.sound_link = input.sound_link;
  if (input.sound_notes !== undefined) patch.sound_notes = input.sound_notes;
  if (input.text_style_notes !== undefined) patch.text_style_notes = input.text_style_notes;
  if (input.timing_notes !== undefined) patch.timing_notes = input.timing_notes;
  if (input.final_checklist !== undefined) patch.final_checklist = input.final_checklist;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await sb
    .from("posting_briefs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  let posts = existing.posts;
  if (input.posts !== undefined) {
    posts = await replacePosts(id, input.posts);
  } else {
    const postsMap = await loadPostsForBriefIds([id]);
    posts = postsMap.get(id) ?? [];
  }

  const brief = mapBrief(data as Record<string, unknown>, posts);
  const wasActive = existing.status === "active";
  const isActive = brief.status === "active";

  if (opts?.notify !== false && isActive) {
    await notifyAssignedVas({
      brief,
      event: wasActive ? "updated" : "published",
      actorUserId: opts?.actorUserId,
    });
  }

  return brief;
}

export async function setPostingBriefStatus(
  id: string,
  status: PostingBriefStatus,
): Promise<PostingBrief> {
  return updatePostingBrief(id, { status }, { notify: false });
}

export async function duplicatePostingBrief(
  id: string,
  createdBy: string,
  opts?: { actorUserId?: string },
): Promise<PostingBrief> {
  const source = await getPostingBriefById(id);
  if (!source) throw new Error("Brief not found");

  return createPostingBrief(
    {
      title: `${source.title} (copy)`,
      model_id: source.model_id,
      account_handle: source.account_handle,
      account_type: source.account_type,
      region: source.region,
      content_type: source.content_type,
      priority: source.priority,
      instructions_notes: source.instructions_notes,
      video_location_path: source.video_location_path,
      sound_name: source.sound_name,
      sound_link: source.sound_link,
      sound_notes: source.sound_notes,
      text_style_notes: source.text_style_notes,
      timing_notes: source.timing_notes,
      final_checklist: [...source.final_checklist],
      status: "active",
      created_by: createdBy,
      posts: source.posts.map((p) => ({
        video_name: p.video_name,
        text_on_screen: p.text_on_screen,
        caption: p.caption,
        pinned_comment: p.pinned_comment,
        notes: p.notes,
      })),
    },
    { notify: true, actorUserId: opts?.actorUserId },
  );
}
