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
  deleteVideoBunch,
  getVideoBunch,
  getVideoBunchDeleteImpact,
  listVideoBunches,
  type DeleteVideoBunchActor,
  type VideoBunch,
  type VideoBunchDeleteImpact,
} from "@/services/winner-sourcing";
import type { BunchKind } from "@/lib/winner-sourcing-helpers";

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
  // UNIQUE(model_id, number) — always max+1 so deletes never collide with count/latest+1.
  const number = existing.reduce((max, c) => Math.max(max, c.number), 0) + 1;

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

/**
 * Delete a Proven or Experimental bunch that belongs to this cycle.
 * Reuses `deleteVideoBunch` (queue items returned to unassigned; cycle FK SET NULL).
 */
export async function deleteBunchFromCycle(input: {
  cycle_id: string;
  bunch_id: string;
  actor: DeleteVideoBunchActor;
}): Promise<{ impact: VideoBunchDeleteImpact; cycle: ContentCycleWithStats }> {
  const cycle = await getCycle(input.cycle_id);
  if (!cycle) throw new Error("Cycle not found");

  const bunchId = input.bunch_id.trim();
  const isProven = cycle.proven_bunch_id === bunchId;
  const isExperimental = cycle.experimental_bunch_id === bunchId;
  if (!isProven && !isExperimental) {
    throw new Error("Bunch does not belong to this cycle");
  }

  const existing = await getVideoBunch(bunchId);
  if (!existing) throw new Error("Bunch not found");
  if (existing.cycle_id && existing.cycle_id !== cycle.id) {
    throw new Error("Bunch does not belong to this cycle");
  }

  const impact = await deleteVideoBunch(bunchId, input.actor);

  // FK SET NULL should clear the ref; ensure explicitly if needed.
  const sb = getSupabaseServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (isProven) patch.proven_bunch_id = null;
  if (isExperimental) patch.experimental_bunch_id = null;
  await sb.from(CYCLES).update(patch).eq("id", cycle.id);

  const refreshed = await getCycle(cycle.id);
  if (!refreshed) throw new Error("Cycle not found after delete");
  return { impact, cycle: await getCycleWithStats(refreshed) };
}

export type ContentCycleDeleteMode = "keep_bunches" | "delete_bunches";

export type ContentCycleDeleteImpact = {
  cycle_id: string;
  cycle_number: number;
  model_id: string;
  model_name: string;
  bunches_linked: number;
  recreate_video_slots: number;
  queue_items: number;
  /** Slots / scripts with progress, filming, editing, or posted briefs across linked bunches. */
  wip: number;
  bunch_impacts: VideoBunchDeleteImpact[];
};

/** Aggregate counts for the cycle-delete confirmation dialog. */
export async function getCycleDeleteImpact(cycleId: string): Promise<ContentCycleDeleteImpact | null> {
  const cycle = await getCycle(cycleId);
  if (!cycle) return null;

  const bunches = await listVideoBunches({ cycle_id: cycle.id }).catch(() => [] as VideoBunch[]);
  const byId = new Map(bunches.map((b) => [b.id, b]));
  const ids = new Set<string>();
  if (cycle.proven_bunch_id) ids.add(cycle.proven_bunch_id);
  if (cycle.experimental_bunch_id) ids.add(cycle.experimental_bunch_id);
  for (const b of bunches) ids.add(b.id);

  const bunch_impacts: VideoBunchDeleteImpact[] = [];
  for (const id of ids) {
    const impact = await getVideoBunchDeleteImpact(id);
    if (impact) bunch_impacts.push(impact);
    else if (!byId.has(id)) {
      // Stale cycle pointer — still count as a linked bunch for the dialog.
    }
  }

  const recreate_video_slots = bunch_impacts.reduce((n, i) => n + i.recreate_video_slots, 0);
  const queue_items = bunch_impacts.reduce((n, i) => n + i.queue_items_returning, 0);
  const wip = bunch_impacts.reduce((n, i) => {
    let piece = i.scripts_with_progress + i.filming_filmed_slots + i.filming_edited_slots + i.linked_posted_briefs;
    if (i.has_valuable_work && piece === 0) piece = 1;
    return n + piece;
  }, 0);

  return {
    cycle_id: cycle.id,
    cycle_number: cycle.number,
    model_id: cycle.model_id,
    model_name: cycle.model_name,
    bunches_linked: Math.max(ids.size, bunch_impacts.length),
    recreate_video_slots,
    queue_items,
    wip,
    bunch_impacts,
  };
}

/**
 * Delete a content cycle.
 * - keep_bunches (default): bunches stay, cycle_id null; cycle row removed.
 * - delete_bunches: reuses deleteVideoBunch / delete_video_bunch_atomic per bunch
 *   (queue items → unassigned pending), then removes the cycle.
 * Does not touch content_cycle_settings. Posting briefs / 24h outlier checks /
 * winner_submissions reference model+dates, not cycle_id — no FK cleanup needed.
 * video_bunches.cycle_id is ON DELETE SET NULL.
 */
