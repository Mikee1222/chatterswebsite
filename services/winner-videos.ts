"use server";

import {
  createRecord,
  getRecord,
  listAllRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { uploadAirtableAttachment } from "@/lib/airtable-upload-attachment";
import {
  coerceWinnerVideoContentType,
  coerceWinnerVideoStatus,
  type WinnerVideoContentType,
  type WinnerVideoStatus,
} from "@/lib/winner-videos-helpers";
import {
  coerceScriptStatus,
  coerceScriptVideoType,
  type ScriptStatus,
  type ScriptVideoType,
} from "@/lib/creative-scripts-helpers";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { listUsersWithPermission } from "@/services/users";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import type { NotificationEventType, NotificationPriority } from "@/types";

const TABLE = "winner_videos";

/** Notify every active user whose role grants `permission` (e.g. winner_videos:manage reviewers). */
async function notifyPermissionHolders(params: {
  permission: Permission;
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
  const holders = await listUsersWithPermission(params.permission).catch(() => []);
  for (const u of holders) {
    if (!u.id) continue;
    if (params.excludeUserId && u.id === params.excludeUserId) continue;
    await notify({
      user_id: u.id,
      event_type: params.event_type,
      priority: params.priority,
      title: params.title,
      body: params.body,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      actor_user_id: params.actor_user_id,
      _triggerSource: params.triggerSource,
    }).catch((err) => console.error(`[${params.event_type}] notify holder failed`, err));
  }
}

export type WinnerVideoAttachment = { url: string; filename?: string };

export interface WinnerVideoRecord {
  id: string;
  video_id: string;
  reference_model_id: string;
  reference_model_name: string;
  video_link: string;
  note: string;
  submitted_by_name: string;
  submitted_by_id: string;
  submitted_at: string | null;
  status: WinnerVideoStatus;
  rejection_reason: string;
  reviewed_by_name: string;
  reviewed_at: string | null;
  assigned_creator_name: string;
  recreation_deadline: string | null;
  recreation_link: string;
  views_at_submission: number | null;
  screenshot: WinnerVideoAttachment[];
  video_file: WinnerVideoAttachment[];
  transcript: string;
  script_status: ScriptStatus;
  script_video_type: ScriptVideoType | "";
  script_text: string;
  script_submitted_by_name: string;
  script_submitted_by_id: string;
  script_submitted_at: string | null;
  script_reviewed_by_name: string;
  script_reviewed_at: string | null;
  script_rejection_reason: string;
  content_type: WinnerVideoContentType | "";
  /** Creative (staff with creative_scripts:submit) assigned to write the script on approve. */
  assigned_creative_name: string;
  assigned_creative_id: string;
}

export interface WinnerVideoFilters {
  status?: WinnerVideoStatus | "";
  content_type?: WinnerVideoContentType | "";
  script_status?: ScriptStatus | "";
  submitted_by_id?: string;
  script_submitted_by_id?: string;
  assigned_creative_id?: string;
  date_from?: string;
  date_to?: string;
}

type WinnerVideoFields = {
  video_id?: string;
  reference_model_id?: string;
  reference_model_name?: string;
  video_link?: string;
  note?: string;
  submitted_by_name?: string;
  submitted_by_id?: string;
  submitted_at?: string;
  status?: string;
  rejection_reason?: string;
  reviewed_by_name?: string;
  reviewed_at?: string | null;
  assigned_creator_name?: string;
  recreation_deadline?: string | null;
  recreation_link?: string;
  views_at_submission?: number | string | null;
  screenshot?: unknown;
  video_file?: unknown;
  transcript?: string;
  script_status?: string;
  script_video_type?: string;
  script_text?: string;
  script_submitted_by_name?: string;
  script_submitted_by_id?: string;
  script_submitted_at?: string;
  script_reviewed_by_name?: string;
  script_reviewed_at?: string | null;
  script_rejection_reason?: string;
  content_type?: string;
  assigned_creative_name?: string;
  assigned_creative_id?: string;
};

function escapeFormulaString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function mapAttachments(raw: unknown): WinnerVideoAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is { url?: string; filename?: string } => a != null && typeof a === "object")
    .map((a) => ({ url: String(a.url ?? ""), filename: a.filename ? String(a.filename) : undefined }))
    .filter((a) => a.url.length > 0);
}

