import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { ClientPaymentHistoryClient } from "@/components/client-payment-history-client";
import { getClientBillingCyclesWithSubmissions } from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientPaymentHistoryPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const cycles = await getClientBillingCyclesWithSubmissions(getClientAirtableId(user));

  return <ClientPaymentHistoryClient cycles={cycles} />;
}
