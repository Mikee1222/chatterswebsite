/**
 * Supabase backend for services/client-portal.ts
 *
 * Delegates to dual-backed client-billing where possible; direct table CRUD
 * for the sub-tables that only client-portal touches.
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
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

const CLIENTS = "clients";
const CYCLES = "billing_cycles";
const REVENUES = "billing_cycle_revenues";
const SUBMISSIONS = "payment_submissions";
const METHODS = "payment_methods";
const INVOICES = "invoices";
const CLIENT_MODELS = "client_models";
const BILLING_MODELS = "modelss";
const CALENDAR = "calendar_events";

const TEAM_ROLES: ClientTeamRole[] = ["admin", "manager", "chatter", "virtual_assistant"];

type ClientRow = SbRow & {
  company_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  status?: string | null;
  user_type?: string | null;
  role?: string | null;
  client_percentage?: number | null;
  net_profit_goal?: number | null;
  portal_access?: boolean | null;
  telegram_group_link?: string | null;
  telegram_group_name?: string | null;
  password?: string | null;
};

type CycleRow = SbRow & {
  client?: string[] | null;
  kind?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  due_date?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  amount_due?: number | null;
  amount_crm?: number | null;
  total_fee_usd?: number | null;
  total_turnover_usd?: number | null;
  client_notified_at?: string | null;
  created_at?: string | null;
};

type RevenueRow = SbRow & {
  billing_cycle?: string[] | null;
  client?: string[] | null;
  model?: string[] | null;
  turnover_usd?: number | null;
  fee_percent?: number | null;
  fee_usd?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type SubmissionRow = SbRow & {
  billing_cycle?: string[] | null;
  client?: string[] | null;
  selected_payment_method?: string[] | null;
  submitted_amount?: number | null;
  submitted_currency?: string | null;
  submitted_datetime?: string | null;
  reference_id?: string | null;
  note?: string | null;
  proof_url?: string | null;
  proof_attachment?: Array<{ url?: string; filename?: string }> | null;
  status?: string | null;
  admin_note?: string | null;
};

type MethodRow = SbRow & {
  type?: string | null;
  label?: string | null;
  details?: string | null;
  network?: string | null;
  is_available?: boolean | null;
  scope?: string | null;
  client?: string[] | null;
  open_url?: string | null;
  fallback_url?: string | null;
  beneficiary?: string | null;
  iban?: string | null;
  bic?: string | null;
  wallet_address?: string | null;
};

type InvoiceRow = SbRow & {
  billing_cycle?: string[] | null;
  client?: string[] | null;
  invoice_number?: string | null;
  sent_to_email?: string | null;
  sent_at?: string | null;
  attachment?: Array<{ url?: string; filename?: string }> | null;
  viewed_at?: string | null;
};

type ClientModelRow = SbRow & {
  client?: string[] | null;
  model?: string[] | null;
};

type ModelRow = SbRow & {
  model_name?: string | null;
  model_id?: string | null;
  status?: string | null;
  platform?: string | null;
};

type CalendarRow = SbRow & {
  title?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  notes?: string | null;
  scope?: string | null;
  client?: string[] | null;
};

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

function mapClient(row: ClientRow): ClientRecord {
  return {
    id: publicId(row),
    company_name: row.company_name ?? "",
    display_name: row.display_name ?? "",
    email: row.email ?? "",
    status: (row.status as ClientRecord["status"]) ?? "inactive",
    user_type: mapUserType(row.user_type),
    role: mapTeamRole(row.role),
    client_percentage: typeof row.client_percentage === "number" ? row.client_percentage : undefined,
    net_profit_goal: typeof row.net_profit_goal === "number" ? row.net_profit_goal : undefined,
  };
}

function mapAdminClient(row: ClientRow): AdminClientRecord {
  return {
    ...mapClient(row),
    portal_access: row.portal_access !== false,
    telegram_group_link: typeof row.telegram_group_link === "string" ? row.telegram_group_link : undefined,
    telegram_group_name: typeof row.telegram_group_name === "string" ? row.telegram_group_name : undefined,
  };
}

function mapBillingCycle(row: CycleRow): BillingCycleRecord {
  return {
    id: publicId(row),
    client: (row.client ?? []) as string[],
    kind: (row.kind as BillingCycleRecord["kind"]) ?? "chatting_weekly",
    period_start: row.period_start ?? "",
    period_end: row.period_end ?? "",
    due_date: row.due_date ?? "",
    amount: typeof row.amount === "number" ? row.amount : 0,
    currency: row.currency ?? "USD",
    status: (row.status as BillingCycleStatus) ?? "draft",
    amount_due: typeof row.amount_due === "number" ? row.amount_due : undefined,
    amount_crm: typeof row.amount_crm === "number" ? row.amount_crm : undefined,
    total_fee_usd: typeof row.total_fee_usd === "number" ? row.total_fee_usd : undefined,
    total_turnover_usd: typeof row.total_turnover_usd === "number" ? row.total_turnover_usd : undefined,
    client_notified_at: typeof row.client_notified_at === "string" ? row.client_notified_at : undefined,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function mapRevenue(row: RevenueRow): BillingCycleRevenueRecord {
  return {
    id: publicId(row),
    billing_cycle: (row.billing_cycle ?? []) as string[],
    client: (row.client ?? []) as string[],
    model: (row.model ?? []) as string[],
    turnover_usd: typeof row.turnover_usd === "number" ? row.turnover_usd : 0,
    fee_percent: typeof row.fee_percent === "number" ? row.fee_percent : 0,
    fee_usd: typeof row.fee_usd === "number" ? row.fee_usd : undefined,
    status: typeof row.status === "string" ? (row.status as BillingCycleRevenueStatus) : undefined,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function mapMethod(row: MethodRow): PaymentMethodRecord {
  return {
    id: publicId(row),
    type: row.type ?? "",
    label: row.label ?? "",
    details: row.details ?? "",
    network: typeof row.network === "string" ? row.network : undefined,
    is_available: Boolean(row.is_available),
    scope: row.scope ?? "",
    client: (row.client ?? []) as string[],
    open_url: typeof row.open_url === "string" ? row.open_url : undefined,
    fallback_url: typeof row.fallback_url === "string" ? row.fallback_url : undefined,
    beneficiary: typeof row.beneficiary === "string" ? row.beneficiary : undefined,
    iban: typeof row.iban === "string" ? row.iban : undefined,
    bic: typeof row.bic === "string" ? row.bic : undefined,
    wallet_address: typeof row.wallet_address === "string" ? row.wallet_address : undefined,
  };
}

function mapSubmission(row: SubmissionRow): PaymentSubmissionRecord {
  const proofAttachment = Array.isArray(row.proof_attachment)
    ? row.proof_attachment
        .filter((a) => typeof a.url === "string")
        .map((a) => ({ url: a.url as string, filename: a.filename }))
    : undefined;
  return {
    id: publicId(row),
    billing_cycle: (row.billing_cycle ?? []) as string[],
    client: (row.client ?? []) as string[],
    selected_payment_method: (row.selected_payment_method ?? []) as string[],
    submitted_amount: typeof row.submitted_amount === "number" ? row.submitted_amount : 0,
    submitted_currency: row.submitted_currency ?? "",
    submitted_datetime: row.submitted_datetime ?? "",
    reference_id: typeof row.reference_id === "string" ? row.reference_id : undefined,
    note: typeof row.note === "string" ? row.note : undefined,
    proof_url: typeof row.proof_url === "string" ? row.proof_url : undefined,
    proof_attachment: proofAttachment,
    status: (row.status as PaymentSubmissionRecord["status"]) ?? "pending_review",
    admin_note: typeof row.admin_note === "string" ? row.admin_note : undefined,
  };
}

function mapInvoice(row: InvoiceRow): InvoiceRecord {
  const attachment = Array.isArray(row.attachment)
    ? row.attachment.filter((a) => typeof a.url === "string").map((a) => ({ url: a.url as string, filename: a.filename }))
    : undefined;
  return {
    id: publicId(row),
    billing_cycle: (row.billing_cycle ?? []) as string[],
    client: (row.client ?? []) as string[],
    invoice_number: typeof row.invoice_number === "string" ? row.invoice_number : undefined,
    sent_to_email: typeof row.sent_to_email === "string" ? row.sent_to_email : undefined,
    sent_at: typeof row.sent_at === "string" ? row.sent_at : undefined,
    attachment,
    viewed_at: typeof row.viewed_at === "string" ? row.viewed_at : undefined,
  };
}

function mapModelRow(row: ModelRow): ModelRecord {
  return {
    id: publicId(row),
    model_name: row.model_name ?? "",
    status: row.status ?? "active",
    platform: typeof row.platform === "string" ? row.platform : undefined,
  };
}

function mapCalendar(row: CalendarRow): CalendarEventRecord {
  return {
    id: publicId(row),
    title: row.title ?? "",
    start_datetime: row.start_datetime ?? "",
    end_datetime: row.end_datetime ?? "",
    notes: typeof row.notes === "string" ? row.notes : undefined,
    scope: row.scope ?? "global",
    client: (row.client ?? []) as string[],
  };
}

function recordIncludesClient(clientField: string[] | null | undefined, clientId: string): boolean {
  return (clientField ?? []).includes(clientId);
}

/** clientId may be an Airtable rec id or a uuid; resolve to the linked-field value used in tables. */
async function resolveClientLinkedIds(clientId: string): Promise<string[]> {
  const trimmed = clientId.trim();
  if (!trimmed) return [];
  // The linked column stores UUIDs of the target row. If we were given an Airtable rec id,
  // find the client row and use its uuid.
  const row = await sbSelectByPublicId<ClientRow>(CLIENTS, trimmed);
  if (!row) return [trimmed];
  return Array.from(new Set([row.id, ...(row.airtable_id ? [row.airtable_id] : []), trimmed]));
}