function coerceViews(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

function mapWinnerVideo(rec: AirtableRecord<WinnerVideoFields>): WinnerVideoRecord {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    video_id: String(f.video_id ?? rec.id),
    reference_model_id: String(f.reference_model_id ?? ""),
    reference_model_name: String(f.reference_model_name ?? ""),
    video_link: String(f.video_link ?? ""),
    note: String(f.note ?? ""),
    submitted_by_name: String(f.submitted_by_name ?? ""),
    submitted_by_id: String(f.submitted_by_id ?? ""),
    submitted_at: f.submitted_at?.trim() ? String(f.submitted_at) : null,
    status: coerceWinnerVideoStatus(f.status),
    rejection_reason: String(f.rejection_reason ?? ""),
    reviewed_by_name: String(f.reviewed_by_name ?? ""),
    reviewed_at: f.reviewed_at?.trim() ? String(f.reviewed_at) : null,
    assigned_creator_name: String(f.assigned_creator_name ?? ""),
    recreation_deadline: f.recreation_deadline?.trim() ? String(f.recreation_deadline) : null,
    recreation_link: String(f.recreation_link ?? ""),
    views_at_submission: coerceViews(f.views_at_submission),
    screenshot: mapAttachments(f.screenshot),
    video_file: mapAttachments(f.video_file),
    transcript: String(f.transcript ?? ""),
    script_status: coerceScriptStatus(f.script_status),
    script_video_type: coerceScriptVideoType(f.script_video_type),
    script_text: String(f.script_text ?? ""),
    script_submitted_by_name: String(f.script_submitted_by_name ?? ""),
    script_submitted_by_id: String(f.script_submitted_by_id ?? ""),
    script_submitted_at: f.script_submitted_at?.trim() ? String(f.script_submitted_at) : null,
    script_reviewed_by_name: String(f.script_reviewed_by_name ?? ""),
    script_reviewed_at: f.script_reviewed_at?.trim() ? String(f.script_reviewed_at) : null,
    script_rejection_reason: String(f.script_rejection_reason ?? ""),
    content_type: coerceWinnerVideoContentType(f.content_type),
    assigned_creative_name: String(f.assigned_creative_name ?? ""),
    assigned_creative_id: String(f.assigned_creative_id ?? ""),
  };
}

