/**
 * Fire-and-forget Anthropic call telemetry for admin cost visibility.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

const TABLE = "ai_usage_logs";

export async function logAiUsage(input: {
  featureKey: string;
  model?: string | null;
  ok?: boolean;
}): Promise<void> {
  try {
    const sb = getSupabaseServiceClient();
    const { error } = await sb.from(TABLE).insert({
      feature_key: input.featureKey.slice(0, 120),
      model: input.model?.slice(0, 80) ?? null,
      ok: input.ok !== false,
    });
    if (error) console.error("[ai-usage-log] insert failed", error.message);
  } catch (err) {
    console.error("[ai-usage-log] insert exception", err);
  }
}

export type AiUsageFeatureCount = {
  feature_key: string;
  week_count: number;
  month_count: number;
};

export type AiUsageSummary = {
  week_total: number;
  month_total: number;
  by_feature: AiUsageFeatureCount[];
  generated_at: string;
};

export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  const sb = getSupabaseServiceClient();
  const now = Date.now();
  const weekIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from(TABLE)
    .select("feature_key, created_at")
    .gte("created_at", monthIso)
    .eq("ok", true)
    .limit(20_000);

  if (error) {
    console.error("[ai-usage-log] summary failed", error.message);
    return { week_total: 0, month_total: 0, by_feature: [], generated_at: new Date().toISOString() };
  }

  const map = new Map<string, { week: number; month: number }>();
  let week_total = 0;
  let month_total = 0;
  const weekMs = new Date(weekIso).getTime();

  for (const row of data ?? []) {
    const key = String((row as { feature_key?: string }).feature_key ?? "unknown");
    const t = new Date(String((row as { created_at?: string }).created_at ?? "")).getTime();
    if (!Number.isFinite(t)) continue;
    const bucket = map.get(key) ?? { week: 0, month: 0 };
    bucket.month += 1;
    month_total += 1;
    if (t >= weekMs) {
      bucket.week += 1;
      week_total += 1;
    }
    map.set(key, bucket);
  }

  const by_feature = [...map.entries()]
    .map(([feature_key, v]) => ({
      feature_key,
      week_count: v.week,
      month_count: v.month,
    }))
    .sort((a, b) => b.month_count - a.month_count);

  return {
    week_total,
    month_total,
    by_feature,
    generated_at: new Date().toISOString(),
  };
}
