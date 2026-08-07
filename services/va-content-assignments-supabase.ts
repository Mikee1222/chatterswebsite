/**
 * Supabase backend for services/va-content-assignments.ts
 */
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  publicId,
  sbAirtableIdsForUuids,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  requireSbUuids,
  type SbRow,
} from "@/lib/supabase-data";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify, notifyByRoleConfig } from "@/services/notification-service";
import type { VaContentAssignmentRecord } from "@/types";
import {
  validateAssignmentFileCount,
  validateAssignmentFileSizes,
  type ParsedAssignmentFile,
} from "@/lib/va-content-assignment-files";
import type {
  VaUpdatePendingAssignmentInput,
  CreateVaContentAssignmentAdminInput,
  ReviewVAContentAssignmentAdminInput,
  ScheduleVAContentAssignmentInput,
  CompleteVAContentAssignmentInput,
  VaAttachmentCell,
} from "./va-content-assignments";

const TABLE = "va_content_assignments";

type Row = SbRow & {
  assignment_id?: string | null;
  /** M2M: linked modelss UUIDs (Airtable `model` / `assigned_model`). No `model_id` text col. */
  model?: string[] | null;
  /** M2M: linked users UUIDs (Airtable `va`). No `va_id` text col — use join `va_content_assignment_vas`. */
  va?: string[] | null;
  title?: string | null;
  description?: string | null;
  content_type?: string | null;
  file_url?: string | null;
  file_attachment?: string[] | null;
  deadline?: string | null;
  scheduled_date?: string | null;
  status?: string | null;
  priority?: string | null;
  model_notes?: string | null;
  va_notes?: string | null;
  completed_at?: string | null;
  created_time?: string | null;
  updated_at?: string | null;
  rejection_reason?: string | null;
  admin_edit_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
};

async function attachmentsFromUrls(v: string[] | null | undefined): Promise<VaAttachmentCell[]> {
  if (!Array.isArray(v) || v.length === 0) return [];
  const { urlsToAttachments } = await import("@/lib/supabase-signed-url");
  const signed = await urlsToAttachments(
    v.filter((u): u is string => typeof u === "string" && u.length > 0),
  );
  return signed.map((a) => ({ url: a.url, filename: a.filename }));
}

async function mapRow(row: Row): Promise<VaContentAssignmentRecord> {
  const modelUuids = row.model ?? [];
  const vaUuids = row.va ?? [];
  const [modelAtIds, vaAtIds, file_attachment] = await Promise.all([
    sbAirtableIdsForUuids("modelss", modelUuids),
    sbAirtableIdsForUuids("users", vaUuids),
    attachmentsFromUrls(row.file_attachment),
  ]);
  const rawFileUrl = (row.file_url ?? "").trim();
  let file_url: string | null = rawFileUrl || null;
  if (file_url) {
    const { resolveStorageUrl } = await import("@/lib/supabase-signed-url");
    file_url = await resolveStorageUrl(file_url);
  }
  return {
    id: publicId(row),
    assignment_id: row.assignment_id ?? "",
    model_id: modelAtIds[0] ?? "",
    va_id: vaAtIds[0] ?? null,
    title: row.title ?? "",
    description: row.description ?? "",
    content_type: row.content_type ?? "",
    file_url,
    file_attachment,
    deadline: row.deadline ?? null,
    scheduled_date: row.scheduled_date ?? null,
    status: row.status ?? "",
    priority: row.priority ?? "",
    model_notes: row.model_notes ?? "",
    va_notes: row.va_notes ?? "",
    completed_at: row.completed_at ?? null,
    created_at: row.created_time ?? "",
    updated_at: row.updated_at ?? "",
    rejection_reason: typeof row.rejection_reason === "string" ? row.rejection_reason : "",
    admin_edit_notes: typeof row.admin_edit_notes === "string" ? row.admin_edit_notes : "",
    reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : "",
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
  };
}

/** Resolve VA public id (Airtable `rec…` or Postgres uuid) → users.id uuid(s). */
async function vaUuidsForUserKey(vaUserRecordId: string): Promise<string[]> {
  const rid = vaUserRecordId?.trim();
  if (!rid) return [];
  return sbUuidsForAirtableIds("users", [rid]);
}

