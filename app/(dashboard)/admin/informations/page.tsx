import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { getAllMassListsAdmin } from "@/services/mass-lists";
import { getAllModelTiersAdmin } from "@/services/model-tiers";
import { getAllPricingRowsAdmin, getAllPricingSpecialsAdmin } from "@/services/pricing";
import { AdminInformationsClient } from "@/components/admin-informations-client";

export default async function AdminInformationsPage() {
  const session = await requireAdminRoute(await getSessionFromCookies());

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
      />
    </div>
  );
}
