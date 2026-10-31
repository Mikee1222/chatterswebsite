import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getAllMassLists } from "@/services/mass-lists";
import { getPriceMenusBundle } from "@/services/price-menus";
import { getActiveShiftByChatter, getActiveShiftModels } from "@/services/shifts";
import { listAllModelss } from "@/services/modelss";
import { InformationsClient } from "@/components/informations-client";

export default async function InformationsPage() {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.INFORMATIONS_VIEW))) {
    redirect(ROUTES.dashboard);
  }

  // Manage holders use the admin editor.
  if (await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE)) {
    redirect(ROUTES.admin.informations);
  }

  const [lists, bundle, allModels] = await Promise.all([
    getAllMassLists().catch(() => []),
    getPriceMenusBundle({ includeInactive: false }).catch(() => null),
    listAllModelss().catch(() => []),
  ]);

  let defaultModelId: string | null = null;
  try {
    const shift = await getActiveShiftByChatter(user.airtableUserId || user.id);
    if (shift?.id) {
      const shiftModels = await getActiveShiftModels(shift.id);
      defaultModelId = shiftModels.find((sm) => sm.model_id)?.model_id ?? null;
    }
  } catch {
    /* ignore */
  }

  const models = allModels
    .filter((m) => m.status === "active" && m.model_name?.trim())
    .map((m) => ({ id: m.id, model_name: m.model_name }))
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  if (!defaultModelId && models[0]) defaultModelId = models[0].id;

  return (
    <div className="relative min-h-full w-full">
      <InformationsClient
        lists={lists}
        models={models}
        defaultModelId={defaultModelId}
        specials={bundle?.specials ?? []}
      />
    </div>
  );
}
