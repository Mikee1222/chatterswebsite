/**
 * Dual-backend model_groups reader/writer.
 */
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  createRecord,
  deleteRecord,
  listAllRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";

const TABLE = "model_groups";

export type ModelGroup = {
  id: string;
  name: string;
  /** Comma-joined public model ids (dual-run Airtable-shaped). */
  model_ids: string;
  description: string;
  created_at: string;
};

type ModelGroupFields = {
  name?: string;
  /** Links to modelss (canonical) — legacy CSV string still read if present. */
  model_ids?: string | string[];
  description?: string;
  created_at?: string;
};

function flattenModelIds(fields: ModelGroupFields): string {
  const raw = fields.model_ids;
  if (Array.isArray(raw)) return raw.map((id) => String(id).trim()).filter(Boolean).join(",");
  return String(raw ?? "").trim();
}

function mapGroup(r: AirtableRecord<ModelGroupFields>): ModelGroup {
  return {
    id: r.id,
    name: String(r.fields.name ?? "").trim(),
    model_ids: flattenModelIds(r.fields),
    description: String(r.fields.description ?? "").trim(),
    created_at: String(r.fields.created_at ?? "").trim(),
  };
}

function parseModelIdsInput(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  return String(raw ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function listModelGroups(): Promise<ModelGroup[]> {
  if (isSupabaseBackend()) return (await import("./model-groups-supabase")).listModelGroups();
  const records = await listAllRecords<ModelGroupFields>(TABLE, { _caller: "model-groups.list" });
  return records.map(mapGroup);
}

export async function createModelGroup(input: {
  name: string;
  model_ids?: unknown;
  description?: string;
}): Promise<ModelGroup> {
  if (isSupabaseBackend()) return (await import("./model-groups-supabase")).createModelGroup(input);
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Group name is required");
  const modelIds = parseModelIdsInput(input.model_ids);
  const rec = await createRecord<ModelGroupFields>(TABLE, {
    name,
    model_ids: modelIds,
    description: String(input.description ?? "").trim() || undefined,
    created_at: new Date().toISOString(),
  });
  return mapGroup(rec);
}

export async function updateModelGroup(
  id: string,
  input: { name?: string; model_ids?: unknown; description?: string }
): Promise<ModelGroup> {
  if (isSupabaseBackend()) return (await import("./model-groups-supabase")).updateModelGroup(id, input);
  const fields: Record<string, unknown> = {};
  if (input.name != null) fields.name = String(input.name).trim();
  if (input.model_ids !== undefined) fields.model_ids = parseModelIdsInput(input.model_ids);
  if (input.description !== undefined) fields.description = String(input.description).trim();
  const rec = await updateRecord<ModelGroupFields>(TABLE, id, fields);
  return mapGroup(rec);
}

export async function deleteModelGroup(id: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./model-groups-supabase")).deleteModelGroup(id);
  await deleteRecord(TABLE, id);
}
