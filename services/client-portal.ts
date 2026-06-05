import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import {
  formulaLinkedContains,
  linkedRecordIds,
} from "@/lib/airtable-linked";
import { formatDateEuropean } from "@/lib/format";
import { getCycleAmountDue, isBillingOverdue } from "@/lib/client-portal-utils";
import {
  getAllBillingCycles,
  getBillingCycleById as getBillingCycleByIdFromBilling,
  getBillingCycleRevenues,
  getBillingCycleRevenuesForCycles,
  listAllBillingModels,
  updateBillingCycle as updateBillingCycleRecord,
  updateRevenuesStatusForClientAndCycle,
} from "@/services/client-billing";
import type {
  AdminClientRecord,
  BillingCycleKind,
  BillingCycleRecord,
  BillingCycleRevenueRecord,
  BillingCycleRevenueStatus,
  BillingCycleStatus,
  CalendarEventRecord,
  ChattingCycleResult,
  ClientAttentionItem,
  ClientModelRecord,
  ClientRecord,
  ClientStatus,
  ClientTeamRole,
  ClientUserType,
  CreateAdminClientInput,
  CreateBillingCycleInput,
  CreatePaymentSubmissionInput,
  EnrichedInvoice,
  GunzoPartnershipData,
  InvoiceRecord,
  ModelRecord,
  PaymentMethodRecord,
  PaymentSubmissionRecord,
  UpdateAdminClientInput,
  UpdatePaymentSubmissionInput,
} from "@/types/client-portal";

export { getCycleAmountDue } from "@/lib/client-portal-utils";

const TABLES = {
  clients: "clients",
  billing_cycles: "billing_cycles",
  billing_cycle_revenues: "billing_cycle_revenues",
  payment_submissions: "payment_submissions",
  payment_methods: "payment_methods",
  invoices: "invoices",
  client_models: "client_models",
  /** Client billing models (B2B portal) — Airtable `modelss` table. */
  billing_models: "modelss",
  calendar_events: "calendar_events",
} as const;

const TEAM_ROLES: ClientTeamRole[] = ["admin", "manager", "chatter", "virtual_assistant"];

function mapUserType(raw: unknown): ClientUserType | undefined {
  if (raw === "team_member") return "team_member";
  if (raw === "client") return "client";
  return undefined;
}

function mapTeamRole(raw: unknown): ClientTeamRole | undefined {
  if (typeof raw === "string" && TEAM_ROLES.includes(raw as ClientTeamRole)) {
    return raw as ClientTeamRole;
  }
  return undefined;
}

function mapClient(rec: AirtableRecord<Record<string, unknown>>): ClientRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    company_name: String(f.company_name ?? ""),
    display_name: String(f.display_name ?? ""),
    email: String(f.email ?? ""),
    status: (f.status as ClientRecord["status"]) ?? "inactive",
    user_type: mapUserType(f.user_type),
    role: mapTeamRole(f.role),
    client_percentage: typeof f.client_percentage === "number" ? f.client_percentage : undefined,
    net_profit_goal: typeof f.net_profit_goal === "number" ? f.net_profit_goal : undefined,
  };
}

function mapAdminClient(rec: AirtableRecord<Record<string, unknown>>): AdminClientRecord {
  const f = rec.fields;
  return {
    ...mapClient(rec),
    portal_access: f.portal_access !== false,
  };
}

function mapBillingCycle(rec: AirtableRecord<Record<string, unknown>>): BillingCycleRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    client: linkedRecordIds(f.client),
    kind: (f.kind as BillingCycleRecord["kind"]) ?? "chatting_weekly",
    period_start: String(f.period_start ?? ""),
    period_end: String(f.period_end ?? ""),
    due_date: String(f.due_date ?? ""),
    amount: typeof f.amount === "number" ? f.amount : 0,
    currency: String(f.currency ?? "USD"),
    status: (f.status as BillingCycleStatus) ?? "draft",
    amount_due: typeof f.amount_due === "number" ? f.amount_due : undefined,
    amount_crm: typeof f.amount_crm === "number" ? f.amount_crm : undefined,
    total_fee_usd: typeof f.total_fee_usd === "number" ? f.total_fee_usd : undefined,
    total_turnover_usd: typeof f.total_turnover_usd === "number" ? f.total_turnover_usd : undefined,
    client_notified_at: typeof f.client_notified_at === "string" ? f.client_notified_at : undefined,
    created_at: typeof f.created_at === "string" ? f.created_at : undefined,
  };
}

