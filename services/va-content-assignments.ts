"use server";

import { createRecord, listAllRecords, getRecord, updateRecord, type AirtableRecord } from "@/lib/airtable-server";
import { firstLinkedId, linkedRecordIds, formulaLinkedContains } from "@/lib/airtable-linked";
import type { VaContentAssignmentRecord } from "@/types";

const TABLE = "va_content_assignments";

/** Airtable attachment cell item (subset). */
export type VaAttachmentCell = {
  id?: string;
  url?: string;
  filename?: string;
  size?: number;
  type?: string;
};

type Fields = {
  assignment_id?: string;
  model?: string | string[];
  /** Some bases name the modelss link like `custom_requests.assigned_model`. */
  assigned_model?: string | string[];
  va?: string | string[];
  /** Some bases use alternate API keys; read-only for mapping/filter fallbacks. */
  VA?: string | string[];
  /** Renamed / hand-built bases sometimes use these link names for the users row. */
  assigned_va?: string | string[];
  virtual_assistant?: string | string[];
  model_id?: string | string[];
  va_id?: string | string[];
  title?: string;
  description?: string;
  content_type?: string;
  file_url?: string;
  file_attachment?: VaAttachmentCell[] | unknown;
  deadline?: string;
  scheduled_date?: string;
  status?: string;
  priority?: string;
  model_notes?: string;
  va_notes?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
};

function parseAttachments(raw: unknown): VaAttachmentCell[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is VaAttachmentCell => x != null && typeof x === "object" && "url" in (x as object))
    .map((x) => ({
      id: typeof (x as VaAttachmentCell).id === "string" ? (x as VaAttachmentCell).id : undefined,
      url: typeof (x as VaAttachmentCell).url === "string" ? (x as VaAttachmentCell).url : undefined,
      filename: typeof (x as VaAttachmentCell).filename === "string" ? (x as VaAttachmentCell).filename : undefined,
      size: typeof (x as VaAttachmentCell).size === "number" ? (x as VaAttachmentCell).size : undefined,
      type: typeof (x as VaAttachmentCell).type === "string" ? (x as VaAttachmentCell).type : undefined,
    }));
}

function mapRecord(rec: AirtableRecord<Fields>): VaContentAssignmentRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    assignment_id: f.assignment_id ?? "",
    model_id:
      firstLinkedId(f.model) ??
      firstLinkedId(f.model_id) ??
      firstLinkedId(f.assigned_model) ??
      "",
    va_id:
      firstLinkedId(f.va) ??
      firstLinkedId(f.va_id) ??
      firstLinkedId(f.VA) ??
      firstLinkedId(f.assigned_va) ??
      firstLinkedId(f.virtual_assistant) ??
      null,
    title: f.title ?? "",
    description: f.description ?? "",
    content_type: f.content_type ?? "",
    file_url: f.file_url ?? null,
    file_attachment: parseAttachments(f.file_attachment),
    deadline: f.deadline ?? null,
    scheduled_date: f.scheduled_date ?? null,
    status: f.status ?? "",
    priority: f.priority ?? "",
    model_notes: f.model_notes ?? "",
    va_notes: f.va_notes ?? "",
    completed_at: f.completed_at ?? null,
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
  };
}

/** All linked record ids for the VA column (supports alternate Airtable field names). */
function vaLinkIds(f: Fields): string[] {
  return [
    ...linkedRecordIds(f.va),
    ...linkedRecordIds(f.VA),
    ...linkedRecordIds(f.va_id),
    ...linkedRecordIds(f.assigned_va),
    ...linkedRecordIds(f.virtual_assistant),
  ];
}

/** All linked record ids for the model column. */
function modelLinkIds(f: Fields): string[] {
  return [
    ...linkedRecordIds(f.model),
    ...linkedRecordIds(f.model_id),
    ...linkedRecordIds(f.assigned_model),
  ];
}

/**
 * Link field API names to try for server-side filter (one field per attempt).
 * A single OR() across names fails if any referenced field does not exist in the base.
 */
const VA_FILTER_LINK_FIELD_NAMES = ["va", "va_id", "VA", "assigned_va", "virtual_assistant"] as const;

