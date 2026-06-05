import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { ClientPaymentsClient } from "@/components/client-payments-client";
import {
  getClientBillingCyclesWithSubmissions,
  getClientPaymentMethods,
} from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientPaymentsPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const clientId = user.id;
  const [cycles, paymentMethods] = await Promise.all([
    getClientBillingCyclesWithSubmissions(clientId),
    getClientPaymentMethods(clientId),
  ]);

  return <ClientPaymentsClient cycles={cycles} paymentMethods={paymentMethods} />;
}
