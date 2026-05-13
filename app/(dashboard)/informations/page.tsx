import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { getAllMassLists } from "@/services/mass-lists";
import { getAllModelTiers } from "@/services/model-tiers";
import { getAllPricingRows, getAllPricingSpecials } from "@/services/pricing";
import { InformationsClient } from "@/components/informations-client";

export default async function InformationsPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") {
    redirect(ROUTES.dashboard);
  }

  const [lists, tiers, pricingRows, pricingSpecials] = await Promise.all([
    getAllMassLists().catch(() => []),
    getAllModelTiers().catch(() => []),
    getAllPricingRows().catch(() => []),
    getAllPricingSpecials().catch(() => []),
  ]);

  return (
    <div className="relative min-h-full w-full">
      <InformationsClient lists={lists} tiers={tiers} pricingRows={pricingRows} pricingSpecials={pricingSpecials} />
    </div>
  );
}
