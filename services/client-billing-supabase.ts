/**
 * Supabase backend for services/client-billing.ts (DATA_BACKEND=supabase).
 * Public ids remain Airtable-shaped (airtable_id) during dual-run.
 * Formula/rollup fields (fee_usd, amount_due, totals) are computed in-app.
 */

import { unstable_cache } from "next/cache";
import {
  publicId,
  sbAirtableIdsForUuids,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectEq,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
  requireSbUuids,
} from "@/lib/supabase-data";
import { urlsToAttachments } from "@/lib/supabase-signed-url";
import { listAllModelss } from "@/services/modelss";
import type {
  AdminClientRecord,
  BillingCycleKind,
  BillingCycleRecord,
  BillingCycleRevenueRecord,
  BillingCycleRevenueStatus,
  BillingCycleStatus,
  ClientModelRecord,
  ModelRecord,
  PaymentSubmissionRecord,
  PaymentSubmissionStatus,
} from "@/types/client-portal";
import type {
  BillingClientRecord,
  CreateBillingCycleInput,
  GeneratePeriodsResult,
  PaymentSubmissionFilters,
  UpdateBillingCycleInput,
} from "./client-billing";

const TABLES = {
  clients: "clients",
  modelss: "modelss",
  client_models: "client_models",
  billing_cycles: "billing_cycles",
  billing_cycle_revenues: "billing_cycle_revenues",
  payment_submissions: "payment_submissions",
} as const;

const REVENUE_STATUSES: BillingCycleRevenueStatus[] = [
  "draft",
  "announced",
  "pending_review",
  "confirmed_paid",
  "overdue",
];

type CycleRow = SbRow & {
  client?: string[] | null;
  kind?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  due_date?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  model?: string[] | null;
  model_turnover?: number | null;
  client_percentage_snapshot?: number | null;
  amount_crm?: number | null;
  client_notified_at?: string | null;
  created_time?: string | null;
};

type RevenueRow = SbRow & {
  billing_cycle?: string[] | null;
  client?: string[] | null;
  model?: string[] | null;
  turnover_usd?: number | null;
  fee_percent?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type PaymentRow = SbRow & {
  billing_cycle?: string[] | null;
  client?: string[] | null;
  selected_payment_method?: string[] | null;
  submitted_amount?: number | null;
  submitted_currency?: string | null;
  submitted_datetime?: string | null;
  reference_id?: string | null;
  note?: string | null;
  proof_url?: string | null;
  proof_attachment?: string[] | null;
  status?: string | null;
  admin_note?: string | null;
};

type ClientRow = SbRow & {
  company_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  status?: string | null;
  client_percentage?: number | null;
};

type ClientModelRow = SbRow & {
  client?: string[] | null;
  model?: string[] | null;
};

function safeNum(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function feeFromParts(turnover: number, feePercent: number): number {
  return turnover * (feePercent / 100);
}

async function resolveUuidMap(table: string, uuidLists: (string[] | null | undefined)[]): Promise<Map<string, string>> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const list of uuidLists) {
    for (const id of list ?? []) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
    }
  }
  if (!unique.length) return new Map();
  const resolved = await sbAirtableIdsForUuids(table, unique);
  const map = new Map<string, string>();
  for (let i = 0; i < unique.length; i++) {
    map.set(unique[i]!, resolved[i] || unique[i]!);
  }
  return map;
}

function mapLinked(ids: string[] | null | undefined, atByUuid: Map<string, string>): string[] {
  return (ids ?? []).map((id) => atByUuid.get(id) || id).filter(Boolean);
}