function mapPaymentMethod(rec: AirtableRecord<Record<string, unknown>>): PaymentMethodRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    type: String(f.type ?? ""),
    label: String(f.label ?? ""),
    details: String(f.details ?? ""),
    network: typeof f.network === "string" ? f.network : undefined,
    is_available: Boolean(f.is_available),
    scope: String(f.scope ?? ""),
    client: linkedRecordIds(f.client),
    open_url: typeof f.open_url === "string" ? f.open_url : undefined,
    fallback_url: typeof f.fallback_url === "string" ? f.fallback_url : undefined,
    beneficiary: typeof f.beneficiary === "string" ? f.beneficiary : undefined,
    iban: typeof f.iban === "string" ? f.iban : undefined,
    bic: typeof f.bic === "string" ? f.bic : undefined,
    wallet_address: typeof f.wallet_address === "string" ? f.wallet_address : undefined,
  };
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
    status: (f.status as PaymentSubmissionRecord["status"]) ?? "pending_review",
    admin_note: typeof f.admin_note === "string" ? f.admin_note : undefined,
  };
}

function mapInvoice(rec: AirtableRecord<Record<string, unknown>>): InvoiceRecord {
  const f = rec.fields;
  const attachment = Array.isArray(f.attachment)
    ? (f.attachment as Array<{ url?: string; filename?: string }>)
        .filter((a) => typeof a.url === "string")
        .map((a) => ({ url: a.url!, filename: a.filename }))
    : undefined;

  return {
    id: rec.id,
    billing_cycle: linkedRecordIds(f.billing_cycle),
    client: linkedRecordIds(f.client),
    invoice_number: typeof f.invoice_number === "string" ? f.invoice_number : undefined,
    sent_to_email: typeof f.sent_to_email === "string" ? f.sent_to_email : undefined,
    sent_at: typeof f.sent_at === "string" ? f.sent_at : undefined,
    attachment,
    viewed_at: typeof f.viewed_at === "string" ? f.viewed_at : undefined,
  };
}

function mapModel(rec: AirtableRecord<Record<string, unknown>>): ModelRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    model_name: String(f.model_name ?? ""),
    status: String(f.status ?? "active"),
    platform: typeof f.platform === "string" ? f.platform : undefined,
  };
}

function mapCalendarEvent(rec: AirtableRecord<Record<string, unknown>>): CalendarEventRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    title: String(f.title ?? ""),
    start_datetime: String(f.start_datetime ?? ""),
    end_datetime: String(f.end_datetime ?? ""),
    notes: typeof f.notes === "string" ? f.notes : undefined,
    scope: String(f.scope ?? "global"),
    client: linkedRecordIds(f.client),
  };
}

function recordIncludesClient(clientField: unknown, clientId: string): boolean {
  return linkedRecordIds(clientField).includes(clientId);
}

export async function getClientById(clientId: string): Promise<ClientRecord> {
  const rec = await getRecord<Record<string, unknown>>(TABLES.clients, clientId);
  return mapClient(rec);
}

export async function listAllClients(): Promise<AdminClientRecord[]> {
  const records = await listAllRecords<Record<string, unknown>>(TABLES.clients, {
    sort: [{ field: "company_name", direction: "asc" }],
    _caller: "listAllClients",
  });
  return records.map(mapAdminClient);
}

export async function createAdminClient(data: CreateAdminClientInput): Promise<AdminClientRecord> {
  const fields: Record<string, unknown> = {
    display_name: data.display_name.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.passwordHash,
    user_type: data.user_type,
    status: data.status,
    portal_access: data.user_type === "client",
  };

  if (data.user_type === "client") {
    if (data.company_name?.trim()) fields.company_name = data.company_name.trim();
    if (typeof data.client_percentage === "number") {
      fields.client_percentage = data.client_percentage;
    }
  } else if (data.role) {
    fields.role = data.role;
  }

  const rec = await createRecord<Record<string, unknown>>(TABLES.clients, fields);
  return mapAdminClient(rec);
}

export async function updateClientPortalAccess(
  clientId: string,
  portalAccess: boolean
): Promise<AdminClientRecord> {
  return updateAdminClient(clientId, { portal_access: portalAccess });
}

export async function updateAdminClient(
  clientId: string,
  data: UpdateAdminClientInput
): Promise<AdminClientRecord> {
  const fields: Record<string, unknown> = {};

  if (data.portal_access !== undefined) fields.portal_access = data.portal_access;
  if (data.company_name !== undefined) fields.company_name = data.company_name.trim();
  if (data.display_name !== undefined) fields.display_name = data.display_name.trim();
  if (data.email !== undefined) fields.email = data.email.trim().toLowerCase();
  if (typeof data.client_percentage === "number") {
    fields.client_percentage = data.client_percentage;
  }
  if (data.status !== undefined) fields.status = data.status;
  if (data.passwordHash) fields.password = data.passwordHash;

  const rec = await updateRecord<Record<string, unknown>>(TABLES.clients, clientId, fields);
  return mapAdminClient(rec);
}

function mapClientModelAssignment(
  rec: AirtableRecord<Record<string, unknown>>,
  modelNameById?: Map<string, string>
): ClientModelRecord {
  const model = linkedRecordIds(rec.fields.model);
  const modelId = model[0];
  return {
    id: rec.id,
    client: linkedRecordIds(rec.fields.client),
    model,
    model_name: modelId ? modelNameById?.get(modelId) : undefined,
  };
}

