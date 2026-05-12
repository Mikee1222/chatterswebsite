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
import { getModelById, updateModel } from "@/services/modelss";
import type { ModelPeriodRecord, ModelRecord } from "@/types";
import { devLog } from "@/lib/dev-log";

const TABLE = "model_periods";
const RECENT_LOG_WINDOW_MS = 2 * 60 * 1000;

const _recentlyLoggedModels = new Map<string, number>();

/** Set PERIOD_TRACKER_DEBUG=true on Vercel (or run dev) to trace period fetches in logs. */
function periodTrace(...args: unknown[]): void {
  if (process.env.PERIOD_TRACKER_DEBUG === "true" || process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- gated diagnostic for period tracker
    console.log(...args);
  }
}

type Fields = {
  start_date?: string;
  end_date?: string;
  /** Link to modelss. */
  model_id?: string | string[];
  cycle_length_days?: number;
  period_length_days?: number;
  notes?: string;
  logged_by?: string;
  created_at?: string;
  came_early?: boolean;
  missed_period?: boolean;
  predicted_next_date?: string | null;
  tracking_enabled?: boolean;
};

function ymdOnly(value: unknown): string {
  if (value == null || typeof value !== "string") return "";
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function linkedModelIdFromPeriodFields(f: Fields): string | null {
  return firstLinkedId(f.model_id);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function markModelPeriodRecentlyLogged(modelId: string): void {
  if (!modelId) return;
  const markedAt = Date.now();
  _recentlyLoggedModels.set(modelId, markedAt);
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    if (_recentlyLoggedModels.get(modelId) === markedAt) {
      _recentlyLoggedModels.delete(modelId);
    }
  }, RECENT_LOG_WINDOW_MS);
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }
}

export function wasRecentlyLogged(modelId: string): boolean {
  const markedAt = _recentlyLoggedModels.get(modelId);
  if (markedAt == null) return false;
  if (Date.now() - markedAt < RECENT_LOG_WINDOW_MS) return true;
  _recentlyLoggedModels.delete(modelId);
  return false;
}

function mapRecord(rec: AirtableRecord<Fields>): ModelPeriodRecord {
  const f = rec.fields;
  const predRaw = f.predicted_next_date;
  const predicted =
    predRaw != null && String(predRaw).trim() !== "" ? ymdOnly(String(predRaw)) : null;
  return {
    id: rec.id,
    model_id: linkedModelIdFromPeriodFields(f) ?? "",
    start_date: ymdOnly(f.start_date),
    end_date: ymdOnly(f.end_date),
    cycle_length_days: typeof f.cycle_length_days === "number" ? f.cycle_length_days : null,
    period_length_days: typeof f.period_length_days === "number" ? f.period_length_days : null,
    notes: typeof f.notes === "string" ? f.notes : "",
    logged_by: typeof f.logged_by === "string" ? f.logged_by : "",
    created_at: typeof f.created_at === "string" ? f.created_at : null,
    came_early: f.came_early === true,
    missed_period: f.missed_period === true,
    predicted_next_date: predicted,
    tracking_enabled: f.tracking_enabled === true,
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

const MODEL_LINK_FIELD_NAMES = ["model_id"] as const;

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))];
}

function isAirtableRecordId(value: string): boolean {
  return value.startsWith("rec");
}

function isStableModelId(value: string): boolean {
  return value.startsWith("model_");
}

function valuesFromModelField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function periodFieldsMatchModelIds(fields: Fields, ids: Set<string>): boolean {
  for (const fieldName of MODEL_LINK_FIELD_NAMES) {
    for (const value of valuesFromModelField(fields[fieldName])) {
      if (ids.has(value)) return true;
    }
  }
  return false;
}

async function resolveStableModelId(modelId: string): Promise<string | null> {
  if (isStableModelId(modelId)) return modelId;
  if (!isAirtableRecordId(modelId)) return null;
  const model = await getModelById(modelId).catch(() => null);
  return model?.model_id?.trim() || null;
}

function addUniqueRecords(
  target: AirtableRecord<Fields>[],
  seen: Set<string>,
  records: AirtableRecord<Fields>[]
): void {
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    target.push(record);
  }
}

