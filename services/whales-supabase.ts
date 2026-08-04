/**
 * Supabase backend for services/whales.ts (DATA_BACKEND=supabase).
 */

import {
  firstMappedLinkedId,
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbResolveUuidToAirtableMap,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectEq,
  sbSelectWhere,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import { WHALES_DEFAULT_PAGE_SIZE, WHALES_STATUS_FILTER_NOT_ASSIGNED, type WhalesListFilters } from "@/lib/whales-filters";
import type { Whale } from "@/types";
import { devLog } from "@/lib/dev-log";
import type { WhaleWriteFields } from "./whales";

const TABLE = "whales";

type Row = SbRow & {
  whale_id?: string | null;
  username?: string | null;
  platform?: string | null;
  assigned_chatter?: string[] | null;
  assigned_chatter_name?: string | null;
  assigned_model?: string[] | null;
  assigned_model_name?: string | null;
  relationship_status?: string | null;
  hours_active?: string[] | null;
  active_hours_start?: string | null;
  active_hours_end?: string | null;
  timezone?: string | null;
  country?: string | null;
  language?: string | null;
  spend_level?: string | null;
  total_spent?: number | null;
  last_spent_amount?: number | null;
  last_spent_date?: string | null;
  last_contact_date?: string | null;
  next_followup?: string | null;
  response_speed?: string | null;
  personality_type?: string | null;
  preferences?: string | null;
  red_flags?: string | null;
  retention_risk?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_updated_by?: string | null;
  added_by?: string[] | null;
};

function mapRowSync(
  row: Row,
  userAt: Map<string, string>,
  modelAt: Map<string, string>
): Whale {
  return {
    id: publicId(row),
    whale_id: row.whale_id ?? "",
    username: row.username ?? "",
    platform: (row.platform as Whale["platform"]) ?? "other",
    assigned_chatter_id: firstMappedLinkedId(row.assigned_chatter, userAt),
    assigned_chatter_name: row.assigned_chatter_name ?? "",
    assigned_model_id: firstMappedLinkedId(row.assigned_model, modelAt),
    assigned_model_name: row.assigned_model_name ?? "",
    relationship_status: (row.relationship_status as Whale["relationship_status"]) ?? "",
    hours_active: Array.isArray(row.hours_active) ? row.hours_active : [],
    active_hours_start: row.active_hours_start ?? "",
    active_hours_end: row.active_hours_end ?? "",
    timezone: row.timezone ?? "",
    country: row.country ?? "",
    language: row.language ?? "",
    spend_level: (row.spend_level as Whale["spend_level"]) ?? "low",
    total_spent: Number(row.total_spent ?? 0),
    last_spent_amount: Number(row.last_spent_amount ?? 0),
    last_spent_date: row.last_spent_date ?? null,
    last_contact_date: row.last_contact_date ?? null,
    next_followup: row.next_followup ?? null,
    response_speed: row.response_speed ?? "",
    personality_type: row.personality_type ?? "",
    preferences: row.preferences ?? "",
    red_flags: row.red_flags ?? "",
    retention_risk: row.retention_risk ?? "",
    status: (row.status as Whale["status"]) ?? "Active",
    notes: row.notes ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
    last_updated_by: row.last_updated_by ?? "",
    created_by: firstMappedLinkedId(row.added_by, userAt),
  };
}

async function mapRows(rows: Row[]): Promise<Whale[]> {
  if (!rows.length) return [];
  const [userAt, modelAt] = await Promise.all([
    sbResolveUuidToAirtableMap("users", [
      ...rows.map((r) => r.assigned_chatter),
      ...rows.map((r) => r.added_by),
    ]),
    sbResolveUuidToAirtableMap("modelss", rows.map((r) => r.assigned_model)),
  ]);
  return rows.map((r) => mapRowSync(r, userAt, modelAt));
}

async function mapRow(row: Row): Promise<Whale> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

function matchesFilters(w: Whale, filters: WhalesListFilters): boolean {
  if (filters.relationshipStatus && w.relationship_status !== filters.relationshipStatus) {
    return false;
  }
  if (filters.status?.trim()) {
    const s = filters.status.trim();
    if (s === WHALES_STATUS_FILTER_NOT_ASSIGNED) {
      if (w.assigned_chatter_id?.trim()) return false;
    } else if (w.status !== s) {
      return false;
    }
  }
  if (filters.usernameSearch?.trim()) {
    const q = filters.usernameSearch.trim().toLowerCase();
    if (!(w.username ?? "").toLowerCase().includes(q)) return false;
  }
  if (filters.chatterId && w.assigned_chatter_id !== filters.chatterId) return false;
  if (filters.modelId && w.assigned_model_id !== filters.modelId) return false;
  return true;
}

async function writePayloadToRow(fields: WhaleWriteFields): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = {};
  if (fields.whale_id !== undefined) row.whale_id = fields.whale_id;
  if (fields.username !== undefined) row.username = fields.username;
  if (fields.relationship_status !== undefined) row.relationship_status = fields.relationship_status;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.hours_active !== undefined) row.hours_active = fields.hours_active;
  if (fields.notes !== undefined) row.notes = fields.notes;
  if (fields.assigned_chatter_name !== undefined) {
    row.assigned_chatter_name = fields.assigned_chatter_name;
  }
  if (fields.assigned_model_name !== undefined) {
    row.assigned_model_name = fields.assigned_model_name;
  }
  if (fields.assigned_chatter !== undefined) {
    row.assigned_chatter = await sbUuidsForAirtableIds("users", fields.assigned_chatter);
  }
  if (fields.assigned_model !== undefined) {
    row.assigned_model = await sbUuidsForAirtableIds("modelss", fields.assigned_model);
  }
  if (fields.created_by !== undefined) {
    const ids = await sbUuidsForAirtableIds("users", [fields.created_by]);
    if (ids.length) row.added_by = ids;
  }
  // Pass through remaining scalar fields that match column names
  for (const [k, v] of Object.entries(fields)) {
    if (
      [
        "whale_id",
        "username",
        "assigned_chatter",
        "assigned_chatter_name",
        "assigned_model",
        "assigned_model_name",
        "relationship_status",
        "status",
        "hours_active",
        "notes",
        "created_by",
      ].includes(k)
    ) {
      continue;
    }
    if (v !== undefined) row[k] = v;
  }
  return row;
}

