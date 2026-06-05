import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { ClientPaymentHistoryClient } from "@/components/client-payment-history-client";
import { getClientBillingCyclesWithSubmissions } from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientPaymentHistoryPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const cycles = await getClientBillingCyclesWithSubmissions(user.id);

  return <ClientPaymentHistoryClient cycles={cycles} />;
}
