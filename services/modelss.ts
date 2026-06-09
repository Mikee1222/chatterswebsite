"use server";

import { unstable_cache } from "next/cache";
import { listRecords, listAllRecords, getRecord, createRecord, updateRecord, type AirtableRecord, type ListParams } from "@/lib/airtable-server";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import type { ModelRecord } from "@/types";
import { listAllUsers } from "@/services/users";

const TABLE = "modelss";

type Fields = {
  model_id?: string;
  of_user_id?: string;
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
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { modelss: records.map(mapRecord), offset };
}

export async function listAllModelss(filterByFormula?: string) {
  const records = await listAllRecords<Fields>(TABLE, filterByFormula ? { filterByFormula } : {});
  return records.map(mapRecord);
}

/** Full modelss list cached 60s — use on heavy admin pages instead of listAllModelss(). */
export const getCachedModelss = unstable_cache(
  async () => listAllModelss(),
  ["all-modelss-v1"],
  { revalidate: 60 }
);

/**
 * Returns only modelss that have a linked user account with role=model, status=active.
 * Use only for admin model-account operational screens (schedules, tasks, live streams, customs).
 * Other pages should use listAllModelss() for full agency operations.
 */
export async function listOperationalModelsWithAccounts(): Promise<ModelRecord[]> {
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
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec);
  } catch {
    return null;
  }
}

export async function getFreeModelss() {
  const modelss = await listAllModelss('{current_status} = "free"');
  return modelss;
}

export async function getOccupiedModelss() {
  const modelss = await listAllModelss('{current_status} = "occupied"');
  return modelss;
}

export async function updateModel(recordId: string, fields: Partial<Fields & ModelssWriteFields>) {
  const rec = await updateRecord(TABLE, recordId, fields as Partial<Fields>);
  const after = mapRecord(rec as AirtableRecord<Fields>);
  return after;
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