const MODEL_LINK_FIELD_NAMES = ["model", "assigned_model"] as const;

/** List rows linked to this modelss id: try known link field API names, then scan. */
async function listAssignmentRecordsByModelLink(modelRecordId: string): Promise<AirtableRecord<Fields>[]> {
  for (const fieldName of MODEL_LINK_FIELD_NAMES) {
    try {
      return await listAllRecords<Fields>(TABLE, {
        filterByFormula: formulaLinkedContains(fieldName, modelRecordId),
      });
    } catch {
      /* next field name */
    }
  }
  const all = await listAllRecords<Fields>(TABLE);
  return all.filter((r) => modelLinkIds(r.fields).includes(modelRecordId));
}

/** Prefer server-side filter; try each known link field name; if all fail, list all and filter in JS. */
async function fetchAssignmentRecordsForVaUser(vaUserRecordId: string): Promise<AirtableRecord<Fields>[]> {
  for (const fieldName of VA_FILTER_LINK_FIELD_NAMES) {
    try {
      return await listAllRecords<Fields>(TABLE, {
        filterByFormula: formulaLinkedContains(fieldName, vaUserRecordId),
      });
    } catch {
      /* field missing or formula error — try next */
    }
  }
  try {
    const all = await listAllRecords<Fields>(TABLE);
    return all.filter((r) => vaLinkIds(r.fields).includes(vaUserRecordId));
  } catch {
    return [];
  }
}

async function fetchAssignmentRecordsForModel(modelRecordId: string): Promise<AirtableRecord<Fields>[]> {
  return listAssignmentRecordsByModelLink(modelRecordId);
}

function sortAssignmentsForVa(rows: VaContentAssignmentRecord[]): VaContentAssignmentRecord[] {
  return [...rows].sort((a, b) => {
    const ta = Date.parse(a.created_at || "") || 0;
    const tb = Date.parse(b.created_at || "") || 0;
    return tb - ta;
  });
}