async function modelUuidForKey(modelRecordId: string): Promise<string | null> {
  const rid = modelRecordId?.trim();
  if (!rid) return null;
  const uuids = await sbUuidsForAirtableIds("modelss", [rid]);
  return uuids[0] ?? null;
}

/** Keep join table `va_content_assignment_vas` in sync with denormalized `va uuid[]`. */
async function syncAssignmentVas(assignmentUuid: string, vaUuids: string[]): Promise<void> {
  const sb = getSupabaseServiceClient();
  await sb.from("va_content_assignment_vas").delete().eq("assignment_id", assignmentUuid);
  if (!vaUuids.length) return;
  const rows = vaUuids.map((user_id) => ({ assignment_id: assignmentUuid, user_id }));
  const { error } = await sb.from("va_content_assignment_vas").upsert(rows, {
    onConflict: "assignment_id,user_id",
  });
  if (error) console.error("[va-content-assignments] sync vas join", error.message);
}

function statusNorm(status: string | undefined): string {
  return String(status ?? "").trim().toLowerCase();
}
function isHiddenFromModelStatus(status: string | undefined): boolean {
  const k = statusNorm(status);
  return k === "pending_approval" || k === "rejected";
}
function isVaEditableStatus(status: string | undefined): boolean {
  const k = statusNorm(status);
  return k === "pending" || k === "pending_approval";
}

function sortAssignmentsForVa(rows: VaContentAssignmentRecord[]): VaContentAssignmentRecord[] {
  return [...rows].sort((a, b) => (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0));
}
function sortAssignmentsForAdmin(rows: VaContentAssignmentRecord[]): VaContentAssignmentRecord[] {
  return [...rows].sort((a, b) => {
    const da = Date.parse(a.deadline ?? "") || Number.POSITIVE_INFINITY;
    const db = Date.parse(b.deadline ?? "") || Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0);
  });
}
function sortAssignmentsForModel(rows: VaContentAssignmentRecord[]): VaContentAssignmentRecord[] {
  return [...rows].sort((a, b) => {
    const da = a.deadline?.trim() ? Date.parse(a.deadline) : NaN;
    const db = b.deadline?.trim() ? Date.parse(b.deadline) : NaN;
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
    if (!Number.isNaN(da)) return -1;
    if (!Number.isNaN(db)) return 1;
    return 0;
  });
}

export async function getVAContentAssignmentForVa(
  assignmentRecordId: string,
  vaUserRecordId: string
): Promise<VaContentAssignmentRecord | null> {
  if (!assignmentRecordId || !vaUserRecordId?.trim()) return null;
  const row = await sbSelectByPublicId<Row>(TABLE, assignmentRecordId);
  if (!row) return null;
  const vaUuids = await vaUuidsForUserKey(vaUserRecordId);
  const rowUuids = row.va ?? [];
  const matches = vaUuids.some((u) => rowUuids.includes(u));
  return matches ? mapRow(row) : null;
}

export async function updatePendingVAContentAssignmentByVa(
  assignmentRecordId: string,
  vaUserRecordId: string,
  patch: VaUpdatePendingAssignmentInput
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForVa(assignmentRecordId, vaUserRecordId);
  if (!current || !isVaEditableStatus(current.status)) return null;
  const fields: Record<string, unknown> = {};
  if (patch.title !== undefined) fields.title = patch.title.trim();
  if (patch.description !== undefined) fields.description = patch.description.trim();
  if (patch.deadline !== undefined) fields.deadline = patch.deadline?.trim() ? patch.deadline.trim() : null;
  if (patch.priority !== undefined) fields.priority = (patch.priority || "normal").trim().toLowerCase();
  if (Object.keys(fields).length === 0) return current;
  const row = await sbUpdateByPublicId<Row>(TABLE, assignmentRecordId, fields);
  return mapRow(row);
}

