/**
 * Supabase backend for services/model-groups.ts
 */
import {
  mapLinkedIds,
  publicId,
  requireSbUuidsOrEmpty,
  sbDeleteByPublicId,
  sbInsert,
  sbResolveUuidToAirtableMap,
  sbSelectAll,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import type { ModelGroup } from "./model-groups";

const TABLE = "model_groups";

type Row = SbRow & {
  name?: string | null;
  model_ids?: string[] | null;
  description?: string | null;
  created_at?: string | null;
};

function parseModelIdsInput(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  return String(raw ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function mapRowSync(row: Row, modelAtByUuid: Map<string, string>): ModelGroup {
  const ids = mapLinkedIds(row.model_ids, modelAtByUuid);
  return {
    id: publicId(row),
    name: String(row.name ?? "").trim(),
    model_ids: ids.join(","),
    description: String(row.description ?? "").trim(),
    created_at: String(row.created_at ?? "").trim(),
  };
}

async function mapRows(rows: Row[]): Promise<ModelGroup[]> {
  if (!rows.length) return [];
  const modelAtByUuid = await sbResolveUuidToAirtableMap(
    "modelss",
    rows.map((r) => r.model_ids)
  );
  return rows.map((r) => mapRowSync(r, modelAtByUuid));
}

export async function listModelGroups(): Promise<ModelGroup[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return mapRows(rows);
}

export async function createModelGroup(input: {
  name: string;
  model_ids?: unknown;
  description?: string;
}): Promise<ModelGroup> {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Group name is required");
  const modelIds = parseModelIdsInput(input.model_ids);
  const modelUuids = await requireSbUuidsOrEmpty("modelss", modelIds, "model_ids");
  if (modelIds.length > 0 && modelUuids.length === 0) {
    throw new Error("requireSbUuids modelss: unresolved model_ids");
  }
  const row = await sbInsert<Row>(TABLE, {
    name,
    model_ids: modelUuids,
    description: String(input.description ?? "").trim() || null,
    created_at: new Date().toISOString(),
  });
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function updateModelGroup(
  id: string,
  input: { name?: string; model_ids?: unknown; description?: string }
): Promise<ModelGroup> {
  const patch: Record<string, unknown> = {};
  if (input.name != null) patch.name = String(input.name).trim();
  if (input.description !== undefined) patch.description = String(input.description).trim();
  if (input.model_ids !== undefined) {
    const modelIds = parseModelIdsInput(input.model_ids);
    patch.model_ids = await requireSbUuidsOrEmpty("modelss", modelIds, "model_ids");
  }
  const row = await sbUpdateByPublicId<Row>(TABLE, id, patch);
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function deleteModelGroup(id: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, id);
}