export async function createClientModelAssignment(
  clientId: string,
  modelId: string
): Promise<ClientModelRecord> {
  const rec = await createRecord<Record<string, unknown>>(TABLES.client_models, {
    client: [clientId],
    model: [modelId],
  });

  let modelName: string | undefined;
  try {
    const modelRec = await getRecord<Record<string, unknown>>(TABLES.billing_models, modelId);
    modelName = String(modelRec.fields.model_name ?? "");
  } catch {
    /* model row may be missing */
  }

  return mapClientModelAssignment(rec, modelName ? new Map([[modelId, modelName]]) : undefined);
}

export async function deleteClientModelAssignment(assignmentId: string): Promise<void> {
  await deleteRecord(TABLES.client_models, assignmentId);
}

export async function createBillingCycleForClient(
  clientId: string,
  data: CreateBillingCycleInput
): Promise<BillingCycleRecord> {
  const fields: Record<string, unknown> = {
    client: [clientId],
    kind: data.kind,
    period_start: data.period_start,
    period_end: data.period_end,
    due_date: data.due_date,
    amount: data.amount,
    currency: data.currency,
    status: "draft",
  };
  if (data.kind === "crm_monthly") {
    fields.amount_crm = data.amount;
  }
  const rec = await createRecord<Record<string, unknown>>(TABLES.billing_cycles, fields);
  return mapBillingCycle(rec);
}

export async function getPendingPaymentSubmissionsForClient(
  clientId: string
): Promise<PaymentSubmissionRecord[]> {
  const filterByFormula = `AND(${formulaLinkedContains("client", clientId)}, {status} = "pending_review")`;
  const { records } = await listRecords<Record<string, unknown>>(TABLES.payment_submissions, {
    filterByFormula,
    sort: [{ field: "submitted_datetime", direction: "desc" }],
    _caller: "getPendingPaymentSubmissionsForClient",
  });
  return records.map(mapPaymentSubmission);
}

export async function getPaymentSubmissionById(
  submissionId: string
): Promise<PaymentSubmissionRecord> {
  const rec = await getRecord<Record<string, unknown>>(TABLES.payment_submissions, submissionId);
  return mapPaymentSubmission(rec);
}

export async function updatePaymentSubmissionReview(
  submissionId: string,
  data: UpdatePaymentSubmissionInput
): Promise<PaymentSubmissionRecord> {
  const fields: Record<string, unknown> = { status: data.status };
  if (data.admin_note !== undefined) {
    fields.admin_note = data.admin_note;
  }
  const rec = await updateRecord<Record<string, unknown>>(
    TABLES.payment_submissions,
    submissionId,
    fields
  );
  return mapPaymentSubmission(rec);
}

export async function updateBillingCycleStatus(
  cycleId: string,
  status: BillingCycleStatus
): Promise<BillingCycleRecord> {
  const rec = await updateRecord<Record<string, unknown>>(TABLES.billing_cycles, cycleId, { status });
  return mapBillingCycle(rec);
}

export async function getClientBillingCycles(clientId: string): Promise<BillingCycleRecord[]> {
  const records = await listAllRecords<Record<string, unknown>>(TABLES.billing_cycles, {
    sort: [{ field: "period_start", direction: "desc" }],
    _caller: "getClientBillingCycles",
  });

  return records
    .map(mapBillingCycle)
    .filter((cycle) => recordIncludesClient(cycle.client, clientId));
}

export async function getClientPaymentMethods(clientId: string): Promise<PaymentMethodRecord[]> {
  const filterByFormula = `AND({is_available} = TRUE(), OR({scope} = "global", ${formulaLinkedContains("client", clientId)}))`;
  const { records } = await listRecords<Record<string, unknown>>(TABLES.payment_methods, {
    filterByFormula,
    _caller: "getClientPaymentMethods",
  });
  return records.map(mapPaymentMethod);
}

export async function getClientInvoices(clientId: string): Promise<InvoiceRecord[]> {
  const records = await listAllRecords<Record<string, unknown>>(TABLES.invoices, {
    sort: [{ field: "sent_at", direction: "desc" }],
    _caller: "getClientInvoices",
  });

  return records
    .map(mapInvoice)
    .filter((invoice) => recordIncludesClient(invoice.client, clientId));
}

