/**
 * Supabase backend for services/modelss.ts (DATA_BACKEND=supabase).
 */

import {
  firstMappedLinkedId,
  publicId,
  sbInsert,
  sbResolveUuidToAirtableMap,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectEq,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import { filterActiveModelsForAssignment } from "@/lib/assignment-filters";
import type { ModelRecord } from "@/types";
import { listAllUsers } from "@/services/users";

const TABLE = "modelss";

type Row = SbRow & {
  model_id?: string | null;
  of_user_id?: string | null;
  infloww_creator_id?: string | null;
  model_name?: string | null;
  platform?: string | null;
  status?: string | null;
  current_status?: string | null;
  current_chatter?: string[] | null;
  current_chatter_name?: string | null;
  current_shift_id?: string | null;
  entered_at?: string | null;
  last_chatter?: string[] | null;
  last_chatter_name?: string | null;
  last_exit_at?: string | null;
  priority?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  avg_cycle_length?: number | null;
  avg_period_length?: number | null;
  period_notes?: string | null;
  period_tracking_enabled?: boolean | null;
  team?: string | null;
  paypal_email?: string | null;
  paypal_link?: string | null;
  revolut_tag?: string | null;
  payment_notes?: string | null;
  payment_threshold_eur?: number | null;
};

function mapRowSync(row: Row, userAt: Map<string, string>): ModelRecord {
  return {
    id: publicId(row),
    model_id: row.model_id ?? "",
    of_user_id: typeof row.of_user_id === "string" ? row.of_user_id.trim() : "",
    infloww_creator_id:
      typeof row.infloww_creator_id === "string" && row.infloww_creator_id.trim()
        ? row.infloww_creator_id.trim()
        : null,
    model_name: row.model_name ?? "",
    platform: (row.platform as ModelRecord["platform"]) ?? "other",
    status: row.status ?? "",
    current_status: (row.current_status === "occupied" ? "occupied" : "free") as ModelRecord["current_status"],
    current_chatter_id: firstMappedLinkedId(row.current_chatter, userAt),
    current_chatter_name: row.current_chatter_name ?? "",
    current_shift_id: row.current_shift_id ?? "",
    entered_at: row.entered_at ?? null,
    last_chatter_id: firstMappedLinkedId(row.last_chatter, userAt),
    last_chatter_name: row.last_chatter_name ?? "",
    last_exit_at: row.last_exit_at ?? null,
    priority: row.priority ?? "",
    notes: row.notes ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
    avg_cycle_length: typeof row.avg_cycle_length === "number" ? Number(row.avg_cycle_length) : null,
    avg_period_length: typeof row.avg_period_length === "number" ? Number(row.avg_period_length) : null,
    period_notes: typeof row.period_notes === "string" ? row.period_notes : "",
    period_tracking_enabled: row.period_tracking_enabled === true,
    team: (row.team === "chatting_agency" ? "chatting_agency" : "gunzo_team") as ModelRecord["team"],
    paypal_email: typeof row.paypal_email === "string" ? row.paypal_email : undefined,
    paypal_link: typeof row.paypal_link === "string" ? row.paypal_link : undefined,
    revolut_tag: typeof row.revolut_tag === "string" ? row.revolut_tag : undefined,
    payment_notes: typeof row.payment_notes === "string" ? row.payment_notes : undefined,
    payment_threshold_eur:
      typeof row.payment_threshold_eur === "number" ? Number(row.payment_threshold_eur) : undefined,
  };
}

async function mapRows(rows: Row[]): Promise<ModelRecord[]> {
  if (!rows.length) return [];
  const userAt = await sbResolveUuidToAirtableMap("users", [
    ...rows.map((r) => r.current_chatter),
    ...rows.map((r) => r.last_chatter),
  ]);
  return rows.map((r) => mapRowSync(r, userAt));
}

async function mapRow(row: Row): Promise<ModelRecord> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

function filterCompleteModels(modelss: ModelRecord[]): ModelRecord[] {
  return modelss.filter((m) => m.model_name?.trim() && m.model_id?.trim());
}

export type ModelssWriteFields = {
  of_user_id?: string;
  infloww_creator_id?: string | null;
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
  period_tracking_enabled?: boolean | null;
  team?: "gunzo_team" | "chatting_agency";
  paypal_email?: string;
  paypal_link?: string;
  revolut_tag?: string;
  payment_notes?: string;
  payment_threshold_eur?: number;
};

async function toPgPatch(fields: Partial<ModelssWriteFields & Record<string, unknown>>): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  if (fields.current_chatter !== undefined) {
    patch.current_chatter = await sbUuidsForAirtableIds("users", fields.current_chatter);
  }
  if (fields.last_chatter !== undefined) {
    patch.last_chatter = await sbUuidsForAirtableIds("users", fields.last_chatter);
  }
  return patch;
}

