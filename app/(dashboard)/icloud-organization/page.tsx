import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import {
  getIcloudManagementOverview,
  listRawSortingWork,
  listSortingIdeasForBunches,
} from "@/services/icloud";
import { IcloudEditedSortingPanel } from "@/components/icloud-sorting-guide";
import { IcloudOrganizationClient } from "@/components/icloud-organization-client";
import { IcloudRawSortingPanel } from "@/components/icloud-raw-sorting-panel";

export default async function IcloudOrganizationPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const canView = await hasPermission(user, PERMISSIONS.ICLOUD_MANAGEMENT_VIEW);
  const canManage = await hasPermission(user, PERMISSIONS.ICLOUD_MANAGEMENT_MANAGE);
  if (!canView && !canManage) {
    redirect(ROUTES.dashboard);
  }

  const overview = await getIcloudManagementOverview().catch(() => ({
    work: [],
    models: [],
    needsOrganization: [],
  }));

  const rawWork = await listRawSortingWork().catch(() => []);
  // Edited videos waiting to be placed: the same file → folder list, per bunch.
  const pendingEdited = overview.work.filter((w) => w.bunch.icloud_status !== "organized");
  const editedIdeas = await listSortingIdeasForBunches(pendingEdited.map((w) => w.bunch.id)).catch(
    () => new Map(),
  );
  const editedBunches = pendingEdited.map((w) => ({
    bunch_id: w.bunch.id,
    label: `${w.bunch.model_name || "—"} · ${w.bunch.name || "Bunch"}`,
    ideas: editedIdeas.get(w.bunch.id) ?? [],
  }));

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <IcloudRawSortingPanel initialWork={rawWork} canManage={canManage} />
      <IcloudEditedSortingPanel bunches={editedBunches} />
      <IcloudOrganizationClient
        initialWork={overview.work}
        initialModels={overview.models}
        initialNeedsOrganization={overview.needsOrganization}
        canOrganize={canView || canManage}
      />
    </div>
  );
}