export async function getClientById(clientId: string): Promise<ClientRecord> {
  const row = await sbSelectByPublicId<ClientRow>(CLIENTS, clientId);
  if (!row) throw new Error("Client not found");
  return mapClient(row);
}

export async function getAdminClientById(clientId: string): Promise<AdminClientRecord> {
  const row = await sbSelectByPublicId<ClientRow>(CLIENTS, clientId);
  if (!row) throw new Error("Client not found");
  return mapAdminClient(row);
}

export async function listAllClients(activeOnly = false): Promise<AdminClientRecord[]> {
  const rows = await sbSelectAll<ClientRow>(CLIENTS);
  const filtered = activeOnly ? rows.filter((r) => (r.status ?? "") === "active") : rows;
  return filtered
    .map(mapAdminClient)
    .sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));
}

export const getCachedListAllClients = async (activeOnly: boolean) => listAllClients(activeOnly);
export const getAllClients = listAllClients;

export async function createAdminClient(data: CreateAdminClientInput): Promise<AdminClientRecord> {
  const insert: Record<string, unknown> = {
    display_name: data.display_name.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.passwordHash,
    user_type: data.user_type,
    status: data.status,
    portal_access: data.user_type === "client",
  };
  if (data.user_type === "client") {
    if (data.company_name?.trim()) insert.company_name = data.company_name.trim();
    if (typeof data.client_percentage === "number") insert.client_percentage = data.client_percentage;
  } else if (data.role) {
    insert.role = data.role;
  }
  const row = await sbInsert<ClientRow>(CLIENTS, insert);
  return mapAdminClient(row);
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
  const patch: Record<string, unknown> = {};
  if (data.portal_access !== undefined) patch.portal_access = data.portal_access;
  if (data.company_name !== undefined) patch.company_name = data.company_name.trim();
  if (data.display_name !== undefined) patch.display_name = data.display_name.trim();
  if (data.email !== undefined) patch.email = data.email.trim().toLowerCase();
  if (typeof data.client_percentage === "number") patch.client_percentage = data.client_percentage;
  if (data.status !== undefined) patch.status = data.status;
  if (data.passwordHash) patch.password = data.passwordHash;
  if (data.telegram_group_link !== undefined) patch.telegram_group_link = data.telegram_group_link;
  if (data.telegram_group_name !== undefined) patch.telegram_group_name = data.telegram_group_name;
  const row = await sbUpdateByPublicId<ClientRow>(CLIENTS, clientId, patch);
  return mapAdminClient(row);
}