function mapBillingCycleSync(
  row: CycleRow,
  clientAtByUuid: Map<string, string>,
  modelAtByUuid: Map<string, string>,
  revenueTotals?: { total_fee_usd?: number; total_turnover_usd?: number; amount_due?: number }
): BillingCycleRecord {
  const amount = safeNum(row.amount) ?? 0;
  return {
    id: publicId(row),
    client: mapLinked(row.client, clientAtByUuid),
    kind: (row.kind as BillingCycleKind) ?? "chatting_weekly",
    period_start: String(row.period_start ?? "").slice(0, 10),
    period_end: String(row.period_end ?? "").slice(0, 10),
    due_date: String(row.due_date ?? "").slice(0, 10),
    amount,
    currency: String(row.currency ?? "USD"),
    status: (row.status as BillingCycleStatus) ?? "draft",
    model: mapLinked(row.model, modelAtByUuid),
    model_turnover: safeNum(row.model_turnover) ?? undefined,
    client_percentage_snapshot: safeNum(row.client_percentage_snapshot) ?? undefined,
    amount_due: revenueTotals?.amount_due ?? amount,
    amount_crm: safeNum(row.amount_crm) ?? undefined,
    total_fee_usd: revenueTotals?.total_fee_usd,
    total_turnover_usd: revenueTotals?.total_turnover_usd,
    client_notified_at: row.client_notified_at ?? undefined,
    created_at: row.created_time ?? undefined,
  };
}

async function mapBillingCycles(
  rows: CycleRow[],
  totalsByPublicId?: Map<string, { total_fee_usd?: number; total_turnover_usd?: number; amount_due?: number }>
): Promise<BillingCycleRecord[]> {
  if (!rows.length) return [];
  const [clientAtByUuid, modelAtByUuid] = await Promise.all([
    resolveUuidMap(TABLES.clients, rows.map((r) => r.client)),
    resolveUuidMap(TABLES.modelss, rows.map((r) => r.model)),
  ]);
  return rows.map((r) =>
    mapBillingCycleSync(r, clientAtByUuid, modelAtByUuid, totalsByPublicId?.get(publicId(r)))
  );
}

async function mapBillingCycle(
  row: CycleRow,
  revenueTotals?: { total_fee_usd?: number; total_turnover_usd?: number; amount_due?: number }
): Promise<BillingCycleRecord> {
  const totals = revenueTotals
    ? new Map([[publicId(row), revenueTotals]])
    : undefined;
  const [mapped] = await mapBillingCycles([row], totals);
  return mapped;
}

function mapBillingCycleRevenueSync(
  row: RevenueRow,
  cycleAtByUuid: Map<string, string>,
  clientAtByUuid: Map<string, string>,
  modelAtByUuid: Map<string, string>
): BillingCycleRevenueRecord {
  const turnover_usd = safeNum(row.turnover_usd) ?? 0;
  const fee_percent = safeNum(row.fee_percent) ?? 0;
  const statusVal = row.status;
  const status =
    typeof statusVal === "string" && REVENUE_STATUSES.includes(statusVal as BillingCycleRevenueStatus)
      ? (statusVal as BillingCycleRevenueStatus)
      : undefined;
  return {
    id: publicId(row),
    billing_cycle: mapLinked(row.billing_cycle, cycleAtByUuid),
    client: mapLinked(row.client, clientAtByUuid),
    model: mapLinked(row.model, modelAtByUuid),
    turnover_usd,
    fee_percent,
    fee_usd: feeFromParts(turnover_usd, fee_percent),
    status,
    created_at: row.created_at ?? undefined,
  };
}

async function mapBillingCycleRevenues(rows: RevenueRow[]): Promise<BillingCycleRevenueRecord[]> {
  if (!rows.length) return [];
  const [cycleAtByUuid, clientAtByUuid, modelAtByUuid] = await Promise.all([
    resolveUuidMap(TABLES.billing_cycles, rows.map((r) => r.billing_cycle)),
    resolveUuidMap(TABLES.clients, rows.map((r) => r.client)),
    resolveUuidMap(TABLES.modelss, rows.map((r) => r.model)),
  ]);
  return rows.map((r) => mapBillingCycleRevenueSync(r, cycleAtByUuid, clientAtByUuid, modelAtByUuid));
}

async function mapBillingCycleRevenue(row: RevenueRow): Promise<BillingCycleRevenueRecord> {
  const [mapped] = await mapBillingCycleRevenues([row]);
  return mapped;
}

