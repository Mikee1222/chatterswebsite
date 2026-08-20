/**
 * Per-model Winner / Super Winner view thresholds.
 * Threshold changes are NOT retroactive — already-classified posts keep their tier.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  DEFAULT_MODEL_WINNER_THRESHOLDS,
  normalizeModelWinnerThresholds,
  type ModelWinnerThresholds,
} from "@/lib/winner-sourcing-helpers";

function mapRow(row: Record<string, unknown>): ModelWinnerThresholds {
  const normalized = normalizeModelWinnerThresholds({
    winner_threshold_views: Number(row.winner_threshold_views),
    super_winner_threshold_views: Number(row.super_winner_threshold_views),
  });
  return {
    model_id: String(row.model_id ?? ""),
    winner_threshold_views: normalized.winner_threshold_views,
    super_winner_threshold_views: normalized.super_winner_threshold_views,
    updated_at: String(row.updated_at ?? ""),
    updated_by: String(row.updated_by ?? ""),
  };
}

export function defaultModelWinnerThresholds(modelId: string): ModelWinnerThresholds {
  return {
    model_id: modelId,
    ...DEFAULT_MODEL_WINNER_THRESHOLDS,
    updated_at: "",
    updated_by: "",
  };
}

export async function getModelWinnerThresholds(
  modelId: string,
): Promise<ModelWinnerThresholds> {
  const id = modelId.trim();
  if (!id) return defaultModelWinnerThresholds("");
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("model_winner_thresholds")
    .select("*")
    .eq("model_id", id)
    .maybeSingle();
  if (error) throw new Error(`getModelWinnerThresholds: ${error.message}`);
  if (!data) return defaultModelWinnerThresholds(id);
  return mapRow(data as Record<string, unknown>);
}

export async function listModelWinnerThresholds(): Promise<ModelWinnerThresholds[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("model_winner_thresholds")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listModelWinnerThresholds: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function listModelWinnerThresholdsMap(): Promise<
  Map<string, ModelWinnerThresholds>
> {
  const rows = await listModelWinnerThresholds();
  const map = new Map<string, ModelWinnerThresholds>();
  for (const row of rows) map.set(row.model_id, row);
  return map;
}

export async function upsertModelWinnerThresholds(input: {
  model_id: string;
  winner_threshold_views: number;
  super_winner_threshold_views: number;
  updated_by: string;
}): Promise<ModelWinnerThresholds> {
  const modelId = input.model_id.trim();
  if (!modelId) throw new Error("Model is required");
  const normalized = normalizeModelWinnerThresholds({
    winner_threshold_views: input.winner_threshold_views,
    super_winner_threshold_views: input.super_winner_threshold_views,
  });
  const now = new Date().toISOString();
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("model_winner_thresholds")
    .upsert(
      {
        model_id: modelId,
        winner_threshold_views: normalized.winner_threshold_views,
        super_winner_threshold_views: normalized.super_winner_threshold_views,
        updated_at: now,
        updated_by: input.updated_by.trim(),
      },
      { onConflict: "model_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`upsertModelWinnerThresholds: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}