export async function deletePendingVAContentAssignmentByVa(
  assignmentRecordId: string,
  vaUserRecordId: string
): Promise<boolean> {
  const current = await getVAContentAssignmentForVa(assignmentRecordId, vaUserRecordId);
  if (!current || !isVaEditableStatus(current.status)) return false;
  await sbDeleteByPublicId(TABLE, assignmentRecordId);
  return true;
}

function appendNoteBlock(existing: string, block: string): string {
  const e = existing.trim();
  const b = block.trim();
  if (!b) return e;
  return e ? `${e}\n\n${b}` : b;
}

export async function appendVAContentAssignmentVaNotes(
  assignmentRecordId: string,
  vaUserRecordId: string,
  noteBlock: string
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForVa(assignmentRecordId, vaUserRecordId);
  if (!current) return null;
  const b = noteBlock.trim();
  if (!b) return null;
  const row = await sbUpdateByPublicId<Row>(TABLE, assignmentRecordId, {
    va_notes: appendNoteBlock(current.va_notes, b),
  });
  return mapRow(row);
}

export async function listVAContentAssignmentsForVaUser(vaUserRecordId: string): Promise<VaContentAssignmentRecord[]> {
  const rid = vaUserRecordId?.trim();
  if (!rid) return [];
  const vaUuids = await vaUuidsForUserKey(rid);
  const userUuid = vaUuids[0];
  if (!userUuid) return [];
  const sb = getSupabaseServiceClient();
  // Filter on `va uuid[]` (Airtable multi-link). There is no `va_id` text column.
  const { data, error } = await sb.from(TABLE).select("*").contains("va", [userUuid]);
  if (error) throw new Error(`va_content_assignments: ${error.message}`);
  const mapped = await Promise.all(((data ?? []) as unknown as Row[]).map(mapRow));
  return sortAssignmentsForVa(mapped);
}

export async function getModelIdsAssignedToVa(vaUserRecordId: string): Promise<string[]> {
  const rows = await listVAContentAssignmentsForVaUser(vaUserRecordId);
  return [...new Set(rows.map((r) => r.model_id).filter(Boolean))];
}

function vaAssignmentDisplayDateYmd(v: VaContentAssignmentRecord): string | null {
  const s = v.scheduled_date?.trim().slice(0, 10);
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = v.deadline?.trim().slice(0, 10);
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return null;
}

export async function listAllVAContentAssignmentsInRange(fromDate: string, toDate: string): Promise<VaContentAssignmentRecord[]> {
  if (!fromDate || !toDate) return [];
  const rows = await sbSelectAll<Row>(TABLE).catch(() => []);
  const mapped = await Promise.all(rows.map(mapRow));
  return mapped.filter((v) => {
    const ymd = vaAssignmentDisplayDateYmd(v);
    return ymd != null && ymd >= fromDate && ymd <= toDate;
  });
}

export async function listVAContentAssignmentsForModel(
  modelRecordId: string,
  _stableModelId?: string | null
): Promise<VaContentAssignmentRecord[]> {
  if (!modelRecordId) return [];
  // Schema has `model uuid[]` only — no `model_id` text column on this table.
  const modelUuid = await modelUuidForKey(modelRecordId);
  if (!modelUuid) return [];
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(TABLE).select("*").contains("model", [modelUuid]);
  if (error) throw new Error(`va_content_assignments: ${error.message}`);
  const mapped = await Promise.all(((data ?? []) as unknown as Row[]).map(mapRow));
  return sortAssignmentsForModel(mapped.filter((row) => !isHiddenFromModelStatus(row.status)));
}

export async function listDistinctVaUserIdsForModel(
  modelRecordId: string,
  stableModelId?: string | null
): Promise<string[]> {
  const rows = await listVAContentAssignmentsForModel(modelRecordId, stableModelId);
  const ids = new Set<string>();
  for (const r of rows) {
    const v = r.va_id?.trim();
    if (v) ids.add(v);
  }
  return [...ids];
}

export async function listAllVAContentAssignments(): Promise<VaContentAssignmentRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE).catch(() => []);
  const mapped = await Promise.all(rows.map(mapRow));
  return sortAssignmentsForAdmin(mapped);
}