/** Enrich invoices with linked billing cycle period info. */
export async function getClientInvoicesEnriched(clientId: string): Promise<EnrichedInvoice[]> {
  const invoices = await getClientInvoices(clientId);
  const cycleIds = [...new Set(invoices.map((i) => i.billing_cycle[0]).filter(Boolean))];

  const cycleMap = new Map<string, BillingCycleRecord>();
  await Promise.all(
    cycleIds.map(async (cycleId) => {
      try {
        const rec = await getRecord<Record<string, unknown>>(TABLES.billing_cycles, cycleId);
        cycleMap.set(cycleId, mapBillingCycle(rec));
      } catch {
        /* cycle may have been deleted */
      }
    })
  );

  return invoices.map((invoice) => {
    const cycleId = invoice.billing_cycle[0];
    const cycle = cycleId ? cycleMap.get(cycleId) : undefined;
    return {
      ...invoice,
      billingCycleInfo: cycle
        ? {
            kind: cycle.kind,
            period_start: cycle.period_start,
            period_end: cycle.period_end,
            due_date: cycle.due_date,
          }
        : null,
    };
  });
}

export async function getClientModels(clientId: string): Promise<ClientModelRecord[]> {
  const [assignments, models] = await Promise.all([
    listAllRecords<Record<string, unknown>>(TABLES.client_models, {
      _caller: "getClientModels:assignments",
    }),
    listAllRecords<Record<string, unknown>>(TABLES.billing_models, {
      _caller: "getClientModels:models",
    }),
  ]);

  const modelNameById = new Map(models.map((m) => [m.id, String(m.fields.model_name ?? "")]));

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
    .filter((row) => recordIncludesClient(row.client, clientId));
}

export async function getLatestSubmissionForCycle(
  cycleId: string,
  clientId?: string
): Promise<PaymentSubmissionRecord | null> {
  const formulaParts = [formulaLinkedContains("billing_cycle", cycleId)];
  if (clientId) {
    formulaParts.push(formulaLinkedContains("client", clientId));
  }

  const { records } = await listRecords<Record<string, unknown>>(TABLES.payment_submissions, {
    filterByFormula: `AND(${formulaParts.join(", ")})`,
    sort: [{ field: "submitted_datetime", direction: "desc" }],
    pageSize: 1,
    _caller: "getLatestSubmissionForCycle",
  });

  const rec = records[0];
  return rec ? mapPaymentSubmission(rec) : null;
}

export async function getPaymentSubmissionsForClient(
  clientId: string
): Promise<PaymentSubmissionRecord[]> {
  const records = await listAllRecords<Record<string, unknown>>(TABLES.payment_submissions, {
    sort: [{ field: "submitted_datetime", direction: "desc" }],
    _caller: "getPaymentSubmissionsForClient",
  });

  return records
    .map(mapPaymentSubmission)
    .filter((sub) => recordIncludesClient(sub.client, clientId));
}

export async function createPaymentSubmission(
  data: CreatePaymentSubmissionInput
): Promise<PaymentSubmissionRecord> {
  const fields: Record<string, unknown> = {
    billing_cycle: data.billing_cycle,
    client: data.client,
    selected_payment_method: data.selected_payment_method,
    submitted_amount: data.submitted_amount,
    submitted_currency: data.submitted_currency,
    submitted_datetime: data.submitted_datetime,
    reference_id: data.reference_id,
    note: data.note,
    proof_url: data.proof_url,
    status: data.status,
  };
  if (data.proof_attachment?.length) {
    fields.proof_attachment = data.proof_attachment.map((a) => ({
      url: a.url,
      filename: a.filename,
    }));
  }
  const rec = await createRecord<Record<string, unknown>>(TABLES.payment_submissions, fields);
  return mapPaymentSubmission(rec);
}

export async function getCalendarEvents(clientId: string): Promise<CalendarEventRecord[]> {
  const filterByFormula = `OR({scope} = "global", ${formulaLinkedContains("client", clientId)})`;
  const records = await listAllRecords<Record<string, unknown>>(TABLES.calendar_events, {
    filterByFormula,
    sort: [{ field: "start_datetime", direction: "asc" }],
    _caller: "getCalendarEvents",
  });
  return records.map(mapCalendarEvent);
}

/** Billing cycles for a client with their latest submission attached. */
export async function getClientBillingCyclesWithSubmissions(
  clientId: string
): Promise<Array<BillingCycleRecord & { latestSubmission: PaymentSubmissionRecord | null }>> {
  const [cycles, submissions] = await Promise.all([
    getClientBillingCycles(clientId),
    getPaymentSubmissionsForClient(clientId),
  ]);

  const latestByCycle = new Map<string, PaymentSubmissionRecord>();
  for (const sub of submissions) {
    const cycleId = sub.billing_cycle[0];
    if (!cycleId) continue;
    const existing = latestByCycle.get(cycleId);
    if (
      !existing ||
      new Date(sub.submitted_datetime).getTime() > new Date(existing.submitted_datetime).getTime()
    ) {
      latestByCycle.set(cycleId, sub);
    }
  }

  return cycles.map((cycle) => ({
    ...cycle,
    latestSubmission: latestByCycle.get(cycle.id) ?? null,
  }));
}

