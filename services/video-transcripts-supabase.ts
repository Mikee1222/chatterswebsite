/**
 * Supabase backend for services/video-transcripts.ts
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { coerceVideoTranscriptStatus } from "@/lib/video-transcripts-helpers";
import { urlsToAttachments, uploadToPrivateStorage } from "@/lib/supabase-signed-url";
import type {
  CreateVideoTranscriptInput,
  UpdateVideoTranscriptResultInput,
  VideoTranscriptAttachment,
  VideoTranscriptFilters,
  VideoTranscriptRecord,
} from "./video-transcripts";

const TABLE = "video_transcripts";

type Row = SbRow & {
  label?: string | null;
  video_file?: string[] | null;
  uploaded_by_name?: string | null;
  uploaded_by_id?: string | null;
  status?: string | null;
  transcript?: string | null;
  language?: string | null;
  duration_seconds?: number | string | null;
  created_at?: string | null;
};

async function mapAttachments(raw: unknown): Promise<VideoTranscriptAttachment[]> {
  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) {
    return urlsToAttachments(raw as string[]);
  }
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

async function mapRow(row: Row): Promise<VideoTranscriptRecord> {
  return {
    id: publicId(row),
    label: String(row.label ?? ""),
    video_file: await mapAttachments(row.video_file),
    uploaded_by_name: String(row.uploaded_by_name ?? ""),
    uploaded_by_id: String(row.uploaded_by_id ?? ""),
    status: coerceVideoTranscriptStatus(row.status),
    transcript: String(row.transcript ?? ""),
    language: String(row.language ?? ""),
    duration_seconds: coerceDuration(row.duration_seconds),
    created_at: row.created_at?.trim() ? String(row.created_at) : null,
  };
}

export async function getVideoTranscripts(
  filters: VideoTranscriptFilters = {}
): Promise<VideoTranscriptRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  let mapped = await Promise.all(rows.map(mapRow));
  if (filters.uploaded_by_id?.trim()) {
    mapped = mapped.filter((r) => r.uploaded_by_id === filters.uploaded_by_id?.trim());
  }
  if (filters.date_from?.trim()) {
    const from = filters.date_from.trim();
    mapped = mapped.filter((r) => !r.created_at || r.created_at > from);
  }
  if (filters.date_to?.trim()) {
    const to = filters.date_to.trim();
    mapped = mapped.filter((r) => !r.created_at || r.created_at < to);
  }
  return mapped.sort((a, b) => ((a.created_at ?? "") < (b.created_at ?? "") ? 1 : -1));
}

export async function getVideoTranscriptById(id: string): Promise<VideoTranscriptRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, id);
  return row ? mapRow(row) : null;
}

export async function createVideoTranscriptRecord(
  data: CreateVideoTranscriptInput
): Promise<VideoTranscriptRecord> {
  const now = new Date().toISOString();
  const row = await sbInsert<Row>(TABLE, {
    label: data.label.trim(),
    uploaded_by_id: data.uploaded_by_id.trim(),
    uploaded_by_name: data.uploaded_by_name.trim(),
    status: "Processing",
    created_at: now,
  });
  return mapRow(row);
}

export async function uploadVideoTranscriptFile(
  id: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>
): Promise<void> {
  const row = await sbSelectByPublicId<Row>(TABLE, id);
  if (!row) throw new Error("Video transcript not found");
  const existing = [...(row.video_file ?? [])];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.bytes.byteLength) continue;
    const safeName = (file.name || "video").replace(/[^a-zA-Z0-9._-]/g, "_");
    const token = await uploadToPrivateStorage({
      bucket: "attachments",
      objectPath: `video_transcripts/${row.airtable_id || row.id}/video_file/${Date.now()}_${i}_${safeName}`,
      bytes: file.bytes,
      contentType: file.type || "application/octet-stream",
    });
    existing.push(token);
  }
  await sbUpdateByPublicId(TABLE, id, {
    video_file: existing,
    updated_at: new Date().toISOString(),
  });
}

export async function updateVideoTranscriptResult(
  id: string,
  data: UpdateVideoTranscriptResultInput
): Promise<VideoTranscriptRecord> {
  const patch: Record<string, unknown> = {
    status: data.status,
    updated_at: new Date().toISOString(),
  };
  if (data.transcript !== undefined) patch.transcript = data.transcript.trim();
  if (data.language !== undefined) patch.language = data.language.trim();
  if (data.duration_seconds !== undefined) {
    patch.duration_seconds = data.duration_seconds ?? null;
  }
  const updated = await sbUpdateByPublicId<Row>(TABLE, id, patch);
  return mapRow(updated);
}

export async function deleteVideoTranscript(id: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, id);
}
