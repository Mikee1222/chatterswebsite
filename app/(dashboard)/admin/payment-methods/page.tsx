import { getSessionFromCookies } from "@/lib/auth";
import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { linkedRecordIds } from "@/lib/airtable-linked";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { listAllClients } from "@/services/client-portal";
import { AdminPaymentMethodsClient } from "@/components/admin-payment-methods-client";
import type { PaymentMethodRecord } from "@/types/client-portal";

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

export default async function AdminPaymentMethodsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const [records, clients] = await Promise.all([
    listAllRecords<Record<string, unknown>>("payment_methods", {
      _caller: "admin/payment-methods:page",
    }),
    listAllClients(),
  ]);

  const paymentMethods = records.map(mapPaymentMethod);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-pink-300/80">Finance</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">Payment Methods</h1>
        <p className="mt-2 text-gray-400">
          Manage bank and crypto payment options shown to clients.
        </p>
      </div>
      <AdminPaymentMethodsClient initialMethods={paymentMethods} clients={clients} />
    </div>
  );
}
