import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AdminPartnershipClient } from "@/components/admin-partnership-client";
import {
  getAllPaymentSubmissions,
  getBillingCycleRevenuesForCycles,
  getPartnerBillingCycles,
  listAllBillingModels,
  getCachedBillingClients,
} from "@/services/client-billing";
import type {
  BillingClientRecord,
  BillingCycleRecord,
  BillingCycleRevenueRecord,
  PaymentSubmissionRecord,
} from "@/services/client-billing";
import type { ModelRecord } from "@/types/client-portal";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  month?: string;
  view?: string;
  client?: string;
  model?: string;
  rollup?: string;
  status?: string;
}>;

export default async function AdminPartnershipPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.CLIENTS_VIEW);

  const params = await searchParams;
  const selectedMonth = params.month ?? new Date().toISOString().slice(0, 7);
  const viewMode = params.view === "all" || params.view === "ytd" ? params.view : "selected";
  const selectedClient = params.client && params.client !== "all" ? params.client : "all";
  const selectedModel = params.model && params.model !== "all" ? params.model : "all";
  const rollupMode = params.rollup === "monthly" ? "monthly" : "weekly";
  const statusFilter =
    params.status === "active" || params.status === "overdue" ? params.status : "all";

  let cycles: BillingCycleRecord[] = [];
  let revenues: BillingCycleRevenueRecord[] = [];
  let clients: BillingClientRecord[] = [];
  let models: ModelRecord[] = [];
  let submissions: PaymentSubmissionRecord[] = [];
  let errorCode: string | null = null;

  try {
    [cycles, clients, models, submissions] = await Promise.all([
      getPartnerBillingCycles(viewMode === "selected" ? selectedMonth : undefined),
      getCachedBillingClients(),
      listAllBillingModels(),
      getAllPaymentSubmissions(),
    ]);
    revenues =
      cycles.length > 0
        ? await getBillingCycleRevenuesForCycles(cycles.map((cycle) => cycle.id))
        : [];
  } catch {
    errorCode = "PARTNERSHIP_DATA_FETCH_FAILED";
  }

  const normalizedCycles = cycles.filter(
    (cycle) => cycle.period_start && cycle.period_end
  );

  return (
    <AdminPartnershipClient
      initialCycles={normalizedCycles}
      revenues={revenues}
      clients={clients}
      models={models}
      submissions={submissions}
      defaultMonth={selectedMonth}
      defaultView={viewMode}
      defaultRollup={rollupMode}
      defaultClient={selectedClient}
      defaultModel={selectedModel}
      defaultStatus={statusFilter}
      errorCode={errorCode}
    />
  );
}
