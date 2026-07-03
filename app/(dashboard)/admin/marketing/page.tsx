import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getAllAccounts, getAllFunnels, getAllPlatforms, getAllShadowbanReports, getPhones } from "@/services/marketing";
import { listAllModelss } from "@/services/modelss";
import { listAllUsers } from "@/services/users";
import { AdminMarketingClient } from "@/components/admin-marketing-client";

export default async function AdminMarketingPage() {
  const session = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.MARKETING_VIEW);

  const [platforms, accounts, funnels, phones, models, allUsers, initialReports] = await Promise.all([
    getAllPlatforms().catch(() => []),
    getAllAccounts().catch(() => []),
    getAllFunnels().catch(() => []),
    getPhones().catch(() => []),
    listAllModelss().catch(() => []),
    listAllUsers().catch(() => []),
    getAllShadowbanReports().catch(() => []),
  ]);

  const vaUsers = allUsers.filter(
    (u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant",
  );

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminMarketingClient
        platforms={platforms}
        accounts={accounts}
        funnels={funnels}
        phones={phones}
        models={models}
        vaUsers={vaUsers}
        initialReports={initialReports}
      />
    </div>
  );
}