export async function listWhales(_params: { filterByFormula?: string; pageSize?: number } = {}) {
  const whales = await listAllWhales();
  return { whales, offset: undefined as string | undefined };
}

export async function listAllWhales(_filterByFormula?: string): Promise<Whale[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return mapRows(rows);
}

export async function countWhalesWithoutChatter(): Promise<number> {
  const rows = await sbSelectWhere<Pick<Row, "id" | "airtable_id">>(
    TABLE,
    (q) => q.or("assigned_chatter.is.null,assigned_chatter.eq.{}"),
    "id, airtable_id"
  );
  return rows.length;
}

export type WhaleStatusCounts = {
  total: number;
  active: number;
  inactive: number;
  dead: number;
  deleted: number;
};

export async function getWhaleStatusCounts(): Promise<WhaleStatusCounts> {
  const rows = await sbSelectAll<Pick<Row, "id" | "airtable_id" | "status">>(TABLE, "id, airtable_id, status");
  let active = 0;
  let inactive = 0;
  let dead = 0;
  let deleted = 0;
  for (const r of rows) {
    const s = (r.status as string) ?? "";
    if (s === "Active") active++;
    else if (s === "Inactive") inactive++;
    else if (s === "Dead") dead++;
    else if (s === "Deleted Account") deleted++;
  }
  return { total: rows.length, active, inactive, dead, deleted };
}

