"use server";

import { createRecord, listAllRecords, getRecord, updateRecord, deleteRecord, type AirtableRecord } from "@/lib/airtable-server";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify, notifyByRoleConfig } from "@/services/notification-service";
import { getUserByAirtableId } from "@/services/users";
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
const _workingVaField = "va";
const _workingModelTextField = "model";

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
  rejection_reason?: string;
  admin_edit_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
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
    rejection_reason: typeof f.rejection_reason === "string" ? f.rejection_reason : "",
    admin_edit_notes: typeof f.admin_edit_notes === "string" ? f.admin_edit_notes : "",
    reviewed_by: typeof f.reviewed_by === "string" ? f.reviewed_by : "",
    reviewed_at: typeof f.reviewed_at === "string" ? f.reviewed_at : null,
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

/** No stable-text VA field exists in the current Airtable base; avoid 422s from `{va_id}`. */
const VA_STABLE_TEXT_FIELD_NAMES = [] as const;

/**
 * Candidate list kept for logging/debugging. The actual query uses the confirmed `va` field directly.
 */
const VA_FILTER_LINK_FIELD_NAMES = ["va", "VA", "assigned_va", "virtual_assistant"] as const;

/**
 * All Airtable identity keys to match for this VA: users table record id (`rec…`) plus stable `user_id` when present.
 */
async function vaIdentityLookupKeys(vaUserRecordId: string): Promise<string[]> {
  const rid = vaUserRecordId?.trim();
  if (!rid) return [];
  const keys = new Set<string>([rid]);
  try {
    const profile = await getUserByAirtableId(rid);
    const stable = profile?.user_id?.trim();
    if (stable) keys.add(stable);
  } catch {
    /* ignore */
  }
  return [...keys];
}

const MODEL_LINK_FIELD_NAMES = [] as const;

/**
 * Single-line text field storing stable `model_…` ids.
 * Logs confirmed `model` is the only working model filter in this base.
 */
const MODEL_STABLE_TEXT_FIELD_NAMES = ["model"] as const;

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

function statusNorm(status: string | undefined): string {
  return String(status ?? "").trim().toLowerCase();
}

/** Rows the model must not see until approved (or at all if rejected). */
function isHiddenFromModelStatus(status: string | undefined): boolean {
  const k = statusNorm(status);
  return k === "pending_approval" || k === "rejected";
}

function isVaEditableStatus(status: string | undefined): boolean {
  const k = statusNorm(status);
  return k === "pending" || k === "pending_approval";
}

/** Linked modelss Airtable record id for resolving the model user (not stable `model_…` text). */
async function modelssAirtableRecordIdForUserNotify(assignmentRecordId: string): Promise<string | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, assignmentRecordId);
    const f = rec.fields;
    return firstLinkedId(f.model) ?? firstLinkedId(f.assigned_model) ?? null;
  } catch {
    return null;
  }
}