export async function getPeriodsForModel(modelId: string): Promise<ModelPeriodRecord[]> {
  const initial = await getPeriodsForModelRaw(modelId);
  if (initial.length > 0 || !wasRecentlyLogged(modelId)) return initial;

  for (const retryDelayMs of [1000, 2000, 3000]) {
    await delay(retryDelayMs);
    const retry = await getPeriodsForModelRaw(modelId);
    if (retry.length > 0) return retry;
  }

  return initial;
}

async function getPeriodsForModelRaw(modelId: string): Promise<ModelPeriodRecord[]> {
  if (!modelId) return [];
  const stableModelId = await resolveStableModelId(modelId);
  const recordIds = uniqueNonEmpty([isAirtableRecordId(modelId) ? modelId : null]);
  const stableIds = uniqueNonEmpty([stableModelId, isStableModelId(modelId) ? modelId : null]);
  const allLookupIds = new Set(uniqueNonEmpty([modelId, ...recordIds, ...stableIds]));
  periodTrace("[periods] fetching for modelId:", modelId, "stableModelId:", stableModelId);

  const records: AirtableRecord<Fields>[] = [];
  const seen = new Set<string>();

  try {
    const linkedRecords = await listAllRecords<Fields>(TABLE, {
      filterByFormula: formulaLinkedContains("model_id", modelId),
      sort: [{ field: "start_date", direction: "desc" }],
      _caller: "model-periods.by-model-id",
    });
    addUniqueRecords(records, seen, linkedRecords);
    periodTrace("[periods] linked formula field: model_id raw records:", linkedRecords.length);
  } catch {
    periodTrace("[periods] linked formula failed for field: model_id");
  }

  if (records.length === 0) {
    const all = await listAllRecords<Fields>(TABLE, {
      sort: [{ field: "start_date", direction: "desc" }],
    });
    addUniqueRecords(
      records,
      seen,
      all.filter((rec) => periodFieldsMatchModelIds(rec.fields as Fields, allLookupIds))
    );
    periodTrace("[periods] full-table filter, matched:", records.length);
  }

  const mapped = records.map(mapRecord).filter((p) => p.start_date && p.end_date);
  mapped.sort((a, b) => b.start_date.localeCompare(a.start_date));
  periodTrace("[periods] after filter (start+end):", mapped.length, "sample:", mapped[0] ?? null);
  return mapped;
}

export type ModelUpcomingPeriod = {
  predicted_start: string;
  predicted_end: string;
  last_start: string;
  cycle_length: number;
  period_length: number;
};

type PeriodLookupOptions = {
  forceRetry?: boolean;
};

/**
 * Active bleed window: latest logged start through `start + avg_period_length - 1` (defaults from modelss).
 */
export async function getCurrentPeriod(
  modelId: string,
  model?: ModelRecord | null,
  options: PeriodLookupOptions = {}
): Promise<ModelPeriodRecord | null> {
  const current = await _getCurrentPeriodInner(modelId, model);
  if (current || !options.forceRetry) return current;
  await delay(3000);
  return _getCurrentPeriodInner(modelId, model);
}

async function _getCurrentPeriodInner(
  modelId: string,
  model?: ModelRecord | null
): Promise<ModelPeriodRecord | null> {
  const periods = await getPeriodsForModel(modelId);
  if (periods.length === 0) return null;

  const m =
    model === undefined || model === null ? await getModelById(modelId).catch(() => null) : model;
  const periodLength =
    typeof m?.avg_period_length === "number" && m.avg_period_length > 0 ? m.avg_period_length : 5;

  const sorted = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const latest = sorted[0];
  const today = getTodayYmd();
  const endDate = addDays(latest.start_date, periodLength - 1);

  if (today >= latest.start_date && today <= endDate) {
    const t0 = Date.parse(`${today}T12:00:00.000Z`);
    const s0 = Date.parse(`${latest.start_date}T12:00:00.000Z`);
    const dayNumber =
      Number.isFinite(t0) && Number.isFinite(s0) ? Math.floor((t0 - s0) / 86400000) + 1 : 1;
    return { ...latest, end_date: endDate, day_number: dayNumber };
  }

  return null;
}

