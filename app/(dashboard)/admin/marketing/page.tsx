import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { buildRoleLabels, filterVaUsers, toStaffUserOptions } from "@/lib/staff-assignee-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { getAllAccounts, getAllFunnels, getAllPlatforms, getAllShadowbanReports, getPhones } from "@/services/marketing";
import { getCachedModelss } from "@/lib/modelss-cache";
import { getRoles } from "@/services/roles";
import { listActiveUsers } from "@/services/users";
import { AdminMarketingClient } from "@/components/admin-marketing-client";

export default async function AdminMarketingPage() {
  const session = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.MARKETING_MANAGE);

  const [platforms, accounts, funnels, models, allUsers, initialReports, roles, canViewCredentials, canManageCredentials, idRows] = await Promise.all([
    getAllPlatforms().catch(() => []),
    getAllAccounts().catch(() => []),
    getAllFunnels().catch(() => []),
    getCachedModelss().catch(() => []),
    listActiveUsers().catch(() => []),
    getAllShadowbanReports().catch(() => []),
    getRoles().catch(() => []),
    hasPermission(session, PERMISSIONS.CREDENTIALS_VIEW),
    hasPermission(session, PERMISSIONS.CREDENTIALS_MANAGE),
    getSupabaseServiceClient()
      .from("modelss")
      .select("id, airtable_id")
      .then(({ data }) => data ?? []),
  ]);
  const phones = await getPhones(accounts).catch(() => []);

  const modelUuidByPublicId: Record<string, string> = {};
  for (const row of idRows) {
    if (row.airtable_id) modelUuidByPublicId[row.airtable_id] = row.id;
  }

  const vaUsers = filterVaUsers(allUsers);
  const staffUsers = toStaffUserOptions(allUsers);
  const roleLabels = buildRoleLabels(roles);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminMarketingClient
        platforms={platforms}
        accounts={accounts}
        funnels={funnels}
        phones={phones}
        models={models}
        vaUsers={vaUsers}
        staffUsers={staffUsers}
        roleLabels={roleLabels}
        initialReports={initialReports}
        canViewCredentials={canViewCredentials}
        canManageCredentials={canManageCredentials}
        modelUuidByPublicId={modelUuidByPublicId}
      />
    </div>
  );
}