async function mapPaymentSubmissions(rows: PaymentRow[]): Promise<PaymentSubmissionRecord[]> {
  if (!rows.length) return [];
  const [cycleAtByUuid, clientAtByUuid, methodAtByUuid] = await Promise.all([
    resolveUuidMap(TABLES.billing_cycles, rows.map((r) => r.billing_cycle)),
    resolveUuidMap(TABLES.clients, rows.map((r) => r.client)),
    resolveUuidMap("payment_methods", rows.map((r) => r.selected_payment_method)),
  ]);
  return Promise.all(
    rows.map(async (row) => {
      const proof_attachment = await urlsToAttachments(row.proof_attachment);
      return {
        id: publicId(row),
        billing_cycle: mapLinked(row.billing_cycle, cycleAtByUuid),
        client: mapLinked(row.client, clientAtByUuid),
        selected_payment_method: mapLinked(row.selected_payment_method, methodAtByUuid),
        submitted_amount: safeNum(row.submitted_amount) ?? 0,
        submitted_currency: String(row.submitted_currency ?? ""),
        submitted_datetime: String(row.submitted_datetime ?? ""),
        reference_id: row.reference_id ?? undefined,
        note: row.note ?? undefined,
        proof_url: row.proof_url ?? undefined,
        proof_attachment: proof_attachment.length ? proof_attachment : undefined,
        status: (row.status as PaymentSubmissionStatus) ?? "pending_review",
        admin_note: row.admin_note ?? undefined,
      };
    })
  );
}

async function mapPaymentSubmission(row: PaymentRow): Promise<PaymentSubmissionRecord> {
  const [mapped] = await mapPaymentSubmissions([row]);
  return mapped;
}

function monthKeyFromCycle(cycle: BillingCycleRecord): string | null {
  const ps = cycle.period_start;
  if (!ps || ps.length < 7) return null;
  return ps.slice(0, 7);
}

function toDateStrLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, day, 12, 0, 0);
  d.setDate(d.getDate() + days);
  return toDateStrLocal(d);
}

async function resolveCycleTotals(
  cycleUuid: string,
  revenues: BillingCycleRevenueRecord[]
): Promise<{ total_fee_usd: number; total_turnover_usd: number; amount_due: number }> {
  const matched = revenues.filter((r) => {
    // revenues already have airtable ids; match via uuid lookup cache if needed — use row filter below instead
    return true;
  });
  void matched;
  void cycleUuid;
  const total_turnover_usd = revenues.reduce((s, r) => s + (r.turnover_usd ?? 0), 0);
  const total_fee_usd = revenues.reduce(
    (s, r) => s + (r.fee_usd ?? feeFromParts(r.turnover_usd ?? 0, r.fee_percent ?? 0)),
    0
  );
  return { total_fee_usd, total_turnover_usd, amount_due: total_fee_usd };
}

export function feeFromRevenue(r: BillingCycleRevenueRecord): number {
  if (typeof r.fee_usd === "number" && Number.isFinite(r.fee_usd)) return r.fee_usd;
  return (r.turnover_usd ?? 0) * ((r.fee_percent ?? 0) / 100);
}

export async function listAllBillingModels(): Promise<ModelRecord[]> {
  const records = await listAllModelss();
  return records
    .map(
      (m): ModelRecord => ({
        id: m.id,
        model_name: m.model_name,
        status: m.status || "active",
        platform: m.platform,
        team: m.team === "chatting_agency" ? "chatting_agency" : "gunzo_team",
      })
    )
    .sort((a, b) => a.model_name.localeCompare(b.model_name));
}

export async function listAllClientModelAssignments(): Promise<
  Array<{ client: string[]; model: string[] }>
> {
  const assignments = await sbSelectAll<ClientModelRow>(TABLES.client_models);
  const [clientAtByUuid, modelAtByUuid] = await Promise.all([
    resolveUuidMap(TABLES.clients, assignments.map((r) => r.client)),
    resolveUuidMap(TABLES.modelss, assignments.map((r) => r.model)),
  ]);
  return assignments.map((row) => ({
    client: mapLinked(row.client, clientAtByUuid),
    model: mapLinked(row.model, modelAtByUuid),
  }));
}

