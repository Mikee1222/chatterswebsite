/**
 * Content cycles — Content Flow v1.1.
 * Two cycles per month per model (1–15, 16–end). Each cycle owns one Proven bunch
 * (researcher, cap 30) and one Experimental bunch (Head of Marketing, cap 15).
 * Counters: fill progress per bunch, grid / trial posting progress, urgent slots used.
 */

import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { getModelById } from "@/services/modelss";
import {
  countUrgentUsedThisMonth,
  createVideoBunch,
  listVideoBunches,
  type VideoBunch,
} from "@/services/winner-sourcing";

const CYCLES = "content_cycles";
const SETTINGS = "content_cycle_settings";

export type CycleStatus = "planning" | "filling" | "briefing" | "shooting" | "posting" | "done";
export const CYCLE_STATUSES: CycleStatus[] = [
  "planning",
  "filling",
  "briefing",
  "shooting",
  "posting",
  "done",
];

export type ContentCycleSettings = {
  model_id: string;
  proven_cap: number;
  experimental_cap: number;
  grid_per_day: number;
  trials_per_day: number;
  urgent_slots_per_month: number;
  outlier_multiple: number;
  hot_multiple: number;
  baseline_posts: number;
  /** Grid outlier scan window (days) for the ClarioSuite auto-detect. */
  outlier_scan_days: number;
};

export const DEFAULT_CYCLE_SETTINGS: Omit<ContentCycleSettings, "model_id"> = {
  proven_cap: 30,
  experimental_cap: 15,
  grid_per_day: 3,
  trials_per_day: 6,
  urgent_slots_per_month: 2,
  outlier_multiple: 2.5,
  hot_multiple: 10,
  baseline_posts: 9,
  outlier_scan_days: 20,
};