function buildFilter(filters: WinnerVideoFilters): string | undefined {
  const parts: string[] = [];
  if (filters.submitted_by_id?.trim()) {
    parts.push(`{submitted_by_id} = "${escapeFormulaString(filters.submitted_by_id.trim())}"`);
  }
  if (filters.status) {
    parts.push(`{status} = "${escapeFormulaString(filters.status)}"`);
  }
  if (filters.content_type) {
    parts.push(`{content_type} = "${escapeFormulaString(filters.content_type)}"`);
  }
  if (filters.script_status) {
    parts.push(`{script_status} = "${escapeFormulaString(filters.script_status)}"`);
  }
  if (filters.script_submitted_by_id?.trim()) {
    parts.push(
      `{script_submitted_by_id} = "${escapeFormulaString(filters.script_submitted_by_id.trim())}"`,
    );
  }
  if (filters.assigned_creative_id?.trim()) {
    parts.push(
      `{assigned_creative_id} = "${escapeFormulaString(filters.assigned_creative_id.trim())}"`,
    );
  }
  if (filters.date_from?.trim()) {
    parts.push(`IS_AFTER({submitted_at}, "${escapeFormulaString(filters.date_from.trim())}")`);
  }
  if (filters.date_to?.trim()) {
    parts.push(`IS_BEFORE({submitted_at}, "${escapeFormulaString(filters.date_to.trim())}")`);
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return `AND(${parts.join(", ")})`;
}

export async function getWinnerVideosBySubmitter(vaId: string): Promise<WinnerVideoRecord[]> {
  const id = vaId.trim();
  if (!id) return [];
  return getAllWinnerVideos({ submitted_by_id: id });
}

export async function getAllWinnerVideos(filters: WinnerVideoFilters = {}): Promise<WinnerVideoRecord[]> {
  const filterByFormula = buildFilter(filters);
  const records = await listAllRecords<WinnerVideoFields>(TABLE, {
    ...(filterByFormula ? { filterByFormula } : {}),
    sort: [{ field: "submitted_at", direction: "desc" }],
  });
  return records.map(mapWinnerVideo);
}

export async function getWinnerVideoById(id: string): Promise<WinnerVideoRecord | null> {
  try {
    const rec = await getRecord<WinnerVideoFields>(TABLE, id);
    return mapWinnerVideo(rec);
  } catch {
    return null;
  }
}

export type CreateWinnerVideoInput = {
  reference_model_id?: string;
  reference_model_name: string;
  content_type: WinnerVideoContentType;
  video_link?: string;
  note?: string;
  views_at_submission?: number | null;
  submitted_by_id: string;
  submitted_by_name: string;
};

export async function createWinnerVideo(data: CreateWinnerVideoInput): Promise<WinnerVideoRecord> {
  const now = new Date().toISOString();
  const rec = await createRecord<WinnerVideoFields>(TABLE, {
    video_id: `wv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    reference_model_id: data.reference_model_id?.trim() || undefined,
    reference_model_name: data.reference_model_name.trim(),
    content_type: data.content_type,
    video_link: (data.video_link ?? "").trim(),
    note: (data.note ?? "").trim(),
    submitted_by_id: data.submitted_by_id.trim(),
    submitted_by_name: data.submitted_by_name.trim(),
    submitted_at: now,
    status: "Pending",
    views_at_submission: data.views_at_submission ?? undefined,
  });
  const video = mapWinnerVideo(rec);

  await notifyPermissionHolders({
    permission: PERMISSIONS.WINNER_VIDEOS_MANAGE,
    event_type: NOTIFICATION_EVENT.WINNER_VIDEO_SUBMITTED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "🎬 New winner video submitted",
    body: `${video.submitted_by_name || "A VA"} submitted a winner video for ${video.reference_model_name || "a reference model"}. Review it in Winner Videos.`,
    entity_type: NOTIFICATION_ENTITY.WINNER_VIDEO,
    entity_id: video.id,
    actor_user_id: data.submitted_by_id.trim() || undefined,
    excludeUserId: data.submitted_by_id.trim() || undefined,
    triggerSource: "create_winner_video",
  });

  return video;
}

export async function uploadWinnerVideoScreenshot(
  id: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>,
): Promise<void> {
  for (const file of files) {
    await uploadAirtableAttachment({
      recordId: id,
      fieldName: "screenshot",
      filename: file.name,
      contentType: file.type,
      bytes: file.bytes,
    });
  }
}

export type ApproveWinnerVideoInput = {
  assigned_creator_name: string;
  recreation_deadline: string;
  /** Creative (staff) who will write the script for this find. */
  assigned_creative_id: string;
  assigned_creative_name: string;
  reviewed_by_name: string;
  reviewed_by_id?: string;
};

export async function approveWinnerVideo(id: string, data: ApproveWinnerVideoInput): Promise<WinnerVideoRecord> {
  const existing = await getWinnerVideoById(id);
  if (!existing) throw new Error("Winner video not found");

  const now = new Date().toISOString();
  const patch: WinnerVideoFields = {
    status: "Approved",
    assigned_creator_name: data.assigned_creator_name.trim(),
    recreation_deadline: data.recreation_deadline.trim(),
    assigned_creative_id: data.assigned_creative_id.trim(),
    assigned_creative_name: data.assigned_creative_name.trim(),
    reviewed_by_name: data.reviewed_by_name.trim(),
    reviewed_at: now,
    rejection_reason: "",
  };

  const currentScriptStatus = existing.script_status;
  if (!currentScriptStatus || currentScriptStatus === "Not Applicable") {
    patch.script_status = "Needs Script";
  }

  await updateRecord(TABLE, id, patch);

  const updated = await getWinnerVideoById(id);
  if (!updated) throw new Error("Winner video not found after approve");

  if (existing.submitted_by_id) {
    await notify({
      user_id: existing.submitted_by_id,
      event_type: NOTIFICATION_EVENT.WINNER_VIDEO_APPROVED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "✅ Winner video approved",
      body: `Your winner video for ${existing.reference_model_name || "a reference model"} was approved.`,
      entity_type: NOTIFICATION_ENTITY.WINNER_VIDEO,
      entity_id: id,
      actor_user_id: data.reviewed_by_id,
      _triggerSource: "approve_winner_video",
    }).catch((err) => console.error("[winner_video_approved] notify failed", err));
  }

  const assignedCreativeId = data.assigned_creative_id.trim();
  if (assignedCreativeId) {
    await notify({
      user_id: assignedCreativeId,
      event_type: NOTIFICATION_EVENT.RESEARCH_ASSIGNED_TO_CREATIVE,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "📋 New script assignment",
      body: `You've been assigned to write a script for ${existing.reference_model_name || "an approved winner video"}. Open My Scripts to get started.`,
      entity_type: NOTIFICATION_ENTITY.CREATIVE_SCRIPT,
      entity_id: id,
      actor_user_id: data.reviewed_by_id,
      _triggerSource: "assign_research_to_creative",
    }).catch((err) => console.error("[research_assigned_to_creative] notify failed", err));
  }

  return updated;
}