/** Pending / overdue cycles that still accept payment. */
export function filterPayableCycles(cycles: BillingCycleRecord[]): BillingCycleRecord[] {
  const payableStatuses: BillingCycleStatus[] = ["announced", "overdue", "pending_review"];
  return cycles.filter((cycle) => {
    if (cycle.status === "draft" || cycle.status === "confirmed_paid") return false;
    if (!payableStatuses.includes(cycle.status)) return false;
    const amount = getCycleAmountDue(cycle);
    if (cycle.kind === "crm_monthly" && amount <= 0) return false;
    return true;
  });
}

export async function getModelById(modelId: string): Promise<ModelRecord | null> {
  try {
    const rec = await getRecord<Record<string, unknown>>(TABLES.billing_models, modelId);
    return mapModel(rec);
  } catch {
    return null;
  }
}

function mapBillingCycleRevenue(rec: AirtableRecord<Record<string, unknown>>): BillingCycleRevenueRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    billing_cycle: linkedRecordIds(f.billing_cycle),
    client: linkedRecordIds(f.client),
    model: linkedRecordIds(f.model),
    turnover_usd: typeof f.turnover_usd === "number" ? f.turnover_usd : 0,
    fee_percent: typeof f.fee_percent === "number" ? f.fee_percent : 0,
    fee_usd: typeof f.fee_usd === "number" ? f.fee_usd : undefined,
    status: typeof f.status === "string" ? (f.status as BillingCycleRevenueStatus) : undefined,
    created_at: typeof f.created_at === "string" ? f.created_at : undefined,
  };
}

function feeFromRevenue(r: BillingCycleRevenueRecord): number {
  return r.fee_usd ?? (r.turnover_usd ?? 0) * ((r.fee_percent ?? 0) / 100);
}

function filterPayableRevenues(
  revenues: BillingCycleRevenueRecord[],
  periodEnd: string
): BillingCycleRevenueRecord[] {
  const pastDeadline = isBillingOverdue(periodEnd);
  const result: BillingCycleRevenueRecord[] = [];
  for (const r of revenues) {
    const s = r.status ?? "draft";
    if (s === "announced" || s === "overdue") {
      result.push(r);
      if (s === "announced" && pastDeadline) {
        updateRecord<Record<string, unknown>>(TABLES.billing_cycle_revenues, r.id, {
          status: "overdue",
        }).catch(() => {});
      }
    }
  }
  return result;
}

async function listBillingCycleRevenuesForClientAndCycle(
  clientId: string,
  cycleId: string
): Promise<BillingCycleRevenueRecord[]> {
  const revenues = await getBillingCycleRevenues(cycleId);
  return revenues.filter((r) => r.client.includes(clientId));
}

async function listPayableRevenuesForClient(clientId: string): Promise<BillingCycleRevenueRecord[]> {
  const records = await listAllRecords<Record<string, unknown>>(TABLES.billing_cycle_revenues, {
    _caller: "listPayableRevenuesForClient",
  });
  return records
    .map(mapBillingCycleRevenue)
    .filter(
      (r) =>
        r.client.includes(clientId) &&
        (r.status === "announced" || r.status === "overdue")
    );
}

export async function getBillingCycleById(cycleId: string): Promise<BillingCycleRecord | null> {
  return getBillingCycleByIdFromBilling(cycleId);
}

export async function getClientCurrentBillingCycle(
  clientId: string,
  kind: BillingCycleKind
): Promise<BillingCycleRecord | null> {
  const cycles = await getClientBillingCycles(clientId);
  const matching = cycles
    .filter((c) => c.kind === kind && c.status !== "draft")
    .sort((a, b) => (b.period_end || b.due_date).localeCompare(a.period_end || a.due_date));

  const cycle = matching[0] ?? null;
  if (!cycle || kind !== "chatting_weekly" || !cycle.period_end) return cycle;

  const revenues = await listBillingCycleRevenuesForClientAndCycle(clientId, cycle.id);
  const payable = filterPayableRevenues(revenues, cycle.period_end);
  const amountDue = payable.reduce((sum, r) => sum + feeFromRevenue(r), 0);
  return { ...cycle, amount_due: amountDue };
}

export async function getClientCurrentChattingCycleFromRevenues(
  clientId: string,
  cycleIdHint?: string
): Promise<ChattingCycleResult | null> {
  const revenues = await listPayableRevenuesForClient(clientId);
  if (revenues.length === 0) return null;

  const cycleIdToRevenues = new Map<string, BillingCycleRevenueRecord[]>();
  for (const r of revenues) {
    const cid = r.billing_cycle[0];
    if (!cid) continue;
    const list = cycleIdToRevenues.get(cid) ?? [];
    list.push(r);
    cycleIdToRevenues.set(cid, list);
  }

  const cycleIds = Array.from(cycleIdToRevenues.keys());
  const cycleRecords = await Promise.all(cycleIds.map((id) => getBillingCycleByIdFromBilling(id)));
  const validCycles = cycleRecords.filter(
    (c): c is NonNullable<typeof c> => c != null && c.kind === "chatting_weekly"
  );
  if (validCycles.length === 0) return null;

  validCycles.sort((a, b) => (b.period_end || "").localeCompare(a.period_end || ""));
  let chosen = validCycles[0];
  if (cycleIdHint && cycleIdToRevenues.has(cycleIdHint)) {
    const hinted = validCycles.find((c) => c.id === cycleIdHint);
    if (hinted) chosen = hinted;
  }

  const payableRevenues = cycleIdToRevenues.get(chosen.id) ?? [];
  const amountDue = payableRevenues.reduce((sum, r) => sum + feeFromRevenue(r), 0);
  return {
    cycle: { ...chosen, amount_due: amountDue },
    payableRevenues,
  };
}

