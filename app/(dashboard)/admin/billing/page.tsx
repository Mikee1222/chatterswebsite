import { getSessionFromCookies } from "@/lib/auth";
import { listAllRecords } from "@/lib/airtable-server";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AdminBillingClient } from "@/components/admin-billing-client";
import {
  getAllBillingCycles,
  getBillingCycleClientCounts,
  listAllBillingModels,
  listBillingClients,
} from "@/services/client-billing";

export default async function AdminBillingPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const [cycles, clients, models, clientModelsRecs] = await Promise.all([
    getAllBillingCycles(),
    listBillingClients(),
    listAllBillingModels(),
    listAllRecords("client_models", { _caller: "admin/billing:client_models" }),
  ]);

  const modelAssignments = clientModelsRecs.map((r) => ({
    client: Array.isArray(r.fields.client) ? (r.fields.client as string[]) : [],
    model: Array.isArray(r.fields.model) ? (r.fields.model as string[]) : [],
  }));

  const weeklyCycles = cycles.filter((c) => c.kind === "chatting_weekly");
  const clientCounts = await getBillingCycleClientCounts(weeklyCycles.map((c) => c.id));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-pink-300/80">Finance</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">Billing</h1>
        <p className="mt-2 text-gray-400">Manage weekly chatting billing periods and revenue.</p>
      </div>
      <AdminBillingClient
        initialCycles={cycles}
        clients={clients}
        models={models}
        modelAssignments={modelAssignments}
        initialClientCounts={clientCounts}
      />
    </div>
  );
}