/** List VA rows for a modelss stable `model_id` string on `modelss`. */
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
    try {
      const fieldName = _workingModelTextField;
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
      return records;
    } catch (error) {
      console.error(`${DEBUG_PREFIX} model query failed on text field`, {
        table: TABLE,
        fieldName: _workingModelTextField,
        filterByFormula: formulaTextEquals(_workingModelTextField, sid),
        error: error instanceof Error ? error.message : String(error),
      });
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

/** Prefer the confirmed working `va` link field; fallback list+JS only if the direct query fails. */
async function fetchAssignmentRecordsForSingleVaLookupKey(lookupKey: string): Promise<AirtableRecord<Fields>[]> {
  const key = lookupKey.trim();
  if (!key) return [];

  console.log(`${DEBUG_PREFIX} filtering by VA lookup key`, { lookupKey: key });

  try {
    const filterByFormula = formulaLinkedContains(_workingVaField, key);
    const records = await listAllRecords<Fields>(TABLE, {
      filterByFormula,
    });
    console.log(`${DEBUG_PREFIX} va query success`, {
      table: TABLE,
      fieldName: _workingVaField,
      filterByFormula,
      recordsReturned: records.length,
    });
    return records;
  } catch (error) {
    console.error(`${DEBUG_PREFIX} va query failed on confirmed field`, {
      table: TABLE,
      fieldName: _workingVaField,
      filterByFormula: formulaLinkedContains(_workingVaField, key),
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    const all = await listAllRecords<Fields>(TABLE);
    const filtered = all.filter((r) => vaLinkIds(r.fields).includes(key));
    console.log(`${DEBUG_PREFIX} va query fallback scan`, {
      table: TABLE,
      lookupKey: key,
      scanned: all.length,
      recordsReturned: filtered.length,
      firstVaRaw:
        filtered[0]?.fields != null
          ? {
              va: (filtered[0].fields as Fields).va,
              va_id: (filtered[0].fields as Fields).va_id,
              VA: (filtered[0].fields as Fields).VA,
            }
          : null,
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

/** Merge rows for `rec…` users id and stable `user_…` app id through the confirmed `va` field. */
async function fetchAssignmentRecordsForVaUser(
  vaUserRecordId: string,
  precomputedKeys?: string[]
): Promise<AirtableRecord<Fields>[]> {
  const keys =
    precomputedKeys != null && precomputedKeys.length > 0
      ? [...new Set(precomputedKeys.map((k) => k.trim()).filter(Boolean))]
      : await vaIdentityLookupKeys(vaUserRecordId);
  console.log(`${DEBUG_PREFIX} va query start`, {
    table: TABLE,
    vaUserRecordId,
    lookupKeys: keys,
    candidateTextFields: [...VA_STABLE_TEXT_FIELD_NAMES],
    candidateLinkFields: [...VA_FILTER_LINK_FIELD_NAMES],
  });
  const byId = new Map<string, AirtableRecord<Fields>>();
  for (const k of keys) {
    const batch = await fetchAssignmentRecordsForSingleVaLookupKey(k);
    for (const r of batch) byId.set(r.id, r);
  }
  const merged = [...byId.values()];
  console.log(`${DEBUG_PREFIX} merged VA assignment records`, {
    keysTried: keys,
    totalUnique: merged.length,
    firstRecordVaId: merged[0]?.fields != null ? (merged[0].fields as Fields).va_id : undefined,
  });
  return merged;
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
  if (!assignmentRecordId || !vaUserRecordId?.trim()) return null;
  try {
    const keys = await vaIdentityLookupKeys(vaUserRecordId);
    const rec = await getRecord<Fields>(TABLE, assignmentRecordId);
    const f = rec.fields;
    const linkIds = vaLinkIds(f);
    if (!keys.some((k) => linkIds.includes(k))) return null;
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

export type VaUpdatePendingAssignmentInput = {
  title?: string;
  description?: string;
  deadline?: string | null;
  priority?: string;
};

/** VA may edit field copy on their own **pending** rows. */
export async function updatePendingVAContentAssignmentByVa(
  assignmentRecordId: string,
  vaUserRecordId: string,
  patch: VaUpdatePendingAssignmentInput
): Promise<VaContentAssignmentRecord | null> {
  const current = await getVAContentAssignmentForVa(assignmentRecordId, vaUserRecordId);
  if (!current || !isVaEditableStatus(current.status)) return null;
  const fields: Partial<Fields> = {};
  if (patch.title !== undefined) fields.title = patch.title.trim();
  if (patch.description !== undefined) fields.description = patch.description.trim();
  if (patch.deadline !== undefined) {
    fields.deadline = patch.deadline?.trim() ? patch.deadline.trim() : "";
  }
  if (patch.priority !== undefined) {
    fields.priority = (patch.priority || "normal").trim().toLowerCase();
  }
  if (Object.keys(fields).length === 0) return current;
  const rec = await updateRecord<Fields>(TABLE, assignmentRecordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Hard-delete a **pending** assignment owned by this VA. */
export async function deletePendingVAContentAssignmentByVa(
  assignmentRecordId: string,
  vaUserRecordId: string
): Promise<boolean> {
  const current = await getVAContentAssignmentForVa(assignmentRecordId, vaUserRecordId);
  if (!current || !isVaEditableStatus(current.status)) return false;
  await deleteRecord(TABLE, assignmentRecordId);
  return true;
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
  if (!vaUserRecordId?.trim()) return [];
  const keys = await vaIdentityLookupKeys(vaUserRecordId);
  console.log(`${DEBUG_PREFIX} listVAContentAssignmentsForVaUser`, { lookupKeys: keys });
  const records = await fetchAssignmentRecordsForVaUser(vaUserRecordId, keys);
  console.log(`${DEBUG_PREFIX} records mapped for VA`, { count: records.length });
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

/** VA → model content rows where `model` stores stable text id (`modelss.model_id`, e.g. `model_1772908052608_mk2psv`). */
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
    const mapped = records
      .map((r) => mapRecord(r as AirtableRecord<Fields>))
      .filter((row) => !isHiddenFromModelStatus(row.status));
    return sortAssignmentsForModel(mapped);
  } catch {
    return [];
  }
}

/** Distinct `va_id` values from content assignments linked to this model (Airtable user id or stable `user_…` id). */
export async function listDistinctVaUserIdsForModel(
  modelRecordId: string,
  stableModelId?: string | null,
): Promise<string[]> {
  const rows = await listVAContentAssignmentsForModel(modelRecordId, stableModelId);
  const ids = new Set<string>();
  for (const r of rows) {
    const v = r.va_id?.trim();
    if (v) ids.add(v);
  }
  return [...ids];
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
      filterByFormula: `OR({status}="pending",{status}="pending_approval")`,
      fields: ["status"],
    });
    return records.length;
  } catch {
    try {
      const rows = await listAllVAContentAssignments();
      return rows.filter((r) => {
        const k = String(r.status ?? "").trim().toLowerCase();
        return k === "pending" || k === "pending_approval";
      }).length;
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
  let sid = stableModelId?.trim() ?? "";
  if (!sid) {
    const rec = await getModelById(modelRecordId).catch(() => null);
    sid = rec?.model_id?.trim() ?? "";
  }
  const isPending = (r: AirtableRecord<Fields>) =>
    String(r.fields.status ?? "").trim().toLowerCase() === "pending";

  if (sid) {
    try {
      const fieldName = _workingModelTextField;
      const formula = `AND(${formulaTextEquals(fieldName, sid)}, {status}="pending")`;
      const records = await listAllRecords<Fields>(TABLE, {
        filterByFormula: formula,
        fields: ["status"],
      });
      return records.length;
    } catch {
      /* fall back to local scan */
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
    if (!assignmentMappedModelMatches(row, modelRecordId, stableModelId)) return null;
    if (isHiddenFromModelStatus(row.status)) return null;
    return row;
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
    status: "pending_approval",
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

export type ReviewVAContentAssignmentAdminInput = {
  action: "approve" | "reject" | "edit_and_approve";
  reviewerLabel: string;
  rejection_reason?: string;
  edits?: {
    title?: string;
    description?: string;
    deadline?: string | null;
    content_type?: string;
    priority?: string;
    admin_edit_notes?: string;
  };
};

/**
 * Admin/manager approves, rejects, or edits-then-approves a row in `pending_approval`.
 * On approve: status becomes `pending`, model receives VA_CONTENT_ASSIGNED, VA receives system_alert.
 */
export async function reviewVAContentAssignmentByAdmin(
  assignmentRecordId: string,
  input: ReviewVAContentAssignmentAdminInput
): Promise<
  | { ok: true; action: "approved" | "rejected"; record: VaContentAssignmentRecord }
  | { ok: false; error: string; statusCode: number }
> {
  const rid = assignmentRecordId?.trim();
  if (!rid) return { ok: false, error: "Missing id", statusCode: 400 };

  let current: VaContentAssignmentRecord;
  try {
    const rec = await getRecord<Fields>(TABLE, rid);
    current = mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return { ok: false, error: "Not found", statusCode: 404 };
  }

  if (statusNorm(current.status) !== "pending_approval") {
    return { ok: false, error: "Assignment is not awaiting approval", statusCode: 400 };
  }

  const now = new Date().toISOString();
  const reviewer = input.reviewerLabel?.trim() || "Admin";

  if (input.action === "reject") {
    const reason = input.rejection_reason?.trim();
    if (!reason) return { ok: false, error: "Rejection reason required", statusCode: 400 };

    const fields: Partial<Fields> = {
      status: "rejected",
      rejection_reason: reason,
      reviewed_by: reviewer,
      reviewed_at: now,
    };
    const rec = await updateRecord<Fields>(TABLE, rid, fields);
    const row = mapRecord(rec as AirtableRecord<Fields>);

    const vaTarget = current.va_id?.trim();
    if (vaTarget) {
      await notify({
        user_id: vaTarget,
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "❌ Assignment Rejected",
        body: `❌ Your assignment "${current.title}" was rejected. Reason: ${reason}`,
        entity_type: "va_content_assignment",
        entity_id: rid,
        _triggerSource: "va_assignment_admin_review",
      }).catch(() => {});
    }
    return { ok: true, action: "rejected", record: row };
  }

  if (input.action === "approve" || input.action === "edit_and_approve") {
    const updateData: Partial<Fields> = {
      status: "pending",
      reviewed_by: reviewer,
      reviewed_at: now,
    };
    if (input.action === "edit_and_approve" && input.edits) {
      const e = input.edits;
      if (typeof e.title === "string" && e.title.trim()) updateData.title = e.title.trim();
      if (typeof e.description === "string") updateData.description = e.description.trim();
      if (e.deadline !== undefined) {
        updateData.deadline = e.deadline?.trim() ? e.deadline.trim() : "";
      }
      if (typeof e.content_type === "string" && e.content_type.trim()) {
        updateData.content_type = e.content_type.trim();
      }
      if (typeof e.priority === "string" && e.priority.trim()) {
        updateData.priority = e.priority.trim().toLowerCase();
      }
      if (typeof e.admin_edit_notes === "string" && e.admin_edit_notes.trim()) {
        updateData.admin_edit_notes = e.admin_edit_notes.trim();
      }
    }

    const rec = await updateRecord<Fields>(TABLE, rid, updateData);
    const row = mapRecord(rec as AirtableRecord<Fields>);

    const vaTarget = current.va_id?.trim();
    if (vaTarget) {
      const displayTitle = (row.title || current.title).trim() || "VA content assignment";
      await notifyByRoleConfig(NOTIFICATION_EVENT.VA_CONTENT_ASSIGNED, {
        personal_user_id: vaTarget,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "📋 New VA Content Assignment",
        body: `📋 ${displayTitle} — open Content assignments or your calendar.`,
        entity_type: "va_content_assignment",
        entity_id: rid,
      }).catch(() => {});

      await notify({
        user_id: vaTarget,
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: input.action === "edit_and_approve" ? "✅ Assignment Approved (with edits)" : "✅ Assignment Approved",
        body: `✅ Your assignment "${current.title}" was approved and sent to the model.`,
        entity_type: "va_content_assignment",
        entity_id: rid,
        _triggerSource: "va_assignment_admin_review",
      }).catch(() => {});
    }

    return { ok: true, action: "approved", record: row };
  }

  return { ok: false, error: "Invalid action", statusCode: 400 };
}
