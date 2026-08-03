import { unstable_cache } from "next/cache";
import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { linkedRecordIds } from "@/lib/airtable-linked";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  getPaymentSubmissionById,
  updatePaymentSubmissionReview,
} from "@/services/client-portal";
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

export type {
  BillingCycleRecord,
  BillingCycleRevenueRecord,
  PaymentSubmissionRecord,
} from "@/types/client-portal";

const TABLES = {
  clients: "clients",
  /** billing_cycle_revenues.model and client_models.model link here (not legacy `models`). */
  modelss: "modelss",
  client_models: "client_models",
  billing_cycles: "billing_cycles",
  billing_cycle_revenues: "billing_cycle_revenues",
  payment_submissions: "payment_submissions",
} as const;

const REVENUE_FIELDS = [
  "billing_cycle",
  "client",
  "model",
  "turnover_usd",
  "fee_percent",
  "fee_usd",
  "status",
  "created_at",
] as const;

const REVENUE_STATUSES: BillingCycleRevenueStatus[] = [
  "draft",
  "announced",
  "pending_review",
  "confirmed_paid",
  "overdue",
];

function safeNum(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapBillingCycle(rec: AirtableRecord<Record<string, unknown>>): BillingCycleRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    client: linkedRecordIds(f.client),
    kind: (f.kind as BillingCycleKind) ?? "chatting_weekly",
    period_start: String(f.period_start ?? ""),
    period_end: String(f.period_end ?? ""),
    due_date: String(f.due_date ?? ""),
    amount: typeof f.amount === "number" ? f.amount : 0,
    currency: String(f.currency ?? "USD"),
    status: (f.status as BillingCycleStatus) ?? "draft",
    model: linkedRecordIds(f.model),
    model_turnover: typeof f.model_turnover === "number" ? f.model_turnover : undefined,
    client_percentage_snapshot:
      typeof f.client_percentage_snapshot === "number" ? f.client_percentage_snapshot : undefined,
    amount_due: typeof f.amount_due === "number" ? f.amount_due : undefined,
    amount_crm: typeof f.amount_crm === "number" ? f.amount_crm : undefined,
    amount_paid: typeof f.amount_paid === "number" ? f.amount_paid : undefined,
    total_fee_usd: typeof f.total_fee_usd === "number" ? f.total_fee_usd : undefined,
    total_turnover_usd: typeof f.total_turnover_usd === "number" ? f.total_turnover_usd : undefined,
    client_notified_at: typeof f.client_notified_at === "string" ? f.client_notified_at : undefined,
    created_at: typeof f.created_at === "string" ? f.created_at : undefined,
  };
}

function mapBillingCycleRevenue(rec: AirtableRecord<Record<string, unknown>>): BillingCycleRevenueRecord {
  const f = rec.fields;
  const statusVal = f.status;
  const status =
    typeof statusVal === "string" && REVENUE_STATUSES.includes(statusVal as BillingCycleRevenueStatus)
      ? (statusVal as BillingCycleRevenueStatus)
      : undefined;

  return {
    id: rec.id,
    billing_cycle: linkedRecordIds(f.billing_cycle),
    client: linkedRecordIds(f.client),
    model: linkedRecordIds(f.model),
    turnover_usd: safeNum(f.turnover_usd) ?? 0,
    fee_percent: safeNum(f.fee_percent) ?? 0,
    fee_usd: safeNum(f.fee_usd) ?? undefined,
    status,
    created_at: typeof f.created_at === "string" ? f.created_at : undefined,
  };
}

/** Resolve fee USD from a billing_cycle_revenues row (stored fee or turnover × percent). */
export function feeFromRevenue(r: BillingCycleRevenueRecord): number {
  if (typeof r.fee_usd === "number" && Number.isFinite(r.fee_usd)) {
    return r.fee_usd;
  }
  return (r.turnover_usd ?? 0) * ((r.fee_percent ?? 0) / 100);
}