export async function createClientModelAssignment(
  clientId: string,
  modelId: string
): Promise<ClientModelRecord> {
  const row = await sbInsert<ClientModelRow>(CLIENT_MODELS, {
    client: [clientId],
    model: [modelId],
  });
  let modelName: string | undefined;
  try {
    const m = await sbSelectByPublicId<ModelRow>(BILLING_MODELS, modelId);
    modelName = m?.model_name ?? undefined;
  } catch {
    /* model may be missing */
  }
  return {
    id: publicId(row),
    client: (row.client ?? []) as string[],
    model: (row.model ?? []) as string[],
    model_name: modelName,
  };
}

export async function deleteClientModelAssignment(assignmentId: string): Promise<void> {
  await sbDeleteByPublicId(CLIENT_MODELS, assignmentId);
}

export async function getClientModelAssignmentsForModel(modelId: string): Promise<ClientModelRecord[]> {
  const rows = await sbSelectAll<ClientModelRow>(CLIENT_MODELS);
  return rows
    .filter((r) => (r.model ?? []).includes(modelId))
    .map((r) => ({
      id: publicId(r),
      client: (r.client ?? []) as string[],
      model: (r.model ?? []) as string[],
      model_name: "",
    }));
}

export async function createBillingCycleForClient(
  clientId: string,
  data: CreateBillingCycleInput
): Promise<BillingCycleRecord> {
  const insert: Record<string, unknown> = {
    client: [clientId],
    kind: data.kind,
    period_start: data.period_start,
    period_end: data.period_end,
    due_date: data.due_date,
    amount: data.amount,
    currency: data.currency,
    status: "draft",
  };
  if (data.kind === "crm_monthly") insert.amount_crm = data.amount;
  const row = await sbInsert<CycleRow>(CYCLES, insert);
  return mapBillingCycle(row);
}

