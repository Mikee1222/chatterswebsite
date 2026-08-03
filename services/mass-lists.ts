import {
  listAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";

export const MASS_LISTS_TABLE = "mass_lists";

export type MassListType = "include" | "exclude";

export type MassListRecord = {
  id: string;
  emoji: string;
  name: string;
  type: MassListType;
  description: string;
  is_different_mass: boolean;
  applies_to_all_models: boolean;
  model_names: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
};

type MassListFields = {
  name?: string;
  emoji?: string;
  type?: string;
  description?: string;
  is_different_mass?: boolean;
  applies_to_all_models?: boolean;
  model_names?: string;
  is_active?: boolean;
  sort_order?: number | string;
  created_at?: string;
};

const SORT = [{ field: "sort_order", direction: "asc" as const }];

function coerceMassListType(v: unknown): MassListType {
  return v === "exclude" ? "exclude" : "include";
}

function mapMassListRecord(rec: AirtableRecord<MassListFields>): MassListRecord {
  const f = rec.fields ?? {};
  const so = f.sort_order;
  const sortNum =
    typeof so === "number" && Number.isFinite(so)
      ? so
      : typeof so === "string"? Number.parseInt(so, 10)
        : 0;
  return {
    id: rec.id,
    emoji: String(f.emoji ?? ""),
    name: String(f.name ?? ""),
    type: coerceMassListType(f.type),
    description: String(f.description ?? ""),
    is_different_mass: Boolean(f.is_different_mass),
    applies_to_all_models: f.applies_to_all_models !== false,
    model_names: String(f.model_names ?? ""),
    is_active: f.is_active !== false,
    sort_order: Number.isFinite(sortNum) ? sortNum : 0,
    created_at: f.created_at != null ? String(f.created_at) : undefined,
  };
}

export async function getAllMassLists(): Promise<MassListRecord[]> {
  if (isSupabaseBackend()) return (await import("./mass-lists-supabase")).getAllMassLists();
  const rows = await listAllRecords<MassListFields>(MASS_LISTS_TABLE, {
    filterByFormula: "{is_active}",
    sort: SORT,
    _caller: "getAllMassLists",
  });
  return rows.map(mapMassListRecord);
}

export async function getAllMassListsAdmin(): Promise<MassListRecord[]> {
  if (isSupabaseBackend()) return (await import("./mass-lists-supabase")).getAllMassListsAdmin();
  const rows = await listAllRecords<MassListFields>(MASS_LISTS_TABLE, {
    sort: SORT,
    _caller: "getAllMassListsAdmin",
  });
  return rows.map(mapMassListRecord);
}

export async function createMassList(
  data: Omit<MassListRecord, "id" | "created_at">
): Promise<MassListRecord> {
  if (isSupabaseBackend()) return (await import("./mass-lists-supabase")).createMassList(data);
  const fields: Record<string, unknown> = {
    name: data.name,
    emoji: data.emoji,
    type: data.type,
    description: data.description,
    is_different_mass: data.is_different_mass,
    applies_to_all_models: data.applies_to_all_models,
    model_names: data.model_names,
    is_active: data.is_active,
    sort_order: data.sort_order,
    created_at: new Date().toISOString(),
  };
  const rec = await createRecord<MassListFields>(MASS_LISTS_TABLE, fields);
  return mapMassListRecord(rec);
}

export async function updateMassList(
  id: string,
  data: Partial<Omit<MassListRecord, "id">>
): Promise<MassListRecord> {
  if (isSupabaseBackend()) return (await import("./mass-lists-supabase")).updateMassList(id, data);
  const fields: Record<string, unknown> = {};
  if (data.emoji !== undefined) fields.emoji = data.emoji;
  if (data.name !== undefined) fields.name = data.name;
  if (data.type !== undefined) fields.type = data.type;
  if (data.description !== undefined) fields.description = data.description;
  if (data.is_different_mass !== undefined) fields.is_different_mass = data.is_different_mass;
  if (data.applies_to_all_models !== undefined) fields.applies_to_all_models = data.applies_to_all_models;
  if (data.model_names !== undefined) fields.model_names = data.model_names;
  if (data.is_active !== undefined) fields.is_active = data.is_active;
  if (data.sort_order !== undefined) fields.sort_order = data.sort_order;
  if (data.created_at !== undefined) fields.created_at = data.created_at;
  const rec = await updateRecord<MassListFields>(MASS_LISTS_TABLE, id, fields);
  return mapMassListRecord(rec);
}

export async function deleteMassList(id: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./mass-lists-supabase")).deleteMassList(id);
  await deleteRecord(MASS_LISTS_TABLE, id);
}