function mapPaymentSubmission(rec: AirtableRecord<Record<string, unknown>>): PaymentSubmissionRecord {
  const f = rec.fields;
  const proofAttachment = Array.isArray(f.proof_attachment)
    ? (f.proof_attachment as Array<{ url?: string; filename?: string }>)
        .filter((a) => typeof a.url === "string")
        .map((a) => ({ url: a.url!, filename: a.filename }))
    : undefined;

  return {
    id: rec.id,
    billing_cycle: linkedRecordIds(f.billing_cycle),
    client: linkedRecordIds(f.client),
    selected_payment_method: linkedRecordIds(f.selected_payment_method),
    submitted_amount: typeof f.submitted_amount === "number" ? f.submitted_amount : 0,
    submitted_currency: String(f.submitted_currency ?? ""),
    submitted_datetime: String(f.submitted_datetime ?? ""),
    reference_id: typeof f.reference_id === "string" ? f.reference_id : undefined,
    note: typeof f.note === "string" ? f.note : undefined,
    proof_url: typeof f.proof_url === "string" ? f.proof_url : undefined,
    proof_attachment: proofAttachment,
    status: (f.status as PaymentSubmissionStatus) ?? "pending_review",
    admin_note: typeof f.admin_note === "string" ? f.admin_note : undefined,
  };
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

function monthKeyFromCycle(cycle: BillingCycleRecord): string | null {
  const ps = cycle.period_start;
  if (!ps || ps.length < 7) return null;
  return ps.slice(0, 7);
}

export async function listAllBillingModels(): Promise<ModelRecord[]> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).listAllBillingModels();
  }
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

export async function getClientModelsForBilling(clientId: string): Promise<ClientModelRecord[]> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).getClientModelsForBilling(clientId);
  }
  const [assignments, models] = await Promise.all([
    listAllRecords<Record<string, unknown>>(TABLES.client_models, {
      _caller: "getClientModelsForBilling:assignments",
    }),
    listAllModelss(),
  ]);

  const modelNameById = new Map(models.map((m) => [m.id, m.model_name]));

  return assignments
    .map((rec) => {
      const client = linkedRecordIds(rec.fields.client);
      const model = linkedRecordIds(rec.fields.model);
      const modelId = model[0];
      return {
        id: rec.id,
        client,
        model,
        model_name: modelId ? modelNameById.get(modelId) : undefined,
      };
    })
    .filter((row) => row.client.includes(clientId));
}

export async function getAllBillingCycles(month?: string): Promise<BillingCycleRecord[]> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).getAllBillingCycles(month);
  }
  const records = await listAllRecords<Record<string, unknown>>(TABLES.billing_cycles, {
    sort: [{ field: "period_start", direction: "desc" }],
    _caller: "getAllBillingCycles",
  });

  const cycles = records.map(mapBillingCycle);
  if (!month) return cycles;
  return cycles.filter((c) => monthKeyFromCycle(c) === month);
}

export async function getBillingCycleById(cycleId: string): Promise<BillingCycleRecord | null> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).getBillingCycleById(cycleId);
  }
  try {
    const rec = await getRecord<Record<string, unknown>>(TABLES.billing_cycles, cycleId);
    return mapBillingCycle(rec);
  } catch {
    return null;
  }
}

export async function getBillingCycleRevenues(cycleId: string): Promise<BillingCycleRevenueRecord[]> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).getBillingCycleRevenues(cycleId);
  }
  const { records } = await listRecords<Record<string, unknown>>(TABLES.billing_cycle_revenues, {
    filterByFormula: `FIND("${cycleId}", {billing_cycle}) > 0`,
    sort: [{ field: "created_at", direction: "asc" }],
    fields: [...REVENUE_FIELDS],
    _caller: "getBillingCycleRevenues",
  });

  let matched = records;
  if (matched.length === 0) {
    const all = await listAllRecords<Record<string, unknown>>(TABLES.billing_cycle_revenues, {
      sort: [{ field: "created_at", direction: "asc" }],
      _caller: "getBillingCycleRevenues:fallback",
    });
    matched = all.filter((r) => linkedRecordIds(r.fields.billing_cycle).includes(cycleId));
  }

  return matched.map(mapBillingCycleRevenue);
}

export async function getBillingCycleRevenuesForCycles(
  cycleIds: string[]
): Promise<BillingCycleRevenueRecord[]> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).getBillingCycleRevenuesForCycles(cycleIds);
  }
  if (cycleIds.length === 0) return [];
  const cycleIdSet = new Set(cycleIds);

  const records = await listAllRecords<Record<string, unknown>>(TABLES.billing_cycle_revenues, {
    sort: [{ field: "created_at", direction: "asc" }],
    _caller: "getBillingCycleRevenuesForCycles",
  });

  return records
    .filter((r) => linkedRecordIds(r.fields.billing_cycle).some((id) => cycleIdSet.has(id)))
    .map(mapBillingCycleRevenue);
}