/**
 * Row to attach cycle flags: active bleed window if today falls inside it, otherwise the most
 * recently started logged period (same ordering as {@link getPeriodsForModel}).
 */
export async function getPeriodRecordForFlags(modelId: string): Promise<ModelPeriodRecord | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await delay(attempt * 2000);

    const model = await getModelById(modelId).catch(() => null);
    const current = await getCurrentPeriod(modelId, model);
    if (current) return current;
    const periods = await getPeriodsForModel(modelId);
    if (periods.length > 0) return periods[0];
  }

  return null;
}

/** Writes {@link getUpcomingPeriod} onto the latest logged period row when that field exists in Airtable. */
export async function syncLatestPeriodPredictedNext(
  modelId: string,
  model?: ModelRecord | null
): Promise<void> {
  const periods = await getPeriodsForModel(modelId);
  const latest = periods[0];
  if (!latest) return;
  const m = model === undefined ? await getModelById(modelId) : model;
  const upcoming = await getUpcomingPeriod(modelId, m);
  await updatePeriod(latest.id, {
    predicted_next_date: upcoming?.predicted_start ?? null,
  });
}

/**
 * Predict next period window: newest `start_date` + avg cycle/period from modelss (defaults 28 / 5).
 */
export async function getUpcomingPeriod(
  modelId: string,
  model: ModelRecord | null | undefined,
  options: PeriodLookupOptions = {}
): Promise<ModelUpcomingPeriod | null> {
  const upcoming = await _getUpcomingPeriodInner(modelId, model);
  if (upcoming || !options.forceRetry) return upcoming;
  await delay(3000);
  return _getUpcomingPeriodInner(modelId, model);
}

async function _getUpcomingPeriodInner(
  modelId: string,
  model: ModelRecord | null | undefined
): Promise<ModelUpcomingPeriod | null> {
  periodTrace("[upcoming] modelId:", modelId);
  const periods = await getPeriodsForModel(modelId);
  if (periods.length === 0) return null;

  const sorted = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const latest = sorted[0];
  periodTrace("[upcoming] periods found:", periods.length, "latest:", latest ?? null);

  const m =
    model === undefined || model === null ? await getModelById(modelId).catch(() => null) : model;
  const cycleLength =
    typeof m?.avg_cycle_length === "number" && m.avg_cycle_length > 0 ? m.avg_cycle_length : 28;
  const periodLength =
    typeof m?.avg_period_length === "number" && m.avg_period_length > 0 ? m.avg_period_length : 5;

  const lastStart = latest.start_date;
  if (!lastStart) return null;

  const nextStart = addDays(lastStart, cycleLength);
  const nextEnd = addDays(nextStart, periodLength - 1);

  return {
    predicted_start: nextStart,
    predicted_end: nextEnd,
    last_start: lastStart,
    cycle_length: cycleLength,
    period_length: periodLength,
  };
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
    /** Explicit so new rows never inherit an accidental checked state from Airtable defaults. */
    missed_period: false,
    came_early: false,
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
  came_early: boolean;
  missed_period: boolean;
  predicted_next_date: string | null;
}>;

