/**
 * Filming work area — shoot assignments, upload confirmation, filming calendar.
 * Permission-gated (filming:view_assignments / filming:manage); no hardcoded filmer role.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { coerceFilmingStatus, type FilmingStatus } from "@/lib/filming-helpers";
import { slotFilled } from "@/lib/winner-sourcing-helpers";
import {
  getVideoBunch,
  listSlotsForBunch,
  listVideoBunches,
  type RecreateVideoSlot,
  type VideoBunch,
} from "@/services/winner-sourcing";
import { getWinnerVideoById, type WinnerVideoRecord } from "@/services/winner-videos";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import { getActiveModelUserAirtableIdByLinkedModelRecordId, listUsersWithPermission } from "@/services/users";
import type { NotificationEventType, NotificationPriority } from "@/types";

async function notifyPermissionHolders(params: {
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
  event_type: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  actor_user_id?: string;
  excludeUserId?: string;
  triggerSource: string;
}): Promise<void> {
  const users = await listUsersWithPermission(params.permission).catch(() => []);
  await Promise.all(
    users
      .filter((u) => u.id && u.id !== params.excludeUserId)
      .map((u) =>
        notify({
          user_id: u.id,
          event_type: params.event_type,
          priority: params.priority,
          title: params.title,
          body: params.body,
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          actor_user_id: params.actor_user_id,
          _triggerSource: params.triggerSource,
        }).catch(() => {}),
      ),
  );
}

export type ShootSlotDetail = RecreateVideoSlot & {
  script_text: string;
  text_on_screen_suggestion: string;
  script_brief: string;
  script_brief_attachment_url: string;
  script_brief_attachment_filename: string;
  script_video_type: string;
  assigned_creator_name: string;
};

export type ShootAssignment = {
  bunch: VideoBunch;
  slots: ShootSlotDetail[];
  filmed_count: number;
  filmable_count: number;
};

export type FilmingScheduleEntry = {
  id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  model_id: string;
  model_name: string;
  location: string;
  notes: string;
  created_by_id: string;
  created_by_name: string;
  model_schedule_item_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapSchedule(row: Record<string, unknown>): FilmingScheduleEntry {
  return {
    id: String(row.id),
    schedule_date: String(row.schedule_date ?? "").slice(0, 10),
    start_time: String(row.start_time ?? ""),
    end_time: String(row.end_time ?? ""),
    model_id: String(row.model_id ?? ""),
    model_name: String(row.model_name ?? ""),
    location: String(row.location ?? ""),
    notes: String(row.notes ?? ""),
    created_by_id: String(row.created_by_id ?? ""),
    created_by_name: String(row.created_by_name ?? ""),
    model_schedule_item_id: row.model_schedule_item_id ? String(row.model_schedule_item_id) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

async function enrichSlotsWithScripts(slots: RecreateVideoSlot[]): Promise<ShootSlotDetail[]> {
  const approved = slots.filter((s) => s.status === "Approved" && Boolean(s.winner_video_id));
  const videos = await Promise.all(
    approved.map(async (s) => {
      const v = s.winner_video_id ? await getWinnerVideoById(s.winner_video_id).catch(() => null) : null;
      return [s.id, v] as const;
    }),
  );
  const bySlot = new Map<string, WinnerVideoRecord | null>(videos);

  return slots
    .filter((s) => s.status === "Approved")
    .map((s) => {
      const v = bySlot.get(s.id) ?? null;
      return {
        ...s,
        script_text: v?.script_text ?? "",
        text_on_screen_suggestion: v?.text_on_screen_suggestion ?? "",
        script_brief: v?.script_brief ?? "",
        script_brief_attachment_url: v?.script_brief_attachment_url ?? "",
        script_brief_attachment_filename: v?.script_brief_attachment_filename ?? "",
        script_video_type: v?.script_video_type ?? s.video_type ?? "",
        assigned_creator_name: v?.assigned_creator_name ?? "",
      };
    })
    .sort((a, b) => a.sequence_number - b.sequence_number);
}

function filmingProgress(slots: RecreateVideoSlot[]): { filmed_count: number; filmable_count: number } {
  const filmable = slots.filter((s) => s.status === "Approved");
  return {
    filmable_count: filmable.length,
    filmed_count: filmable.filter((s) => s.filmed).length,
  };
}

/** Bunches assigned to this filmer (or all with filming activity for managers). */
export async function listShootAssignmentsForFilmer(filmerId: string): Promise<ShootAssignment[]> {
  const id = filmerId.trim();
  if (!id) return [];
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("video_bunches")
    .select("*")
    .eq("assigned_filmer_id", id)
    .in("filming_status", ["assigned", "in_progress", "uploaded"])
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listShootAssignmentsForFilmer: ${error.message}`);

  const bunches = (data ?? []).map((row) => {
    // Reuse mapper via list — inline minimal mapping
    return row as Record<string, unknown>;
  });

  const results: ShootAssignment[] = [];
  for (const row of bunches) {
    const bunch = await getVideoBunch(String(row.id));
    if (!bunch) continue;
    const slots = await listSlotsForBunch(bunch.id);
    const progress = filmingProgress(slots);
    const enriched = await enrichSlotsWithScripts(slots);
    results.push({
      bunch: { ...bunch, ...progress },
      slots: enriched,
      ...progress,
    });
  }
  return results;
}

/** Admin: bunches ready to assign (all filled slots Approved) or already in filming. */
export async function listBunchesForFilmingManage(): Promise<
  Array<VideoBunch & { slots: RecreateVideoSlot[]; scripts_ready: boolean }>
> {
  const bunches = await listVideoBunches();
  const out: Array<VideoBunch & { slots: RecreateVideoSlot[]; scripts_ready: boolean }> = [];
  for (const bunch of bunches) {
    const slots = await listSlotsForBunch(bunch.id);
    const filled = slots.filter((s) => slotFilled(s) || s.status === "Approved" || s.status === "Pending Review" || s.status === "Needs Script" || s.status === "Rejected");
    const scripts_ready =
      filled.length > 0 && filled.every((s) => s.status === "Approved");
    const progress = filmingProgress(slots);
    if (!scripts_ready && !bunch.assigned_filmer_id && bunch.filming_status === "unassigned") {
      continue;
    }
    out.push({ ...bunch, ...progress, slots, scripts_ready });
  }
  return out;
}

export async function assignFilmerToBunch(input: {
  bunch_id: string;
  assigned_filmer_id: string;
  assigned_filmer_name: string;
  actor_user_id?: string;
  actor_user_name?: string;
}): Promise<VideoBunch> {
  const filmerId = input.assigned_filmer_id.trim();
  const filmerName = input.assigned_filmer_name.trim();
  if (!filmerId) throw new Error("Filmer is required");
  if (!filmerName) throw new Error("Filmer name is required");

  const bunch = await getVideoBunch(input.bunch_id);
  if (!bunch) throw new Error("Bunch not found");

  const slots = await listSlotsForBunch(bunch.id);
  const filled = slots.filter(
    (s) =>
      slotFilled(s) ||
      s.status === "Approved" ||
      s.status === "Pending Review" ||
      s.status === "Needs Script" ||
      s.status === "Rejected",
  );
  if (filled.length === 0) throw new Error("Bunch has no slots to film");
  if (!filled.every((s) => s.status === "Approved")) {
    throw new Error("All scripts in the bunch must be approved before assigning a filmer");
  }

  const sb = getSupabaseServiceClient();
  const nextStatus: FilmingStatus =
    coerceFilmingStatus(bunch.filming_status) === "uploaded" ? "uploaded" : "assigned";

  const { data, error } = await sb
    .from("video_bunches")
    .update({
      assigned_filmer_id: filmerId,
      assigned_filmer_name: filmerName,
      filming_status: nextStatus === "uploaded" ? "assigned" : "assigned",
      upload_folder_link: "",
      uploaded_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bunch.id)
    .select("*")
    .single();
  if (error) throw new Error(`assignFilmerToBunch: ${error.message}`);

  // Reset filmed flags on reassignment
  await sb
    .from("recreate_video_slots")
    .update({ filmed: false, filmed_at: null, updated_at: new Date().toISOString() })
    .eq("bunch_id", bunch.id);

  await notify({
    user_id: filmerId,
    event_type: NOTIFICATION_EVENT.BUNCH_ASSIGNED_TO_FILMER,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: "🎬 Bunch assigned for filming",
    body: `“${bunch.name}” (${bunch.model_name || "model"}) was assigned to you — ${filled.length} script${filled.length === 1 ? "" : "s"} ready to shoot.`,
    entity_type: NOTIFICATION_ENTITY.FILMING_ASSIGNMENT,
    entity_id: bunch.id,
    actor_user_id: input.actor_user_id,
    _triggerSource: "assign_filmer_to_bunch",
  }).catch(() => {});

  const refreshed = await getVideoBunch(bunch.id);
  return refreshed ?? (data as unknown as VideoBunch);
}

export async function setSlotFilmed(input: {
  slot_id: string;
  filmed: boolean;
  actor_user_id: string;
  allowManage: boolean;
}): Promise<{ slot: RecreateVideoSlot; bunch: VideoBunch }> {
  const sb = getSupabaseServiceClient();
  const { data: slotRow, error: slotErr } = await sb
    .from("recreate_video_slots")
    .select("*")
    .eq("id", input.slot_id)
    .maybeSingle();
  if (slotErr) throw new Error(slotErr.message);
  if (!slotRow) throw new Error("Slot not found");

  const bunch = await getVideoBunch(String(slotRow.bunch_id));
  if (!bunch) throw new Error("Bunch not found");
  if (!input.allowManage && bunch.assigned_filmer_id !== input.actor_user_id) {
    throw new Error("Forbidden");
  }
  if (String(slotRow.status) !== "Approved") {
    throw new Error("Only approved script slots can be marked filmed");
  }
  if (bunch.filming_status === "uploaded") {
    throw new Error("Bunch already uploaded — filming checklist is locked");
  }

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await sb
    .from("recreate_video_slots")
    .update({
      filmed: input.filmed,
      filmed_at: input.filmed ? now : null,
      updated_at: now,
    })
    .eq("id", input.slot_id)
    .select("*")
    .single();
  if (upErr) throw new Error(upErr.message);

  const slots = await listSlotsForBunch(bunch.id);
  const progress = filmingProgress(slots);
  let nextStatus: FilmingStatus = coerceFilmingStatus(bunch.filming_status);
  if (nextStatus !== "uploaded") {
    nextStatus = progress.filmed_count > 0 ? "in_progress" : "assigned";
  }
  if (nextStatus !== bunch.filming_status) {
    await sb
      .from("video_bunches")
      .update({ filming_status: nextStatus, updated_at: now })
      .eq("id", bunch.id);
  }

  const refreshed = await getVideoBunch(bunch.id);
  const slot: RecreateVideoSlot = {
    id: String(updated.id),
    bunch_id: String(updated.bunch_id),
    source: (updated.source as RecreateVideoSlot["source"]) || "researcher_submitted",
    sequence_number: Number(updated.sequence_number) || 1,
    description: String(updated.description ?? ""),
    video_link: String(updated.video_link ?? ""),
    video_type: (updated.video_type as RecreateVideoSlot["video_type"]) || "",
    video_type_other: String(updated.video_type_other ?? ""),
    status: (updated.status as RecreateVideoSlot["status"]) || "Approved",
    assigned_creative_id: String(updated.assigned_creative_id ?? ""),
    assigned_creative_name: String(updated.assigned_creative_name ?? ""),
    winner_submission_id: updated.winner_submission_id ? String(updated.winner_submission_id) : null,
    winner_video_id: updated.winner_video_id ? String(updated.winner_video_id) : null,
    filmed: Boolean(updated.filmed),
    filmed_at: updated.filmed_at ? String(updated.filmed_at) : null,
    created_at: String(updated.created_at ?? ""),
    updated_at: String(updated.updated_at ?? ""),
  };

  return { slot, bunch: refreshed ?? { ...bunch, filming_status: nextStatus, ...progress } };
}

export async function submitBunchUpload(input: {
  bunch_id: string;
  upload_folder_link: string;
  actor_user_id: string;
  actor_user_name?: string;
  allowManage: boolean;
}): Promise<VideoBunch> {
  const link = input.upload_folder_link.trim();
  if (!link) throw new Error("Upload folder link is required");

  const bunch = await getVideoBunch(input.bunch_id);
  if (!bunch) throw new Error("Bunch not found");
  if (!input.allowManage && bunch.assigned_filmer_id !== input.actor_user_id) {
    throw new Error("Forbidden");
  }

  const slots = await listSlotsForBunch(bunch.id);
  const progress = filmingProgress(slots);
  if (progress.filmable_count === 0) throw new Error("No approved slots to upload");
  if (progress.filmed_count < progress.filmable_count) {
    throw new Error(`Mark all slots filmed first (${progress.filmed_count} of ${progress.filmable_count})`);
  }

  const now = new Date().toISOString();
  const sb = getSupabaseServiceClient();
  const { error } = await sb
    .from("video_bunches")
    .update({
      filming_status: "uploaded",
      upload_folder_link: link,
      uploaded_at: now,
      updated_at: now,
    })
    .eq("id", bunch.id);
  if (error) throw new Error(`submitBunchUpload: ${error.message}`);

  await notifyPermissionHolders({
    permission: PERMISSIONS.FILMING_MANAGE,
    event_type: NOTIFICATION_EVENT.BUNCH_FILMING_UPLOADED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: "📁 Bunch footage uploaded",
    body: `${input.actor_user_name || bunch.assigned_filmer_name || "A filmer"} uploaded “${bunch.name}” (${bunch.model_name}).`,
    entity_type: NOTIFICATION_ENTITY.FILMING_ASSIGNMENT,
    entity_id: bunch.id,
    actor_user_id: input.actor_user_id,
    excludeUserId: input.actor_user_id,
    triggerSource: "submit_bunch_upload",
  });

  const refreshed = await getVideoBunch(bunch.id);
  return refreshed ?? bunch;
}

// ── Filming calendar ─────────────────────────────────────────────────────────

export async function listFilmingSchedule(filters?: {
  fromDate?: string;
  toDate?: string;
  model_id?: string;
}): Promise<FilmingScheduleEntry[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from("filming_schedule").select("*").order("schedule_date", { ascending: true });
  if (filters?.fromDate) q = q.gte("schedule_date", filters.fromDate);
  if (filters?.toDate) q = q.lte("schedule_date", filters.toDate);
  if (filters?.model_id) q = q.eq("model_id", filters.model_id);
  const { data, error } = await q;
  if (error) throw new Error(`listFilmingSchedule: ${error.message}`);
  return (data ?? []).map((r) => mapSchedule(r as Record<string, unknown>));
}

async function syncModelScheduleFromFilming(
  entry: FilmingScheduleEntry,
  actorUserId?: string,
): Promise<string | null> {
  const sb = getSupabaseServiceClient();
  const title = `Filming shoot${entry.location ? ` · ${entry.location}` : ""}`;
  const detailsParts = [
    entry.location ? `Location: ${entry.location}` : "",
    entry.notes?.trim() || "",
    `filming_schedule:${entry.id}`,
  ].filter(Boolean);
  const details = detailsParts.join("\n");

  const payload: Record<string, unknown> = {
    model_id: entry.model_id,
    model_name: entry.model_name,
    title,
    item_type: "content_shoot",
    date: entry.schedule_date,
    start_time: entry.start_time || null,
    end_time: entry.end_time || null,
    details,
    status: "scheduled",
    updated_at: new Date().toISOString(),
  };

  if (entry.model_schedule_item_id) {
    const { error } = await sb
      .from("model_schedule")
      .update(payload)
      .eq("id", entry.model_schedule_item_id);
    if (!error) return entry.model_schedule_item_id;
    // Fall through to insert if linked row missing
  }

  const { data, error } = await sb
    .from("model_schedule")
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[filming_schedule] model_schedule sync failed", error.message);
    return null;
  }
  const scheduleId = String(data.id);

  // Notify model user
  try {
    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(entry.model_id);
    if (modelUserId) {
      await notify({
        user_id: modelUserId,
        event_type: NOTIFICATION_EVENT.FILMING_SCHEDULE_CREATED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "📅 Filming shoot scheduled",
        body: `You have a shoot on ${entry.schedule_date}${entry.start_time ? ` at ${entry.start_time}` : ""}${entry.location ? ` · ${entry.location}` : ""}.`,
        entity_type: NOTIFICATION_ENTITY.FILMING_SCHEDULE,
        entity_id: entry.id,
        actor_user_id: actorUserId,
        _triggerSource: "filming_schedule_created_model",
      });
    }
  } catch {
    /* best-effort */
  }

  return scheduleId;
}

export async function createFilmingScheduleEntry(input: {
  schedule_date: string;
  start_time?: string;
  end_time?: string;
  model_id: string;
  model_name: string;
  location?: string;
  notes?: string;
  created_by_id: string;
  created_by_name: string;
}): Promise<FilmingScheduleEntry> {
  const date = input.schedule_date.trim().slice(0, 10);
  const modelId = input.model_id.trim();
  if (!date) throw new Error("Date is required");
  if (!modelId) throw new Error("Model is required");

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("filming_schedule")
    .insert({
      schedule_date: date,
      start_time: (input.start_time ?? "").trim(),
      end_time: (input.end_time ?? "").trim(),
      model_id: modelId,
      model_name: (input.model_name ?? "").trim(),
      location: (input.location ?? "").trim(),
      notes: (input.notes ?? "").trim(),
      created_by_id: input.created_by_id.trim(),
      created_by_name: input.created_by_name.trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`createFilmingScheduleEntry: ${error.message}`);

  let entry = mapSchedule(data as Record<string, unknown>);
  const scheduleItemId = await syncModelScheduleFromFilming(entry, input.created_by_id);
  if (scheduleItemId) {
    const { data: updated } = await sb
      .from("filming_schedule")
      .update({ model_schedule_item_id: scheduleItemId, updated_at: new Date().toISOString() })
      .eq("id", entry.id)
      .select("*")
      .single();
    if (updated) entry = mapSchedule(updated as Record<string, unknown>);
  }
  return entry;
}

export async function updateFilmingScheduleEntry(
  id: string,
  patch: Partial<{
    schedule_date: string;
    start_time: string;
    end_time: string;
    model_id: string;
    model_name: string;
    location: string;
    notes: string;
  }>,
  actorUserId?: string,
): Promise<FilmingScheduleEntry> {
  const sb = getSupabaseServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.schedule_date !== undefined) updates.schedule_date = patch.schedule_date.trim().slice(0, 10);
  if (patch.start_time !== undefined) updates.start_time = patch.start_time.trim();
  if (patch.end_time !== undefined) updates.end_time = patch.end_time.trim();
  if (patch.model_id !== undefined) updates.model_id = patch.model_id.trim();
  if (patch.model_name !== undefined) updates.model_name = patch.model_name.trim();
  if (patch.location !== undefined) updates.location = patch.location.trim();
  if (patch.notes !== undefined) updates.notes = patch.notes.trim();

  const { data, error } = await sb
    .from("filming_schedule")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateFilmingScheduleEntry: ${error.message}`);

  let entry = mapSchedule(data as Record<string, unknown>);
  const scheduleItemId = await syncModelScheduleFromFilming(entry, actorUserId);
  if (scheduleItemId && scheduleItemId !== entry.model_schedule_item_id) {
    const { data: updated } = await sb
      .from("filming_schedule")
      .update({ model_schedule_item_id: scheduleItemId })
      .eq("id", entry.id)
      .select("*")
      .single();
    if (updated) entry = mapSchedule(updated as Record<string, unknown>);
  }
  return entry;
}

