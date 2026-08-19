import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getSalesReassignments } from "@/services/infloww-sales-reassignments";
import { AdminSalesReassignmentsClient } from "@/components/admin-sales-reassignments-client";

export default async function AdminSalesReassignmentsPage() {
  const user = await getSessionFromCookies();
  await requireAdminRoute(user, PERMISSIONS.INFLOWW_STATS_VIEW_ALL);

  const reassignments = await getSalesReassignments({ limit: 500 }).catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-pink-300/80">Performance</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">Sales Reassignment Log</h1>
        <p className="mt-2 text-gray-400">
          Audit trail of manual sales reassignment events from Infloww. Synced daily.
        </p>
      </div>
      <AdminSalesReassignmentsClient reassignments={reassignments} />
    </div>
  );
}