export async function getBillingCycleClientCounts(
  cycleIds: string[]
): Promise<Record<string, number>> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).getBillingCycleClientCounts(cycleIds);
  }
  if (cycleIds.length === 0) return {};

  const records = await listAllRecords<Record<string, unknown>>(TABLES.billing_cycle_revenues, {
    fields: ["billing_cycle", "client"],
    _caller: "getBillingCycleClientCounts",
  });

  const counts: Record<string, Set<string>> = {};
  for (const id of cycleIds) counts[id] = new Set();

  for (const r of records) {
    const cycleIdsFromRecord = linkedRecordIds(r.fields.billing_cycle);
    const clientIds = linkedRecordIds(r.fields.client);
    const clientId = clientIds[0];
    if (!clientId) continue;
    for (const cid of cycleIdsFromRecord) {
      if (counts[cid]) counts[cid].add(clientId);
    }
  }

  const result: Record<string, number> = {};
  for (const id of cycleIds) {
    result[id] = counts[id]?.size ?? 0;
  }
  return result;
}

export type CreateBillingCycleInput = {
  client?: string[];
  kind: BillingCycleKind;
  period_start: string;
  period_end: string;
  due_date: string;
  currency: string;
  status: BillingCycleStatus;
  model?: string[];
  model_turnover?: number;
  client_percentage_snapshot?: number;
  amount_crm?: number;
  amount?: number;
};

export async function createBillingCycle(data: CreateBillingCycleInput): Promise<BillingCycleRecord> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).createBillingCycle(data);
  }
  const fields: Record<string, unknown> = {
    client: data.client ?? [],
    kind: data.kind,
    period_start: data.period_start,
    period_end: data.period_end,
    due_date: data.due_date,
    currency: data.currency,
    status: data.status,
  };
  if (data.model?.length) fields.model = data.model;
  if (data.model_turnover !== undefined) fields.model_turnover = data.model_turnover;
  if (data.client_percentage_snapshot !== undefined) {
    fields.client_percentage_snapshot = data.client_percentage_snapshot;
  }
  if (data.amount_crm !== undefined) {
    fields.amount_crm = data.amount_crm;
    fields.amount = data.amount ?? data.amount_crm;
  } else if (data.amount !== undefined) {
    fields.amount = data.amount;
  }

  const rec = await createRecord<Record<string, unknown>>(TABLES.billing_cycles, fields);
  return mapBillingCycle(rec);
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

export type UpdateBillingCycleInput = Partial<{
  client: string[];
  kind: BillingCycleKind;
  period_start: string;
  period_end: string;
  due_date: string;
  amount: number;
  currency: string;
  status: BillingCycleStatus;
  model: string[];
  model_turnover: number;
  client_percentage_snapshot: number;
  amount_crm: number;
}>;

export async function updateBillingCycle(
  cycleId: string,
  data: UpdateBillingCycleInput
): Promise<BillingCycleRecord> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).updateBillingCycle(cycleId, data);
  }
  const rec = await updateRecord<Record<string, unknown>>(TABLES.billing_cycles, cycleId, data);
  return mapBillingCycle(rec);
}

export async function deleteBillingCycle(cycleId: string): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).deleteBillingCycle(cycleId);
  }
  await deleteRecord(TABLES.billing_cycles, cycleId);
}

export type GeneratePeriodsResult =
  | { ok: true; created: number; skipped?: number; month?: string }
  | { ok: false; userMessage: string; errorCode: string };

export async function generateWeeklyPeriods(month: string): Promise<GeneratePeriodsResult> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).generateWeeklyPeriods(month);
  }
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
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).generateBillingPeriodsRange(
      periodStart,
      periodEnd
    );
  }
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
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).createBillingCycleRevenue(data);
  }
  const fields: Record<string, unknown> = {
    billing_cycle: data.billing_cycle,
    client: data.client,
    model: data.model,
    turnover_usd: data.turnover_usd,
    fee_percent: data.fee_percent,
    status: data.status ?? "announced",
  };
  const rec = await createRecord<Record<string, unknown>>(TABLES.billing_cycle_revenues, fields);

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

  return mapBillingCycleRevenue(rec);
}

export async function updateBillingCycleRevenue(
  revenueId: string,
  data: { turnover_usd?: number; fee_percent?: number; status?: BillingCycleRevenueStatus }
): Promise<BillingCycleRevenueRecord> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).updateBillingCycleRevenue(revenueId, data);
  }
  const rec = await updateRecord<Record<string, unknown>>(
    TABLES.billing_cycle_revenues,
    revenueId,
    data
  );
  return mapBillingCycleRevenue(rec);
}