export async function getClientModelsForBilling(clientId: string): Promise<ClientModelRecord[]> {
  const [assignments, models] = await Promise.all([
    sbSelectAll<ClientModelRow>(TABLES.client_models),
    listAllModelss(),
  ]);
  const modelNameById = new Map(models.map((m) => [m.id, m.model_name]));
  const [clientAtByUuid, modelAtByUuid] = await Promise.all([
    resolveUuidMap(TABLES.clients, assignments.map((r) => r.client)),
    resolveUuidMap(TABLES.modelss, assignments.map((r) => r.model)),
  ]);
  const out: ClientModelRecord[] = [];
  for (const row of assignments) {
    const client = mapLinked(row.client, clientAtByUuid);
    const model = mapLinked(row.model, modelAtByUuid);
    if (!client.includes(clientId)) continue;
    const modelId = model[0];
    out.push({
      id: publicId(row),
      client,
      model,
      model_name: modelId ? modelNameById.get(modelId) : undefined,
    });
  }
  return out;
}

export async function getAllBillingCycles(month?: string): Promise<BillingCycleRecord[]> {
  const rows = await sbSelectAll<CycleRow>(TABLES.billing_cycles);
  rows.sort((a, b) => String(b.period_start ?? "").localeCompare(String(a.period_start ?? "")));
  const allRevenues = await sbSelectAll<RevenueRow>(TABLES.billing_cycle_revenues);
  const mappedRevenues = await mapBillingCycleRevenues(allRevenues);
  const byCycle = new Map<string, BillingCycleRevenueRecord[]>();
  for (const r of mappedRevenues) {
    for (const cid of r.billing_cycle) {
      const list = byCycle.get(cid) ?? [];
      list.push(r);
      byCycle.set(cid, list);
    }
  }
  const totalsByPublicId = new Map<
    string,
    { total_fee_usd?: number; total_turnover_usd?: number; amount_due?: number }
  >();
  for (const row of rows) {
    const id = publicId(row);
    const revs = byCycle.get(id) ?? [];
    totalsByPublicId.set(id, await resolveCycleTotals(row.id, revs));
  }
  const cycles = await mapBillingCycles(rows, totalsByPublicId);
  if (!month) return cycles;
  return cycles.filter((c) => monthKeyFromCycle(c) === month);
}

export async function getBillingCycleById(cycleId: string): Promise<BillingCycleRecord | null> {
  const row = await sbSelectByPublicId<CycleRow>(TABLES.billing_cycles, cycleId);
  if (!row) return null;
  const revs = await getBillingCycleRevenues(publicId(row));
  const totals = await resolveCycleTotals(row.id, revs);
  return mapBillingCycle(row, totals);
}

export async function getBillingCycleRevenues(cycleId: string): Promise<BillingCycleRevenueRecord[]> {
  const all = await sbSelectAll<RevenueRow>(TABLES.billing_cycle_revenues);
  const mapped = await mapBillingCycleRevenues(all);
  return mapped
    .filter((r) => r.billing_cycle.includes(cycleId))
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
}

export async function getBillingCycleRevenuesForCycles(
  cycleIds: string[]
): Promise<BillingCycleRevenueRecord[]> {
  if (cycleIds.length === 0) return [];
  const set = new Set(cycleIds);
  const all = await sbSelectAll<RevenueRow>(TABLES.billing_cycle_revenues);
  const mapped = await mapBillingCycleRevenues(all);
  return mapped
    .filter((r) => r.billing_cycle.some((id) => set.has(id)))
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
}

export async function getBillingCycleClientCounts(
  cycleIds: string[]
): Promise<Record<string, number>> {
  if (cycleIds.length === 0) return {};
  const revenues = await getBillingCycleRevenuesForCycles(cycleIds);
  const counts: Record<string, Set<string>> = {};
  for (const id of cycleIds) counts[id] = new Set();
  for (const r of revenues) {
    const clientId = r.client[0];
    if (!clientId) continue;
    for (const cid of r.billing_cycle) {
      if (counts[cid]) counts[cid].add(clientId);
    }
  }
  const result: Record<string, number> = {};
  for (const id of cycleIds) result[id] = counts[id]?.size ?? 0;
  return result;
}