export async function getPendingPaymentSubmissionsForClient(
  clientId: string
): Promise<PaymentSubmissionRecord[]> {
  const linked = await resolveClientLinkedIds(clientId);
  const rows = await sbSelectAll<SubmissionRow>(SUBMISSIONS);
  return rows
    .map(mapSubmission)
    .filter((s) => s.client.some((c) => linked.includes(c)) && s.status === "pending_review")
    .sort((a, b) => (a.submitted_datetime < b.submitted_datetime ? 1 : -1));
}

export async function getPaymentSubmissionById(
  submissionId: string
): Promise<PaymentSubmissionRecord> {
  const row = await sbSelectByPublicId<SubmissionRow>(SUBMISSIONS, submissionId);
  if (!row) throw new Error("Payment submission not found");
  return mapSubmission(row);
}

export async function updatePaymentSubmissionReview(
  submissionId: string,
  data: UpdatePaymentSubmissionInput
): Promise<PaymentSubmissionRecord> {
  const patch: Record<string, unknown> = { status: data.status };
  if (data.admin_note !== undefined) patch.admin_note = data.admin_note;
  const row = await sbUpdateByPublicId<SubmissionRow>(SUBMISSIONS, submissionId, patch);
  return { ...mapSubmission(row), status: data.status as PaymentSubmissionRecord["status"] };
}

export async function updateBillingCycleStatus(
  cycleId: string,
  status: BillingCycleStatus
): Promise<BillingCycleRecord> {
  const row = await sbUpdateByPublicId<CycleRow>(CYCLES, cycleId, { status });
  return mapBillingCycle(row);
}

export async function getClientBillingCycles(clientId: string): Promise<BillingCycleRecord[]> {
  const linked = await resolveClientLinkedIds(clientId);
  const [cycleRows, revenueRows] = await Promise.all([
    sbSelectAll<CycleRow>(CYCLES),
    sbSelectAll<RevenueRow>(REVENUES),
  ]);
  const cycleUuidsFromRevenues = new Set<string>();
  for (const r of revenueRows) {
    if (!(r.client ?? []).some((c) => linked.includes(c))) continue;
    for (const cycleUuid of r.billing_cycle ?? []) cycleUuidsFromRevenues.add(cycleUuid);
  }
  const cycleAirtableFromRevenues = new Set<string>();
  if (cycleUuidsFromRevenues.size > 0) {
    for (const c of cycleRows) {
      if (cycleUuidsFromRevenues.has(c.id) && c.airtable_id) cycleAirtableFromRevenues.add(c.airtable_id);
    }
  }
  const cycles = cycleRows.map(mapBillingCycle);
  return cycles
    .filter(
      (cycle) =>
        cycle.client.some((c) => linked.includes(c)) ||
        cycleAirtableFromRevenues.has(cycle.id) ||
        cycleUuidsFromRevenues.has(cycle.id)
    )
    .sort((a, b) => (a.period_start < b.period_start ? 1 : -1));
}