export async function deleteFilmingScheduleEntry(id: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { data: existing } = await sb.from("filming_schedule").select("*").eq("id", id).maybeSingle();
  if (existing?.model_schedule_item_id) {
    await sb.from("model_schedule").delete().eq("id", existing.model_schedule_item_id);
  }
  const { error } = await sb.from("filming_schedule").delete().eq("id", id);
  if (error) throw new Error(`deleteFilmingScheduleEntry: ${error.message}`);
}

/** Filming progress for Hub bunches list (batch). */
export async function getFilmingProgressForBunches(
  bunchIds: string[],
): Promise<Record<string, { filmed_count: number; filmable_count: number }>> {
  const ids = [...new Set(bunchIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return {};
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("recreate_video_slots")
    .select("bunch_id, status, filmed")
    .in("bunch_id", ids);
  if (error) throw new Error(error.message);
  const out: Record<string, { filmed_count: number; filmable_count: number }> = {};
  for (const id of ids) out[id] = { filmed_count: 0, filmable_count: 0 };
  for (const row of data ?? []) {
    const bid = String(row.bunch_id);
    if (!out[bid]) out[bid] = { filmed_count: 0, filmable_count: 0 };
    if (String(row.status) !== "Approved") continue;
    out[bid].filmable_count += 1;
    if (row.filmed) out[bid].filmed_count += 1;
  }
  return out;
}