export type RejectWinnerVideoInput = {
  rejection_reason: string;
  reviewed_by_name: string;
  reviewed_by_id?: string;
};

export async function rejectWinnerVideo(id: string, data: RejectWinnerVideoInput): Promise<WinnerVideoRecord> {
  const existing = await getWinnerVideoById(id);
  if (!existing) throw new Error("Winner video not found");
  const reason = data.rejection_reason.trim();
  if (!reason) throw new Error("Rejection reason is required");

  const now = new Date().toISOString();
  await updateRecord(TABLE, id, {
    status: "Rejected",
    rejection_reason: reason,
    reviewed_by_name: data.reviewed_by_name.trim(),
    reviewed_at: now,
    script_status: "Not Applicable",
  });

  const updated = await getWinnerVideoById(id);
  if (!updated) throw new Error("Winner video not found after reject");

  if (existing.submitted_by_id) {
    await notify({
      user_id: existing.submitted_by_id,
      event_type: NOTIFICATION_EVENT.WINNER_VIDEO_REJECTED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "❌ Winner video rejected",
      body: `Your winner video for ${existing.reference_model_name || "a reference model"} was rejected: ${reason}`,
      entity_type: NOTIFICATION_ENTITY.WINNER_VIDEO,
      entity_id: id,
      actor_user_id: data.reviewed_by_id,
      _triggerSource: "reject_winner_video",
    }).catch((err) => console.error("[winner_video_rejected] notify failed", err));
  }

  return updated;
}

export type UpdateWinnerVideoStatusInput = {
  status: WinnerVideoStatus;
  recreation_link?: string;
  reviewed_by_name?: string;
  reviewed_by_id?: string;
};

export async function updateWinnerVideoStatus(
  id: string,
  data: UpdateWinnerVideoStatusInput,
): Promise<WinnerVideoRecord> {
  const patch: Record<string, unknown> = { status: data.status };
  if (data.recreation_link !== undefined) patch.recreation_link = data.recreation_link.trim();
  if (data.reviewed_by_name !== undefined) {
    patch.reviewed_by_name = data.reviewed_by_name.trim();
    patch.reviewed_at = new Date().toISOString();
  }
  await updateRecord(TABLE, id, patch);
  const updated = await getWinnerVideoById(id);
  if (!updated) throw new Error("Winner video not found after status update");
  return updated;
}

const TRANSCRIBE_TIMEOUT_MS = 5 * 60 * 1000;

