import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listIcloudOrganizationWork } from "@/services/icloud";
import { IcloudOrganizationClient } from "@/components/icloud-organization-client";

export default async function IcloudOrganizationPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const canView = await hasPermission(user, PERMISSIONS.ICLOUD_MANAGEMENT_VIEW);
  const canManage = await hasPermission(user, PERMISSIONS.ICLOUD_MANAGEMENT_MANAGE);
  if (!canView && !canManage) {
    redirect(ROUTES.dashboard);
  }

  const work = await listIcloudOrganizationWork().catch(() => []);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <IcloudOrganizationClient initialWork={work} />
    </div>
  );
}