export async function createBillingCycle(data: CreateBillingCycleInput): Promise<BillingCycleRecord> {
  const clientUuids = data.client?.length
    ? await requireSbUuids(TABLES.clients, data.client, "client")
    : [];
  const modelUuids = data.model?.length
    ? await requireSbUuids(TABLES.modelss, data.model, "model")
    : [];
  const row: Record<string, unknown> = {
    client: clientUuids,
    kind: data.kind,
    period_start: data.period_start,
    period_end: data.period_end,
    due_date: data.due_date,
    currency: data.currency,
    status: data.status,
  };
  if (modelUuids.length) row.model = modelUuids;
  if (data.model_turnover !== undefined) row.model_turnover = data.model_turnover;
  if (data.client_percentage_snapshot !== undefined) {
    row.client_percentage_snapshot = data.client_percentage_snapshot;
  }
  if (data.amount_crm !== undefined) {
    row.amount_crm = data.amount_crm;
    row.amount = data.amount ?? data.amount_crm;
  } else if (data.amount !== undefined) {
    row.amount = data.amount;
  }
  const inserted = await sbInsert<CycleRow>(TABLES.billing_cycles, row);
  return mapBillingCycle(inserted);
}

export async function createBillingCyclePeriod(data: {
  period_start: string;
  period_end: string;
  due_date: string;
  kind: BillingCycleKind;
  currency: string;
  status: BillingCycleStatus;
}): Promise<BillingCycleRecord> {
  return createBillingCycle({
    client: [],
    kind: data.kind,
    period_start: data.period_start,
    period_end: data.period_end,
    due_date: data.due_date,
    currency: data.currency,
    status: data.status,
  });
}

export async function updateBillingCycle(
  cycleId: string,
  data: UpdateBillingCycleInput
): Promise<BillingCycleRecord> {
  const patch: Record<string, unknown> = {};
  if (data.client !== undefined) {
    patch.client = await requireSbUuids(TABLES.clients, data.client, "client");
  }
  if (data.model !== undefined) {
    patch.model = await requireSbUuids(TABLES.modelss, data.model, "model");
  }
  if (data.kind !== undefined) patch.kind = data.kind;
  if (data.period_start !== undefined) patch.period_start = data.period_start;
  if (data.period_end !== undefined) patch.period_end = data.period_end;
  if (data.due_date !== undefined) patch.due_date = data.due_date;
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.currency !== undefined) patch.currency = data.currency;
  if (data.status !== undefined) patch.status = data.status;
  if (data.model_turnover !== undefined) patch.model_turnover = data.model_turnover;
  if (data.client_percentage_snapshot !== undefined) {
    patch.client_percentage_snapshot = data.client_percentage_snapshot;
  }
  if (data.amount_crm !== undefined) patch.amount_crm = data.amount_crm;
  patch.updated_at = new Date().toISOString();
  const updated = await sbUpdateByPublicId<CycleRow>(TABLES.billing_cycles, cycleId, patch);
  return mapBillingCycle(updated);
}

export async function deleteBillingCycle(cycleId: string): Promise<void> {
  await sbDeleteByPublicId(TABLES.billing_cycles, cycleId);
}

export async function generateWeeklyPeriods(month: string): Promise<GeneratePeriodsResult> {
  const [year, monthNum] = month.split("-").map(Number);
  if (Number.isNaN(year) || Number.isNaN(monthNum)) {
    return { ok: false, userMessage: "Invalid month format (YYYY-MM)", errorCode: "invalid_month" };
  }
  const lastDay = lastDayOfMonth(year, monthNum);
  const mm = String(monthNum).padStart(2, "0");
  const ranges: [string, string][] = [
    [`${year}-${mm}-01`, `${year}-${mm}-07`],
    [`${year}-${mm}-08`, `${year}-${mm}-14`],
    [`${year}-${mm}-15`, `${year}-${mm}-21`],
    [`${year}-${mm}-22`, lastDay],
  ];
  const periods = ranges.map(([period_start, period_end]) => ({
    period_start,
    period_end,
    due_date: addDaysToDateStr(period_end, 4),
  }));
  const existing = await getAllBillingCycles();
  const toCreate = periods.filter(
    (p) =>
      !existing.some(
        (c) =>
          c.kind === "chatting_weekly" &&
          c.period_start === p.period_start &&
          c.period_end === p.period_end
      )
  );
  const skipped = periods.length - toCreate.length;
  let created = 0;
  for (const p of toCreate) {
    await createBillingCyclePeriod({
      ...p,
      kind: "chatting_weekly",
      currency: "USD",
      status: "draft",
    });
    created++;
  }
  return { ok: true, created, skipped, month };
}

