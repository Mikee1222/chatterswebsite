/**
 * Supabase cache for AI feature outputs (service-role only).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

const TABLE = "ai_feature_caches";

export type AiFeatureCacheRecord = {
  id: string;
  feature_key: string;
  cache_key: string;
  content_text: string;
  context_snapshot: Record<string, unknown>;
  model: string | null;
  generated_at: string;
  updated_at: string;
};

export async function getAiFeatureCache(
  featureKey: string,
  cacheKey: string,
): Promise<AiFeatureCacheRecord | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("feature_key", featureKey)
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (error) {
    console.error("[ai-feature-cache] get failed", error.message);
    return null;
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function upsertAiFeatureCache(input: {
  featureKey: string;
  cacheKey: string;
  contentText: string;
  contextSnapshot?: Record<string, unknown>;
  model?: string | null;
}): Promise<AiFeatureCacheRecord> {
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const row = {
    feature_key: input.featureKey,
    cache_key: input.cacheKey,
    content_text: input.contentText,
    context_snapshot: input.contextSnapshot ?? {},
    model: input.model ?? null,
    generated_at: now,
    updated_at: now,
  };
  const { data, error } = await sb
    .from(TABLE)
    .upsert(row, { onConflict: "feature_key,cache_key" })
    .select("*")
    .single();
  if (error) {
    console.error("[ai-feature-cache] upsert failed", error.message);
    throw new Error(error.message);
  }
  return mapRow(data as Record<string, unknown>);
}

export function isAiCacheStale(
  record: AiFeatureCacheRecord | null,
  maxAgeMs: number,
): boolean {
  if (!record?.generated_at) return true;
  const t = new Date(record.generated_at).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > maxAgeMs;
}

function mapRow(row: Record<string, unknown>): AiFeatureCacheRecord {
  const snap = row.context_snapshot;
  return {
    id: String(row.id ?? ""),
    feature_key: String(row.feature_key ?? ""),
    cache_key: String(row.cache_key ?? ""),
    content_text: String(row.content_text ?? ""),
    context_snapshot:
      snap && typeof snap === "object" && !Array.isArray(snap)
        ? (snap as Record<string, unknown>)
        : {},
    model: row.model != null ? String(row.model) : null,
    generated_at: String(row.generated_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}
