import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllMassListsAdmin } from "@/services/mass-lists";
import { getPriceMenusBundle } from "@/services/price-menus";
import { AdminInformationsClient } from "@/components/admin-informations-client";

export default async function AdminInformationsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.INFORMATIONS_MANAGE);
  const canManage = await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE);

  const [lists, bundle] = await Promise.all([
    getAllMassListsAdmin().catch(() => []),
    getPriceMenusBundle({ includeInactive: true }).catch(() => null),
  ]);

  const emptyBundle = {
    menus: [],
    rowsByMenuId: {},
    specials: [],
    suggestions: [],
    unlinkedActiveModels: [],
    allModels: [],
  };

  return (
    <div className="relative min-h-full w-full">
      <AdminInformationsClient
        lists={lists}
        priceMenus={bundle ?? emptyBundle}
        canManage={canManage}
      />
    </div>
  );
}
