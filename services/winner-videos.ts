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
  coerceWinnerVideoStatus,
  type WinnerVideoStatus,
} from "@/lib/winner-videos-helpers";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const TABLE = "winner_videos";

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
  transcript: string;
}

export interface WinnerVideoFilters {
  status?: WinnerVideoStatus | "";
  submitted_by_id?: string;
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
  transcript?: string;
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
    transcript: String(f.transcript ?? ""),
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
  video_link: string;
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
    video_link: data.video_link.trim(),
    note: (data.note ?? "").trim(),
    submitted_by_id: data.submitted_by_id.trim(),
    submitted_by_name: data.submitted_by_name.trim(),
    submitted_at: now,
    status: "Pending",
    views_at_submission: data.views_at_submission ?? undefined,
  });
  return mapWinnerVideo(rec);
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
  reviewed_by_name: string;
  reviewed_by_id?: string;
};

export async function approveWinnerVideo(id: string, data: ApproveWinnerVideoInput): Promise<WinnerVideoRecord> {
  const existing = await getWinnerVideoById(id);
  if (!existing) throw new Error("Winner video not found");

  const now = new Date().toISOString();
  await updateRecord(TABLE, id, {
    status: "Approved",
    assigned_creator_name: data.assigned_creator_name.trim(),
    recreation_deadline: data.recreation_deadline.trim(),
    reviewed_by_name: data.reviewed_by_name.trim(),
    reviewed_at: now,
    rejection_reason: "",
  });

  const updated = await getWinnerVideoById(id);
  if (!updated) throw new Error("Winner video not found after approve");

  if (existing.submitted_by_id) {
    await notify({
      user_id: existing.submitted_by_id,
      event_type: NOTIFICATION_EVENT.WINNER_VIDEO_APPROVED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "Winner video approved",
      body: `Your submission for ${existing.reference_model_name || "a reference model"} was approved.`,
      entity_type: NOTIFICATION_ENTITY.WINNER_VIDEO,
      entity_id: id,
      actor_user_id: data.reviewed_by_id,
      _triggerSource: "approve_winner_video",
    }).catch((err) => console.error("[winner_video_approved] notify failed", err));
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
  });

  const updated = await getWinnerVideoById(id);
  if (!updated) throw new Error("Winner video not found after reject");

  if (existing.submitted_by_id) {
    await notify({
      user_id: existing.submitted_by_id,
      event_type: NOTIFICATION_EVENT.WINNER_VIDEO_REJECTED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "Winner video rejected",
      body: reason,
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

export async function updateWinnerVideoTranscript(id: string, transcript: string): Promise<void> {
  const text = transcript.trim();
  if (!text) return;
  await updateRecord(TABLE, id, { transcript: text });
}

export async function transcribeAndSaveWinnerVideo(id: string, videoLink: string): Promise<void> {
  const result = await transcribeVideoUrl(videoLink);
  if (!result) return;
  await updateWinnerVideoTranscript(id, result.transcript);
}
