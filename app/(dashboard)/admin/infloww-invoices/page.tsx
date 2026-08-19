import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getInflowwMonthlyBilling } from "@/services/infloww-monthly-billing";
import { AdminInflowwInvoicesClient } from "@/components/admin-infloww-invoices-client";

export default async function AdminInflowwInvoicesPage() {
  const user = await getSessionFromCookies();
  await requireAdminRoute(user, PERMISSIONS.BILLING_VIEW);

  const billing = await getInflowwMonthlyBilling().catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-pink-300/80">Finance</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">Infloww Platform Subscription</h1>
        <p className="mt-2 text-gray-400">
          Monthly subscription fees billed by Infloww to your agency. Synced once daily.
        </p>
      </div>
      <AdminInflowwInvoicesClient billing={billing} />
    </div>
  );
}