export async function getVAContentAssignmentById(assignmentRecordId: string): Promise<VaContentAssignmentRecord | null> {
  if (!assignmentRecordId) return null;
  const row = await sbSelectByPublicId<Row>(TABLE, assignmentRecordId);
  return row ? mapRow(row) : null;
}

export async function countPendingVAContentAssignments(): Promise<number> {
  try {
    const sb = getSupabaseServiceClient();
    const { count } = await sb.from(TABLE).select("id", { count: "exact", head: true }).in("status", ["pending", "pending_approval"]);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function cancelVAContentAssignment(
  assignmentRecordId: string,
  input: { reason: string; actorLabel?: string }
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentById(assignmentRecordId);
  if (!current) return null;
  const reason = input.reason.trim();
  if (!reason) return null;
  const actor = input.actorLabel?.trim() || "Admin";
  const noteBlock = `[${actor} cancelled] ${reason}`;
  const row = await sbUpdateByPublicId<Row>(TABLE, assignmentRecordId, {
    status: "cancelled",
    model_notes: appendNoteBlock(current.model_notes, noteBlock),
  });
  return mapRow(row);
}

export async function countPendingVAContentAssignmentsForModel(
  modelRecordId: string,
  stableModelId?: string | null
): Promise<number> {
  if (!modelRecordId) return 0;
  const rows = await listVAContentAssignmentsForModel(modelRecordId, stableModelId);
  return rows.filter((r) => statusNorm(r.status) === "pending").length;
}

export async function getVAContentAssignmentForModel(
  assignmentRecordId: string,
  modelRecordId: string,
  _stableModelId?: string | null
): Promise<VaContentAssignmentRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, assignmentRecordId);
  if (!row) return null;
  const mapped = await mapRow(row);
  const uuid = await modelUuidForKey(modelRecordId);
  const linkMatch = uuid ? (row.model ?? []).includes(uuid) : false;
  // Fallback: caller passed a Postgres uuid directly as modelRecordId
  const idAsUuidMatch = Boolean(
    !modelRecordId.startsWith("rec") && (row.model ?? []).includes(modelRecordId)
  );
  if (!linkMatch && !idAsUuidMatch) return null;
  if (isHiddenFromModelStatus(mapped.status)) return null;
  return mapped;
}

export async function scheduleVAContentAssignmentForModel(
  assignmentRecordId: string,
  modelRecordId: string,
  input: ScheduleVAContentAssignmentInput,
  stableModelId?: string | null
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForModel(assignmentRecordId, modelRecordId, stableModelId);
  if (!current || current.status !== "pending") return null;
  const noteBlock =
    input.notes?.trim() != null && String(input.notes?.trim()).length > 0
      ? `[Scheduled] ${input.scheduled_date_iso.slice(0, 10)} — ${input.notes!.trim()}`
      : `[Scheduled] ${input.scheduled_date_iso.slice(0, 10)}`;
  const row = await sbUpdateByPublicId<Row>(TABLE, assignmentRecordId, {
    status: "scheduled",
    scheduled_date: input.scheduled_date_iso,
    model_notes: appendNoteBlock(current.model_notes, noteBlock),
  });
  return mapRow(row);
}

export async function completeVAContentAssignmentForModel(
  assignmentRecordId: string,
  modelRecordId: string,
  input: CompleteVAContentAssignmentInput,
  stableModelId?: string | null
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForModel(assignmentRecordId, modelRecordId, stableModelId);
  if (!current || current.status !== "scheduled") return null;
  const completedAt = new Date().toISOString();
  const noteBlock =
    input.completion_notes?.trim() != null && String(input.completion_notes?.trim()).length > 0
      ? `[Completed] ${input.completion_notes!.trim()}`
      : `[Completed] ${completedAt.slice(0, 10)}`;
  const row = await sbUpdateByPublicId<Row>(TABLE, assignmentRecordId, {
    status: "completed",
    completed_at: completedAt,
    model_notes: appendNoteBlock(current.model_notes, noteBlock),
  });
  return mapRow(row);
}

