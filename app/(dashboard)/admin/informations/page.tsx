import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllMassListsAdmin } from "@/services/mass-lists";
import { getAllModelTiersAdmin } from "@/services/model-tiers";
import { getAllPricingRowsAdmin, getAllPricingSpecialsAdmin } from "@/services/pricing";
import { AdminInformationsClient } from "@/components/admin-informations-client";

export default async function AdminInformationsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.INFORMATIONS_VIEW);
  const canManage = await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE);

  const [lists, tiers, pricingRows, pricingSpecials] = await Promise.all([
    getAllMassListsAdmin().catch(() => []),
    getAllModelTiersAdmin().catch(() => []),
    getAllPricingRowsAdmin().catch(() => []),
    getAllPricingSpecialsAdmin().catch(() => []),
  ]);

  return (
    <div className="relative min-h-full w-full">
      <AdminInformationsClient
        lists={lists}
        tiers={tiers}
        pricingRows={pricingRows}
        pricingSpecials={pricingSpecials}
        canManage={canManage}
      />
    </div>
  );
}
