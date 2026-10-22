/**
 * Editing Briefs — Creative Director → Editor structured edit briefs.
 * Coexists with bunch-pipeline Editor assignments (editing:view_assignments).
 * Permission-gated. Text preserved exactly.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { greeceLocalToUtc } from "@/lib/brief-deadlines";
import {
  assertEditingPublishReady,
  assertEditingTransition,
  type BriefActorCapability,
  type EditingBriefStatus,
  BriefTransitionError,
} from "@/lib/brief-status-transitions";
import { notify } from "@/services/notification-service";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import { listUsersWithPermission } from "@/services/users";
import type { NotificationPriority } from "@/types";

export type { EditingBriefStatus };
export type EditingBriefPriority = "normal" | "urgent";
export type EditingBriefAudioVoice = "keep_voice" | "mute_original" | "clean_up";

export type EditingBriefTextGraphics = {
  title_on_top_text: string;
  title_on_top_style: string;
  subtitles: boolean;
  subtitles_style: string;
  labels: string;
  pictures: string;
};

export type EditingBriefVideo = {
  id: string;
  brief_id: string;
  position: number;
  output_name: string;
  raw_take: string;
  special_instructions: string;
  created_at: string;
  updated_at: string;
};

export type EditingBrief = {
  id: string;
  title: string;
  model_id: string;
  reference_links: string[];
  priority: EditingBriefPriority;
  deadline_at: string | null;
  deliverables_count: number;
  recording_brief_id: string | null;
  assigned_editor_id: string;
  concept: string;
  raw_footage_path: string;
  raw_files_takes: string;
  cut_rules: string;
  audio_voice: EditingBriefAudioVoice;
  audio_music: boolean;
  audio_notes: string;
  text_graphics: EditingBriefTextGraphics[];
  do_not_add: string;
  export_width: number;
  export_height: number;
  export_fps: number;
  export_format: string;
  upload_path_finals: string;
  final_check: string;
  status: EditingBriefStatus;
  reviewer_comment: string;
  created_by: string;
  reminder_sent_at: string | null;
  overdue_alerted_at: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  videos: EditingBriefVideo[];
};

export type EditingBriefVideoInput = {
  output_name?: string;
  raw_take?: string;
  special_instructions?: string;
};

export type EditingBriefInput = {
  title: string;
  model_id: string;
  reference_links?: string[];
  priority?: EditingBriefPriority;
  deadline_local_greece?: string | null;
  deadline_at?: string | null;
  deliverables_count?: number;
  recording_brief_id?: string | null;
  assigned_editor_id?: string;
  concept?: string;
  raw_footage_path?: string;
  raw_files_takes?: string;
  cut_rules?: string;
  audio_voice?: EditingBriefAudioVoice;
  audio_music?: boolean;
  audio_notes?: string;
  text_graphics?: EditingBriefTextGraphics[];
  do_not_add?: string;
  export_width?: number;
  export_height?: number;
  export_fps?: number;
  export_format?: string;
  upload_path_finals?: string;
  final_check?: string;
  status?: EditingBriefStatus;
  reviewer_comment?: string;
  videos?: EditingBriefVideoInput[];
  created_by?: string;
};

export type ListEditingBriefsFilters = {
  model_id?: string;
  status?: EditingBriefStatus | "all" | "active";
  priority?: EditingBriefPriority | "all";
  assigned_editor_id?: string;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : String(v);
}

function parseLinks(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean);
      }
    } catch {
      return raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function emptyTextGraphics(): EditingBriefTextGraphics {
  return {
    title_on_top_text: "",
    title_on_top_style: "",
    subtitles: false,
    subtitles_style: "",
    labels: "",
    pictures: "",
  };
}

function parseTextGraphics(raw: unknown): EditingBriefTextGraphics[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return {
      title_on_top_text: asString(o.title_on_top_text),
      title_on_top_style: asString(o.title_on_top_style),
      subtitles: Boolean(o.subtitles),
      subtitles_style: asString(o.subtitles_style),
      labels: asString(o.labels),
      pictures: asString(o.pictures),
    };
  });
}

function resolveDeadlineUtc(input: EditingBriefInput): string | null {
  if (input.deadline_local_greece != null && String(input.deadline_local_greece).trim()) {
    return greeceLocalToUtc(String(input.deadline_local_greece).trim()).toISOString();
  }
  if (input.deadline_at === null) return null;
  if (input.deadline_at != null && String(input.deadline_at).trim()) {
    const d = new Date(String(input.deadline_at));
    if (Number.isNaN(d.getTime())) throw new Error("Invalid deadline_at");
    return d.toISOString();
  }
  return null;
}

function mapVideo(row: Record<string, unknown>): EditingBriefVideo {
  return {
    id: asString(row.id),
    brief_id: asString(row.brief_id),
    position: typeof row.position === "number" ? row.position : Number(row.position) || 0,
    output_name: asString(row.output_name),
    raw_take: asString(row.raw_take),
    special_instructions: asString(row.special_instructions),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  };
}

function mapBrief(row: Record<string, unknown>, videos: EditingBriefVideo[]): EditingBrief {
  return {
    id: asString(row.id),
    title: asString(row.title),
    model_id: asString(row.model_id),
    reference_links: parseLinks(row.reference_links),
    priority: (asString(row.priority) || "normal") as EditingBriefPriority,
    deadline_at: asNullableString(row.deadline_at),
    deliverables_count:
      typeof row.deliverables_count === "number"
        ? row.deliverables_count
        : Number(row.deliverables_count) || 1,
    recording_brief_id: asNullableString(row.recording_brief_id),
    assigned_editor_id: asString(row.assigned_editor_id),
    concept: asString(row.concept),
    raw_footage_path: asString(row.raw_footage_path),
    raw_files_takes: asString(row.raw_files_takes),
    cut_rules: asString(row.cut_rules),
    audio_voice: (asString(row.audio_voice) || "keep_voice") as EditingBriefAudioVoice,
    audio_music: Boolean(row.audio_music),
    audio_notes: asString(row.audio_notes),
    text_graphics: parseTextGraphics(row.text_graphics),
    do_not_add: asString(row.do_not_add),
    export_width:
      typeof row.export_width === "number" ? row.export_width : Number(row.export_width) || 1080,
    export_height:
      typeof row.export_height === "number"
        ? row.export_height
        : Number(row.export_height) || 1920,
    export_fps:
      typeof row.export_fps === "number" ? row.export_fps : Number(row.export_fps) || 30,
    export_format: asString(row.export_format) || "MP4",
    upload_path_finals: asString(row.upload_path_finals),
    final_check: asString(row.final_check),
    status: (asString(row.status) || "draft") as EditingBriefStatus,
    reviewer_comment: asString(row.reviewer_comment),
    created_by: asString(row.created_by),
    reminder_sent_at: asNullableString(row.reminder_sent_at),
    overdue_alerted_at: asNullableString(row.overdue_alerted_at),
    delivered_at: asNullableString(row.delivered_at),
    delivered_by: asNullableString(row.delivered_by),
    reviewed_at: asNullableString(row.reviewed_at),
    reviewed_by: asNullableString(row.reviewed_by),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    videos: [...videos].sort((a, b) => a.position - b.position),
  };
}

async function loadVideos(briefIds: string[]): Promise<Map<string, EditingBriefVideo[]>> {
  const map = new Map<string, EditingBriefVideo[]>();
  if (!briefIds.length) return map;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("editing_brief_videos")
    .select("*")
    .in("brief_id", briefIds)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const v = mapVideo(row as Record<string, unknown>);
    const list = map.get(v.brief_id) ?? [];
    list.push(v);
    map.set(v.brief_id, list);
  }
  return map;
}

function sortBriefs(briefs: EditingBrief[]): EditingBrief[] {
  return [...briefs].sort((a, b) => {
    if (a.priority === "urgent" && b.priority !== "urgent") return -1;
    if (b.priority === "urgent" && a.priority !== "urgent") return 1;
    const da = a.deadline_at || "";
    const db = b.deadline_at || "";
    if (da && db && da !== db) return da.localeCompare(db);
    if (da && !db) return -1;
    if (db && !da) return 1;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
}

async function replaceVideos(
  briefId: string,
  videos: EditingBriefVideoInput[],
): Promise<EditingBriefVideo[]> {
  const sb = getSupabaseServiceClient();
  const { error: delErr } = await sb.from("editing_brief_videos").delete().eq("brief_id", briefId);
  if (delErr) throw new Error(delErr.message);
  if (!videos.length) return [];
  const rows = videos.map((v, i) => ({
    brief_id: briefId,
    position: i,
    output_name: v.output_name ?? "",
    raw_take: v.raw_take ?? "",
    special_instructions: v.special_instructions ?? "",
  }));
  const { data, error } = await sb.from("editing_brief_videos").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapVideo(r as Record<string, unknown>));
}

async function notifyEditor(params: {
  brief: EditingBrief;
  event: "published" | "updated" | "reminder" | "changes_needed" | "approved";
  actorUserId?: string;
  extraBody?: string;
}): Promise<void> {
  const { brief, event, actorUserId, extraBody } = params;
  const editorId = brief.assigned_editor_id?.trim();
  if (!editorId || editorId === actorUserId) return;

  const isUrgent = brief.priority === "urgent";
  const highEvents = new Set(["reminder", "changes_needed"]);
  const priority: NotificationPriority =
    highEvents.has(event) || (event === "published" && isUrgent)
      ? NOTIFICATION_PRIORITY.HIGH
      : NOTIFICATION_PRIORITY.NORMAL;

  const eventType =
    event === "published"
      ? NOTIFICATION_EVENT.EDITING_BRIEF_PUBLISHED
      : event === "updated"
        ? NOTIFICATION_EVENT.EDITING_BRIEF_UPDATED
        : event === "reminder"
          ? NOTIFICATION_EVENT.EDITING_BRIEF_REMINDER
          : event === "changes_needed"
            ? NOTIFICATION_EVENT.EDITING_BRIEF_CHANGES_NEEDED
            : NOTIFICATION_EVENT.EDITING_BRIEF_APPROVED;

  const title =
    event === "published"
      ? isUrgent
        ? `Urgent editing brief: ${brief.title}`
        : `New editing brief: ${brief.title}`
      : event === "updated"
        ? `Editing brief updated: ${brief.title}`
        : event === "reminder"
          ? `Editing deadline soon: ${brief.title}`
          : event === "changes_needed"
            ? `Changes needed: ${brief.title}`
            : `Editing approved: ${brief.title}`;

  const body =
    extraBody ??
    (event === "changes_needed"
      ? brief.reviewer_comment || "Reviewer requested changes"
      : event === "reminder"
        ? "Deadline approaching — mark Delivered when finals are uploaded"
        : `Open Editing Briefs for full instructions`);

  await notify({
    user_id: editorId,
    event_type: eventType,
    priority,
    title,
    body,
    entity_type: NOTIFICATION_ENTITY.EDITING_BRIEF,
    entity_id: brief.id,
    actor_user_id: actorUserId,
    _triggerSource: `editing_brief_${event}`,
  }).catch((err) => console.error(`[editing_brief_${event}] notify failed`, err));
}

async function notifyPermissionSet(params: {
  brief: EditingBrief;
  permissions: Array<(typeof PERMISSIONS)[keyof typeof PERMISSIONS]>;
  event_type: (typeof NOTIFICATION_EVENT)[keyof typeof NOTIFICATION_EVENT];
  title: string;
  body: string;
  actorUserId?: string;
  alsoUserIds?: string[];
  triggerSource: string;
}): Promise<void> {
  const ids = new Set<string>();
  for (const perm of params.permissions) {
    const holders = await listUsersWithPermission(perm).catch(() => []);
    for (const u of holders) if (u.id) ids.add(u.id);
  }
  for (const id of params.alsoUserIds ?? []) if (id) ids.add(id);

  await Promise.all(
    [...ids]
      .filter((id) => id && id !== params.actorUserId)
      .map((user_id) =>
        notify({
          user_id,
          event_type: params.event_type,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: params.title,
          body: params.body,
          entity_type: NOTIFICATION_ENTITY.EDITING_BRIEF,
          entity_id: params.brief.id,
          actor_user_id: params.actorUserId,
          _triggerSource: params.triggerSource,
        }).catch((err) => console.error(`[${params.triggerSource}] notify failed`, err)),
      ),
  );
}

export async function listEditingBriefs(
  filters: ListEditingBriefsFilters = {},
): Promise<EditingBrief[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from("editing_briefs").select("*");

  const status = filters.status ?? "active";
  if (status === "active") {
    q = q.in("status", ["published", "delivered", "changes_needed", "approved"]);
  } else if (status !== "all") {
    q = q.eq("status", status);
  }
  if (filters.model_id) q = q.eq("model_id", filters.model_id);
  if (filters.priority && filters.priority !== "all") q = q.eq("priority", filters.priority);
  if (filters.assigned_editor_id) q = q.eq("assigned_editor_id", filters.assigned_editor_id);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const vids = await loadVideos(rows.map((r) => asString(r.id)));
  return sortBriefs(rows.map((r) => mapBrief(r, vids.get(asString(r.id)) ?? [])));
}

export async function getEditingBriefById(id: string): Promise<EditingBrief | null> {
  const bid = id.trim();
  if (!bid) return null;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from("editing_briefs").select("*").eq("id", bid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const vids = await loadVideos([bid]);
  return mapBrief(data as Record<string, unknown>, vids.get(bid) ?? []);
}

function rowFromInput(input: EditingBriefInput, createdBy?: string): Record<string, unknown> {
  const deadline = resolveDeadlineUtc(input);
  return {
    title: input.title ?? "",
    model_id: input.model_id ?? "",
    reference_links: input.reference_links ?? [],
    priority: input.priority ?? "normal",
    deadline_at: deadline,
    deliverables_count: input.deliverables_count ?? 1,
    recording_brief_id: input.recording_brief_id ?? null,
    assigned_editor_id: input.assigned_editor_id ?? "",
    concept: input.concept ?? "",
    raw_footage_path: input.raw_footage_path ?? "",
    raw_files_takes: input.raw_files_takes ?? "",
    cut_rules: input.cut_rules ?? "",
    audio_voice: input.audio_voice ?? "keep_voice",
    audio_music: Boolean(input.audio_music),
    audio_notes: input.audio_notes ?? "",
    text_graphics: input.text_graphics ?? [],
    do_not_add: input.do_not_add ?? "",
    export_width: input.export_width ?? 1080,
    export_height: input.export_height ?? 1920,
    export_fps: input.export_fps ?? 30,
    export_format: input.export_format ?? "MP4",
    upload_path_finals: input.upload_path_finals ?? "",
    final_check: input.final_check ?? "",
    status: input.status ?? "draft",
    reviewer_comment: input.reviewer_comment ?? "",
    ...(createdBy != null ? { created_by: createdBy } : {}),
    updated_at: new Date().toISOString(),
  };
}

export async function createEditingBrief(
  input: EditingBriefInput,
  opts?: { notify?: boolean; actorUserId?: string },
): Promise<EditingBrief> {
  if (!(input.title ?? "").trim()) throw new Error("Title is required");
  if (!(input.model_id ?? "").trim()) throw new Error("Model is required");
  const status = input.status ?? "draft";
  if (status === "published") {
    assertEditingPublishReady(input.assigned_editor_id);
  }

  const sb = getSupabaseServiceClient();
  const row = rowFromInput(input, input.created_by ?? "");
  const { data, error } = await sb.from("editing_briefs").insert(row).select("*").single();
  if (error) throw new Error(error.message);

  const briefId = asString((data as Record<string, unknown>).id);
  const videos = await replaceVideos(briefId, input.videos ?? []);
  const brief = mapBrief(data as Record<string, unknown>, videos);

  if (opts?.notify && brief.status === "published") {
    await notifyEditor({ brief, event: "published", actorUserId: opts.actorUserId });
  }
  return brief;
}

export async function updateEditingBrief(
  id: string,
  input: Partial<EditingBriefInput>,
  opts?: { notify?: boolean; actorUserId?: string },
): Promise<EditingBrief> {
  const existing = await getEditingBriefById(id);
  if (!existing) throw new Error("Brief not found");

  const merged: EditingBriefInput = {
    title: input.title ?? existing.title,
    model_id: input.model_id ?? existing.model_id,
    reference_links: input.reference_links ?? existing.reference_links,
    priority: input.priority ?? existing.priority,
    deadline_local_greece: input.deadline_local_greece,
    deadline_at:
      input.deadline_local_greece !== undefined
        ? undefined
        : input.deadline_at !== undefined
          ? input.deadline_at
          : existing.deadline_at,
    deliverables_count: input.deliverables_count ?? existing.deliverables_count,
    recording_brief_id:
      input.recording_brief_id !== undefined
        ? input.recording_brief_id
        : existing.recording_brief_id,
    assigned_editor_id: input.assigned_editor_id ?? existing.assigned_editor_id,
    concept: input.concept ?? existing.concept,
    raw_footage_path: input.raw_footage_path ?? existing.raw_footage_path,
    raw_files_takes: input.raw_files_takes ?? existing.raw_files_takes,
    cut_rules: input.cut_rules ?? existing.cut_rules,
    audio_voice: input.audio_voice ?? existing.audio_voice,
    audio_music: input.audio_music ?? existing.audio_music,
    audio_notes: input.audio_notes ?? existing.audio_notes,
    text_graphics: input.text_graphics ?? existing.text_graphics,
    do_not_add: input.do_not_add ?? existing.do_not_add,
    export_width: input.export_width ?? existing.export_width,
    export_height: input.export_height ?? existing.export_height,
    export_fps: input.export_fps ?? existing.export_fps,
    export_format: input.export_format ?? existing.export_format,
    upload_path_finals: input.upload_path_finals ?? existing.upload_path_finals,
    final_check: input.final_check ?? existing.final_check,
    status: input.status ?? existing.status,
    reviewer_comment: input.reviewer_comment ?? existing.reviewer_comment,
    videos: input.videos,
  };

  if (merged.status === "published") {
    assertEditingPublishReady(merged.assigned_editor_id);
  }
  if (input.status && input.status !== existing.status) {
    assertEditingTransition({
      from: existing.status,
      to: input.status,
      capabilities: ["manage"],
      reviewerComment: merged.reviewer_comment,
    });
  }

  const sb = getSupabaseServiceClient();
  const patch = rowFromInput(merged);
  delete patch.created_by;
  if (
    (existing.status === "published" || existing.status === "changes_needed") &&
    patch.deadline_at !== existing.deadline_at
  ) {
    patch.reminder_sent_at = null;
    patch.overdue_alerted_at = null;
  }

  const { data, error } = await sb
    .from("editing_briefs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  let videos = existing.videos;
  if (input.videos) {
    videos = await replaceVideos(id, input.videos);
  }
  const brief = mapBrief(data as Record<string, unknown>, videos);

  const becamePublished =
    existing.status !== "published" && brief.status === "published";
  const editedWhileActive =
    (existing.status === "published" || existing.status === "changes_needed") &&
    (brief.status === "published" || brief.status === "changes_needed");

  if (opts?.notify) {
    if (becamePublished) {
      await notifyEditor({ brief, event: "published", actorUserId: opts.actorUserId });
    } else if (editedWhileActive) {
      await notifyEditor({ brief, event: "updated", actorUserId: opts.actorUserId });
    }
  }
  return brief;
}

export async function transitionEditingBriefStatus(params: {
  id: string;
  to: EditingBriefStatus;
  capabilities: BriefActorCapability[];
  isAssignedEditor?: boolean;
  reviewerComment?: string;
  actorUserId?: string;
}): Promise<EditingBrief> {
  const existing = await getEditingBriefById(params.id);
  if (!existing) throw new Error("Brief not found");

  if (params.to === "published") {
    assertEditingPublishReady(existing.assigned_editor_id);
  }

  try {
    assertEditingTransition({
      from: existing.status,
      to: params.to,
      capabilities: params.capabilities,
      isAssignedEditor: params.isAssignedEditor,
      reviewerComment: params.reviewerComment,
    });
  } catch (e) {
    if (e instanceof BriefTransitionError) throw e;
    throw e;
  }

  const sb = getSupabaseServiceClient();
  const patch: Record<string, unknown> = {
    status: params.to,
    updated_at: new Date().toISOString(),
  };
  if (params.to === "delivered") {
    patch.delivered_at = new Date().toISOString();
    patch.delivered_by = params.actorUserId ?? "";
  }
  if (params.to === "approved" || params.to === "changes_needed") {
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = params.actorUserId ?? "";
    if (params.to === "changes_needed") {
      patch.reviewer_comment = (params.reviewerComment ?? "").trim();
    }
  }
  if (params.to === "published" && existing.status === "draft") {
    patch.reminder_sent_at = null;
    patch.overdue_alerted_at = null;
  }

  const { data, error } = await sb
    .from("editing_briefs")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const brief = mapBrief(data as Record<string, unknown>, existing.videos);

  if (params.to === "published" && existing.status !== "published") {
    await notifyEditor({ brief, event: "published", actorUserId: params.actorUserId });
  }
  if (params.to === "delivered") {
    await notifyPermissionSet({
      brief,
      permissions: [PERMISSIONS.EDITING_BRIEFS_MANAGE, PERMISSIONS.EDITING_BRIEFS_REVIEW],
      event_type: NOTIFICATION_EVENT.EDITING_BRIEF_DELIVERED,
      title: `Editing delivered: ${brief.title}`,
      body: "Editor marked Delivered — ready for review",
      actorUserId: params.actorUserId,
      alsoUserIds: [brief.created_by],
      triggerSource: "editing_brief_delivered",
    });
  }
  if (params.to === "changes_needed") {
    await notifyEditor({
      brief,
      event: "changes_needed",
      actorUserId: params.actorUserId,
      extraBody: brief.reviewer_comment,
    });
  }
  if (params.to === "approved") {
    await notifyEditor({ brief, event: "approved", actorUserId: params.actorUserId });
    await notifyPermissionSet({
      brief,
      permissions: [PERMISSIONS.EDITING_BRIEFS_MANAGE],
      event_type: NOTIFICATION_EVENT.EDITING_BRIEF_APPROVED,
      title: `Editing approved: ${brief.title}`,
      body: "Manager approved the delivered edits",
      actorUserId: params.actorUserId,
      alsoUserIds: [brief.created_by],
      triggerSource: "editing_brief_approved",
    });
  }
  return brief;
}

export async function duplicateEditingBrief(
  id: string,
  actorUserId?: string,
): Promise<EditingBrief> {
  const src = await getEditingBriefById(id);
  if (!src) throw new Error("Brief not found");
  return createEditingBrief(
    {
      title: `${src.title} (copy)`,
      model_id: src.model_id,
      reference_links: src.reference_links,
      priority: src.priority,
      deadline_at: src.deadline_at,
      deliverables_count: src.deliverables_count,
      recording_brief_id: src.recording_brief_id,
      assigned_editor_id: src.assigned_editor_id,
      concept: src.concept,
      raw_footage_path: src.raw_footage_path,
      raw_files_takes: src.raw_files_takes,
      cut_rules: src.cut_rules,
      audio_voice: src.audio_voice,
      audio_music: src.audio_music,
      audio_notes: src.audio_notes,
      text_graphics: src.text_graphics.length ? src.text_graphics : [emptyTextGraphics()],
      do_not_add: src.do_not_add,
      export_width: src.export_width,
      export_height: src.export_height,
      export_fps: src.export_fps,
      export_format: src.export_format,
      upload_path_finals: src.upload_path_finals,
      final_check: src.final_check,
      status: "draft",
      reviewer_comment: "",
      videos: src.videos.map((v) => ({
        output_name: v.output_name,
        raw_take: v.raw_take,
        special_instructions: v.special_instructions,
      })),
      created_by: actorUserId ?? src.created_by,
    },
    { notify: false },
  );
}

export { emptyTextGraphics };

export async function runEditingBriefDeadlineJobs(leadHours: number): Promise<{
  reminders: number;
  overdue: number;
}> {
  const sb = getSupabaseServiceClient();
  const now = new Date();
  const reminderUntil = new Date(now.getTime() + leadHours * 3600_000);

  let reminders = 0;
  let overdue = 0;

  const { data: dueReminders, error: remErr } = await sb
    .from("editing_briefs")
    .select("*")
    .in("status", ["published", "changes_needed"])
    .is("reminder_sent_at", null)
    .not("deadline_at", "is", null)
    .lte("deadline_at", reminderUntil.toISOString())
    .gt("deadline_at", now.toISOString());
  if (remErr) throw new Error(remErr.message);

  for (const row of dueReminders ?? []) {
    const id = asString((row as Record<string, unknown>).id);
    const vids = await loadVideos([id]);
    const brief = mapBrief(row as Record<string, unknown>, vids.get(id) ?? []);
    const { error } = await sb
      .from("editing_briefs")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", id)
      .is("reminder_sent_at", null);
    if (error) continue;
    await notifyEditor({ brief, event: "reminder" });
    reminders += 1;
  }

  const { data: overdueRows, error: odErr } = await sb
    .from("editing_briefs")
    .select("*")
    .in("status", ["published", "changes_needed"])
    .is("overdue_alerted_at", null)
    .not("deadline_at", "is", null)
    .lt("deadline_at", now.toISOString());
  if (odErr) throw new Error(odErr.message);

  for (const row of overdueRows ?? []) {
    const id = asString((row as Record<string, unknown>).id);
    const vids = await loadVideos([id]);
    const brief = mapBrief(row as Record<string, unknown>, vids.get(id) ?? []);
    const { error } = await sb
      .from("editing_briefs")
      .update({ overdue_alerted_at: now.toISOString() })
      .eq("id", id)
      .is("overdue_alerted_at", null);
    if (error) continue;
    await notifyPermissionSet({
      brief,
      permissions: [PERMISSIONS.EDITING_BRIEFS_MANAGE],
      event_type: NOTIFICATION_EVENT.EDITING_BRIEF_OVERDUE,
      title: `Editing overdue: ${brief.title}`,
      body: "Deadline passed without Delivered",
      alsoUserIds: [brief.created_by],
      triggerSource: "editing_brief_overdue",
    });
    overdue += 1;
  }

  return { reminders, overdue };
}
