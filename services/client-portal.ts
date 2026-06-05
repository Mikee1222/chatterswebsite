import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import {
  formulaLinkedContains,
  linkedRecordIds,
} from "@/lib/airtable-linked";
import { getCycleAmountDue } from "@/lib/client-portal-utils";
import type {
  BillingCycleRecord,
  BillingCycleStatus,
  CalendarEventRecord,
  ClientModelRecord,
  ClientRecord,
  CreatePaymentSubmissionInput,
  EnrichedInvoice,
  InvoiceRecord,
  ModelRecord,
  PaymentMethodRecord,
  PaymentSubmissionRecord,
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
  models: "models",
  calendar_events: "calendar_events",
} as const;

function mapClient(rec: AirtableRecord<Record<string, unknown>>): ClientRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    company_name: String(f.company_name ?? ""),
    display_name: String(f.display_name ?? ""),
    email: String(f.email ?? ""),
    status: (f.status as ClientRecord["status"]) ?? "inactive",
    client_percentage: typeof f.client_percentage === "number" ? f.client_percentage : undefined,
    net_profit_goal: typeof f.net_profit_goal === "number" ? f.net_profit_goal : undefined,
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
