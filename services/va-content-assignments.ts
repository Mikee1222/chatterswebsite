"use server";

import { createRecord, listAllRecords, getRecord, updateRecord, type AirtableRecord } from "@/lib/airtable-server";
import { getModelById } from "@/services/modelss";
import {
  firstLinkedId,
  linkedRecordIds,
  formulaLinkedContains,
  formulaTextEquals,
} from "@/lib/airtable-linked";
import type { VaContentAssignmentRecord } from "@/types";

const TABLE = "va_content_assignments";
const DEBUG_PREFIX = "[va-content-assignments]";

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

function modelStableOrLinkId(f: Fields): string {
  const pick = (raw: unknown): string | null => {
    if (typeof raw === "string") {
      const t = raw.trim();
      return t || null;
    }
    return firstLinkedId(raw);
  };
  return pick(f.model) ?? pick(f.model_id) ?? pick(f.assigned_model) ?? "";
}

function mapRecord(rec: AirtableRecord<Fields>): VaContentAssignmentRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    assignment_id: f.assignment_id ?? "",
    model_id: modelStableOrLinkId(f),
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

/**
 * Fields that may store stable model id text (e.g. `model_1772908052608_mk2psv`) vs linked `rec…` ids.
 * Airtable rejects `{field}=…` formulas on wrong column types → try names and swallow errors.
 */
const MODEL_STABLE_TEXT_FIELD_NAMES = ["model", "model_id"] as const;

function trimmedStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Row ties to models table record id (`rec…`) and/or stable `modelss.model_id` text. */
function modelFieldsMatchQuery(
  f: Fields,
  airtableModelRecordId: string,
  stableModelId?: string | null,
): boolean {
  if (modelLinkIds(f).includes(airtableModelRecordId)) return true;
  const sid = stableModelId?.trim();
  if (!sid) return false;
  if (trimmedStr(f.model) === sid) return true;
  if (trimmedStr(f.model_id) === sid) return true;
  if (trimmedStr(f.assigned_model) === sid) return true;
  return false;
}

function assignmentMappedModelMatches(
  row: VaContentAssignmentRecord,
  airtableModelRecordId: string,
  stableModelId?: string | null,
): boolean {
  if (row.model_id === airtableModelRecordId) return true;
  const sid = stableModelId?.trim();
  return Boolean(sid && row.model_id === sid);
}

