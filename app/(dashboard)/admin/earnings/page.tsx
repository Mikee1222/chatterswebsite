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
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Earnings</h1>
        <p className="mt-1 text-sm text-white/55">
          Creator-level Infloww revenue, fans, reach, and marketing — synced daily. Distinct from
          chatter employee performance.
        </p>
      </div>
      <AdminEarningsDashboard />
    </div>
  );
}
