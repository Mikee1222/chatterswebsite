"use server";

import { listRecords, listAllRecords, getRecord, createRecord, updateRecord, type AirtableRecord, type ListParams } from "@/lib/airtable-server";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import { filterActiveModelsForAssignment } from "@/lib/assignment-filters";
import { isSupabaseBackend } from "@/lib/data-backend";
import type { ModelRecord } from "@/types";
import { listAllUsers } from "@/services/users";

const TABLE = "modelss";

type Fields = {
  model_id?: string;
  of_user_id?: string;
  infloww_creator_id?: string | null;
  model_name?: string;
  platform?: string;
  status?: string;
  current_status?: string;
  current_chatter?: string | string[];
  current_chatter_name?: string;
  current_shift_id?: string;
  entered_at?: string;
  last_chatter?: string | string[];
  last_chatter_name?: string;
  last_exit_at?: string;
  priority?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  avg_cycle_length?: number | null;
  avg_period_length?: number | null;
  period_notes?: string;
  period_tracking_enabled?: boolean;
  team?: string;
  paypal_email?: string;
  paypal_link?: string;
  revolut_tag?: string;
  payment_notes?: string;
  payment_threshold_eur?: number;
};

function mapRecord(rec: AirtableRecord<Fields>): ModelRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    model_id: f.model_id ?? "",
    of_user_id: typeof f.of_user_id === "string" ? f.of_user_id.trim() : "",
    infloww_creator_id:
      typeof f.infloww_creator_id === "string" && f.infloww_creator_id.trim()
        ? f.infloww_creator_id.trim()
        : null,
    model_name: f.model_name ?? "",
    platform: (f.platform as ModelRecord["platform"]) ?? "other",
    status: f.status ?? "",
    current_status: (f.current_status === "occupied" ? "occupied" : "free") as ModelRecord["current_status"],
    current_chatter_id: firstLinkedId(f.current_chatter) ?? "",
    current_chatter_name: snapshotText(f.current_chatter_name),
    current_shift_id: f.current_shift_id ?? "",
    entered_at: f.entered_at ?? null,
    last_chatter_id: firstLinkedId(f.last_chatter) ?? "",
    last_chatter_name: snapshotText(f.last_chatter_name),
    last_exit_at: f.last_exit_at ?? null,
    priority: f.priority ?? "",
    notes: f.notes ?? "",
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
    avg_cycle_length: typeof f.avg_cycle_length === "number" ? f.avg_cycle_length : null,
    avg_period_length: typeof f.avg_period_length === "number" ? f.avg_period_length : null,
    period_notes: typeof f.period_notes === "string" ? f.period_notes : "",
    period_tracking_enabled: f.period_tracking_enabled === true,
    team: (f.team === "chatting_agency" ? "chatting_agency" : "gunzo_team") as ModelRecord["team"],
    paypal_email: typeof f.paypal_email === "string" ? f.paypal_email : undefined,
    paypal_link: typeof f.paypal_link === "string" ? f.paypal_link : undefined,
    revolut_tag: typeof f.revolut_tag === "string" ? f.revolut_tag : undefined,
    payment_notes: typeof f.payment_notes === "string" ? f.payment_notes : undefined,
    payment_threshold_eur: typeof f.payment_threshold_eur === "number" ? f.payment_threshold_eur : undefined,
  };
}

/** Both fields required before a model appears in dropdowns / pickers. */
function filterCompleteModels(modelss: ModelRecord[]): ModelRecord[] {
  return modelss.filter((m) => m.model_name?.trim() && m.model_id?.trim());
}

/** Active modelss only — for assignment dropdowns (not admin list pages). */
export async function listActiveModelsForAssignment(): Promise<ModelRecord[]> {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).listActiveModelsForAssignment();
  return filterActiveModelsForAssignment(await listAllModelss());
}

/** Fields we can write for modelss; linked fields as arrays, snapshots as strings. */
export type ModelssWriteFields = {
  of_user_id?: string;
  current_status?: string;
  current_chatter?: string[];
  current_chatter_name?: string;
  current_shift_id?: string;
  entered_at?: string;
  last_chatter?: string[];
  last_chatter_name?: string;
  last_exit_at?: string;
  avg_cycle_length?: number | null;
  avg_period_length?: number | null;
  period_notes?: string;
  /** Airtable checkbox on modelss — add via scripts/setup-period-tracking.ts if missing. */
  period_tracking_enabled?: boolean | null;
  team?: "gunzo_team" | "chatting_agency";
  paypal_email?: string;
  paypal_link?: string;
  revolut_tag?: string;
  payment_notes?: string;
  payment_threshold_eur?: number;
};

export async function listModelss(params: ListParams = {}) {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).listModelss();
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { modelss: filterCompleteModels(records.map(mapRecord)), offset };
}

