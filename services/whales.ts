import { listRecords, listAllRecords, getRecord, createRecord, updateRecord, type AirtableRecord, type ListParams } from "@/lib/airtable-server";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import { buildWhalesFilterFormula, WHALES_DEFAULT_PAGE_SIZE, type WhalesListFilters } from "@/lib/whales-filters";
import type { Whale } from "@/types";

const TABLE = "whales";

type Fields = {
  whale_id?: string;
  username?: string;
  platform?: string;
  assigned_chatter?: string | string[];
  assigned_chatter_name?: string;
  assigned_model?: string | string[];
  assigned_model_name?: string;
  relationship_status?: string;
  hours_active?: string | string[];
  active_hours_start?: string;
  active_hours_end?: string;
  timezone?: string;
  country?: string;
  language?: string;
  spend_level?: string;
  total_spent?: number;
  last_spent_amount?: number;
  last_spent_date?: string;
  last_contact_date?: string;
  next_followup?: string;
  response_speed?: string;
  personality_type?: string;
  preferences?: string;
  red_flags?: string;
  retention_risk?: string;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  last_updated_by?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): Whale {
  const f = rec.fields;
  return {
    id: rec.id,
    whale_id: f.whale_id ?? "",
    username: f.username ?? "",
    platform: (f.platform as Whale["platform"]) ?? "other",
    assigned_chatter_id: firstLinkedId(f.assigned_chatter) ?? "",
    assigned_chatter_name: snapshotText(f.assigned_chatter_name),
    assigned_model_id: firstLinkedId(f.assigned_model) ?? "",
    assigned_model_name: snapshotText(f.assigned_model_name),
    relationship_status: (f.relationship_status as Whale["relationship_status"]) ?? "",
    hours_active: Array.isArray(f.hours_active) ? f.hours_active : (f.hours_active ? [f.hours_active] : []),
    active_hours_start: f.active_hours_start ?? "",
    active_hours_end: f.active_hours_end ?? "",
    timezone: f.timezone ?? "",
    country: f.country ?? "",
    language: f.language ?? "",
    spend_level: (f.spend_level as Whale["spend_level"]) ?? "low",
    total_spent: f.total_spent ?? 0,
    last_spent_amount: f.last_spent_amount ?? 0,
    last_spent_date: f.last_spent_date ?? null,
    last_contact_date: f.last_contact_date ?? null,
    next_followup: f.next_followup ?? null,
    response_speed: f.response_speed ?? "",
    personality_type: f.personality_type ?? "",
    preferences: f.preferences ?? "",
    red_flags: f.red_flags ?? "",
    retention_risk: f.retention_risk ?? "",
    status: (f.status as Whale["status"]) ?? "Active",
    notes: f.notes ?? "",
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
    last_updated_by: f.last_updated_by ?? "",
  };
}

/** Write payload: linked fields as [recordId], snapshots as strings. */
export type WhaleWriteFields = Partial<{
  whale_id: string;
  username: string;
  assigned_chatter: string[];
  assigned_chatter_name: string;
  assigned_model: string[];
  assigned_model_name: string;
  relationship_status: string;
  status: string;
  hours_active?: string[];
  notes: string;
  [k: string]: unknown;
}>;

export async function listWhales(params: ListParams & { filterByFormula?: string } = {}) {
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { whales: records.map(mapRecord), offset };
}

export async function listAllWhales(filterByFormula?: string) {
  const records = await listAllRecords<Fields>(TABLE, filterByFormula ? { filterByFormula } : {});
  return records.map(mapRecord);
}

/** Global status counts across all whales (for dashboard summary cards). Fetches only status field. */
export type WhaleStatusCounts = {
  total: number;
  active: number;
  inactive: number;
  dead: number;
  deleted: number;
};

export async function getWhaleStatusCounts(): Promise<WhaleStatusCounts> {
  const records = await listAllRecords<Pick<Fields, "status">>(TABLE, { fields: ["status"] });
  let active = 0;
  let inactive = 0;
  let dead = 0;
  let deleted = 0;
  for (const r of records) {
    const s = (r.fields?.status as string) ?? "";
    if (s === "Active") active++;
    else if (s === "Inactive") inactive++;
    else if (s === "Dead") dead++;
    else if (s === "Deleted Account") deleted++;
  }
  return {
    total: records.length,
    active,
    inactive,
    dead,
    deleted,
  };
}

export type { WhalesListFilters } from "@/lib/whales-filters";

/**
 * List whales with server-side filtering and pagination for admin table.
 * Returns one page and nextOffset for "next page" (no total count from Airtable).
 */
export async function listWhalesPaginated(
  filters: WhalesListFilters,
  pageSize: number = WHALES_DEFAULT_PAGE_SIZE,
  offset?: string
): Promise<{ whales: Whale[]; nextOffset: string | null }> {
  const formula = buildWhalesFilterFormula(filters);
  const params: ListParams & { filterByFormula?: string } = {
    pageSize: Math.min(100, Math.max(1, pageSize)),
    ...(offset && { offset }),
    ...(formula && { filterByFormula: formula, _caller: "whales.listWhalesPaginated" }),
  };
  const { records, offset: nextOffset } = await listRecords<Fields>(TABLE, params);
  return {
    whales: records.map(mapRecord),
    nextOffset: nextOffset ?? null,
  };
}

/**
 * Load whales assigned to the current chatter.
 * Uses application-side filtering: Airtable formula on linked fields can be unreliable
 * (formula sees display values, not record IDs), so we fetch and filter by assigned_chatter
 * linked record IDs.
 */
export async function getWhalesByChatter(chatterRecordId: string): Promise<Whale[]> {
  const all = await listAllWhales();
  const matched = all.filter((w) => w.assigned_chatter_id === chatterRecordId);
  if (process.env.NODE_ENV !== "production") {
    const sampleAssigned = all.slice(0, 3).map((w) => ({
      id: w.id,
      assigned_chatter_id: w.assigned_chatter_id,
      assigned_chatter_name: w.assigned_chatter_name,
    }));
    console.log("[getWhalesByChatter]", {
      chatterRecordId,
      totalFetched: all.length,
      matchedCount: matched.length,
      sampleAssigned,
    });
  }
  return matched;
}

export async function getWhaleById(recordId: string): Promise<Whale | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec);
  } catch {
    return null;
  }
}

export async function getWhaleByWhaleId(whaleId: string): Promise<Whale | null> {
  const { whales } = await listWhales({ filterByFormula: `{whale_id} = "${whaleId.replace(/"/g, '""')}"`, pageSize: 1 });
  return whales[0] ?? null;
}

export async function createWhale(fields: WhaleWriteFields) {
  const rec = await createRecord(TABLE, fields as Record<string, unknown>);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updateWhale(recordId: string, fields: WhaleWriteFields) {
  const rec = await updateRecord(TABLE, recordId, fields as Partial<Fields>);
  return mapRecord(rec as AirtableRecord<Fields>);
}
