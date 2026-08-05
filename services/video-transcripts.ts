"use server";

import {
  createRecord,
  deleteRecord,
  getRecord,
  listAllRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { uploadAirtableAttachment } from "@/lib/airtable-upload-attachment";
import { isSupabaseBackend } from "@/lib/data-backend";
import { coerceVideoTranscriptStatus, type VideoTranscriptStatus } from "@/lib/video-transcripts-helpers";
import { WINNER_VIDEO_MAX_FILE_BYTES } from "@/lib/winner-video-files";

const TABLE = "video_transcripts";

export type VideoTranscriptAttachment = { url: string; filename?: string };

export interface VideoTranscriptRecord {
  id: string;
  label: string;
  video_file: VideoTranscriptAttachment[];
  uploaded_by_name: string;
  uploaded_by_id: string;
  status: VideoTranscriptStatus;
  transcript: string;
  language: string;
  duration_seconds: number | null;
  created_at: string | null;
}

export interface VideoTranscriptFilters {
  uploaded_by_id?: string;
  date_from?: string;
  date_to?: string;
}

type VideoTranscriptFields = {
  label?: string;
  video_file?: unknown;
  uploaded_by_name?: string;
  uploaded_by_id?: string;
  status?: string;
  transcript?: string;
  language?: string;
  duration_seconds?: number | string | null;
  created_at?: string;
};

function escapeFormulaString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function mapAttachments(raw: unknown): VideoTranscriptAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is { url?: string; filename?: string } => a != null && typeof a === "object")
    .map((a) => ({ url: String(a.url ?? ""), filename: a.filename ? String(a.filename) : undefined }))
    .filter((a) => a.url.length > 0);
}

function coerceDuration(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

function mapVideoTranscript(rec: AirtableRecord<VideoTranscriptFields>): VideoTranscriptRecord {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    label: String(f.label ?? ""),
    video_file: mapAttachments(f.video_file),
    uploaded_by_name: String(f.uploaded_by_name ?? ""),
    uploaded_by_id: String(f.uploaded_by_id ?? ""),
    status: coerceVideoTranscriptStatus(f.status),
    transcript: String(f.transcript ?? ""),
    language: String(f.language ?? ""),
    duration_seconds: coerceDuration(f.duration_seconds),
    created_at: f.created_at?.trim() ? String(f.created_at) : null,
  };
}

function buildFilter(filters: VideoTranscriptFilters): string | undefined {
  const parts: string[] = [];
  if (filters.uploaded_by_id?.trim()) {
    parts.push(`{uploaded_by_id} = "${escapeFormulaString(filters.uploaded_by_id.trim())}"`);
  }
  if (filters.date_from?.trim()) {
    parts.push(`IS_AFTER({created_at}, "${escapeFormulaString(filters.date_from.trim())}")`);
  }
  if (filters.date_to?.trim()) {
    parts.push(`IS_BEFORE({created_at}, "${escapeFormulaString(filters.date_to.trim())}")`);
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return `AND(${parts.join(", ")})`;
}

export async function getVideoTranscripts(filters: VideoTranscriptFilters = {}): Promise<VideoTranscriptRecord[]> {
  if (isSupabaseBackend()) return (await import("./video-transcripts-supabase")).getVideoTranscripts(filters);
  const filterByFormula = buildFilter(filters);
  const records = await listAllRecords<VideoTranscriptFields>(TABLE, {
    ...(filterByFormula ? { filterByFormula } : {}),
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map(mapVideoTranscript);
}

export async function getVideoTranscriptById(id: string): Promise<VideoTranscriptRecord | null> {
  if (isSupabaseBackend()) return (await import("./video-transcripts-supabase")).getVideoTranscriptById(id);
  try {
    const rec = await getRecord<VideoTranscriptFields>(TABLE, id);
    return mapVideoTranscript(rec);
  } catch {
    return null;
  }
}

export type CreateVideoTranscriptInput = {
  label: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
};

export async function createVideoTranscriptRecord(data: CreateVideoTranscriptInput): Promise<VideoTranscriptRecord> {
  if (isSupabaseBackend()) return (await import("./video-transcripts-supabase")).createVideoTranscriptRecord(data);
  const now = new Date().toISOString();
  const rec = await createRecord<VideoTranscriptFields>(TABLE, {
    label: data.label.trim(),
    uploaded_by_id: data.uploaded_by_id.trim(),
    uploaded_by_name: data.uploaded_by_name.trim(),
    status: "Processing",
    created_at: now,
  });
  return mapVideoTranscript(rec);
}

export async function uploadVideoTranscriptFile(
  id: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>,
): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./video-transcripts-supabase")).uploadVideoTranscriptFile(id, files);
  }
  for (const file of files) {
    await uploadAirtableAttachment({
      recordId: id,
      fieldName: "video_file",
      filename: file.name,
      contentType: file.type,
      bytes: file.bytes,
      maxBytes: WINNER_VIDEO_MAX_FILE_BYTES,
    });
  }
}

export async function setVideoTranscriptFileUrls(id: string, urls: string[]): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./video-transcripts-supabase")).setVideoTranscriptFileUrls(id, urls);
  }
  void id;
  void urls;
}

export type UpdateVideoTranscriptResultInput = {
  transcript?: string;
  language?: string;
  duration_seconds?: number | null;
  status: "Done" | "Failed";
};

export async function updateVideoTranscriptResult(
  id: string,
  data: UpdateVideoTranscriptResultInput,
): Promise<VideoTranscriptRecord> {
  if (isSupabaseBackend()) return (await import("./video-transcripts-supabase")).updateVideoTranscriptResult(id, data);
  const patch: Record<string, unknown> = { status: data.status };
  if (data.transcript !== undefined) patch.transcript = data.transcript.trim();
  if (data.language !== undefined) patch.language = data.language.trim();
  if (data.duration_seconds !== undefined) {
    patch.duration_seconds = data.duration_seconds ?? undefined;
  }
  await updateRecord(TABLE, id, patch);
  const updated = await getVideoTranscriptById(id);
  if (!updated) throw new Error("Video transcript not found after update");
  return updated;
}

export async function deleteVideoTranscript(id: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./video-transcripts-supabase")).deleteVideoTranscript(id);
  await deleteRecord(TABLE, id);
}