export type ContentCycle = {
  id: string;
  model_id: string;
  model_name: string;
  number: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  proven_cap: number;
  experimental_cap: number;
  grid_per_day: number;
  trials_per_day: number;
  proven_bunch_id: string | null;
  experimental_bunch_id: string | null;
  status: CycleStatus;
  notes: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type CycleStats = {
  days_total: number;
  days_elapsed: number;
  proven: { provided: number; pending: number; cap: number };
  experimental: { provided: number; pending: number; cap: number };
  /** Posted inside the cycle's date range, by placement + source. */
  posted: {
    grid_proven: number;
    grid_experimental: number;
    grid_other: number;
    trials: number;
    grid_target: number;
    trials_target: number;
  };
  outliers: number;
  urgent: { used: number; total: number };
};

export type ContentCycleWithStats = ContentCycle & {
  stats: CycleStats;
  proven_bunch?: VideoBunch | null;
  experimental_bunch?: VideoBunch | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function num(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function coerceStatus(v: unknown): CycleStatus {
  return (CYCLE_STATUSES as string[]).includes(str(v)) ? (v as CycleStatus) : "planning";
}

function mapCycle(row: Record<string, unknown>): ContentCycle {
  return {
    id: str(row.id),
    model_id: str(row.model_id),
    model_name: str(row.model_name),
    number: num(row.number, 1),
    start_date: str(row.start_date).slice(0, 10),
    end_date: str(row.end_date).slice(0, 10),
    proven_cap: num(row.proven_cap, 30),
    experimental_cap: num(row.experimental_cap, 15),
    grid_per_day: num(row.grid_per_day, 3),
    trials_per_day: num(row.trials_per_day, 6),
    proven_bunch_id: row.proven_bunch_id ? str(row.proven_bunch_id) : null,
    experimental_bunch_id: row.experimental_bunch_id ? str(row.experimental_bunch_id) : null,
    status: coerceStatus(row.status),
    notes: str(row.notes),
    created_by_id: str(row.created_by_id),
    created_by_name: str(row.created_by_name),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

export async function getCycleSettings(modelId: string): Promise<ContentCycleSettings> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb.from(SETTINGS).select("*").eq("model_id", modelId).maybeSingle();
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    model_id: modelId,
    proven_cap: num(r.proven_cap, DEFAULT_CYCLE_SETTINGS.proven_cap),
    experimental_cap: num(r.experimental_cap, DEFAULT_CYCLE_SETTINGS.experimental_cap),
    grid_per_day: num(r.grid_per_day, DEFAULT_CYCLE_SETTINGS.grid_per_day),
    trials_per_day: num(r.trials_per_day, DEFAULT_CYCLE_SETTINGS.trials_per_day),
    urgent_slots_per_month: num(r.urgent_slots_per_month, DEFAULT_CYCLE_SETTINGS.urgent_slots_per_month),
    outlier_multiple: num(r.outlier_multiple, DEFAULT_CYCLE_SETTINGS.outlier_multiple),
    hot_multiple: num(r.hot_multiple, DEFAULT_CYCLE_SETTINGS.hot_multiple),
    baseline_posts: num(r.baseline_posts, DEFAULT_CYCLE_SETTINGS.baseline_posts),
    outlier_scan_days: num(r.outlier_scan_days, DEFAULT_CYCLE_SETTINGS.outlier_scan_days),
  };
}

export async function upsertCycleSettings(
  modelId: string,
  patch: Partial<Omit<ContentCycleSettings, "model_id">>,
  userId: string,
): Promise<ContentCycleSettings> {
  const current = await getCycleSettings(modelId);
  const next = { ...current, ...patch, model_id: modelId };
  if (next.proven_cap < 1) throw new Error("Proven cap must be at least 1");
  if (next.experimental_cap < 0) throw new Error("Experimental cap cannot be negative");
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from(SETTINGS).upsert(
    { ...next, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "model_id" },
  );
  if (error) throw new Error(`upsertCycleSettings: ${error.message}`);
  return next;
}

/* ------------------------------------------------------------------ */
/* Dates                                                                */
/* ------------------------------------------------------------------ */

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The half-month window containing `at`: 1–15 or 16–end. */
export function halfMonthWindow(at: Date): { start: string; end: string } {
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth();
  const day = at.getUTCDate();
  if (day <= 15) {
    return { start: iso(new Date(Date.UTC(y, m, 1))), end: iso(new Date(Date.UTC(y, m, 15))) };
  }
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { start: iso(new Date(Date.UTC(y, m, 16))), end: iso(new Date(Date.UTC(y, m, last))) };
}

/** The half-month window right after the given end date. */
export function nextHalfMonthWindow(afterEnd: string): { start: string; end: string } {
  const d = new Date(`${afterEnd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return halfMonthWindow(d);
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                 */
/* ------------------------------------------------------------------ */

export async function listCycles(modelId?: string | null): Promise<ContentCycle[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from(CYCLES).select("*").order("start_date", { ascending: false });
  if (modelId) q = q.eq("model_id", modelId);
  const { data, error } = await q;
  if (error) throw new Error(`listCycles: ${error.message}`);
  return (data ?? []).map((r) => mapCycle(r as Record<string, unknown>));
}

export async function getCycle(id: string): Promise<ContentCycle | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(CYCLES).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getCycle: ${error.message}`);
  return data ? mapCycle(data as Record<string, unknown>) : null;
}

/**
 * Start the next cycle for a model: the half-month after the latest cycle (or the current
 * half-month when there is none), with one Proven + one Experimental bunch created at the caps.
 */
export async function startNextCycle(input: {
  model_id: string;
  actor_id: string;
  actor_name: string;
  /** Force a specific start (YYYY-MM-DD); defaults to the next free half-month. */
  start_date?: string;
}): Promise<ContentCycle> {
  const model = await getModelById(input.model_id);
  const modelName = model?.model_name?.trim() || "Creator";
  const settings = await getCycleSettings(input.model_id);
  const existing = await listCycles(input.model_id);
  const latest = existing[0] ?? null;

  let window: { start: string; end: string };
  if (input.start_date) {
    window = halfMonthWindow(new Date(`${input.start_date}T00:00:00Z`));
  } else if (latest) {
    window = nextHalfMonthWindow(latest.end_date);
  } else {
    window = halfMonthWindow(new Date());
  }
  if (existing.some((c) => c.start_date === window.start)) {
    throw new Error(`A cycle starting ${window.start} already exists for ${modelName}`);
  }
  const number = (latest?.number ?? 0) + 1;

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(CYCLES)
    .insert({
      model_id: input.model_id,
      model_name: modelName,
      number,
      start_date: window.start,
      end_date: window.end,
      proven_cap: settings.proven_cap,
      experimental_cap: settings.experimental_cap,
      grid_per_day: settings.grid_per_day,
      trials_per_day: settings.trials_per_day,
      status: "filling",
      created_by_id: input.actor_id,
      created_by_name: input.actor_name,
    })
    .select("*")
    .single();
  if (error) throw new Error(`startNextCycle: ${error.message}`);
  const cycle = mapCycle(data as Record<string, unknown>);

  const label = `${modelName} · Cycle ${number} (${window.start} → ${window.end})`;
  const proven = await createVideoBunch({
    name: `${label} · Proven`,
    model_id: input.model_id,
    model_name: modelName,
    target_video_count: settings.proven_cap,
    created_by_id: input.actor_id,
    created_by_name: input.actor_name,
    kind: "proven",
    cycle_id: cycle.id,
  });
  let experimentalId: string | null = null;
  if (settings.experimental_cap > 0) {
    const experimental = await createVideoBunch({
      name: `${label} · Experimental`,
      model_id: input.model_id,
      model_name: modelName,
      target_video_count: settings.experimental_cap,
      created_by_id: input.actor_id,
      created_by_name: input.actor_name,
      kind: "experimental",
      cycle_id: cycle.id,
    });
    experimentalId = experimental.id;
  }
  await sb
    .from(CYCLES)
    .update({ proven_bunch_id: proven.id, experimental_bunch_id: experimentalId })
    .eq("id", cycle.id);
  return { ...cycle, proven_bunch_id: proven.id, experimental_bunch_id: experimentalId };
}

export async function updateCycle(
  id: string,
  patch: { status?: CycleStatus; notes?: string },
): Promise<ContentCycle> {
  const sb = getSupabaseServiceClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) update.status = coerceStatus(patch.status);
  if (patch.notes !== undefined) update.notes = patch.notes.trim().slice(0, 4000);
  const { data, error } = await sb.from(CYCLES).update(update).eq("id", id).select("*").single();
  if (error) throw new Error(`updateCycle: ${error.message}`);
  return mapCycle(data as Record<string, unknown>);
}

/* ------------------------------------------------------------------ */
/* Stats                                                                */
/* ------------------------------------------------------------------ */

async function countPostedInWindow(
  modelId: string,
  start: string,
  end: string,
): Promise<CycleStats["posted"] & { outliers: number }> {
  const sb = getSupabaseServiceClient();
  const { data: briefs } = await sb.from("posting_briefs").select("id").eq("model_id", modelId);
  const briefIds = (briefs ?? []).map((b) => String((b as { id: string }).id));
  const out = { grid_proven: 0, grid_experimental: 0, grid_other: 0, trials: 0, grid_target: 0, trials_target: 0, outliers: 0 };
  if (!briefIds.length) return out;
  const { data: posts } = await sb
    .from("posting_brief_posts")
    .select("placement, content_source, outlier_status, posted_at")
    .in("brief_id", briefIds)
    .not("posted_at", "is", null)
    .gte("posted_at", `${start}T00:00:00Z`)
    .lte("posted_at", `${end}T23:59:59Z`);
  for (const p of posts ?? []) {
    const r = p as Record<string, unknown>;
    if (r.placement === "trial") out.trials += 1;
    else if (r.content_source === "proven") out.grid_proven += 1;
    else if (r.content_source === "experimental") out.grid_experimental += 1;
    else out.grid_other += 1;
    if (r.outlier_status === "outlier" || r.outlier_status === "hot") out.outliers += 1;
  }
  return out;
}

export async function getCycleWithStats(cycle: ContentCycle): Promise<ContentCycleWithStats> {
  const bunches = await listVideoBunches({ cycle_id: cycle.id }).catch(() => [] as VideoBunch[]);
  const proven = bunches.find((b) => b.id === cycle.proven_bunch_id) ?? bunches.find((b) => b.kind === "proven") ?? null;
  const experimental =
    bunches.find((b) => b.id === cycle.experimental_bunch_id) ?? bunches.find((b) => b.kind === "experimental") ?? null;

  const start = new Date(`${cycle.start_date}T00:00:00Z`);
  const end = new Date(`${cycle.end_date}T00:00:00Z`);
  const daysTotal = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const today = new Date();
  const elapsed = Math.min(daysTotal, Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1));

  const settings = await getCycleSettings(cycle.model_id);
  const [posted, urgentUsed] = await Promise.all([
    countPostedInWindow(cycle.model_id, cycle.start_date, cycle.end_date),
    countUrgentUsedThisMonth(cycle.model_id, start).catch(() => 0),
  ]);

  return {
    ...cycle,
    proven_bunch: proven,
    experimental_bunch: experimental,
    stats: {
      days_total: daysTotal,
      days_elapsed: elapsed,
      proven: {
        provided: proven?.provided_count ?? 0,
        pending: proven?.pending_review_count ?? 0,
        cap: cycle.proven_cap,
      },
      experimental: {
        provided: experimental?.provided_count ?? 0,
        pending: experimental?.pending_review_count ?? 0,
        cap: cycle.experimental_cap,
      },
      posted: {
        ...posted,
        grid_target: daysTotal * cycle.grid_per_day,
        trials_target: daysTotal * cycle.trials_per_day,
      },
      outliers: posted.outliers,
      urgent: { used: urgentUsed, total: settings.urgent_slots_per_month },
    },
  };
}

export async function listCyclesWithStats(modelId?: string | null, limit = 12): Promise<ContentCycleWithStats[]> {
  const cycles = (await listCycles(modelId)).slice(0, limit);
  return Promise.all(cycles.map((c) => getCycleWithStats(c)));
}
