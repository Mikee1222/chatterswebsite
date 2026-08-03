/**
 * Supabase backend for services/model-periods.ts (CRUD tier only).
 * High-level helpers (getCurrentPeriod, syncModelPeriodAveragesToModelss, etc.) are
 * defined in the main file and delegate through these CRUD calls, so they work under
 * both backends without duplication.
 */
import {
  sbResolveUuidToAirtableMap,
  firstMappedLinkedId,
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  requireSbUuids,
  type SbRow,
} from "@/lib/supabase-data";
import { addDays } from "@/lib/weekly-program";
import type { ModelPeriodRecord } from "@/types";
import type { CreateModelPeriodInput, UpdateModelPeriodInput } from "./model-periods";

const TABLE = "model_periods";

type Row = SbRow & {
  start_date?: string | null;
  end_date?: string | null;
  model_id?: string[] | null;
  cycle_length_days?: number | null;
  period_length_days?: number | null;
  notes?: string | null;
  logged_by?: string | null;
  created_at?: string | null;
  came_early?: boolean | null;
  missed_period?: boolean | null;
  predicted_next_date?: string | null;
  tracking_enabled?: boolean | null;
};

function ymdOnly(v: unknown): string {
  if (v == null || typeof v !== "string") return "";
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function inclusiveDaySpan(startYmd: string, endYmd: string): number {
  const a = new Date(`${startYmd}T12:00:00.000Z`).getTime();
  const b = new Date(`${endYmd}T12:00:00.000Z`).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

function expandDatesInWindow(
  startYmd: string,
  endYmd: string,
  windowStart: string,
  windowEnd: string
): string[] {
  const out: string[] = [];
  if (!startYmd || !endYmd || startYmd > endYmd) return out;
  let d = startYmd < windowStart ? windowStart : startYmd;
  const last = endYmd > windowEnd ? windowEnd : endYmd;
  while (d <= last) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

function mapRowSync(row: Row, modelAt: Map<string, string>): ModelPeriodRecord {
  const predRaw = row.predicted_next_date;
  const predicted =
    predRaw != null && String(predRaw).trim() !== "" ? ymdOnly(String(predRaw)) : null;
  return {
    id: publicId(row),
    model_id: firstMappedLinkedId(row.model_id, modelAt),
    start_date: ymdOnly(row.start_date),
    end_date: ymdOnly(row.end_date),
    cycle_length_days: typeof row.cycle_length_days === "number" ? row.cycle_length_days : null,
    period_length_days: typeof row.period_length_days === "number" ? row.period_length_days : null,
    notes: typeof row.notes === "string" ? row.notes : "",
    logged_by: typeof row.logged_by === "string" ? row.logged_by : "",
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    came_early: row.came_early === true,
    missed_period: row.missed_period === true,
    predicted_next_date: predicted,
    tracking_enabled: row.tracking_enabled === true,
  };
}

async function mapRows(rows: Row[]): Promise<ModelPeriodRecord[]> {
  if (!rows.length) return [];
  const modelAt = await sbResolveUuidToAirtableMap(
    "modelss",
    rows.map((r) => r.model_id)
  );
  return rows.map((r) => mapRowSync(r, modelAt));
}

async function mapRow(row: Row): Promise<ModelPeriodRecord> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function listAllModelPeriods(): Promise<ModelPeriodRecord[]> {
  try {
    const rows = await sbSelectAll<Row>(TABLE);
    const mapped = await mapRows(rows);
    return mapped.filter((p) => p.start_date && p.end_date);
  } catch {
    return [];
  }
}

export async function getPeriodsForModel(modelId: string): Promise<ModelPeriodRecord[]> {
  if (!modelId) return [];
  const all = await listAllModelPeriods();
  return all
    .filter((p) => p.model_id === modelId)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
}

export async function createPeriod(data: CreateModelPeriodInput): Promise<ModelPeriodRecord> {
  const periodLen =
    data.period_length_days ??
    (data.start_date && data.end_date
      ? inclusiveDaySpan(data.start_date, data.end_date)
      : null);
  const modelUuids = await requireSbUuids("modelss", [data.model_id], "model");
  const row = await sbInsert<Row>(TABLE, {
    model_id: modelUuids,
    start_date: data.start_date,
    end_date: data.end_date,
    cycle_length_days: data.cycle_length_days ?? null,
    period_length_days: periodLen ?? null,
    notes: data.notes?.trim() || null,
    logged_by: data.logged_by,
    missed_period: false,
    came_early: false,
    created_at: new Date().toISOString(),
  });
  return mapRow(row);
}

export async function updatePeriod(
  id: string,
  data: UpdateModelPeriodInput
): Promise<ModelPeriodRecord> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.start_date !== undefined) patch.start_date = data.start_date;
  if (data.end_date !== undefined) patch.end_date = data.end_date;
  if (data.cycle_length_days !== undefined) patch.cycle_length_days = data.cycle_length_days;
  if (data.period_length_days !== undefined) patch.period_length_days = data.period_length_days;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.logged_by !== undefined) patch.logged_by = data.logged_by;
  if (data.came_early !== undefined) patch.came_early = data.came_early;
  if (data.missed_period !== undefined) patch.missed_period = data.missed_period;
  if (data.predicted_next_date !== undefined) {
    patch.predicted_next_date =
      data.predicted_next_date === null || data.predicted_next_date === ""
        ? null
        : data.predicted_next_date;
  }
  const row = await sbUpdateByPublicId<Row>(TABLE, id, patch);
  return mapRow(row);
}

export async function deletePeriod(id: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, id);
}

export async function getPeriodById(id: string): Promise<ModelPeriodRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, id);
  return row ? mapRow(row) : null;
}

export async function getPeriodDatesByModelForWeek(
  modelIds: string[],
  weekStart: string,
  weekEnd: string
): Promise<Record<string, string[]>> {
  const want = new Set(modelIds);
  const out: Record<string, string[]> = {};
  for (const id of modelIds) out[id] = [];
  if (modelIds.length === 0) return out;
  const all = await listAllModelPeriods();
  for (const p of all) {
    if (!p.model_id || !want.has(p.model_id)) continue;
    if (!p.start_date || !p.end_date) continue;
    if (p.end_date < weekStart || p.start_date > weekEnd) continue;
    for (const d of expandDatesInWindow(p.start_date, p.end_date, weekStart, weekEnd)) {
      if (!out[p.model_id].includes(d)) out[p.model_id].push(d);
    }
  }
  for (const id of modelIds) out[id].sort();
  return out;
}
