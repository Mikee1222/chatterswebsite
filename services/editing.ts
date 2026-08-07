/**
 * Editing work area — edit assignments, per-slot edited checklist, upload confirmation.
 * Permission-gated (editing:view_assignments / editing:manage); no hardcoded editor role.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  bunchReadyForEditing,
  coerceEditingStatus,
  type EditingStatus,
} from "@/lib/editing-helpers";
import {
  getVideoBunch,
  listSlotsForBunch,
  type RecreateVideoSlot,
  type VideoBunch,
} from "@/services/winner-sourcing";
import { getWinnerVideoById, type WinnerVideoRecord } from "@/services/winner-videos";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import { listUsersWithPermission } from "@/services/users";
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

export type EditSlotDetail = RecreateVideoSlot & {
  script_text: string;
  text_on_screen_suggestion: string;
  script_brief: string;
  script_brief_attachment_url: string;
  script_brief_attachment_filename: string;
  script_video_type: string;
  assigned_creator_name: string;
};

export type EditAssignment = {
  bunch: VideoBunch;
  slots: EditSlotDetail[];
  edited_count: number;
  editable_count: number;
};

async function enrichSlotsWithScripts(slots: RecreateVideoSlot[]): Promise<EditSlotDetail[]> {
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

function editingProgress(slots: RecreateVideoSlot[]): { edited_count: number; editable_count: number } {
  const editable = slots.filter((s) => s.status === "Approved");
  return {
    editable_count: editable.length,
    edited_count: editable.filter((s) => s.edited).length,
  };
}

/** Bunches assigned to this editor. */
export async function listEditAssignmentsForEditor(editorId: string): Promise<EditAssignment[]> {
  const id = editorId.trim();
  if (!id) return [];
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("video_bunches")
    .select("*")
    .eq("assigned_editor_id", id)
    .in("editing_status", ["assigned", "in_progress", "uploaded"])
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listEditAssignmentsForEditor: ${error.message}`);

  const results: EditAssignment[] = [];
  for (const row of data ?? []) {
    const bunch = await getVideoBunch(String(row.id));
    if (!bunch) continue;
    const slots = await listSlotsForBunch(bunch.id);
    const progress = editingProgress(slots);
    const enriched = await enrichSlotsWithScripts(slots);
    results.push({
      bunch: { ...bunch, ...progress },
      slots: enriched,
      ...progress,
    });
  }
  return results;
}

export async function assignEditorToBunch(input: {
  bunch_id: string;
  assigned_editor_id: string;
  assigned_editor_name: string;
  actor_user_id?: string;
  actor_user_name?: string;
}): Promise<VideoBunch> {
  const editorId = input.assigned_editor_id.trim();
  const editorName = input.assigned_editor_name.trim();
  if (!editorId) throw new Error("Editor is required");
  if (!editorName) throw new Error("Editor name is required");

  const bunch = await getVideoBunch(input.bunch_id);
  if (!bunch) throw new Error("Bunch not found");
  if (!bunchReadyForEditing(bunch)) {
    throw new Error("Filming must be uploaded before assigning an editor");
  }

  const slots = await listSlotsForBunch(bunch.id);
  const approved = slots.filter((s) => s.status === "Approved");
  if (approved.length === 0) throw new Error("Bunch has no approved slots to edit");

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("video_bunches")
    .update({
      assigned_editor_id: editorId,
      assigned_editor_name: editorName,
      editing_status: "assigned",
      edited_upload_folder_link: "",
      edited_uploaded_at: null,
      // Reset iCloud when re-assigning editing
      icloud_status: "pending",
      icloud_organized_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bunch.id)
    .select("*")
    .single();
  if (error) throw new Error(`assignEditorToBunch: ${error.message}`);

  await sb
    .from("recreate_video_slots")
    .update({ edited: false, edited_at: null, updated_at: new Date().toISOString() })
    .eq("bunch_id", bunch.id);

  await notify({
    user_id: editorId,
    event_type: NOTIFICATION_EVENT.BUNCH_ASSIGNED_TO_EDITOR,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: "✂️ Bunch assigned for editing",
    body: `“${bunch.name}” (${bunch.model_name || "model"}) was assigned to you — ${approved.length} slot${approved.length === 1 ? "" : "s"} ready to edit.`,
    entity_type: NOTIFICATION_ENTITY.EDITING_ASSIGNMENT,
    entity_id: bunch.id,
    actor_user_id: input.actor_user_id,
    _triggerSource: "assign_editor_to_bunch",
  }).catch(() => {});

  const refreshed = await getVideoBunch(bunch.id);
  return refreshed ?? (data as unknown as VideoBunch);
}

export async function setSlotEdited(input: {
  slot_id: string;
  edited: boolean;
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
  if (!input.allowManage && bunch.assigned_editor_id !== input.actor_user_id) {
    throw new Error("Forbidden");
  }
  if (String(slotRow.status) !== "Approved") {
    throw new Error("Only approved script slots can be marked edited");
  }
  if (bunch.editing_status === "uploaded") {
    throw new Error("Bunch already edited & uploaded — checklist is locked");
  }

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await sb
    .from("recreate_video_slots")
    .update({
      edited: input.edited,
      edited_at: input.edited ? now : null,
      updated_at: now,
    })
    .eq("id", input.slot_id)
    .select("*")
    .single();
  if (upErr) throw new Error(upErr.message);

  const slots = await listSlotsForBunch(bunch.id);
  const progress = editingProgress(slots);
  let nextStatus: EditingStatus = coerceEditingStatus(bunch.editing_status);
  if (nextStatus !== "uploaded") {
    nextStatus = progress.edited_count > 0 ? "in_progress" : "assigned";
  }
  if (nextStatus !== bunch.editing_status) {
    await sb
      .from("video_bunches")
      .update({ editing_status: nextStatus, updated_at: now })
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
    edited: Boolean(updated.edited),
    edited_at: updated.edited_at ? String(updated.edited_at) : null,
    created_at: String(updated.created_at ?? ""),
    updated_at: String(updated.updated_at ?? ""),
  };

  return { slot, bunch: refreshed ?? { ...bunch, editing_status: nextStatus, ...progress } };
}

export async function submitBunchEditedUpload(input: {
  bunch_id: string;
  edited_upload_folder_link: string;
  actor_user_id: string;
  actor_user_name?: string;
  allowManage: boolean;
}): Promise<VideoBunch> {
  const link = input.edited_upload_folder_link.trim();
  if (!link) throw new Error("Edited upload folder link is required");

  const bunch = await getVideoBunch(input.bunch_id);
  if (!bunch) throw new Error("Bunch not found");
  if (!input.allowManage && bunch.assigned_editor_id !== input.actor_user_id) {
    throw new Error("Forbidden");
  }

  const slots = await listSlotsForBunch(bunch.id);
  const progress = editingProgress(slots);
  if (progress.editable_count === 0) throw new Error("No approved slots to mark edited");
  if (progress.edited_count < progress.editable_count) {
    throw new Error(`Mark all slots edited first (${progress.edited_count} of ${progress.editable_count})`);
  }

  const now = new Date().toISOString();
  const sb = getSupabaseServiceClient();
  const { error } = await sb
    .from("video_bunches")
    .update({
      editing_status: "uploaded",
      edited_upload_folder_link: link,
      edited_uploaded_at: now,
      icloud_status: "pending",
      updated_at: now,
    })
    .eq("id", bunch.id);
  if (error) throw new Error(`submitBunchEditedUpload: ${error.message}`);

  await notifyPermissionHolders({
    permission: PERMISSIONS.EDITING_MANAGE,
    event_type: NOTIFICATION_EVENT.BUNCH_EDITING_UPLOADED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: "✂️ Bunch edited & uploaded",
    body: `${input.actor_user_name || bunch.assigned_editor_name || "An editor"} uploaded edited files for “${bunch.name}” (${bunch.model_name}).`,
    entity_type: NOTIFICATION_ENTITY.EDITING_ASSIGNMENT,
    entity_id: bunch.id,
    actor_user_id: input.actor_user_id,
    excludeUserId: input.actor_user_id,
    triggerSource: "submit_bunch_edited_upload",
  });

  const refreshed = await getVideoBunch(bunch.id);
  return refreshed ?? bunch;
}

/** Editing progress for Hub bunches list (batch). */
export async function getEditingProgressForBunches(
  bunchIds: string[],
): Promise<Record<string, { edited_count: number; editable_count: number }>> {
  const ids = [...new Set(bunchIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return {};
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("recreate_video_slots")
    .select("bunch_id, status, edited")
    .in("bunch_id", ids);
  if (error) throw new Error(error.message);
  const out: Record<string, { edited_count: number; editable_count: number }> = {};
  for (const id of ids) out[id] = { edited_count: 0, editable_count: 0 };
  for (const row of data ?? []) {
    const bid = String(row.bunch_id);
    if (!out[bid]) out[bid] = { edited_count: 0, editable_count: 0 };
    if (String(row.status) !== "Approved") continue;
    out[bid].editable_count += 1;
    if (row.edited) out[bid].edited_count += 1;
  }
  return out;
}
