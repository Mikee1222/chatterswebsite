"use server";

import { listRecords, listAllRecords, getRecord, createRecord, updateRecord, type AirtableRecord, type ListParams } from "@/lib/airtable-server";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import type { ModelRecord } from "@/types";

const TABLE = "modelss";

type Fields = {
  model_id?: string;
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
};

function mapRecord(rec: AirtableRecord<Fields>): ModelRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    model_id: f.model_id ?? "",
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
  };
}

/** Fields we can write for modelss; linked fields as arrays, snapshots as strings. */
export type ModelssWriteFields = {
  current_status?: string;
  current_chatter?: string[];
  current_chatter_name?: string;
  current_shift_id?: string;
  entered_at?: string;
  last_chatter?: string[];
  last_chatter_name?: string;
  last_exit_at?: string;
};

export async function listModelss(params: ListParams = {}) {
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { modelss: records.map(mapRecord), offset };
}

export async function listAllModelss(filterByFormula?: string) {
  const records = await listAllRecords<Fields>(TABLE, filterByFormula ? { filterByFormula } : {});
  return records.map(mapRecord);
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
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Admin create: model_name, platform, status, priority, notes. Defaults: current_status=free, priority=medium, linked/snapshot fields empty. */
export type CreateModelFields = {
  model_name: string;
  platform?: string;
  status?: string;
  priority?: string;
  notes?: string;
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
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}
