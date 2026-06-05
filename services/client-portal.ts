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
import { getCycleAmountDue } from "@/lib/client-portal-utils";
import type {
  AdminClientRecord,
  BillingCycleRecord,
  BillingCycleStatus,
  CalendarEventRecord,
  ClientModelRecord,
  ClientRecord,
  ClientStatus,
  ClientTeamRole,
  ClientUserType,
  CreateAdminClientInput,
  CreateBillingCycleInput,
  CreatePaymentSubmissionInput,
  EnrichedInvoice,
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
  models: "modelss",
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
    const modelRec = await getRecord<Record<string, unknown>>(TABLES.models, modelId);
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
    listAllRecords<Record<string, unknown>>(TABLES.models, {
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
  const rec = await createRecord<Record<string, unknown>>(TABLES.payment_submissions, {
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
  });
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
    const rec = await getRecord<Record<string, unknown>>(TABLES.models, modelId);
    return mapModel(rec);
  } catch {
    return null;
  }
}