export async function listAllModelss(filterByFormula?: string) {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).listAllModelss(filterByFormula);
  const records = await listAllRecords<Fields>(TABLE, filterByFormula ? { filterByFormula } : {});
  return filterCompleteModels(records.map(mapRecord));
}

/**
 * Returns only modelss that have a linked user account with role=model, status=active.
 * Use only for admin model-account operational screens (schedules, tasks, live streams, customs).
 * Other pages should use listAllModelss() for full agency operations.
 */
export async function listOperationalModelsWithAccounts(): Promise<ModelRecord[]> {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).listOperationalModelsWithAccounts();
  const [users, allModelss] = await Promise.all([
    listAllUsers(),
    listAllModelss(),
  ]);
  const operationalModelIds = new Set<string>();
  for (const u of users) {
    if (u.role === "model" && (u.status ?? "").toLowerCase() === "active" && u.linked_model_id) {
      operationalModelIds.add(u.linked_model_id);
    }
  }
  return allModelss.filter((m) => operationalModelIds.has(m.id));
}

export async function getModelById(recordId: string): Promise<ModelRecord | null> {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).getModelById(recordId);
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec);
  } catch {
    return null;
  }
}

/** Active modelss on the Gunzo team (excludes chatting_agency). */
export async function listActiveGunzoTeamModelss(): Promise<ModelRecord[]> {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).listActiveGunzoTeamModelss();
  return listAllModelss('AND({team} = "gunzo_team", {status} = "active")');
}

export async function getFreeModelss() {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).getFreeModelss();
  const modelss = await listAllModelss('{current_status} = "free"');
  return modelss;
}

export async function getOccupiedModelss() {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).getOccupiedModelss();
  const modelss = await listAllModelss('{current_status} = "occupied"');
  return modelss;
}

export async function updateModel(recordId: string, fields: Partial<Fields & ModelssWriteFields>) {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).updateModel(recordId, fields);
  const rec = await updateRecord(TABLE, recordId, fields as Partial<Fields>);
  const after = mapRecord(rec as AirtableRecord<Fields>);
  return after;
}

/** Batch-update modelss (Airtable batch API or parallel Supabase updates). */
export async function batchUpdateModels(
  updates: { id: string; fields: Partial<Fields & ModelssWriteFields> }[]
): Promise<void> {
  if (updates.length === 0) return;
  if (isSupabaseBackend()) {
    return (await import("./modelss-supabase")).batchUpdateModels(updates);
  }
  const { batchUpdateRecords } = await import("@/lib/airtable-server");
  await batchUpdateRecords(
    TABLE,
    updates.map((u) => ({ id: u.id, fields: u.fields as Record<string, unknown> }))
  );
}

/**
 * Free models among the given record IDs.
 * Map keys match the lookup IDs passed in (UUID or rec…).
 */
export async function getFreeModelsByRecordIds(
  recordIds: string[]
): Promise<Map<string, { model_name: string }>> {
  if (isSupabaseBackend()) {
    return (await import("./modelss-supabase")).getFreeModelsByRecordIds(recordIds);
  }
  const out = new Map<string, { model_name: string }>();
  const unique = [...new Set(recordIds.filter((id) => id?.trim()))];
  const chunkSize = 25;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const escaped = chunk.map((id) => id.replace(/"/g, '""'));
    const orClause =
      chunk.length === 1
        ? `RECORD_ID()="${escaped[0]}"`
        : `OR(${escaped.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
    const formula = `AND(${orClause}, {current_status}="free")`;
    const { records } = await listRecords<{ model_name?: string }>(TABLE, {
      filterByFormula: formula,
      fields: ["model_name", "current_status"],
      pageSize: 100,
      _caller: "modelss.getFreeModelsByRecordIds",
    });
    for (const r of records) {
      out.set(r.id, { model_name: typeof r.fields?.model_name === "string" ? r.fields.model_name : "" });
    }
  }
  return out;
}

/** Admin create: model_name, platform, status, priority, notes. Defaults: current_status=free, priority=medium, linked/snapshot fields empty. */
export type CreateModelFields = {
  model_name: string;
  platform?: string;
  status?: string;
  priority?: string;
  notes?: string;
  team?: "gunzo_team" | "chatting_agency";
};

export async function createModel(fields: CreateModelFields): Promise<ModelRecord> {
  if (isSupabaseBackend()) return (await import("./modelss-supabase")).createModel(fields);
  const modelId = `model_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const rec = await createRecord<Fields>(TABLE, {
    model_id: modelId,
    model_name: fields.model_name.trim(),
    platform: fields.platform ?? "other",
    status: fields.status ?? "active",
    current_status: "free",
    priority: fields.priority ?? "medium",
    notes: fields.notes ?? "",
    team: fields.team ?? "gunzo_team",
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}