export async function getClientPaymentMethods(clientId: string): Promise<PaymentMethodRecord[]> {
  const linked = await resolveClientLinkedIds(clientId);
  const rows = await sbSelectAll<MethodRow>(METHODS);
  return rows
    .filter(
      (r) =>
        r.is_available === true &&
        ((r.scope ?? "") === "global" || (r.client ?? []).some((c) => linked.includes(c)))
    )
    .map(mapMethod);
}

export async function getClientInvoices(clientId: string): Promise<InvoiceRecord[]> {
  const linked = await resolveClientLinkedIds(clientId);
  const rows = await sbSelectAll<InvoiceRow>(INVOICES);
  return rows
    .map(mapInvoice)
    .filter((invoice) => invoice.client.some((c) => linked.includes(c)))
    .sort((a, b) => ((a.sent_at ?? "") < (b.sent_at ?? "") ? 1 : -1));
}

export async function getClientInvoicesEnriched(clientId: string): Promise<EnrichedInvoice[]> {
  const invoices = await getClientInvoices(clientId);
  const cycleIds = [...new Set(invoices.map((i) => i.billing_cycle[0]).filter(Boolean) as string[])];
  const cycleMap = new Map<string, BillingCycleRecord>();
  await Promise.all(
    cycleIds.map(async (cycleId) => {
      try {
        const cycle = await getBillingCycleByIdFromBilling(cycleId);
        if (cycle) cycleMap.set(cycleId, cycle);
      } catch {
        /* skip missing */
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
  const linked = await resolveClientLinkedIds(clientId);
  const [assignments, models] = await Promise.all([
    sbSelectAll<ClientModelRow>(CLIENT_MODELS),
    sbSelectAll<ModelRow>(BILLING_MODELS),
  ]);
  const modelNameById = new Map(models.map((m) => [m.id, m.model_name ?? ""]));
  const airtableToUuid = new Map<string, string>();
  for (const m of models) {
    if (m.airtable_id) airtableToUuid.set(m.airtable_id, m.id);
  }
  return assignments
    .filter((rec) => (rec.client ?? []).some((c) => linked.includes(c)))
    .map((rec) => {
      const modelUuids = rec.model ?? [];
      const modelId = modelUuids[0];
      return {
        id: publicId(rec),
        client: (rec.client ?? []) as string[],
        model: modelUuids,
        model_name: modelId ? modelNameById.get(modelId) : undefined,
      };
    });
}

export async function getLatestSubmissionForCycle(
  cycleId: string,
  clientId?: string
): Promise<PaymentSubmissionRecord | null> {
  const linked = clientId ? await resolveClientLinkedIds(clientId) : [];
  const rows = await sbSelectAll<SubmissionRow>(SUBMISSIONS);
  const filtered = rows
    .filter((r) => (r.billing_cycle ?? []).includes(cycleId))
    .filter((r) => !clientId || (r.client ?? []).some((c) => linked.includes(c)))
    .sort((a, b) => ((a.submitted_datetime ?? "") < (b.submitted_datetime ?? "") ? 1 : -1));
  return filtered[0] ? mapSubmission(filtered[0]) : null;
}

export async function getPaymentSubmissionsForClient(
  clientId: string
): Promise<PaymentSubmissionRecord[]> {
  const linked = await resolveClientLinkedIds(clientId);
  const rows = await sbSelectAll<SubmissionRow>(SUBMISSIONS);
  return rows
    .map(mapSubmission)
    .filter((sub) => sub.client.some((c) => linked.includes(c)))
    .sort((a, b) => (a.submitted_datetime < b.submitted_datetime ? 1 : -1));
}

export async function createPaymentSubmission(
  data: CreatePaymentSubmissionInput
): Promise<PaymentSubmissionRecord> {
  const insert: Record<string, unknown> = {
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
    insert.proof_attachment = data.proof_attachment.map((a) => ({ url: a.url, filename: a.filename }));
  }
  const row = await sbInsert<SubmissionRow>(SUBMISSIONS, insert);
  return mapSubmission(row);
}

export async function getCalendarEvents(clientId: string): Promise<CalendarEventRecord[]> {
  const linked = await resolveClientLinkedIds(clientId);
  const rows = await sbSelectAll<CalendarRow>(CALENDAR);
  return rows
    .filter((r) => (r.scope ?? "") === "global" || (r.client ?? []).some((c) => linked.includes(c)))
    .map(mapCalendar)
    .sort((a, b) => (a.start_datetime < b.start_datetime ? -1 : 1));
}

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
  return cycles.map((cycle) => ({ ...cycle, latestSubmission: latestByCycle.get(cycle.id) ?? null }));
}

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
    const row = await sbSelectByPublicId<ModelRow>(BILLING_MODELS, modelId);
    return row ? mapModelRow(row) : null;
  } catch {
    return null;
  }
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
    if (s === "announced" || s === "overdue" || s === "pending_review") {
      result.push(r);
      if (s === "announced" && pastDeadline) {
        void (async () => {
          try {
            await sbUpdateByPublicId(REVENUES, r.id, { status: "overdue" });
          } catch {
            /* ignore */
          }
        })();
      }
    }
  }
  return result;
}