function sortAssignmentsForAdmin(rows: VaContentAssignmentRecord[]): VaContentAssignmentRecord[] {
  return [...rows].sort((a, b) => {
    const da = Date.parse(a.deadline ?? "") || Number.POSITIVE_INFINITY;
    const db = Date.parse(b.deadline ?? "") || Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    const ta = Date.parse(a.created_at || "") || 0;
    const tb = Date.parse(b.created_at || "") || 0;
    return tb - ta;
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

/** Load one assignment and ensure `va` links to this users record id. */
export async function getVAContentAssignmentForVa(
  assignmentRecordId: string,
  vaUserRecordId: string
): Promise<VaContentAssignmentRecord | null> {
  if (!assignmentRecordId || !vaUserRecordId) return null;
  try {
    const rec = await getRecord<Fields>(TABLE, assignmentRecordId);
    const f = rec.fields;
    if (!vaLinkIds(f).includes(vaUserRecordId)) return null;
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

function appendVaNoteBlock(existing: string, block: string): string {
  const e = existing.trim();
  const b = block.trim();
  if (!b) return e;
  return e ? `${e}\n\n${b}` : b;
}

/** Append a block to `va_notes` after verifying the row belongs to this VA. */
export async function appendVAContentAssignmentVaNotes(
  assignmentRecordId: string,
  vaUserRecordId: string,
  noteBlock: string
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForVa(assignmentRecordId, vaUserRecordId);
  if (!current) return null;
  const b = noteBlock.trim();
  if (!b) return null;
  const rec = await updateRecord<Fields>(TABLE, assignmentRecordId, {
    va_notes: appendVaNoteBlock(current.va_notes, b),
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** All content assignments created by / assigned to this VA (users record id). */
export async function listVAContentAssignmentsForVaUser(vaUserRecordId: string): Promise<VaContentAssignmentRecord[]> {
  if (!vaUserRecordId) return [];
  const records = await fetchAssignmentRecordsForVaUser(vaUserRecordId);
  return sortAssignmentsForVa(records.map((r) => mapRecord(r as AirtableRecord<Fields>)));
}

/** Distinct modelss record ids linked from rows where `va` contains this users record id. */
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

/** All VA content assignments whose calendar date (`scheduled_date` else `deadline`) falls in the range inclusive. */
export async function listAllVAContentAssignmentsInRange(fromDate: string, toDate: string): Promise<VaContentAssignmentRecord[]> {
  if (!fromDate || !toDate) return [];
  try {
    const records = await listAllRecords<Fields>(TABLE);
    return records
      .map((r) => mapRecord(r as AirtableRecord<Fields>))
      .filter((v) => {
        const ymd = vaAssignmentDisplayDateYmd(v);
        return ymd != null && ymd >= fromDate && ymd <= toDate;
      });
  } catch {
    return [];
  }
}

/** VA → model content rows linked to this modelss record id. */
export async function listVAContentAssignmentsForModel(modelRecordId: string): Promise<VaContentAssignmentRecord[]> {
  if (!modelRecordId) return [];
  try {
    const records = await fetchAssignmentRecordsForModel(modelRecordId);
    return sortAssignmentsForModel(records.map((r) => mapRecord(r as AirtableRecord<Fields>)));
  } catch {
    return [];
  }
}

/** Admin/staff list: all VA content assignments across all models. */
export async function listAllVAContentAssignments(): Promise<VaContentAssignmentRecord[]> {
  try {
    const records = await listAllRecords<Fields>(TABLE);
    return sortAssignmentsForAdmin(records.map((r) => mapRecord(r as AirtableRecord<Fields>)));
  } catch {
    return [];
  }
}

/** Admin/staff lookup by Airtable record id. */
export async function getVAContentAssignmentById(assignmentRecordId: string): Promise<VaContentAssignmentRecord | null> {
  if (!assignmentRecordId) return null;
  try {
    const rec = await getRecord<Fields>(TABLE, assignmentRecordId);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

/** Pending count across all VA content assignments (for admin nav badge). */
export async function countPendingVAContentAssignments(): Promise<number> {
  try {
    const records = await listAllRecords<Fields>(TABLE, {
      filterByFormula: `{status}="pending"`,
      fields: ["status"],
    });
    return records.length;
  } catch {
    try {
      const rows = await listAllVAContentAssignments();
      return rows.filter((r) => String(r.status ?? "").trim().toLowerCase() === "pending").length;
    } catch {
      return 0;
    }
  }
}

type CancelVAContentAssignmentInput = {
  reason: string;
  actorLabel?: string;
};

/** Admin/staff cancel with reason appended to `model_notes`. */
export async function cancelVAContentAssignment(
  assignmentRecordId: string,
  input: CancelVAContentAssignmentInput
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentById(assignmentRecordId);
  if (!current) return null;
  const reason = input.reason.trim();
  if (!reason) return null;
  const actor = input.actorLabel?.trim() || "Admin";
  const noteBlock = `[${actor} cancelled] ${reason}`;
  const fields: Partial<Fields> = {
    status: "cancelled",
    model_notes: appendModelNoteBlock(current.model_notes, noteBlock),
  };
  const rec = await updateRecord<Fields>(TABLE, assignmentRecordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Count of assignments in `pending` for this model (server-only; uses Airtable filter). */
export async function countPendingVAContentAssignmentsForModel(modelRecordId: string): Promise<number> {
  if (!modelRecordId) return 0;
  const isPending = (r: AirtableRecord<Fields>) =>
    String(r.fields.status ?? "").trim().toLowerCase() === "pending";
  for (const fieldName of MODEL_LINK_FIELD_NAMES) {
    try {
      const formula = `AND(${formulaLinkedContains(fieldName, modelRecordId)}, {status}="pending")`;
      const records = await listAllRecords<Fields>(TABLE, {
        filterByFormula: formula,
        fields: ["status"],
      });
      return records.length;
    } catch {
      /* try next link field name */
    }
  }
  try {
    const all = await listAllRecords<Fields>(TABLE);
    return all.filter((r) => modelLinkIds(r.fields).includes(modelRecordId) && isPending(r)).length;
  } catch {
    return 0;
  }
}

/** Load one row and ensure it belongs to the given modelss id. */
export async function getVAContentAssignmentForModel(
  assignmentRecordId: string,
  modelRecordId: string
): Promise<VaContentAssignmentRecord | null> {
  if (!assignmentRecordId || !modelRecordId) return null;
  try {
    const rec = await getRecord<Fields>(TABLE, assignmentRecordId);
    const row = mapRecord(rec as AirtableRecord<Fields>);
    return row.model_id === modelRecordId ? row : null;
  } catch {
    return null;
  }
}

export type ScheduleVAContentAssignmentInput = {
  scheduled_date_iso: string;
  /** Appended to `model_notes` when non-empty. */
  notes?: string;
};

export type CompleteVAContentAssignmentInput = {
  /** Appended to `model_notes` when non-empty. */
  completion_notes?: string;
};

function appendModelNoteBlock(existing: string, block: string): string {
  const e = existing.trim();
  const b = block.trim();
  if (!b) return e;
  return e ? `${e}\n\n${b}` : b;
}

/** Model sets status scheduled + scheduled_date; optional note block on model_notes. */
export async function scheduleVAContentAssignmentForModel(
  assignmentRecordId: string,
  modelRecordId: string,
  input: ScheduleVAContentAssignmentInput
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForModel(assignmentRecordId, modelRecordId);
  if (!current || current.status !== "pending") return null;

  const noteBlock =
    input.notes?.trim() != null && String(input.notes?.trim()).length > 0
      ? `[Scheduled] ${input.scheduled_date_iso.slice(0, 10)} — ${input.notes!.trim()}`
      : `[Scheduled] ${input.scheduled_date_iso.slice(0, 10)}`;

  const fields: Partial<Fields> = {
    status: "scheduled",
    scheduled_date: input.scheduled_date_iso,
    model_notes: appendModelNoteBlock(current.model_notes, noteBlock),
  };

  const rec = await updateRecord<Fields>(TABLE, assignmentRecordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Model marks completed + completed_at; optional note on model_notes. */
export async function completeVAContentAssignmentForModel(
  assignmentRecordId: string,
  modelRecordId: string,
  input: CompleteVAContentAssignmentInput
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForModel(assignmentRecordId, modelRecordId);
  if (!current || current.status !== "scheduled") return null;

  const completedAt = new Date().toISOString();
  const noteBlock =
    input.completion_notes?.trim() != null && String(input.completion_notes?.trim()).length > 0
      ? `[Completed] ${input.completion_notes!.trim()}`
      : `[Completed] ${completedAt.slice(0, 10)}`;

  const fields: Partial<Fields> = {
    status: "completed",
    completed_at: completedAt,
    model_notes: appendModelNoteBlock(current.model_notes, noteBlock),
  };

  const rec = await updateRecord<Fields>(TABLE, assignmentRecordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export type CreateVaContentAssignmentAdminInput = {
  va_user_record_id: string;
  model_record_id: string;
  title: string;
  description: string;
  content_type: string;
  priority: string;
  /** ISO datetime or date string; empty omits field. */
  deadline: string | null;
  /** Public HTTPS URL — Airtable will pull into `file_attachment` when set. */
  file_url?: string | null;
};

/**
 * Create a `va_content_assignments` row (VA dashboard or API passes `va_user_record_id`; admin UI removed).
 * For local files, create the row first then call `uploadAirtableAttachment` with the returned `id`.
 */
export async function createVaContentAssignmentAdmin(
  input: CreateVaContentAssignmentAdminInput
): Promise<VaContentAssignmentRecord> {
  const assignment_id = `vca_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const priorityNorm = (input.priority || "normal").toLowerCase();
  const payload: Record<string, unknown> = {
    assignment_id,
    va: [input.va_user_record_id],
    model: [input.model_record_id],
    title: input.title.trim(),
    description: input.description.trim(),
    content_type: (input.content_type || "Other").trim(),
    priority: priorityNorm,
    status: "pending",
    model_notes: "",
    va_notes: "",
  };
  if (input.deadline?.trim()) {
    payload.deadline = input.deadline.trim();
  }
  const url = input.file_url?.trim();
  if (url && /^https:\/\//i.test(url)) {
    payload.file_url = url;
    const nameFromUrl = url.split("/").pop()?.split("?")[0]?.trim() || "file";
    payload.file_attachment = [{ url, filename: decodeURIComponent(nameFromUrl) }];
  }
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}
