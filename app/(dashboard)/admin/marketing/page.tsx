import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { buildRoleLabels, filterVaUsers, toStaffUserOptions } from "@/lib/staff-assignee-data";
import { getAllAccounts, getAllFunnels, getAllPlatforms, getAllShadowbanReports, getPhones } from "@/services/marketing";
import { listAllModelss } from "@/services/modelss";
import { getRoles } from "@/services/roles";
import { listActiveUsers } from "@/services/users";
import { AdminMarketingClient } from "@/components/admin-marketing-client";

export default async function AdminMarketingPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.MARKETING_VIEW);

  const [platforms, accounts, funnels, phones, models, allUsers, initialReports, roles] = await Promise.all([
    getAllPlatforms().catch(() => []),
    getAllAccounts().catch(() => []),
    getAllFunnels().catch(() => []),
    getPhones().catch(() => []),
    listAllModelss().catch(() => []),
    listActiveUsers().catch(() => []),
    getAllShadowbanReports().catch(() => []),
    getRoles().catch(() => []),
  ]);

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
      />
    </div>
  );
}
