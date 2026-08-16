/**
 * Per-model Story CTA Link A/B URLs (Supabase model_story_link_config).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type ModelStoryLinkConfig = {
  id: string;
  model_id: string;
  link_a_url: string | null;
  link_b_url: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type ModelStoryLinkConfigInput = {
  link_a_url?: string | null;
  link_b_url?: string | null;
};

type ConfigRow = {
  id: string;
  model_id: string;
  link_a_url: string | null;
  link_b_url: string | null;
  updated_by: string | null;
  updated_at: string;
};

function mapRow(row: ConfigRow): ModelStoryLinkConfig {
  return {
    id: row.id,
    model_id: row.model_id.trim(),
    link_a_url: row.link_a_url?.trim() || null,
    link_b_url: row.link_b_url?.trim() || null,
    updated_by: row.updated_by?.trim() || null,
    updated_at: row.updated_at,
  };
}

function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function getModelStoryLinkConfig(
  modelId: string,
): Promise<ModelStoryLinkConfig | null> {
  const mid = modelId.trim();
  if (!mid) return null;

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("model_story_link_config")
    .select("id,model_id,link_a_url,link_b_url,updated_by,updated_at")
    .eq("model_id", mid)
    .maybeSingle();
  if (error) throw new Error(`get model_story_link_config: ${error.message}`);
  return data ? mapRow(data as ConfigRow) : null;
}

export async function listModelStoryLinkConfigs(
  modelIds: string[],
): Promise<ModelStoryLinkConfig[]> {
  const ids = [...new Set(modelIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return [];

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("model_story_link_config")
    .select("id,model_id,link_a_url,link_b_url,updated_by,updated_at")
    .in("model_id", ids);
  if (error) throw new Error(`list model_story_link_config: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as ConfigRow));
}

export async function upsertModelStoryLinkConfig(
  modelId: string,
  input: ModelStoryLinkConfigInput,
  updatedBy?: string | null,
): Promise<ModelStoryLinkConfig> {
  const mid = modelId.trim();
  if (!mid) throw new Error("model_id is required");

  const payload = {
    model_id: mid,
    link_a_url: normalizeUrl(input.link_a_url),
    link_b_url: normalizeUrl(input.link_b_url),
    updated_by: updatedBy?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("model_story_link_config")
    .upsert(payload, { onConflict: "model_id" })
    .select("id,model_id,link_a_url,link_b_url,updated_by,updated_at")
    .single();
  if (error) throw new Error(`upsert model_story_link_config: ${error.message}`);
  return mapRow(data as ConfigRow);
}

export async function deleteModelStoryLinkConfig(modelId: string): Promise<void> {
  const mid = modelId.trim();
  if (!mid) return;

  const sb = getSupabaseServiceClient();
  const { error } = await sb.from("model_story_link_config").delete().eq("model_id", mid);
  if (error) throw new Error(`delete model_story_link_config: ${error.message}`);
}