export async function transcribeVideoUrl(
  url: string,
): Promise<{ transcript: string; language: string; duration: number } | null> {
  const serviceUrl = process.env.TRANSCRIBE_SERVICE_URL?.trim();
  const apiKey = process.env.TRANSCRIBE_SERVICE_API_KEY?.trim();
  if (!serviceUrl || !apiKey) {
    console.error("[transcribeVideoUrl] TRANSCRIBE_SERVICE_URL or TRANSCRIBE_SERVICE_API_KEY is not configured");
    return null;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

  try {
    const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ url: trimmedUrl }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[transcribeVideoUrl] service error", res.status, body.slice(0, 500));
      return null;
    }

    const data = (await res.json()) as {
      transcript?: unknown;
      language?: unknown;
      duration?: unknown;
      duration_seconds?: unknown;
    };

    const transcript = typeof data.transcript === "string" ? data.transcript.trim() : "";
    if (!transcript) {
      console.error("[transcribeVideoUrl] empty transcript in response");
      return null;
    }

    const language = typeof data.language === "string" ? data.language : "unknown";
    const durationRaw = data.duration ?? data.duration_seconds;
    const duration =
      typeof durationRaw === "number" && Number.isFinite(durationRaw)
        ? durationRaw
        : Number.parseFloat(String(durationRaw ?? "0")) || 0;

    return { transcript, language, duration };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[transcribeVideoUrl] request failed:", message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Scripts-to-write queue. When `assignedCreativeId` is provided, only finds assigned to
 * that Creative are returned (the queue is per-Creative, not a shared pool).
 */
export async function getScriptsQueue(assignedCreativeId?: string): Promise<WinnerVideoRecord[]> {
  const creativeId = assignedCreativeId?.trim();
  return getAllWinnerVideos({
    script_status: "Needs Script",
    ...(creativeId ? { assigned_creative_id: creativeId } : {}),
  });
}

export async function getMyScripts(submitterId: string): Promise<WinnerVideoRecord[]> {
  const id = submitterId.trim();
  if (!id) return [];
  return getAllWinnerVideos({ script_submitted_by_id: id });
}

export async function getPendingScriptsForReview(): Promise<WinnerVideoRecord[]> {
  return getAllWinnerVideos({ script_status: "Pending Review" });
}

export type SubmitCreativeScriptInput = {
  assigned_creator_name: string;
  script_video_type: ScriptVideoType;
  script_text: string;
  script_submitted_by_name: string;
  script_submitted_by_id: string;
};

async function writeCreativeScriptSubmission(
  id: string,
  data: SubmitCreativeScriptInput,
): Promise<WinnerVideoRecord> {
  const scriptText = data.script_text.trim();
  const modelName = data.assigned_creator_name.trim();
  const videoType = data.script_video_type;
  if (!modelName) throw new Error("Model is required");
  if (!videoType) throw new Error("Script type is required");
  if (!scriptText) throw new Error("Script text is required");

  const now = new Date().toISOString();
  await updateRecord(TABLE, id, {
    assigned_creator_name: modelName,
    script_status: "Pending Review",
    script_video_type: videoType,
    script_text: scriptText,
    script_submitted_by_name: data.script_submitted_by_name.trim(),
    script_submitted_by_id: data.script_submitted_by_id.trim(),
    script_submitted_at: now,
    script_rejection_reason: "",
    script_reviewed_by_name: "",
    script_reviewed_at: null,
  });

  const updated = await getWinnerVideoById(id);
  if (!updated) throw new Error("Winner video not found after script submit");
  return updated;
}

export async function submitCreativeScript(
  id: string,
  data: SubmitCreativeScriptInput,
): Promise<WinnerVideoRecord> {
  const existing = await getWinnerVideoById(id);
  if (!existing) throw new Error("Winner video not found");
  if (existing.script_status !== "Needs Script") {
    throw new Error("This video is not available for script submission");
  }
  const updated = await writeCreativeScriptSubmission(id, data);

  await notifyPermissionHolders({
    permission: PERMISSIONS.CREATIVE_SCRIPTS_MANAGE,
    event_type: NOTIFICATION_EVENT.CREATIVE_SCRIPT_SUBMITTED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "📝 Creative script submitted",
    body: `${updated.script_submitted_by_name || "A Creative"} submitted a script for ${updated.assigned_creator_name || "a model"} for review.`,
    entity_type: NOTIFICATION_ENTITY.CREATIVE_SCRIPT,
    entity_id: id,
    actor_user_id: data.script_submitted_by_id.trim() || undefined,
    excludeUserId: data.script_submitted_by_id.trim() || undefined,
    triggerSource: "submit_creative_script",
  });

  return updated;
}

export type ResubmitCreativeScriptInput = SubmitCreativeScriptInput;

export async function resubmitCreativeScript(
  id: string,
  data: ResubmitCreativeScriptInput,
): Promise<WinnerVideoRecord> {
  const existing = await getWinnerVideoById(id);
  if (!existing) throw new Error("Winner video not found");
  if (existing.script_status !== "Rejected") {
    throw new Error("Only rejected scripts can be resubmitted");
  }
  const updated = await writeCreativeScriptSubmission(id, data);

  await notifyPermissionHolders({
    permission: PERMISSIONS.CREATIVE_SCRIPTS_MANAGE,
    event_type: NOTIFICATION_EVENT.CREATIVE_SCRIPT_RESUBMITTED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "📝 Creative script resubmitted",
    body: `${updated.script_submitted_by_name || "A Creative"} resubmitted the script for ${updated.assigned_creator_name || "a model"} after rejection.`,
    entity_type: NOTIFICATION_ENTITY.CREATIVE_SCRIPT,
    entity_id: id,
    actor_user_id: data.script_submitted_by_id.trim() || undefined,
    excludeUserId: data.script_submitted_by_id.trim() || undefined,
    triggerSource: "resubmit_creative_script",
  });

  return updated;
}

export type ReviewCreativeScriptInput = {
  script_text: string;
  reviewed_by_name: string;
  script_rejection_reason?: string;
};

export async function approveCreativeScript(
  id: string,
  data: ReviewCreativeScriptInput,
): Promise<WinnerVideoRecord> {
  const existing = await getWinnerVideoById(id);
  if (!existing) throw new Error("Winner video not found");
  if (existing.script_status !== "Pending Review") {
    throw new Error("Script is not pending review");
  }

  const scriptText = data.script_text.trim();
  if (!scriptText) throw new Error("Script text is required");

  const now = new Date().toISOString();
  await updateRecord(TABLE, id, {
    script_status: "Approved",
    script_text: scriptText,
    script_reviewed_by_name: data.reviewed_by_name.trim(),
    script_reviewed_at: now,
    script_rejection_reason: "",
  });

  const updated = await getWinnerVideoById(id);
  if (!updated) throw new Error("Winner video not found after script approval");

  if (existing.script_submitted_by_id) {
    await notify({
      user_id: existing.script_submitted_by_id,
      event_type: NOTIFICATION_EVENT.CREATIVE_SCRIPT_APPROVED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "✅ Creative script approved",
      body: `Your script for ${existing.assigned_creator_name || "a model"} was approved.`,
      entity_type: NOTIFICATION_ENTITY.CREATIVE_SCRIPT,
      entity_id: id,
      _triggerSource: "approve_creative_script",
    }).catch((err) => console.error("[creative_script_approved] notify failed", err));
  }

  return updated;
}

export async function rejectCreativeScript(
  id: string,
  data: ReviewCreativeScriptInput,
): Promise<WinnerVideoRecord> {
  const existing = await getWinnerVideoById(id);
  if (!existing) throw new Error("Winner video not found");
  if (existing.script_status !== "Pending Review") {
    throw new Error("Script is not pending review");
  }

  const reason = (data.script_rejection_reason ?? "").trim();
  if (!reason) throw new Error("Rejection reason is required");

  const scriptText = data.script_text.trim();
  if (!scriptText) throw new Error("Script text is required");

  const now = new Date().toISOString();
  await updateRecord(TABLE, id, {
    script_status: "Rejected",
    script_text: scriptText,
    script_rejection_reason: reason,
    script_reviewed_by_name: data.reviewed_by_name.trim(),
    script_reviewed_at: now,
  });

  const updated = await getWinnerVideoById(id);
  if (!updated) throw new Error("Winner video not found after script rejection");

  if (existing.script_submitted_by_id) {
    await notify({
      user_id: existing.script_submitted_by_id,
      event_type: NOTIFICATION_EVENT.CREATIVE_SCRIPT_REJECTED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "❌ Creative script rejected",
      body: `Your script for ${existing.assigned_creator_name || "a model"} was rejected: ${reason}`,
      entity_type: NOTIFICATION_ENTITY.CREATIVE_SCRIPT,
      entity_id: id,
      _triggerSource: "reject_creative_script",
    }).catch((err) => console.error("[creative_script_rejected] notify failed", err));
  }

  return updated;
}

export async function saveCreativeScriptText(id: string, script_text: string): Promise<WinnerVideoRecord> {
  const existing = await getWinnerVideoById(id);
  if (!existing) throw new Error("Winner video not found");
  const text = script_text.trim();
  if (!text) throw new Error("Script text is required");

  await updateRecord(TABLE, id, { script_text: text });

  const updated = await getWinnerVideoById(id);
  if (!updated) throw new Error("Winner video not found after save");
  return updated;
}

