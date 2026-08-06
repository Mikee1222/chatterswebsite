import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { AdminEarningsDashboard } from "@/components/admin-earnings-dashboard";

export default async function AdminEarningsPage() {
  await requireAdminRoute(await getSessionFromCookies(), {
    permission: PERMISSIONS.EARNINGS_VIEW,
    adminOnly: true,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 md:px-6">
      <AdminEarningsDashboard />
    </div>
  );
}