/** List VA rows for a modelss Airtable id and/or stable `model_id` string on `modelss`. */
async function listAssignmentRecordsByModelLink(
  modelRecordId: string,
  stableModelId?: string | null,
): Promise<AirtableRecord<Fields>[]> {
  const sid = stableModelId?.trim();

  console.log(`${DEBUG_PREFIX} model query start`, {
    table: TABLE,
    modelRecordId,
    stableModelId: sid ?? "",
    candidateTextFields: [...MODEL_STABLE_TEXT_FIELD_NAMES],
    candidateLinkFields: [...MODEL_LINK_FIELD_NAMES],
  });

  if (sid) {
    // Primary: `model` holds stable text id (e.g. model_1772908052608_mk2psv); use equality, not FIND on linked ids.
    try {
      const filterByFormula = formulaTextEquals("model", sid);
      const records = await listAllRecords<Fields>(TABLE, { filterByFormula });
      console.log(`${DEBUG_PREFIX} model query (model text id)`, {
        table: TABLE,
        filterByFormula,
        recordsReturned: records.length,
      });
      // Authoritative when `model` is a plain-text id field — do not merge with FIND(linked) hits.
      return records;
    } catch (error) {
      console.error(`${DEBUG_PREFIX} model query failed on {model}=stableId`, {
        table: TABLE,
        filterByFormula: formulaTextEquals("model", sid),
        error: error instanceof Error ? error.message : String(error),
      });
    }
    for (const fieldName of MODEL_STABLE_TEXT_FIELD_NAMES) {
      if (fieldName === "model") continue;
      try {
        const filterByFormula = formulaTextEquals(fieldName, sid);
        const records = await listAllRecords<Fields>(TABLE, {
          filterByFormula,
        });
        console.log(`${DEBUG_PREFIX} model query (text id)`, {
          table: TABLE,
          fieldName,
          filterByFormula,
          recordsReturned: records.length,
        });
        if (records.length > 0) return records;
      } catch (error) {
        console.error(`${DEBUG_PREFIX} model query failed on text field`, {
          table: TABLE,
          fieldName,
          filterByFormula: formulaTextEquals(fieldName, sid),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  for (const fieldName of MODEL_LINK_FIELD_NAMES) {
    try {
      const filterByFormula = formulaLinkedContains(fieldName, modelRecordId);
      const records = await listAllRecords<Fields>(TABLE, {
        filterByFormula,
      });
      console.log(`${DEBUG_PREFIX} model query success`, {
        table: TABLE,
        fieldName,
        filterByFormula,
        recordsReturned: records.length,
      });
      return records;
    } catch (error) {
      console.error(`${DEBUG_PREFIX} model query failed on field`, {
        table: TABLE,
        fieldName,
        filterByFormula: formulaLinkedContains(fieldName, modelRecordId),
        error: error instanceof Error ? error.message : String(error),
      });
      /* next field name */
    }
  }
  const all = await listAllRecords<Fields>(TABLE);
  const filtered = all.filter((r) => modelFieldsMatchQuery(r.fields, modelRecordId, sid));
  console.log(`${DEBUG_PREFIX} model query fallback scan`, {
    table: TABLE,
    scanned: all.length,
    recordsReturned: filtered.length,
  });
  return filtered;
}

/** Prefer server-side filter; try each known link field name; if all fail, list all and filter in JS. */
async function fetchAssignmentRecordsForVaUser(vaUserRecordId: string): Promise<AirtableRecord<Fields>[]> {
  console.log(`${DEBUG_PREFIX} va query start`, {
    table: TABLE,
    vaUserRecordId,
    candidateFields: [...VA_FILTER_LINK_FIELD_NAMES],
  });
  for (const fieldName of VA_FILTER_LINK_FIELD_NAMES) {
    try {
      const filterByFormula = formulaLinkedContains(fieldName, vaUserRecordId);
      const records = await listAllRecords<Fields>(TABLE, {
        filterByFormula,
      });
      console.log(`${DEBUG_PREFIX} va query success`, {
        table: TABLE,
        fieldName,
        filterByFormula,
        recordsReturned: records.length,
      });
      return records;
    } catch (error) {
      console.error(`${DEBUG_PREFIX} va query failed on field`, {
        table: TABLE,
        fieldName,
        filterByFormula: formulaLinkedContains(fieldName, vaUserRecordId),
        error: error instanceof Error ? error.message : String(error),
      });
      /* field missing or formula error — try next */
    }
  }
  try {
    const all = await listAllRecords<Fields>(TABLE);
    const filtered = all.filter((r) => vaLinkIds(r.fields).includes(vaUserRecordId));
    console.log(`${DEBUG_PREFIX} va query fallback scan`, {
      table: TABLE,
      scanned: all.length,
      recordsReturned: filtered.length,
    });
    return filtered;
  } catch (error) {
    console.error(`${DEBUG_PREFIX} va query fallback scan failed`, {
      table: TABLE,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function fetchAssignmentRecordsForModel(
  modelRecordId: string,
  stableModelId?: string | null,
): Promise<AirtableRecord<Fields>[]> {
  return listAssignmentRecordsByModelLink(modelRecordId, stableModelId);
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

/**
 * VA → model content rows linked to this modelss **Airtable record id**, and/or rows where `model`
 * / `model_id` stores stable text id (`modelss.model_id`, e.g. `model_1772908052608_mk2psv`).
 */
export async function listVAContentAssignmentsForModel(
  modelRecordId: string,
  stableModelId?: string | null,
): Promise<VaContentAssignmentRecord[]> {
  if (!modelRecordId) return [];
  try {
    let sid = stableModelId?.trim() ?? "";
    if (!sid) {
      const rec = await getModelById(modelRecordId).catch(() => null);
      sid = rec?.model_id?.trim() ?? "";
    }
    const records = await fetchAssignmentRecordsForModel(modelRecordId, sid || null);
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
export async function countPendingVAContentAssignmentsForModel(
  modelRecordId: string,
  stableModelId?: string | null,
): Promise<number> {
  if (!modelRecordId) return 0;
  const sid = stableModelId?.trim();
  const isPending = (r: AirtableRecord<Fields>) =>
    String(r.fields.status ?? "").trim().toLowerCase() === "pending";

  if (sid) {
    try {
      const formula = `AND(${formulaTextEquals("model", sid)}, {status}="pending")`;
      const records = await listAllRecords<Fields>(TABLE, {
        filterByFormula: formula,
        fields: ["status"],
      });
      return records.length;
    } catch {
      /* wrong field type or unknown field */
    }
    for (const fieldName of MODEL_STABLE_TEXT_FIELD_NAMES) {
      if (fieldName === "model") continue;
      try {
        const formula = `AND(${formulaTextEquals(fieldName, sid)}, {status}="pending")`;
        const records = await listAllRecords<Fields>(TABLE, {
          filterByFormula: formula,
          fields: ["status"],
        });
        return records.length;
      } catch {
        /* field type mismatch or unknown field */
      }
    }
  }

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
    return all.filter((r) => modelFieldsMatchQuery(r.fields, modelRecordId, sid) && isPending(r)).length;
  } catch {
    return 0;
  }
}

/** Load one row and ensure it belongs to the given modelss Airtable id and/or stable model id text. */
export async function getVAContentAssignmentForModel(
  assignmentRecordId: string,
  modelRecordId: string,
  stableModelId?: string | null,
): Promise<VaContentAssignmentRecord | null> {
  if (!assignmentRecordId || !modelRecordId) return null;
  try {
    const rec = await getRecord<Fields>(TABLE, assignmentRecordId);
    const row = mapRecord(rec as AirtableRecord<Fields>);
    return assignmentMappedModelMatches(row, modelRecordId, stableModelId) ? row : null;
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
  input: ScheduleVAContentAssignmentInput,
  stableModelId?: string | null,
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForModel(
    assignmentRecordId,
    modelRecordId,
    stableModelId,
  );
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
  input: CompleteVAContentAssignmentInput,
  stableModelId?: string | null,
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForModel(
    assignmentRecordId,
    modelRecordId,
    stableModelId,
  );
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