/** Append already-uploaded sb:// tokens (direct client upload). */
export async function appendVAContentAssignmentFileUrls(
  assignmentRecordId: string,
  urls: string[]
): Promise<{ uploaded: number; error?: string }> {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean);
  if (!cleaned.length) return { uploaded: 0 };
  const row = await sbSelectByPublicId<Row>(TABLE, assignmentRecordId);
  if (!row) return { uploaded: 0, error: "Assignment not found" };
  const existing = [...(row.file_attachment ?? []), ...cleaned];
  await sbUpdateByPublicId(TABLE, assignmentRecordId, {
    file_attachment: existing,
    updated_at: new Date().toISOString(),
  });
  return { uploaded: cleaned.length };
}

export async function uploadVAContentAssignmentAttachments(
  assignmentRecordId: string,
  files: ParsedAssignmentFile[]
): Promise<{ uploaded: number; error?: string }> {
  const countErr = validateAssignmentFileCount(files.length);
  if (countErr) return { uploaded: 0, error: countErr };
  const sizeErr = validateAssignmentFileSizes(files);
  if (sizeErr) return { uploaded: 0, error: sizeErr };

  const row = await sbSelectByPublicId<Row>(TABLE, assignmentRecordId);
  if (!row) return { uploaded: 0, error: "Assignment not found" };

  const { uploadToPrivateStorage } = await import("@/lib/supabase-signed-url");
  const existing = [...(row.file_attachment ?? [])];
  let uploaded = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const safeName = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const token = await uploadToPrivateStorage({
        bucket: "attachments",
        objectPath: `va_content_assignments/${row.airtable_id || row.id}/file_attachment/${Date.now()}_${i}_${safeName}`,
        bytes: file.data,
        contentType: file.type || "application/octet-stream",
      });
      existing.push(token);
      uploaded += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (uploaded > 0) {
        await sbUpdateByPublicId(TABLE, assignmentRecordId, {
          file_attachment: existing,
          updated_at: new Date().toISOString(),
        });
      }
      return {
        uploaded,
        error:
          uploaded > 0
            ? `Uploaded ${uploaded} of ${files.length} files, then failed on "${file.name}": ${msg}`
            : `File upload failed for "${file.name}": ${msg}`,
      };
    }
  }
  await sbUpdateByPublicId(TABLE, assignmentRecordId, {
    file_attachment: existing,
    updated_at: new Date().toISOString(),
  });
  return { uploaded };
}

export async function appendVAContentAssignmentUrls(
  assignmentRecordId: string,
  urls: string[]
): Promise<{ uploaded: number; error?: string }> {
  if (!urls.length) return { uploaded: 0 };
  const countErr = validateAssignmentFileCount(urls.length);
  if (countErr) return { uploaded: 0, error: countErr };
  const row = await sbSelectByPublicId<Row>(TABLE, assignmentRecordId);
  if (!row) return { uploaded: 0, error: "Assignment not found" };
  const existing = [...(row.file_attachment ?? []), ...urls.filter(Boolean)];
  await sbUpdateByPublicId(TABLE, assignmentRecordId, {
    file_attachment: existing,
    updated_at: new Date().toISOString(),
  });
  return { uploaded: urls.length };
}