export async function updatePeriod(id: string, data: UpdateModelPeriodInput): Promise<ModelPeriodRecord> {
  const payload: Partial<Fields> = {};
  if (data.start_date !== undefined) payload.start_date = data.start_date;
  if (data.end_date !== undefined) payload.end_date = data.end_date;
  if (data.cycle_length_days !== undefined) payload.cycle_length_days = data.cycle_length_days ?? undefined;
  if (data.period_length_days !== undefined) payload.period_length_days = data.period_length_days ?? undefined;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (data.logged_by !== undefined) payload.logged_by = data.logged_by;
  if (data.came_early !== undefined) payload.came_early = data.came_early;
  if (data.missed_period !== undefined) payload.missed_period = data.missed_period;
  if (data.predicted_next_date !== undefined) {
    payload.predicted_next_date =
      data.predicted_next_date === null || data.predicted_next_date === ""
        ? null
        : data.predicted_next_date;
  }
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

/** Log a new period from start date only; end date = start + avg period length (default 5 days). */
export async function logModelPeriodFromStartDate(
  modelId: string,
  startDate: string,
  notes: string | undefined,
  loggedBy: "model" | "admin" | "va"
): Promise<ModelPeriodRecord> {
  const start = startDate.trim().slice(0, 10);
  const model = await getModelById(modelId);
  const periodDays =
    typeof model?.avg_period_length === "number" && model.avg_period_length > 0
      ? model.avg_period_length
      : 5;
  const end = addDays(start, Math.max(1, periodDays) - 1);
  const existing = await getPeriodsForModel(modelId);
  const asc = [...existing].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const prev = asc.filter((p) => p.start_date < start).pop() ?? null;
  const cycle_length_days = prev ? Math.max(1, daysBetweenStarts(prev.start_date, start)) : null;
  const row = await createPeriod({
    model_id: modelId,
    start_date: start,
    end_date: end,
    notes: notes?.trim(),
    logged_by: loggedBy,
    cycle_length_days,
  });
  await syncModelPeriodAveragesToModelss(modelId);
  const refreshed = await getModelById(modelId);
  await syncLatestPeriodPredictedNext(modelId, refreshed);
  return row;
}

export async function markCurrentPeriodCameEarly(modelId: string): Promise<void> {
  const row = await getPeriodRecordForFlags(modelId);
  if (!row) throw new Error("NO_PERIOD_ROW");
  await updatePeriod(row.id, { came_early: true });
  await syncModelPeriodAveragesToModelss(modelId);
  const model = await getModelById(modelId);
  await syncLatestPeriodPredictedNext(modelId, model);
}

export async function markCurrentPeriodMissed(modelId: string): Promise<void> {
  const row = await getPeriodRecordForFlags(modelId);
  if (!row) throw new Error("NO_PERIOD_ROW");
  /** Align with `/api/model/period/flags` missed_period branch: clear related flags + sync averages + prediction column. */
  await updatePeriod(row.id, {
    missed_period: true,
    predicted_next_date: null,
    came_early: false,
  });
  await syncModelPeriodAveragesToModelss(modelId);
  const fresh = await getModelById(modelId);
  await syncLatestPeriodPredictedNext(modelId, fresh);
}

/** JSON shape for model period UI / API: current bleed row, computed next start, rolling averages on modelss. */
export type ModelCycleInfoResponse = {
  current_period: ModelPeriodRecord | null;
  predicted_next_start: string | null;
  avg_cycle_length: number | null;
  avg_period_length: number | null;
};

export type ModelPeriodTrackingSnapshot = {
  periods: ModelPeriodRecord[];
  current_period: ModelPeriodRecord | null;
  predicted_next_start: string | null;
  avg_cycle_length: number | null;
  avg_period_length: number | null;
};

export async function getModelCycleInfoResponse(
  modelId: string,
  options: PeriodLookupOptions = {}
): Promise<ModelCycleInfoResponse> {
  const model = await getModelById(modelId);
  const current = await getCurrentPeriod(modelId, model, options);
  const upcoming = await getUpcomingPeriod(modelId, model, options);
  return {
    current_period: current,
    predicted_next_start: upcoming?.predicted_start ?? null,
    avg_cycle_length: model?.avg_cycle_length ?? null,
    avg_period_length: model?.avg_period_length ?? null,
  };
}

/** Full tracking payload for widgets and cron jobs (single model). */
export async function getModelPeriodTrackingSnapshot(modelId: string): Promise<ModelPeriodTrackingSnapshot> {
  const [periods, cycle] = await Promise.all([getPeriodsForModel(modelId), getModelCycleInfoResponse(modelId)]);
  return {
    periods,
    current_period: cycle.current_period,
    predicted_next_start: cycle.predicted_next_start,
    avg_cycle_length: cycle.avg_cycle_length,
    avg_period_length: cycle.avg_period_length,
  };
}