export async function deleteCycle(input: {
  cycle_id: string;
  mode: ContentCycleDeleteMode;
  actor: DeleteVideoBunchActor;
}): Promise<{ impact: ContentCycleDeleteImpact; mode: ContentCycleDeleteMode }> {
  const impact = await getCycleDeleteImpact(input.cycle_id);
  if (!impact) throw new Error("Cycle not found");

  const deleteBunches = input.mode === "delete_bunches";
  const sb = getSupabaseServiceClient();

  const { error: rpcError } = await sb.rpc("delete_content_cycle_atomic", {
    p_cycle_id: input.cycle_id,
    p_delete_bunches: deleteBunches,
  });

  if (rpcError) {
    const missing =
      /could not find the function|function .* does not exist|PGRST202/i.test(rpcError.message) ||
      rpcError.code === "PGRST202";
    if (!missing) throw new Error(`delete_content_cycle_atomic: ${rpcError.message}`);

    // Fallback: ordered steps (same semantics as the RPC). Bunches RPC is also
    // often absent from PostgREST cache — deleteVideoBunch already has its own fallback.
    const cycle = await getCycle(input.cycle_id);
    if (!cycle) throw new Error("Cycle not found");
    const ids = new Set(impact.bunch_impacts.map((b) => b.bunch_id));
    if (cycle.proven_bunch_id) ids.add(cycle.proven_bunch_id);
    if (cycle.experimental_bunch_id) ids.add(cycle.experimental_bunch_id);

    if (deleteBunches) {
      for (const bunchId of ids) {
        const still = await getVideoBunch(bunchId);
        if (still) await deleteVideoBunch(bunchId, input.actor);
      }
    } else {
      await sb.from("video_bunches").update({ cycle_id: null }).eq("cycle_id", input.cycle_id);
      if (ids.size) {
        await sb.from("video_bunches").update({ cycle_id: null }).in("id", [...ids]);
      }
      await sb
        .from(CYCLES)
        .update({
          proven_bunch_id: null,
          experimental_bunch_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.cycle_id);
    }
    const { error: delErr } = await sb.from(CYCLES).delete().eq("id", input.cycle_id);
    if (delErr) throw new Error(`deleteCycle: ${delErr.message}`);
  }

  console.info("[content-cycle-delete]", {
    at: new Date().toISOString(),
    actor_user_id: input.actor.user_id ?? "",
    actor_user_name: input.actor.user_name ?? "",
    cycle_id: impact.cycle_id,
    cycle_number: impact.cycle_number,
    model_id: impact.model_id,
    model_name: impact.model_name,
    mode: input.mode,
    bunches_linked: impact.bunches_linked,
    recreate_video_slots: impact.recreate_video_slots,
    queue_items: impact.queue_items,
    wip: impact.wip,
  });

  return { impact, mode: input.mode };
}

/** Recreate a missing Proven or Experimental bunch slot on an existing cycle. */
export async function createBunchForCycle(input: {
  cycle_id: string;
  kind: BunchKind;
  actor_id: string;
  actor_name: string;
}): Promise<ContentCycleWithStats> {
  const cycle = await getCycle(input.cycle_id);
  if (!cycle) throw new Error("Cycle not found");
  const kind = input.kind === "experimental" ? "experimental" : "proven";

  if (kind === "proven" && cycle.proven_bunch_id) {
    throw new Error("Proven bunch already exists for this cycle");
  }
  if (kind === "experimental" && cycle.experimental_bunch_id) {
    throw new Error("Experimental bunch already exists for this cycle");
  }
  if (kind === "experimental" && cycle.experimental_cap < 1) {
    throw new Error("Experimental cap is 0 — cannot create Experimental bunch");
  }

  const label = `${cycle.model_name} · Cycle ${cycle.number} (${cycle.start_date} → ${cycle.end_date})`;
  const cap = kind === "proven" ? cycle.proven_cap : cycle.experimental_cap;
  const bunch = await createVideoBunch({
    name: `${label} · ${kind === "proven" ? "Proven" : "Experimental"}`,
    model_id: cycle.model_id,
    model_name: cycle.model_name,
    target_video_count: Math.max(1, cap),
    created_by_id: input.actor_id,
    created_by_name: input.actor_name,
    kind,
    cycle_id: cycle.id,
  });

  const sb = getSupabaseServiceClient();
  const patch =
    kind === "proven"
      ? { proven_bunch_id: bunch.id, updated_at: new Date().toISOString() }
      : { experimental_bunch_id: bunch.id, updated_at: new Date().toISOString() };
  const { error } = await sb.from(CYCLES).update(patch).eq("id", cycle.id);
  if (error) throw new Error(`createBunchForCycle: ${error.message}`);

  const refreshed = await getCycle(cycle.id);
  if (!refreshed) throw new Error("Cycle not found after create");
  return getCycleWithStats(refreshed);
}
