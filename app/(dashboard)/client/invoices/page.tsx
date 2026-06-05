import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { ClientInvoicesClient } from "@/components/client-invoices-client";
import { getClientInvoicesEnriched } from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientInvoicesPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const invoices = await getClientInvoicesEnriched(getClientAirtableId(user));

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Invoices</h1>
        <p className="mt-1 text-sm text-white/55">View and download your invoices</p>
      </div>
      <ClientInvoicesClient invoices={invoices} />
    </div>
  );
}