async function listBillingCycleRevenuesForClientAndCycle(
  clientId: string,
  cycleId: string
): Promise<BillingCycleRevenueRecord[]> {
  const linked = await resolveClientLinkedIds(clientId);
  const revenues = await getBillingCycleRevenues(cycleId);
  return revenues.filter((r) => r.client.some((c) => linked.includes(c)));
}

async function listPayableRevenuesForClient(clientId: string): Promise<BillingCycleRevenueRecord[]> {
  const linked = await resolveClientLinkedIds(clientId);
  const rows = await sbSelectAll<RevenueRow>(REVENUES);
  return rows
    .map(mapRevenue)
    .filter(
      (r) =>
        r.client.some((c) => linked.includes(c)) &&
        (r.status === "announced" || r.status === "overdue" || r.status === "pending_review")
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
  let chosen = validCycles[0]!;
  if (cycleIdHint && cycleIdToRevenues.has(cycleIdHint)) {
    const hinted = validCycles.find((c) => c.id === cycleIdHint);
    if (hinted) chosen = hinted;
  }
  const payableRevenues = cycleIdToRevenues.get(chosen.id) ?? [];
  const amountDue = payableRevenues.reduce((sum, r) => sum + feeFromRevenue(r), 0);
  return { cycle: { ...chosen, amount_due: amountDue }, payableRevenues };
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

  const linked = await resolveClientLinkedIds(clientId);

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

  const [yStr, mStr] = monthKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
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
    cycleIdsForMonth.length > 0 ? await getBillingCycleRevenuesForCycles(cycleIdsForMonth) : [];
  const allRevenues = allRevenuesRaw.filter((r) => r.client.some((c) => linked.includes(c)));

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
    const revs = cycleId ? revenuesByCycleId.get(cycleId) ?? [] : [];
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
      bestModelName: bestModelId ? modelMap.get(bestModelId) ?? null : null,
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
        title: "\u23F0 Payment Due Soon",
        description: `${cycle.kind === "chatting_weekly" ? "Chatting" : "CRM"} payment due ${formatDateEuropean(cycle.due_date)}`,
        link: cycle.kind === "chatting_weekly" ? "/client/pay-chatting" : "/client/pay-crm",
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
        title: "\u274C Payment Proof Rejected",
        description: "Your payment proof needs attention. Please review and resubmit.",
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
        title: "\uD83D\uDCC4 New Invoice Available",
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
  await sbUpdateByPublicId(INVOICES, invoiceId, { viewed_at: new Date().toISOString() });
}

export async function markSubmissionAsSeen(_submissionId: string): Promise<void> {
  /* no-op: client_seen_at optional */
}

export async function markBillingCycleAsNotified(cycleId: string): Promise<void> {
  try {
    await sbUpdateByPublicId(CYCLES, cycleId, { client_notified_at: new Date().toISOString() });
  } catch {
    /* swallow */
  }
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
    const hasPending = cycle.status === "pending_review" || cycle.status === "confirmed_paid";
    if (hasPending) return { submissionId: existing?.id ?? billingCycleId, alreadySubmitted: true };
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
    );
  } else if (cycle?.kind === "crm_monthly") {
    await updateBillingCycleRecord(billingCycleId, { status: "pending_review" });
  }
  return { submissionId: submission.id, alreadySubmitted: false };
}

void recordIncludesClient;
void getSupabaseServiceClient;