export async function deleteBillingCycleRevenue(revenueId: string): Promise<{
  cycleId: string | null;
  clientId: string | null;
}> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).deleteBillingCycleRevenue(revenueId);
  }
  const rec = await getRecord<Record<string, unknown>>(TABLES.billing_cycle_revenues, revenueId);
  const cycleId = linkedRecordIds(rec.fields.billing_cycle)[0] ?? null;
  const clientId = linkedRecordIds(rec.fields.client)[0] ?? null;
  await deleteRecord(TABLES.billing_cycle_revenues, revenueId);
  if (cycleId) {
    await syncBillingCycleLinksAfterRevenueDelete(cycleId);
  }
  return { cycleId, clientId };
}

export async function syncBillingCycleLinksAfterRevenueDelete(cycleId: string): Promise<void> {
  const remaining = await getBillingCycleRevenues(cycleId);
  const modelIds = Array.from(
    new Set(remaining.flatMap((r) => r.model).filter(Boolean))
  );
  const clientIds = Array.from(
    new Set(remaining.flatMap((r) => r.client).filter(Boolean))
  );
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

export type PaymentSubmissionFilters = {
  status?: PaymentSubmissionStatus;
  clientId?: string;
};

export async function getAllPaymentSubmissions(
  filters?: PaymentSubmissionFilters
): Promise<PaymentSubmissionRecord[]> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).getAllPaymentSubmissions(filters);
  }
  const formulaParts: string[] = [];
  if (filters?.status) {
    formulaParts.push(`{status} = "${filters.status}"`);
  }
  if (filters?.clientId) {
    formulaParts.push(`FIND("${filters.clientId}", {client}) > 0`);
  }

  const filterByFormula =
    formulaParts.length === 0
      ? undefined
      : formulaParts.length === 1
        ? formulaParts[0]
        : `AND(${formulaParts.join(", ")})`;

  const records = await listAllRecords<Record<string, unknown>>(TABLES.payment_submissions, {
    filterByFormula,
    sort: [{ field: "submitted_datetime", direction: "desc" }],
    _caller: "getAllPaymentSubmissions",
  });

  return records.map(mapPaymentSubmission);
}

export async function updatePaymentSubmission(
  submissionId: string,
  data: { status: "approved" | "rejected"; admin_note?: string }
): Promise<PaymentSubmissionRecord> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).updatePaymentSubmission(submissionId, data);
  }
  const submission = await getPaymentSubmissionById(submissionId);
  const clientId = submission.client[0];
  const billingCycleId = submission.billing_cycle[0];

  const result = await updatePaymentSubmissionReview(submissionId, data);

  const finalCycleId = billingCycleId ?? result.billing_cycle[0];
  if (data.status === "approved" && finalCycleId && clientId) {
    const cycle = await getBillingCycleById(finalCycleId);
    if (cycle?.kind === "chatting_weekly") {
      await updateRevenuesStatusForClientAndCycle(
        clientId,
        finalCycleId,
        ["pending_review", "announced", "overdue"],
        "confirmed_paid");
    } else if (cycle?.kind === "crm_monthly") {
      await updateBillingCycle(finalCycleId, { status: "confirmed_paid" });
    }
  }

  return result;
}

/** Partner billing cycles filtered by month (YYYY-MM) when provided. */
export async function getPartnerBillingCycles(month?: string): Promise<BillingCycleRecord[]> {
  const all = await getAllBillingCycles();
  if (!month) return all;

  return all.filter((cycle) => {
    const periodStart = cycle.period_start;
    if (!periodStart || periodStart.length < 7) return false;
    return periodStart.slice(0, 7) === month;
  });
}

export type BillingClientRecord = Pick<
  AdminClientRecord,
  "id" | "company_name" | "display_name" | "email" | "status" | "client_percentage"
>;

export async function listBillingClients(): Promise<BillingClientRecord[]> {
  if (isSupabaseBackend()) {
    return (await import("./client-billing-supabase")).listBillingClients();
  }
  const records = await listAllRecords<Record<string, unknown>>(TABLES.clients, {
    filterByFormula: '{status} = "active"',
    sort: [{ field: "company_name", direction: "asc" }],
    _caller: "listBillingClients",
  });
  return records.map((rec) => {
    const f = rec.fields;
    return {
      id: rec.id,
      company_name: String(f.company_name ?? ""),
      display_name: String(f.display_name ?? ""),
      email: String(f.email ?? ""),
      status: (f.status as AdminClientRecord["status"]) ?? "inactive",
      client_percentage:
        typeof f.client_percentage === "number" ? f.client_percentage : undefined,
    };
  });
}

/** Active billing clients cached 60s — use on heavy admin pages instead of listBillingClients(). */
export const getCachedBillingClients = unstable_cache(
  async () => listBillingClients(),
  ["billing-clients-v1"],
  { revalidate: 60 }
);