export async function generateBillingPeriodsRange(
  periodStart: string,
  periodEnd: string
): Promise<GeneratePeriodsResult> {
  const rangeStart = new Date(periodStart + "T12:00:00");
  const endLimit = new Date(periodEnd + "T12:00:00");
  const periods: { period_start: string; period_end: string; due_date: string }[] = [];
  let currentStart = new Date(rangeStart);
  while (currentStart <= endLimit) {
    let periodEndDate = new Date(currentStart);
    periodEndDate.setDate(periodEndDate.getDate() + 6);
    if (periodEndDate > endLimit) periodEndDate = new Date(endLimit);
    const ps = toDateStrLocal(currentStart);
    const pe = toDateStrLocal(periodEndDate);
    periods.push({ period_start: ps, period_end: pe, due_date: addDaysToDateStr(pe, 4) });
    currentStart = new Date(periodEndDate);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  const existing = await getAllBillingCycles();
  const toCreate = periods.filter(
    (p) =>
      !existing.some(
        (c) =>
          c.kind === "chatting_weekly" &&
          c.period_start === p.period_start &&
          c.period_end === p.period_end
      )
  );
  let created = 0;
  for (const p of toCreate) {
    await createBillingCyclePeriod({
      ...p,
      kind: "chatting_weekly",
      currency: "USD",
      status: "draft",
    });
    created++;
  }
  return { ok: true, created };
}

export async function createBillingCycleRevenue(data: {
  billing_cycle: string[];
  client: string[];
  model: string[];
  turnover_usd: number;
  fee_percent: number;
  status?: BillingCycleRevenueStatus;
}): Promise<BillingCycleRevenueRecord> {
  const [billing_cycle, client, model] = await Promise.all([
    requireSbUuids(TABLES.billing_cycles, data.billing_cycle, "billing_cycle"),
    requireSbUuids(TABLES.clients, data.client, "client"),
    requireSbUuids(TABLES.modelss, data.model, "model"),
  ]);
  const inserted = await sbInsert<RevenueRow>(TABLES.billing_cycle_revenues, {
    billing_cycle,
    client,
    model,
    turnover_usd: data.turnover_usd,
    fee_percent: data.fee_percent,
    status: data.status ?? "announced",
    created_at: new Date().toISOString(),
  });
  const cycleId = data.billing_cycle[0];
  if (cycleId) {
    const cycle = await getBillingCycleById(cycleId);
    if (cycle) {
      const updates: UpdateBillingCycleInput = {};
      if (cycle.client.length === 0) updates.client = data.client;
      const currentModels = cycle.model ?? [];
      const modelId = data.model[0];
      if (modelId && !currentModels.includes(modelId)) {
        updates.model = [...currentModels, modelId];
      }
      if (Object.keys(updates).length > 0) {
        await updateBillingCycle(cycleId, updates);
      }
    }
  }
  return mapBillingCycleRevenue(inserted);
}

export async function updateBillingCycleRevenue(
  revenueId: string,
  data: { turnover_usd?: number; fee_percent?: number; status?: BillingCycleRevenueStatus }
): Promise<BillingCycleRevenueRecord> {
  const patch: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };
  const updated = await sbUpdateByPublicId<RevenueRow>(
    TABLES.billing_cycle_revenues,
    revenueId,
    patch
  );
  return mapBillingCycleRevenue(updated);
}

export async function deleteBillingCycleRevenue(revenueId: string): Promise<{
  cycleId: string | null;
  clientId: string | null;
}> {
  const row = await sbSelectByPublicId<RevenueRow>(TABLES.billing_cycle_revenues, revenueId);
  if (!row) return { cycleId: null, clientId: null };
  const mapped = await mapBillingCycleRevenue(row);
  const cycleId = mapped.billing_cycle[0] ?? null;
  const clientId = mapped.client[0] ?? null;
  await sbDeleteByPublicId(TABLES.billing_cycle_revenues, revenueId);
  if (cycleId) await syncBillingCycleLinksAfterRevenueDelete(cycleId);
  return { cycleId, clientId };
}