export async function getAllClientBillingModels(): Promise<ModelRecord[]> {
  return listAllBillingModels();
}

function getMonthKeyFromDate(dateString?: string): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getClientPartnershipAnalytics(
  clientId: string,
  monthKey: string
): Promise<GunzoPartnershipData> {
  const empty: GunzoPartnershipData = {
    weeks: [],
    weeklyPerModel: [],
    monthlyTotals: { turnoverUsd: 0, feeUsd: 0, crmUsd: 0 },
    monthlyPerModel: [],
    availableMonths2026: [],
    modelsForClient: [],
    bestModelOfMonthId: null,
    bestModelOfMonthName: null,
  };

  const [chattingCyclesAll, clientCycles, assignments, allModelsList] = await Promise.all([
    getAllBillingCycles(),
    getClientBillingCycles(clientId),
    getClientModels(clientId),
    listAllBillingModels(),
  ]);

  const modelMap = new Map(allModelsList.map((m) => [m.id, m.model_name]));
  const cycles2026 = chattingCyclesAll.filter((c) => {
    const key = getMonthKeyFromDate(c.period_start || c.due_date);
    return key != null && key.startsWith("2026");
  });
  const availableMonths2026 = Array.from(
    new Set(cycles2026.map((c) => getMonthKeyFromDate(c.period_start || c.due_date)).filter(Boolean))
  ) as string[];
  availableMonths2026.sort();

  const [y, m] = monthKey.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m)) return { ...empty, availableMonths2026 };

  const lastDay = lastDayOfMonth(y, m);
  const weekRanges: [string, string][] = [
    [`${monthKey}-01`, `${monthKey}-07`],
    [`${monthKey}-08`, `${monthKey}-14`],
    [`${monthKey}-15`, `${monthKey}-21`],
    [`${monthKey}-22`, lastDay],
  ];

  const chattingCyclesInMonth = chattingCyclesAll.filter((c) => {
    if (c.kind !== "chatting_weekly") return false;
    const key = getMonthKeyFromDate(c.period_start || c.due_date);
    return key === monthKey;
  });
  const cycleIdsForMonth = chattingCyclesInMonth.map((c) => c.id).filter(Boolean);
  const allRevenuesRaw =
    cycleIdsForMonth.length > 0
      ? await getBillingCycleRevenuesForCycles(cycleIdsForMonth)
      : [];
  const allRevenues = allRevenuesRaw.filter((r) => r.client.includes(clientId));

  const cycleIdByKey = new Map<string, string>();
  chattingCyclesInMonth.forEach((c) => {
    if (c.period_start && c.period_end) cycleIdByKey.set(`${c.period_start}|${c.period_end}`, c.id);
  });

  const revenuesByCycleId = new Map<string, BillingCycleRevenueRecord[]>();
  for (const r of allRevenues) {
    const cid = r.billing_cycle[0];
    if (!cid) continue;
    const list = revenuesByCycleId.get(cid) ?? [];
    list.push(r);
    revenuesByCycleId.set(cid, list);
  }

  const weeks = weekRanges.map(([start, end]) => {
    const cycleId = cycleIdByKey.get(`${start}|${end}`);
    const revs = cycleId ? (revenuesByCycleId.get(cycleId) ?? []) : [];
    const turnoverUsd = revs.reduce((s, r) => s + (r.turnover_usd ?? 0), 0);
    const feeUsd = revs.reduce((s, r) => s + feeFromRevenue(r), 0);
    let bestModelId: string | null = null;
    let bestTurnover = 0;
    revs.forEach((r) => {
      const t = r.turnover_usd ?? 0;
      if (t > bestTurnover) {
        bestTurnover = t;
        bestModelId = r.model[0] ?? null;
      }
    });
    return {
      start,
      end,
      turnoverUsd,
      feeUsd,
      bestModelId,
      bestModelName: bestModelId ? (modelMap.get(bestModelId) ?? null) : null,
    };
  });

  const assignedModelIds = assignments.flatMap((a) => a.model).filter(Boolean);
  const modelIdsFromRevenues = new Set(allRevenues.flatMap((r) => r.model).filter(Boolean));
  const uniqueModelIds = Array.from(
    new Set(assignedModelIds.length > 0 ? assignedModelIds : modelIdsFromRevenues)
  );

  const weeklyPerModel = uniqueModelIds.map((modelId) => {
    let w1 = 0,
      w2 = 0,
      w3 = 0,
      w4 = 0,
      monthTurnover = 0,
      monthFee = 0;
    weekRanges.forEach(([start, end], idx) => {
      const cycleId = cycleIdByKey.get(`${start}|${end}`);
      const revs = cycleId
        ? (revenuesByCycleId.get(cycleId) ?? []).filter((r) => r.model[0] === modelId)
        : [];
      const t = revs.reduce((s, r) => s + (r.turnover_usd ?? 0), 0);
      const f = revs.reduce((s, r) => s + feeFromRevenue(r), 0);
      if (idx === 0) w1 = t;
      else if (idx === 1) w2 = t;
      else if (idx === 2) w3 = t;
      else w4 = t;
      monthTurnover += t;
      monthFee += f;
    });
    return {
      modelId,
      modelName: modelMap.get(modelId) ?? "Unknown",
      week1TurnoverUsd: w1,
      week2TurnoverUsd: w2,
      week3TurnoverUsd: w3,
      week4TurnoverUsd: w4,
      monthTotalTurnoverUsd: monthTurnover,
      monthTotalFeeUsd: monthFee,
    };
  });
  weeklyPerModel.sort((a, b) => b.monthTotalTurnoverUsd - a.monthTotalTurnoverUsd);

  const turnoverUsd = weeks.reduce((s, w) => s + w.turnoverUsd, 0);
  const feeUsd = weeks.reduce((s, w) => s + w.feeUsd, 0);

  const crmCyclesInMonth = clientCycles.filter((c) => {
    if (c.kind !== "crm_monthly") return false;
    const key = getMonthKeyFromDate(c.period_start || c.due_date);
    return key === monthKey;
  });
  const crmUsd = crmCyclesInMonth.reduce((s, c) => s + getCycleAmountDue(c), 0);

  const monthlyPerModel = uniqueModelIds.map((modelId) => {
    let turnoverTotalUsd = 0;
    let feeTotalUsd = 0;
    let bestWeekStart: string | null = null;
    let bestWeekEnd: string | null = null;
    let bestWeekTurnoverUsd = 0;
    weekRanges.forEach(([start, end]) => {
      const cycleId = cycleIdByKey.get(`${start}|${end}`);
      const revs = cycleId
        ? (revenuesByCycleId.get(cycleId) ?? []).filter((r) => r.model[0] === modelId)
        : [];
      const t = revs.reduce((s, r) => s + (r.turnover_usd ?? 0), 0);
      const f = revs.reduce((s, r) => s + feeFromRevenue(r), 0);
      turnoverTotalUsd += t;
      feeTotalUsd += f;
      if (t > bestWeekTurnoverUsd) {
        bestWeekTurnoverUsd = t;
        bestWeekStart = start;
        bestWeekEnd = end;
      }
    });
    return {
      modelId,
      modelName: modelMap.get(modelId) ?? "Unknown",
      turnoverTotalUsd,
      feeTotalUsd,
      bestWeekStart,
      bestWeekEnd,
      bestWeekTurnoverUsd,
    };
  });
  monthlyPerModel.sort((a, b) => b.turnoverTotalUsd - a.turnoverTotalUsd);

  const bestModelOfMonth = monthlyPerModel[0] ?? null;

  return {
    weeks,
    weeklyPerModel,
    monthlyTotals: { turnoverUsd, feeUsd, crmUsd },
    monthlyPerModel,
    availableMonths2026,
    modelsForClient: uniqueModelIds.map((id) => ({ id, name: modelMap.get(id) ?? "Unknown" })),
    bestModelOfMonthId: bestModelOfMonth?.modelId ?? null,
    bestModelOfMonthName: bestModelOfMonth?.modelName ?? null,
  };
}