export async function listWhalesPaginated(
  filters: WhalesListFilters,
  pageSize: number = WHALES_DEFAULT_PAGE_SIZE,
  offset?: string
): Promise<{ whales: Whale[]; nextOffset: string | null }> {
  const [chatterUuids, modelUuids] = await Promise.all([
    filters.chatterId
      ? sbUuidsForAirtableIds("users", [filters.chatterId])
      : Promise.resolve([] as string[]),
    filters.modelId
      ? sbUuidsForAirtableIds("modelss", [filters.modelId])
      : Promise.resolve([] as string[]),
  ]);

  const rows = await sbSelectWhere<Row>(TABLE, (q) => {
    let query = q;
    if (filters.relationshipStatus) {
      query = query.eq("relationship_status", filters.relationshipStatus);
    }
    if (filters.status?.trim()) {
      const s = filters.status.trim();
      if (s === WHALES_STATUS_FILTER_NOT_ASSIGNED) {
        query = query.or("assigned_chatter.is.null,assigned_chatter.eq.{}");
      } else {
        query = query.eq("status", s);
      }
    }
    if (filters.usernameSearch?.trim()) {
      const qText = filters.usernameSearch.trim().slice(0, 100);
      query = query.ilike("username", `%${qText}%`);
    }
    if (filters.chatterId) {
      if (!chatterUuids[0]) return query.eq("id", "00000000-0000-0000-0000-000000000000");
      query = query.contains("assigned_chatter", [chatterUuids[0]]);
    }
    if (filters.modelId) {
      if (!modelUuids[0]) return query.eq("id", "00000000-0000-0000-0000-000000000000");
      query = query.contains("assigned_model", [modelUuids[0]]);
    }
    return query;
  });

  const mapped = await mapRows(rows);
  // Keep in-memory matchesFilters for dual-id edge cases (airtable vs uuid public ids).
  const filtered = mapped.filter((w) => matchesFilters(w, filters));
  const size = Math.min(100, Math.max(1, pageSize));
  const start = offset ? Math.max(0, parseInt(offset, 10) || 0) : 0;
  const page = filtered.slice(start, start + size);
  const next = start + size < filtered.length ? String(start + size) : null;
  return { whales: page, nextOffset: next };
}

export async function getWhalesByChatter(chatterRecordId: string): Promise<Whale[]> {
  const uuids = await sbUuidsForAirtableIds("users", [chatterRecordId]);
  if (!uuids[0]) return [];
  const rows = await sbSelectWhere<Row>(TABLE, (q) =>
    q.contains("assigned_chatter", [uuids[0]!])
  );
  const matched = await mapRows(rows);
  if (process.env.NODE_ENV !== "production") {
    devLog("[getWhalesByChatter:sb]", {
      chatterRecordId,
      totalFetched: matched.length,
      matchedCount: matched.length,
    });
  }
  return matched;
}

export async function getWhaleById(recordId: string): Promise<Whale | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (!row) return null;
  return mapRow(row);
}

export async function getWhaleByWhaleId(whaleId: string): Promise<Whale | null> {
  const rows = await sbSelectEq<Row>(TABLE, "whale_id", whaleId, "*", 1);
  if (!rows[0]) return null;
  return mapRow(rows[0]);
}

export async function createWhale(fields: WhaleWriteFields) {
  const payload = await writePayloadToRow(fields);
  if (!payload.created_at) payload.created_at = new Date().toISOString();
  payload.updated_at = new Date().toISOString();
  const inserted = await sbInsert<Row>(TABLE, payload);
  return mapRow(inserted);
}

export async function updateWhale(recordId: string, fields: WhaleWriteFields) {
  const payload = await writePayloadToRow(fields);
  payload.updated_at = new Date().toISOString();
  const updated = await sbUpdateByPublicId<Row>(TABLE, recordId, payload);
  return mapRow(updated);
}

export async function deleteWhale(recordId: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, recordId);
}