export async function syncBillingCycleLinksAfterRevenueDelete(cycleId: string): Promise<void> {
  const remaining = await getBillingCycleRevenues(cycleId);
  const modelIds = Array.from(new Set(remaining.flatMap((r) => r.model).filter(Boolean)));
  const clientIds = Array.from(new Set(remaining.flatMap((r) => r.client).filter(Boolean)));
  await updateBillingCycle(cycleId, { model: modelIds, client: clientIds });
}

export async function updateRevenuesStatusForClientAndCycle(
  clientId: string,
  cycleId: string,
  fromStatuses: BillingCycleRevenueStatus[],
  toStatus: BillingCycleRevenueStatus
): Promise<number> {
  const revenues = await getBillingCycleRevenues(cycleId);
  const toUpdate = revenues.filter(
    (r) =>
      r.client.includes(clientId) &&
      ((r.status && fromStatuses.includes(r.status)) ||
        (!r.status && fromStatuses.includes("draft")))
  );
  let updated = 0;
  for (const r of toUpdate) {
    await updateBillingCycleRevenue(r.id, { status: toStatus });
    updated++;
  }
  return updated;
}

export async function getAllPaymentSubmissions(
  filters?: PaymentSubmissionFilters
): Promise<PaymentSubmissionRecord[]> {
  const rows = await sbSelectAll<PaymentRow>(TABLES.payment_submissions);
  let mapped = await mapPaymentSubmissions(rows);
  if (filters?.status) mapped = mapped.filter((r) => r.status === filters.status);
  if (filters?.clientId) mapped = mapped.filter((r) => r.client.includes(filters.clientId!));
  mapped.sort((a, b) => String(b.submitted_datetime).localeCompare(String(a.submitted_datetime)));
  return mapped;
}

export async function updatePaymentSubmission(
  submissionId: string,
  data: { status: "approved" | "rejected"; admin_note?: string }
): Promise<PaymentSubmissionRecord> {
  const existing = await sbSelectByPublicId<PaymentRow>(TABLES.payment_submissions, submissionId);
  if (!existing) throw new Error("Payment submission not found");
  const mapped = await mapPaymentSubmission(existing);
  const clientId = mapped.client[0];
  const billingCycleId = mapped.billing_cycle[0];

  const patch: Record<string, unknown> = {
    status: data.status,
    updated_at: new Date().toISOString(),
  };
  if (data.admin_note !== undefined) patch.admin_note = data.admin_note;
  const updated = await sbUpdateByPublicId<PaymentRow>(
    TABLES.payment_submissions,
    submissionId,
    patch
  );
  const result = await mapPaymentSubmission(updated);
  result.status = data.status;

  const finalCycleId = billingCycleId ?? result.billing_cycle[0];
  if (data.status === "approved" && finalCycleId && clientId) {
    const cycle = await getBillingCycleById(finalCycleId);
    if (cycle?.kind === "chatting_weekly") {
      await updateRevenuesStatusForClientAndCycle(
        clientId,
        finalCycleId,
        ["pending_review", "announced", "overdue"],
        "confirmed_paid"
      );
    } else if (cycle?.kind === "crm_monthly") {
      await updateBillingCycle(finalCycleId, { status: "confirmed_paid" });
    }
  }
  return result;
}

export async function getPartnerBillingCycles(month?: string): Promise<BillingCycleRecord[]> {
  const all = await getAllBillingCycles();
  if (!month) return all;
  return all.filter((cycle) => {
    const periodStart = cycle.period_start;
    if (!periodStart || periodStart.length < 7) return false;
    return periodStart.slice(0, 7) === month;
  });
}

export async function listBillingClients(): Promise<BillingClientRecord[]> {
  const rows = await sbSelectEq<ClientRow>(TABLES.clients, "status", "active");
  return rows
    .map((row) => ({
      id: publicId(row),
      company_name: String(row.company_name ?? ""),
      display_name: String(row.display_name ?? ""),
      email: String(row.email ?? ""),
      status: (row.status as AdminClientRecord["status"]) ?? "inactive",
      client_percentage:
        typeof row.client_percentage === "number" ? row.client_percentage : undefined,
    }))
    .sort((a, b) => a.company_name.localeCompare(b.company_name));
}

export const getCachedBillingClients = unstable_cache(
  async () => listBillingClients(),
  ["billing-clients-v1-sb"],
  { revalidate: 60 }
);
