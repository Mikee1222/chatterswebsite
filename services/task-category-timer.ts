/**
 * Service layer for per-item task timers.
 * Wraps task_category_time_entries and task_category_timer_config Supabase tables.
 *
 * Timer policy: ONE active item-timer at a time per VA (across all tasks).
 * Starting a new item auto-ends any other active timer for that VA.
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
  task_phase_item_id: string;
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
  total_tracked_seconds: number;
};

export type ItemTimeAggregate = {
  task_phase_item_id: string;
  item_title: string;
  category: TaskStepType;
  va_task_id: string;
  va_task_title: string;
  va_id: string;
  va_name: string;
  total_sessions: number;
  total_seconds: number;
  avg_seconds: number | null;
};

export type TaskInstanceTimeStat = {
  va_task_id: string;
  va_task_title: string;
  va_id: string;
  va_name: string;
  items: Array<{
    task_phase_item_id: string;
    item_title: string;
    category: TaskStepType;
    total_seconds: number;
    sessions: number;
    avg_seconds: number | null;
  }>;
  total_seconds: number;
};

export type CategoryTimeStatsResult = {
  by_category: CategoryTimeStat[];
  by_va: VaCategoryTimeStat[];
  total_tracked_seconds: number;
  longest_items: ItemTimeAggregate[];
  shortest_items: ItemTimeAggregate[];
  by_task_instance: TaskInstanceTimeStat[];
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

/** Active timer for this VA (at most one — see idx_tcte_one_active_per_va). */
export async function getActiveTimerForVa(va_id: string): Promise<CategoryTimeEntry | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("task_category_time_entries")
    .select("*")
    .eq("va_id", va_id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getActiveTimerForVa: ${error.message}`);
  return data as CategoryTimeEntry | null;
}

export async function startTimerEntry(input: {
  va_task_id: string;
  task_phase_item_id: string;
  va_id: string;
  category: TaskStepType;
}): Promise<CategoryTimeEntry> {
  const sb = getSupabaseServiceClient();

  // One active item-timer per VA — end any existing session first.
  const existing = await getActiveTimerForVa(input.va_id);
  if (existing) await endTimerEntry(existing.id, input.va_id);

  const { data, error } = await sb
    .from("task_category_time_entries")
    .insert({
      va_task_id: input.va_task_id,
      task_phase_item_id: input.task_phase_item_id,
      va_id: input.va_id,
      category: input.category,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`startTimerEntry: ${error.message}`);
  return data as CategoryTimeEntry;
}

export async function endTimerEntry(
  entry_id: string,
  va_id: string,
  ended_at?: string,
): Promise<CategoryTimeEntry> {
  const sb = getSupabaseServiceClient();
  const endedIso = ended_at ?? new Date().toISOString();

  const { data: existing, error: fetchErr } = await sb
    .from("task_category_time_entries")
    .select("started_at, ended_at")
    .eq("id", entry_id)
    .eq("va_id", va_id)
    .maybeSingle();
  if (fetchErr) throw new Error(`endTimerEntry: ${fetchErr.message}`);
  if (!existing) throw new Error("Timer entry not found");
  if (existing.ended_at) {
    const { data: done, error: doneErr } = await sb
      .from("task_category_time_entries")
      .select("*")
      .eq("id", entry_id)
      .single();
    if (doneErr) throw new Error(`endTimerEntry: ${doneErr.message}`);
    return done as CategoryTimeEntry;
  }

  const startMs = new Date(String(existing.started_at)).getTime();
  const endMs = new Date(endedIso).getTime();
  const duration_seconds =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(0, Math.floor((endMs - startMs) / 1000))
      : null;

  const { data, error } = await sb
    .from("task_category_time_entries")
    .update({ ended_at: endedIso, duration_seconds })
    .eq("id", entry_id)
    .eq("va_id", va_id)
    .select("*")
    .single();
  if (error) throw new Error(`endTimerEntry: ${error.message}`);
  return data as CategoryTimeEntry;
}

/** Stop any active item-timer for this VA (e.g. shift pause/end). Does not complete the checklist item. */
export async function stopActiveTimerForVa(va_id: string, ended_at?: string): Promise<CategoryTimeEntry | null> {
  const active = await getActiveTimerForVa(va_id);
  if (!active) return null;
  return endTimerEntry(active.id, va_id, ended_at);
}

/** Latest completed timer duration per checklist item for one task instance. */
export async function getLatestDurationsForTask(
  va_task_id: string,
  va_id: string,
): Promise<Record<string, number>> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("task_category_time_entries")
    .select("task_phase_item_id, duration_seconds, ended_at")
    .eq("va_task_id", va_task_id)
    .eq("va_id", va_id)
    .not("ended_at", "is", null)
    .not("duration_seconds", "is", null)
    .order("ended_at", { ascending: false });
  if (error) throw new Error(`getLatestDurationsForTask: ${error.message}`);

  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const itemId = String(row.task_phase_item_id ?? "").trim();
    if (!itemId || out[itemId] != null) continue;
    const sec = Math.floor(Number(row.duration_seconds));
    if (Number.isFinite(sec) && sec >= 0) out[itemId] = sec;
  }
  return out;
}

// ─── Reporting ────────────────────────────────────────────────────────────────

type RawEntry = {
  id: string;
  va_task_id: string;
  task_phase_item_id: string;
  va_id: string;
  category: string;
  duration_seconds: number | null;
};

async function loadEntryEnrichment(rows: RawEntry[]): Promise<{
  itemTitleById: Map<string, string>;
  taskTitleById: Map<string, string>;
  vaNameById: Map<string, string>;
}> {
  const sb = getSupabaseServiceClient();
  const itemIds = [...new Set(rows.map((r) => r.task_phase_item_id).filter(Boolean))];
  const taskIds = [...new Set(rows.map((r) => r.va_task_id).filter(Boolean))];
  const vaIds = [...new Set(rows.map((r) => r.va_id).filter(Boolean))];

  const itemTitleById = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: items } = await sb.from("va_task_phase_items").select("id, title").in("id", itemIds);
    for (const row of items ?? []) {
      itemTitleById.set(String(row.id), String(row.title ?? "").trim() || "Checklist item");
    }
  }

  const taskTitleById = new Map<string, string>();
  if (taskIds.length > 0) {
    const { data: tasks } = await sb.from("va_tasks").select("id, title").in("id", taskIds);
    for (const row of tasks ?? []) {
      taskTitleById.set(String(row.id), String(row.title ?? "").trim() || "Task");
    }
  }

  const vaNameById = new Map<string, string>();
  if (vaIds.length > 0) {
    const { data: byId } = await sb.from("users").select("id, airtable_id, full_name, email").in("id", vaIds);
    const { data: byAirtable } = await sb
      .from("users")
      .select("id, airtable_id, full_name, email")
      .in("airtable_id", vaIds);
    for (const row of [...(byId ?? []), ...(byAirtable ?? [])]) {
      const name = String(row.full_name ?? row.email ?? "").trim() || String(row.id);
      vaNameById.set(String(row.id), name);
      if (row.airtable_id) vaNameById.set(String(row.airtable_id), name);
    }
  }

  return { itemTitleById, taskTitleById, vaNameById };
}

export async function computeCategoryTimeStats(opts: {
  startYmd?: string;
  endYmd?: string;
  va_id?: string;
}): Promise<CategoryTimeStatsResult> {
  const sb = getSupabaseServiceClient();

  let query = sb
    .from("task_category_time_entries")
    .select("id, va_task_id, task_phase_item_id, va_id, category, duration_seconds")
    .not("ended_at", "is", null);

  if (opts.startYmd) query = query.gte("started_at", `${opts.startYmd}T00:00:00Z`);
  if (opts.endYmd) query = query.lte("started_at", `${opts.endYmd}T23:59:59Z`);
  if (opts.va_id) query = query.eq("va_id", opts.va_id);

  const { data, error } = await query;
  if (error) throw new Error(`computeCategoryTimeStats: ${error.message}`);

  const rows = (data ?? []) as RawEntry[];
  const { itemTitleById, taskTitleById, vaNameById } = await loadEntryEnrichment(rows);

  const total_tracked_seconds = rows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0);

  // Overall by-category
  const catMap = new Map<string, { total: number; seconds: number }>();
  for (const row of rows) {
    const prev = catMap.get(row.category) ?? { total: 0, seconds: 0 };
    catMap.set(row.category, {
      total: prev.total + 1,
      seconds: prev.seconds + (row.duration_seconds ?? 0),
    });
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
  const vaTotalSeconds = new Map<string, number>();
  for (const row of rows) {
    if (!vaMap.has(row.va_id)) vaMap.set(row.va_id, new Map());
    const vaCats = vaMap.get(row.va_id)!;
    const prev = vaCats.get(row.category) ?? { total: 0, seconds: 0 };
    vaCats.set(row.category, {
      total: prev.total + 1,
      seconds: prev.seconds + (row.duration_seconds ?? 0),
    });
    vaTotalSeconds.set(row.va_id, (vaTotalSeconds.get(row.va_id) ?? 0) + (row.duration_seconds ?? 0));
  }

  const by_va: VaCategoryTimeStat[] = [...vaMap.entries()].map(([va_id, cats]) => ({
    va_id,
    va_name: vaNameById.get(va_id) ?? va_id,
    total_tracked_seconds: vaTotalSeconds.get(va_id) ?? 0,
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

  // Per-item aggregates (for longest/shortest)
  type ItemAgg = { sessions: number; seconds: number; category: string; va_task_id: string; va_id: string };
  const itemAggMap = new Map<string, ItemAgg>();
  for (const row of rows) {
    const key = row.task_phase_item_id;
    const prev = itemAggMap.get(key) ?? {
      sessions: 0,
      seconds: 0,
      category: row.category,
      va_task_id: row.va_task_id,
      va_id: row.va_id,
    };
    itemAggMap.set(key, {
      ...prev,
      sessions: prev.sessions + 1,
      seconds: prev.seconds + (row.duration_seconds ?? 0),
    });
  }

  const itemAggregates: ItemTimeAggregate[] = [...itemAggMap.entries()].map(([task_phase_item_id, agg]) => ({
    task_phase_item_id,
    item_title: itemTitleById.get(task_phase_item_id) ?? "Checklist item",
    category: agg.category as TaskStepType,
    va_task_id: agg.va_task_id,
    va_task_title: taskTitleById.get(agg.va_task_id) ?? "Task",
    va_id: agg.va_id,
    va_name: vaNameById.get(agg.va_id) ?? agg.va_id,
    total_sessions: agg.sessions,
    total_seconds: agg.seconds,
    avg_seconds: agg.sessions > 0 ? Math.round(agg.seconds / agg.sessions) : null,
  }));

  const sortedByAvg = [...itemAggregates]
    .filter((i) => i.avg_seconds != null && i.total_sessions > 0)
    .sort((a, b) => (b.avg_seconds ?? 0) - (a.avg_seconds ?? 0));

  const longest_items = sortedByAvg.slice(0, 5);
  const shortest_items = [...sortedByAvg].reverse().slice(0, 5);

  // Per-task-instance view
  type TaskItemAgg = Map<
    string,
    { item_title: string; category: string; sessions: number; seconds: number }
  >;
  const taskMap = new Map<string, { va_id: string; items: TaskItemAgg }>();
  for (const row of rows) {
    if (!taskMap.has(row.va_task_id)) {
      taskMap.set(row.va_task_id, { va_id: row.va_id, items: new Map() });
    }
    const task = taskMap.get(row.va_task_id)!;
    const prev = task.items.get(row.task_phase_item_id) ?? {
      item_title: itemTitleById.get(row.task_phase_item_id) ?? "Checklist item",
      category: row.category,
      sessions: 0,
      seconds: 0,
    };
    task.items.set(row.task_phase_item_id, {
      ...prev,
      sessions: prev.sessions + 1,
      seconds: prev.seconds + (row.duration_seconds ?? 0),
    });
  }

  const by_task_instance: TaskInstanceTimeStat[] = [...taskMap.entries()]
    .map(([va_task_id, { va_id, items }]) => {
      const itemRows = [...items.entries()].map(([task_phase_item_id, agg]) => ({
        task_phase_item_id,
        item_title: agg.item_title,
        category: agg.category as TaskStepType,
        total_seconds: agg.seconds,
        sessions: agg.sessions,
        avg_seconds: agg.sessions > 0 ? Math.round(agg.seconds / agg.sessions) : null,
      }));
      const total_seconds = itemRows.reduce((s, i) => s + i.total_seconds, 0);
      return {
        va_task_id,
        va_task_title: taskTitleById.get(va_task_id) ?? "Task",
        va_id,
        va_name: vaNameById.get(va_id) ?? va_id,
        items: itemRows.sort((a, b) => b.total_seconds - a.total_seconds),
        total_seconds,
      };
    })
    .sort((a, b) => b.total_seconds - a.total_seconds);

  return {
    by_category,
    by_va,
    total_tracked_seconds,
    longest_items,
    shortest_items,
    by_task_instance,
  };
}