export async function getClientAttentionItems(clientId: string): Promise<ClientAttentionItem[]> {
  const [invoices, billingCycles, submissions] = await Promise.all([
    getClientInvoices(clientId),
    getClientBillingCycles(clientId),
    getPaymentSubmissionsForClient(clientId),
  ]);

  const items: ClientAttentionItem[] = [];
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  billingCycles
    .filter((cycle) => {
      const dueDate = new Date(cycle.due_date);
      return (
        dueDate >= now &&
        dueDate <= threeDaysFromNow &&
        ["announced", "overdue", "pending_review"].includes(cycle.status) &&
        !cycle.client_notified_at
      );
    })
    .forEach((cycle) => {
      items.push({
        id: `due-${cycle.id}`,
        type: "payment_due",
        recordId: cycle.id,
        severity: cycle.status === "overdue" ? "high" : "medium",
        title: "Payment due soon",
        description: `${cycle.kind === "chatting_weekly" ? "Chatting" : "CRM"} payment due ${formatDateEuropean(cycle.due_date)}`,
        link:
          cycle.kind === "chatting_weekly" ? "/client/pay-chatting" : "/client/pay-crm",
      });
    });

  submissions
    .filter((s) => s.status === "rejected")
    .forEach((submission) => {
      const kind =
        billingCycles.find((c) => c.id === submission.billing_cycle[0])?.kind ?? "chatting_weekly";
      items.push({
        id: `rejected-${submission.id}`,
        type: "proof_rejected",
        recordId: submission.id,
        severity: "high",
        title: "Payment proof rejected",
        description: "Your payment proof needs attention. Please review and resubmit.",
        link: kind === "chatting_weekly" ? "/client/pay-chatting" : "/client/pay-crm",
      });
    });

  submissions
    .filter((s) => s.status === "pending_review")
    .forEach((submission) => {
      const kind =
        billingCycles.find((c) => c.id === submission.billing_cycle[0])?.kind ?? "chatting_weekly";
      items.push({
        id: `pending-${submission.id}`,
        type: "proof_pending",
        recordId: submission.id,
        severity: "low",
        title: "Payment proof pending review",
        description: "Your payment proof is being reviewed.",
        link: kind === "chatting_weekly" ? "/client/pay-chatting" : "/client/pay-crm",
      });
    });

  invoices
    .filter((invoice) => {
      const sentDate = invoice.sent_at ? new Date(invoice.sent_at) : null;
      if (!sentDate) return false;
      return sentDate >= fourteenDaysAgo && !invoice.viewed_at;
    })
    .slice(0, 3)
    .forEach((invoice) => {
      items.push({
        id: `invoice-${invoice.id}`,
        type: "invoice",
        recordId: invoice.id,
        severity: "low",
        title: "New invoice available",
        description: `Invoice #${invoice.invoice_number || invoice.id.slice(0, 8)}`,
        link: "/client/invoices",
      });
    });

  const severityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return items.slice(0, 5);
}

