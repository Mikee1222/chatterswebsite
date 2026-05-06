import {
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, formulaLinkedContains } from "@/lib/airtable-linked";
import { addDays, getTodayYmd } from "@/lib/weekly-program";
import { updateModel } from "@/services/modelss";
import type { ModelPeriodRecord, ModelRecord } from "@/types";
import { devLog } from "@/lib/dev-log";

const TABLE = "model_periods";

type Fields = {
  start_date?: string;
  end_date?: string;
  model_id?: string | string[];
  cycle_length_days?: number;
  period_length_days?: number;
  notes?: string;
  logged_by?: string;
  created_at?: string;
};

function ymdOnly(value: unknown): string {
  if (value == null || typeof value !== "string") return "";
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function mapRecord(rec: AirtableRecord<Fields>): ModelPeriodRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    model_id: firstLinkedId(f.model_id) ?? "",
    start_date: ymdOnly(f.start_date),
    end_date: ymdOnly(f.end_date),
    cycle_length_days: typeof f.cycle_length_days === "number" ? f.cycle_length_days : null,
    period_length_days: typeof f.period_length_days === "number" ? f.period_length_days : null,
    notes: typeof f.notes === "string" ? f.notes : "",
    logged_by: typeof f.logged_by === "string" ? f.logged_by : "",
    created_at: typeof f.created_at === "string" ? f.created_at : null,
  };
}

