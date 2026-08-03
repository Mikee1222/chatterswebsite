/**
 * Supabase backend for services/mass-lists.ts
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import type { MassListRecord, MassListType } from "./mass-lists";

const TABLE = "mass_lists";

type Row = SbRow & {
  name?: string | null;
  emoji?: string | null;
  type?: string | null;
  description?: string | null;
  is_different_mass?: boolean | null;
  applies_to_all_models?: boolean | null;
  model_names?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
};

function coerceType(v: unknown): MassListType {
  return v === "exclude" ? "exclude" : "include";
}

function mapRow(row: Row): MassListRecord {
  const so = row.sort_order;
  const sortNum = typeof so === "number" && Number.isFinite(so) ? so : 0;
  return {
    id: publicId(row),
    emoji: String(row.emoji ?? ""),
    name: String(row.name ?? ""),
    type: coerceType(row.type),
    description: String(row.description ?? ""),
    is_different_mass: Boolean(row.is_different_mass),
    applies_to_all_models: row.applies_to_all_models !== false,
    model_names: String(row.model_names ?? ""),
    is_active: row.is_active !== false,
    sort_order: sortNum,
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

export async function getAllMassLists(): Promise<MassListRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return rows
    .map(mapRow)
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getAllMassListsAdmin(): Promise<MassListRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return rows.map(mapRow).sort((a, b) => a.sort_order - b.sort_order);
}

export async function createMassList(
  data: Omit<MassListRecord, "id" | "created_at">
): Promise<MassListRecord> {
  const row = await sbInsert<Row>(TABLE, {
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
  });
  return mapRow(row);
}

export async function updateMassList(
  id: string,
  data: Partial<Omit<MassListRecord, "id">>
): Promise<MassListRecord> {
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
  const row = await sbUpdateByPublicId<Row>(TABLE, id, fields);
  return mapRow(row);
}

export async function deleteMassList(id: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, id);
}
