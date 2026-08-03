import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { listAllClients } from "@/services/client-portal";
import { listAllPaymentMethods } from "@/services/payment-methods";
import { AdminPaymentMethodsClient } from "@/components/admin-payment-methods-client";
import type { PaymentMethodRecord } from "@/types/client-portal";

export default async function AdminPaymentMethodsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.PAYMENTS_MANAGE);

  const [methods, clients] = await Promise.all([listAllPaymentMethods(), listAllClients()]);

  const initialMethods: PaymentMethodRecord[] = methods.map((m) => ({
    id: m.id,
    type: m.type,
    label: m.label,
    details: m.details,
    network: m.network || undefined,
    is_available: m.is_available,
    scope: m.scope,
    client: m.client ?? [],
    open_url: m.open_url || undefined,
    fallback_url: m.fallback_url || undefined,
    beneficiary: m.beneficiary || undefined,
    iban: m.iban || undefined,
    bic: m.bic || undefined,
    wallet_address: m.wallet_address || undefined,
  }));

  if (!user) redirect(ROUTES.login);

  return <AdminPaymentMethodsClient initialMethods={initialMethods} clients={clients} />;
}