/** Inclusive calendar-day count between two YYYY-MM-DD dates (UTC noon anchor). */
export function inclusiveDaySpan(startYmd: string, endYmd: string): number {
  const a = new Date(`${startYmd}T12:00:00.000Z`).getTime();
  const b = new Date(`${endYmd}T12:00:00.000Z`).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

/** Days from start A to start B (exclusive of A day, i.e. gap between cycle starts). */
export function daysBetweenStarts(prevStartYmd: string, nextStartYmd: string): number {
  const a = new Date(`${prevStartYmd}T12:00:00.000Z`).getTime();
  const b = new Date(`${nextStartYmd}T12:00:00.000Z`).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function expandDatesInWindow(startYmd: string, endYmd: string, windowStart: string, windowEnd: string): string[] {
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

/** All period rows (for admin batching). Safe when table is moderate size. */
export async function listAllModelPeriods(): Promise<ModelPeriodRecord[]> {
  try {
    const records = await listAllRecords<Fields>(TABLE, {});
    return records.map(mapRecord).filter((p) => p.start_date && p.end_date);
  } catch {
    return [];
  }
}

export async function getPeriodsForModel(modelId: string): Promise<ModelPeriodRecord[]> {
  if (!modelId) return [];
  const formula = formulaLinkedContains("model_id", modelId);
  const records = await listAllRecords<Fields>(TABLE, { filterByFormula: formula });
  const mapped = records.map(mapRecord).filter((p) => p.start_date && p.end_date);
  mapped.sort((a, b) => b.start_date.localeCompare(a.start_date));
  return mapped;
}

export async function getCurrentPeriod(modelId: string): Promise<ModelPeriodRecord | null> {
  const today = getTodayYmd();
  const periods = await getPeriodsForModel(modelId);
  return (
    periods.find((p) => p.start_date <= today && p.end_date >= today) ?? null
  );
}

/**
 * Predict next period start: last logged start + avg_cycle_length from modelss (default 28 if unset).
 */
export async function getUpcomingPeriod(
  modelId: string,
  model?: ModelRecord | null
): Promise<{ predicted_start: string } | null> {
  const periods = await getPeriodsForModel(modelId);
  const lastStart = periods[0]?.start_date;
  if (!lastStart) return null;
  const cycle =
    typeof model?.avg_cycle_length === "number" && model.avg_cycle_length > 0
      ? model.avg_cycle_length
      : 28;
  return { predicted_start: addDays(lastStart, cycle) };
}

export type CreateModelPeriodInput = {
  model_id: string;
  start_date: string;
  end_date: string;
  cycle_length_days?: number | null;
  period_length_days?: number | null;
  notes?: string;
  logged_by: string;
};

export async function createPeriod(data: CreateModelPeriodInput): Promise<ModelPeriodRecord> {
  const periodLen =
    data.period_length_days ??
    (data.start_date && data.end_date ? inclusiveDaySpan(data.start_date, data.end_date) : null);
  const rec = await createRecord<Fields>(TABLE, {
    model_id: [data.model_id],
    start_date: data.start_date,
    end_date: data.end_date,
    cycle_length_days: data.cycle_length_days ?? undefined,
    period_length_days: periodLen ?? undefined,
    notes: data.notes?.trim() || undefined,
    logged_by: data.logged_by,
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}

export type UpdateModelPeriodInput = Partial<{
  start_date: string;
  end_date: string;
  cycle_length_days: number | null;
  period_length_days: number | null;
  notes: string;
  logged_by: string;
}>;

export async function updatePeriod(id: string, data: UpdateModelPeriodInput): Promise<ModelPeriodRecord> {
  const payload: Partial<Fields> = {};
  if (data.start_date !== undefined) payload.start_date = data.start_date;
  if (data.end_date !== undefined) payload.end_date = data.end_date;
  if (data.cycle_length_days !== undefined) payload.cycle_length_days = data.cycle_length_days ?? undefined;
  if (data.period_length_days !== undefined) payload.period_length_days = data.period_length_days ?? undefined;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (data.logged_by !== undefined) payload.logged_by = data.logged_by;
  const rec = await updateRecord<Fields>(TABLE, id, payload);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function deletePeriod(id: string): Promise<void> {
  await deleteRecord(TABLE, id);
}

export async function getPeriodById(id: string): Promise<ModelPeriodRecord | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, id);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

export async function getPeriodDatesForWeek(
  modelId: string,
  weekStart: string,
  weekEnd: string
): Promise<string[]> {
  if (!modelId) {
    devLog("[getPeriodDatesForWeek]", JSON.stringify({ reason: "empty_modelId", table: TABLE }));
    return [];
  }
  // Use same overlap query + in-code model filter as weekly program (avoids FIND-on-link edge cases).
  const byModel = await getPeriodDatesByModelForWeek([modelId], weekStart, weekEnd);
  const dates = byModel[modelId] ?? [];
  devLog(
    "[getPeriodDatesForWeek]",
    JSON.stringify({
      table: TABLE,
      modelId,
      weekStart,
      weekEnd,
      returnedCount: dates.length,
      datesSample: dates.slice(0, 14),
    })
  );
  return dates;
}

/** Single Airtable query: periods overlapping [weekStart, weekEnd], grouped by model id. */
export async function getPeriodDatesByModelForWeek(
  modelIds: string[],
  weekStart: string,
  weekEnd: string
): Promise<Record<string, string[]>> {
  const want = new Set(modelIds);
  const out: Record<string, string[]> = {};
  for (const id of modelIds) out[id] = [];

  if (modelIds.length === 0) return out;

  const formula = `AND(NOT(IS_BEFORE({end_date}, "${weekStart}")), NOT(IS_AFTER({start_date}, "${weekEnd}")))`;
  let records: AirtableRecord<Fields>[];
  try {
    records = await listAllRecords<Fields>(TABLE, { filterByFormula: formula });
  } catch {
    records = await listAllRecords<Fields>(TABLE, {});
  }

  for (const rec of records) {
    const p = mapRecord(rec);
    if (!p.model_id || !want.has(p.model_id)) continue;
    for (const d of expandDatesInWindow(p.start_date, p.end_date, weekStart, weekEnd)) {
      if (!out[p.model_id].includes(d)) out[p.model_id].push(d);
    }
  }
  for (const id of modelIds) {
    out[id].sort();
  }
  return out;
}

/**
 * Recompute avg_cycle_length and avg_period_length from all periods for this model and write to modelss.
 */
export async function syncModelPeriodAveragesToModelss(modelId: string): Promise<void> {
  const periods = await getPeriodsForModel(modelId);
  const asc = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));

  const cycleDeltas: number[] = [];
  for (let i = 1; i < asc.length; i++) {
    const delta = daysBetweenStarts(asc[i - 1].start_date, asc[i].start_date);
    if (delta > 0 && delta <= 120) cycleDeltas.push(delta);
  }

  const lengths: number[] = [];
  for (const p of asc) {
    const len =
      typeof p.period_length_days === "number" && p.period_length_days > 0
        ? p.period_length_days
        : inclusiveDaySpan(p.start_date, p.end_date);
    if (len > 0 && len <= 30) lengths.push(len);
  }

  const avg_cycle =
    cycleDeltas.length > 0
      ? Math.round(cycleDeltas.reduce((a, b) => a + b, 0) / cycleDeltas.length)
      : null;
  const avg_period =
    lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : null;

  const payload: { avg_cycle_length?: number; avg_period_length?: number } = {};
  if (avg_cycle != null) payload.avg_cycle_length = avg_cycle;
  if (avg_period != null) payload.avg_period_length = avg_period;
  if (Object.keys(payload).length > 0) {
    await updateModel(modelId, payload);
  }
}