export async function createVaContentAssignmentAdmin(
  input: CreateVaContentAssignmentAdminInput
): Promise<VaContentAssignmentRecord> {
  const assignment_id = `vca_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const priorityNorm = (input.priority || "normal").toLowerCase();
  const [vaUuids, modelUuids] = await Promise.all([
    requireSbUuids("users", [input.va_user_record_id], "va"),
    requireSbUuids("modelss", [input.model_record_id], "model"),
  ]);
  const payload: Record<string, unknown> = {
    assignment_id,
    va: vaUuids,
    model: modelUuids,
    title: input.title.trim(),
    description: input.description.trim(),
    content_type: (input.content_type || "Other").trim(),
    priority: priorityNorm,
    status: input.direct_assign ? "pending" : "pending_approval",
    model_notes: "",
    va_notes: "",
  };
  if (input.deadline?.trim()) payload.deadline = input.deadline.trim();
  const url = input.file_url?.trim();
  if (url && /^https:\/\//i.test(url)) {
    payload.file_url = url;
    payload.file_attachment = [url];
  }
  const row = await sbInsert<Row>(TABLE, payload);
  if (vaUuids.length) {
    await syncAssignmentVas(row.id, vaUuids).catch(() => {});
  }
  return mapRow(row);
}

export async function reviewVAContentAssignmentByAdmin(
  assignmentRecordId: string,
  input: ReviewVAContentAssignmentAdminInput
): Promise<
  | { ok: true; action: "approved" | "rejected"; record: VaContentAssignmentRecord }
  | { ok: false; error: string; statusCode: number }
> {
  const rid = assignmentRecordId?.trim();
  if (!rid) return { ok: false, error: "Missing id", statusCode: 400 };
  const row = await sbSelectByPublicId<Row>(TABLE, rid);
  if (!row) return { ok: false, error: "Not found", statusCode: 404 };
  const current = await mapRow(row);
  if (statusNorm(current.status) !== "pending_approval") {
    return { ok: false, error: "Assignment is not awaiting approval", statusCode: 400 };
  }
  const now = new Date().toISOString();
  const reviewer = input.reviewerLabel?.trim() || "Admin";

  if (input.action === "reject") {
    const reason = input.rejection_reason?.trim();
    if (!reason) return { ok: false, error: "Rejection reason required", statusCode: 400 };
    const updated = await sbUpdateByPublicId<Row>(TABLE, rid, {
      status: "rejected",
      rejection_reason: reason,
      reviewed_by: reviewer,
      reviewed_at: now,
    });
    const mapped = await mapRow(updated);
    const vaTarget = current.va_id?.trim();
    if (vaTarget) {
      await notify({
        user_id: vaTarget,
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "❌ Assignment rejected",
        body: `Your assignment "${current.title}" was rejected. Reason: ${reason}`,
        entity_type: "va_content_assignment",
        entity_id: rid,
        _triggerSource: "va_assignment_admin_review",
      }).catch(() => {});
    }
    return { ok: true, action: "rejected", record: mapped };
  }

  if (input.action === "approve" || input.action === "edit_and_approve") {
    const updateData: Record<string, unknown> = {
      status: "pending",
      reviewed_by: reviewer,
      reviewed_at: now,
    };
    if (input.action === "edit_and_approve" && input.edits) {
      const e = input.edits;
      if (typeof e.title === "string" && e.title.trim()) updateData.title = e.title.trim();
      if (typeof e.description === "string") updateData.description = e.description.trim();
      if (e.deadline !== undefined) updateData.deadline = e.deadline?.trim() ? e.deadline.trim() : null;
      if (typeof e.content_type === "string" && e.content_type.trim()) updateData.content_type = e.content_type.trim();
      if (typeof e.priority === "string" && e.priority.trim()) updateData.priority = e.priority.trim().toLowerCase();
      if (typeof e.admin_edit_notes === "string" && e.admin_edit_notes.trim()) updateData.admin_edit_notes = e.admin_edit_notes.trim();
    }
    const updated = await sbUpdateByPublicId<Row>(TABLE, rid, updateData);
    const mapped = await mapRow(updated);
    const vaTarget = current.va_id?.trim();
    if (vaTarget) {
      const displayTitle = (mapped.title || current.title).trim() || "Chatting content assignment";
      await notifyByRoleConfig(NOTIFICATION_EVENT.VA_CONTENT_ASSIGNED, {
        personal_user_id: vaTarget,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "📋 New Chatting Content",
        body: `${displayTitle} — open Chatting Content or your calendar.`,
        entity_type: "va_content_assignment",
        entity_id: rid,
      }).catch(() => {});
      await notify({
        user_id: vaTarget,
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: input.action === "edit_and_approve" ? "✅ Assignment approved (with edits)" : "✅ Assignment approved",
        body: `Your assignment "${current.title}" was approved and sent to the model.`,
        entity_type: "va_content_assignment",
        entity_id: rid,
        _triggerSource: "va_assignment_admin_review",
      }).catch(() => {});
    }
    return { ok: true, action: "approved", record: mapped };
  }
  return { ok: false, error: "Invalid action", statusCode: 400 };
}