export async function listActiveModelsForAssignment(): Promise<ModelRecord[]> {
  return filterActiveModelsForAssignment(await listAllModelss());
}

export async function listModelss(): Promise<{ modelss: ModelRecord[]; offset?: string }> {
  const rows = await sbSelectAll<Row>(TABLE);
  const modelss = filterCompleteModels(await mapRows(rows));
  return { modelss };
}

export async function listAllModelss(filterByFormula?: string): Promise<ModelRecord[]> {
  // Dual-run: support the few formula strings callers use; otherwise load all + filter in memory.
  let rows = await sbSelectAll<Row>(TABLE);
  if (filterByFormula) {
    const f = filterByFormula;
    if (f.includes('{current_status} = "free"')) {
      rows = rows.filter((r) => (r.current_status ?? "") === "free");
    } else if (f.includes('{current_status} = "occupied"')) {
      rows = rows.filter((r) => (r.current_status ?? "") === "occupied");
    } else if (f.includes("gunzo_team") && f.includes("active")) {
      rows = rows.filter(
        (r) => (r.team ?? "gunzo_team") === "gunzo_team" && (r.status ?? "") === "active"
      );
    }
  }
  return filterCompleteModels(await mapRows(rows));
}

export async function listOperationalModelsWithAccounts(): Promise<ModelRecord[]> {
  const [users, allModelss] = await Promise.all([listAllUsers(), listAllModelss()]);
  const operationalModelIds = new Set<string>();
  for (const u of users) {
    if (u.role === "model" && (u.status ?? "").toLowerCase() === "active" && u.linked_model_id) {
      operationalModelIds.add(u.linked_model_id);
    }
  }
  return allModelss.filter((m) => operationalModelIds.has(m.id));
}

export async function getModelById(recordId: string): Promise<ModelRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (!row) return null;
  return mapRow(row);
}

export async function listActiveGunzoTeamModelss(): Promise<ModelRecord[]> {
  return listAllModelss('AND({team} = "gunzo_team", {status} = "active")');
}

export async function getFreeModelss() {
  return listAllModelss('{current_status} = "free"');
}

export async function getOccupiedModelss() {
  return listAllModelss('{current_status} = "occupied"');
}

export async function updateModel(
  recordId: string,
  fields: Partial<Row & ModelssWriteFields>
): Promise<ModelRecord> {
  const patch = await toPgPatch(fields as Partial<ModelssWriteFields & Record<string, unknown>>);
  const updated = await sbUpdateByPublicId<Row>(TABLE, recordId, patch);
  return mapRow(updated);
}

export async function batchUpdateModels(
  updates: { id: string; fields: Partial<Row & ModelssWriteFields> }[]
): Promise<void> {
  if (updates.length === 0) return;
  await Promise.all(updates.map((u) => updateModel(u.id, u.fields)));
}

/** Free models among the given IDs. Keys match the lookup IDs passed in. */
export async function getFreeModelsByRecordIds(
  recordIds: string[]
): Promise<Map<string, { model_name: string }>> {
  const out = new Map<string, { model_name: string }>();
  const unique = [...new Set(recordIds.filter((id) => id?.trim()))];
  await Promise.all(
    unique.map(async (id) => {
      const m = await getModelById(id);
      if (m && m.current_status === "free") {
        out.set(id, { model_name: m.model_name ?? "" });
      }
    })
  );
  return out;
}

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
  const created = await sbInsert<Row>(TABLE, {
    model_id: modelId,
    model_name: fields.model_name.trim(),
    platform: fields.platform ?? "other",
    status: fields.status ?? "active",
    current_status: "free",
    priority: fields.priority ?? "medium",
    notes: fields.notes ?? "",
    team: fields.team ?? "gunzo_team",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return mapRow(created);
}
