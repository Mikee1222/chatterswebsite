/**
 * Supabase data backend for services/winner-videos.ts (DATA_BACKEND=supabase).
 */

import {
  coerceScriptStatus,
  coerceScriptVideoType,
  type ScriptStatus,
  type ScriptVideoType,
} from "@/lib/creative-scripts-helpers";
import {
  publicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { uploadToPrivateStorage, urlsToAttachments } from "@/lib/supabase-signed-url";
import {
  coerceWinnerVideoContentType,
  coerceWinnerVideoStatus,
  type WinnerVideoContentType,
  type WinnerVideoStatus,
} from "@/lib/winner-videos-helpers";

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

const TABLE = "winner_videos";

type Row = SbRow & {
  video_id?: string | null;
  reference_model_id?: string | null;
  reference_model_name?: string | null;
  video_link?: string | null;
  note?: string | null;
  submitted_by_name?: string | null;
  submitted_by_id?: string | null;
  submitted_at?: string | null;
  status?: string | null;
  rejection_reason?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  assigned_creator_name?: string | null;
  recreation_deadline?: string | null;
  recreation_link?: string | null;
  views_at_submission?: number | null;
  screenshot?: string[] | null;
  video_file?: string[] | null;
  transcript?: string | null;
  script_status?: string | null;
  script_video_type?: string | null;
  script_text?: string | null;
  script_submitted_by_name?: string | null;
  script_submitted_by_id?: string | null;
  script_submitted_at?: string | null;
  script_reviewed_by_name?: string | null;
  script_reviewed_at?: string | null;
  script_rejection_reason?: string | null;
  content_type?: string | null;
  assigned_creative_name?: string | null;
  assigned_creative_id?: string | null;
};

function coerceViews(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

async function mapRow(row: Row): Promise<WinnerVideoRecord> {
  const [screenshot, video_file] = await Promise.all([
    urlsToAttachments(row.screenshot),
    urlsToAttachments(row.video_file),
  ]);
  return {
    id: publicId(row),
    video_id: String(row.video_id ?? publicId(row)),
    reference_model_id: String(row.reference_model_id ?? ""),
    reference_model_name: String(row.reference_model_name ?? ""),
    video_link: String(row.video_link ?? ""),
    note: String(row.note ?? ""),
    submitted_by_name: String(row.submitted_by_name ?? ""),
    submitted_by_id: String(row.submitted_by_id ?? ""),
    submitted_at: row.submitted_at?.trim() ? String(row.submitted_at) : null,
    status: coerceWinnerVideoStatus(row.status),
    rejection_reason: String(row.rejection_reason ?? ""),
    reviewed_by_name: String(row.reviewed_by_name ?? ""),
    reviewed_at: row.reviewed_at?.trim() ? String(row.reviewed_at) : null,
    assigned_creator_name: String(row.assigned_creator_name ?? ""),
    recreation_deadline: row.recreation_deadline?.trim() ? String(row.recreation_deadline) : null,
    recreation_link: String(row.recreation_link ?? ""),
    views_at_submission: coerceViews(row.views_at_submission),
    screenshot,
    video_file,
    transcript: String(row.transcript ?? ""),
    script_status: coerceScriptStatus(row.script_status),
    script_video_type: coerceScriptVideoType(row.script_video_type),
    script_text: String(row.script_text ?? ""),
    script_submitted_by_name: String(row.script_submitted_by_name ?? ""),
    script_submitted_by_id: String(row.script_submitted_by_id ?? ""),
    script_submitted_at: row.script_submitted_at?.trim() ? String(row.script_submitted_at) : null,
    script_reviewed_by_name: String(row.script_reviewed_by_name ?? ""),
    script_reviewed_at: row.script_reviewed_at?.trim() ? String(row.script_reviewed_at) : null,
    script_rejection_reason: String(row.script_rejection_reason ?? ""),
    content_type: coerceWinnerVideoContentType(row.content_type),
    assigned_creative_name: String(row.assigned_creative_name ?? ""),
    assigned_creative_id: String(row.assigned_creative_id ?? ""),
  };
}

function matchesFilters(v: WinnerVideoRecord, filters: WinnerVideoFilters): boolean {
  if (filters.submitted_by_id?.trim() && v.submitted_by_id !== filters.submitted_by_id.trim()) return false;
  if (filters.status && v.status !== filters.status) return false;
  if (filters.content_type && v.content_type !== filters.content_type) return false;
  if (filters.script_status && v.script_status !== filters.script_status) return false;
  if (
    filters.script_submitted_by_id?.trim() &&
    v.script_submitted_by_id !== filters.script_submitted_by_id.trim()
  ) {
    return false;
  }
  if (
    filters.assigned_creative_id?.trim() &&
    v.assigned_creative_id !== filters.assigned_creative_id.trim()
  ) {
    return false;
  }
  if (filters.date_from?.trim() && v.submitted_at) {
    if (new Date(v.submitted_at).getTime() <= new Date(filters.date_from.trim()).getTime()) return false;
  }
  if (filters.date_to?.trim() && v.submitted_at) {
    if (new Date(v.submitted_at).getTime() >= new Date(filters.date_to.trim()).getTime()) return false;
  }
  return true;
}

export async function getAllWinnerVideos(filters: WinnerVideoFilters = {}): Promise<WinnerVideoRecord[]> {
  // Prefer SQL filters when selective columns are present
  const sb = getSupabaseServiceClient();
  let q = sb.from(TABLE).select("*").order("submitted_at", { ascending: false });
  if (filters.submitted_by_id?.trim()) q = q.eq("submitted_by_id", filters.submitted_by_id.trim());
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.content_type) q = q.eq("content_type", filters.content_type);
  if (filters.script_status) q = q.eq("script_status", filters.script_status);
  if (filters.script_submitted_by_id?.trim()) {
    q = q.eq("script_submitted_by_id", filters.script_submitted_by_id.trim());
  }
  if (filters.assigned_creative_id?.trim()) {
    q = q.eq("assigned_creative_id", filters.assigned_creative_id.trim());
  }
  if (filters.date_from?.trim()) q = q.gt("submitted_at", filters.date_from.trim());
  if (filters.date_to?.trim()) q = q.lt("submitted_at", filters.date_to.trim());

  const pageSize = 1000;
  const rows: Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw new Error(`getAllWinnerVideos: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  const mapped = await Promise.all(rows.map(mapRow));
  // date_from/to semantics match Airtable IS_AFTER/IS_BEFORE; SQL used same bounds
  return mapped.filter((v) => matchesFilters(v, filters));
}

export async function getWinnerVideoById(id: string): Promise<WinnerVideoRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, id);
  if (!row) return null;
  return mapRow(row);
}

export async function createWinnerVideoRow(fields: Record<string, unknown>): Promise<WinnerVideoRecord> {
  const row = await sbInsert<Row>(TABLE, fields);
  return mapRow(row);
}

export async function updateWinnerVideoFields(
  id: string,
  fields: Record<string, unknown>
): Promise<WinnerVideoRecord> {
  const row = await sbUpdateByPublicId<Row>(TABLE, id, fields);
  return mapRow(row);
}

export async function uploadWinnerVideoScreenshot(
  id: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>
): Promise<void> {
  const row = await sbSelectByPublicId<Row>(TABLE, id);
  if (!row) throw new Error("Winner video not found");
  const existing = [...(row.screenshot ?? [])];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = (file.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "");
    const token = await uploadToPrivateStorage({
      bucket: "winner-videos",
      objectPath: `winner_videos/${row.airtable_id || row.id}/screenshot/${Date.now()}_${i}.${ext}`,
      bytes: file.bytes,
      contentType: file.type || "application/octet-stream",
    });
    existing.push(token);
  }
  await sbUpdateByPublicId(TABLE, id, { screenshot: existing });
}

export async function listAllRaw(): Promise<WinnerVideoRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return Promise.all(rows.map(mapRow));
}