export async function getClientUnreadCounts(clientId: string): Promise<{ invoices: number }> {
  const invoices = await getClientInvoices(clientId);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const unreadInvoices = invoices.filter((invoice) => {
    const sentDate = invoice.sent_at ? new Date(invoice.sent_at) : null;
    if (!sentDate) return false;
    return sentDate >= fourteenDaysAgo && !invoice.viewed_at;
  });
  return { invoices: unreadInvoices.length };
}

export async function markInvoiceAsViewed(invoiceId: string): Promise<void> {
  await updateRecord<Record<string, unknown>>(TABLES.invoices, invoiceId, {
    viewed_at: new Date().toISOString(),
  });
}

export async function markSubmissionAsSeen(_submissionId: string): Promise<void> {
  /* client_seen_at field optional — no-op if absent */
}

export async function markBillingCycleAsNotified(cycleId: string): Promise<void> {
  await updateRecord<Record<string, unknown>>(TABLES.billing_cycles, cycleId, {
    client_notified_at: new Date().toISOString(),
  }).catch(() => {});
}

export async function submitClientPaymentProof(
  clientId: string,
  data: {
    billing_cycle_id: string;
    payment_method_id: string;
    amount: number;
    currency: string;
    datetime: string;
    notes?: string;
    proof_url?: string;
    proof_attachment?: Array<{ url: string; filename?: string }>;
  }
): Promise<{ submissionId: string; alreadySubmitted: boolean }> {
  const billingCycleId = data.billing_cycle_id;
  const existing = await getLatestSubmissionForCycle(billingCycleId, clientId);
  if (existing && existing.status !== "rejected") {
    return { submissionId: existing.id, alreadySubmitted: true };
  }

  const cycle = await getBillingCycleByIdFromBilling(billingCycleId);
  if (cycle) {
    const hasPending =
      cycle.status === "pending_review" || cycle.status === "confirmed_paid";
    if (hasPending) {
      return { submissionId: existing?.id ?? billingCycleId, alreadySubmitted: true };
    }
  }

  const submission = await createPaymentSubmission({
    billing_cycle: [billingCycleId],
    client: [clientId],
    selected_payment_method: [data.payment_method_id],
    submitted_amount: data.amount,
    submitted_currency: data.currency,
    submitted_datetime: data.datetime,
    note: data.notes,
    proof_url: data.proof_url,
    proof_attachment: data.proof_attachment,
    status: "pending_review",
  });

  if (cycle?.kind === "chatting_weekly") {
    await updateRevenuesStatusForClientAndCycle(
      clientId,
      billingCycleId,
      ["announced", "overdue"],
      "pending_review"
    ).catch(() => {});
  } else if (cycle?.kind === "crm_monthly") {
    await updateBillingCycleRecord(billingCycleId, { status: "pending_review" }).catch(() => {});
  }

  return { submissionId: submission.id, alreadySubmitted: false };
}

export type { GunzoPartnershipData, ClientAttentionItem, ChattingCycleResult };
