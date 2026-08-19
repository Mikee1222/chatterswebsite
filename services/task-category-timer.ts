/**
 * Service layer for per-category task timers.
 * Wraps task_category_time_entries and task_category_timer_config Supabase tables.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimerConfig = {
  category: TaskStepType;
  timer_enabled: boolean;
};

export type CategoryTimeEntry = {
  id: string;
  va_task_id: string;
  va_id: string;
  category: TaskStepType;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
};

export type CategoryTimeStat = {
  category: TaskStepType;
  total_sessions: number;
  total_seconds: number;
  avg_seconds: number | null;
};

export type VaCategoryTimeStat = {
  va_id: string;
  va_name: string;
  by_category: CategoryTimeStat[];
};

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getTimerConfigs(): Promise<TimerConfig[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("task_category_timer_config")
    .select("category, timer_enabled")
    .order("category");
  if (error) throw new Error(`getTimerConfigs: ${error.message}`);

  const rows = (data ?? []) as TimerConfig[];
  // Fill any missing categories with defaults
  const byCategory = new Map(rows.map((r) => [r.category, r]));
  return TASK_STEP_TYPES.map((cat) => byCategory.get(cat) ?? { category: cat, timer_enabled: false });
}

export async function getEnabledTimerCategories(): Promise<TaskStepType[]> {
  const configs = await getTimerConfigs();
  return configs.filter((c) => c.timer_enabled).map((c) => c.category);
}

export async function updateTimerConfig(category: TaskStepType, timer_enabled: boolean): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb
    .from("task_category_timer_config")
    .upsert({ category, timer_enabled, updated_at: new Date().toISOString() }, { onConflict: "category" });
  if (error) throw new Error(`updateTimerConfig: ${error.message}`);
}

// ─── Time Entries ─────────────────────────────────────────────────────────────

export async function getActiveTimerEntry(
  va_task_id: string,
  va_id: string,
): Promise<CategoryTimeEntry | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("task_category_time_entries")
    .select("*")
    .eq("va_task_id", va_task_id)
    .eq("va_id", va_id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getActiveTimerEntry: ${error.message}`);
  return data as CategoryTimeEntry | null;
}

export async function startTimerEntry(
  va_task_id: string,
  va_id: string,
  category: TaskStepType,
): Promise<CategoryTimeEntry> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("task_category_time_entries")
    .insert({ va_task_id, va_id, category, started_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw new Error(`startTimerEntry: ${error.message}`);
  return data as CategoryTimeEntry;
}

export async function endTimerEntry(
  entry_id: string,
  va_id: string,
): Promise<CategoryTimeEntry> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("task_category_time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", entry_id)
    .eq("va_id", va_id)
    .select("*")
    .single();
  if (error) throw new Error(`endTimerEntry: ${error.message}`);
  return data as CategoryTimeEntry;
}

// ─── Reporting ────────────────────────────────────────────────────────────────

export async function computeCategoryTimeStats(opts: {
  startYmd?: string;
  endYmd?: string;
  va_id?: string;
}): Promise<{ by_category: CategoryTimeStat[]; by_va: VaCategoryTimeStat[] }> {
  const sb = getSupabaseServiceClient();

  let query = sb
    .from("task_category_time_entries")
    .select("*")
    .not("ended_at", "is", null);

  if (opts.startYmd) query = query.gte("started_at", `${opts.startYmd}T00:00:00Z`);
  if (opts.endYmd) query = query.lte("started_at", `${opts.endYmd}T23:59:59Z`);
  if (opts.va_id) query = query.eq("va_id", opts.va_id);

  const { data, error } = await query;
  if (error) throw new Error(`computeCategoryTimeStats: ${error.message}`);

  const rows = (data ?? []) as Array<{
    va_id: string;
    category: string;
    duration_seconds: number | null;
  }>;

  // Overall by-category
  const catMap = new Map<string, { total: number; seconds: number }>();
  for (const row of rows) {
    const cat = row.category;
    const prev = catMap.get(cat) ?? { total: 0, seconds: 0 };
    catMap.set(cat, { total: prev.total + 1, seconds: prev.seconds + (row.duration_seconds ?? 0) });
  }

  const by_category: CategoryTimeStat[] = TASK_STEP_TYPES.map((cat) => {
    const agg = catMap.get(cat);
    return {
      category: cat,
      total_sessions: agg?.total ?? 0,
      total_seconds: agg?.seconds ?? 0,
      avg_seconds: agg && agg.total > 0 ? Math.round(agg.seconds / agg.total) : null,
    };
  });

  // Per-VA breakdown
  type VaAgg = Map<string, { total: number; seconds: number }>;
  const vaMap = new Map<string, VaAgg>();
  for (const row of rows) {
    if (!vaMap.has(row.va_id)) vaMap.set(row.va_id, new Map());
    const vaCats = vaMap.get(row.va_id)!;
    const prev = vaCats.get(row.category) ?? { total: 0, seconds: 0 };
    vaCats.set(row.category, { total: prev.total + 1, seconds: prev.seconds + (row.duration_seconds ?? 0) });
  }

  const by_va: VaCategoryTimeStat[] = [...vaMap.entries()].map(([va_id, cats]) => ({
    va_id,
    va_name: va_id, // enriched by caller if needed
    by_category: TASK_STEP_TYPES.map((cat) => {
      const agg = cats.get(cat);
      return {
        category: cat,
        total_sessions: agg?.total ?? 0,
        total_seconds: agg?.seconds ?? 0,
        avg_seconds: agg && agg.total > 0 ? Math.round(agg.seconds / agg.total) : null,
      };
    }),
  }));

  return { by_category, by_va };
}
