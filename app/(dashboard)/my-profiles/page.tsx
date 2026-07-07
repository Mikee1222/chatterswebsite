import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { getMyProfilesData } from "@/services/my-profiles";
import { MyProfilesClient } from "@/components/my-profiles-client";
import { VaTasksDesignShell } from "@/components/va-tasks-design-shell";

export default async function MyProfilesPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect(ROUTES.login);
  if (!(await hasPermission(session, PERMISSIONS.MY_PROFILES_VIEW))) {
    redirect(ROUTES.dashboard);
  }

  const initialData = await getMyProfilesData(session.id);

  return (
    <VaTasksDesignShell>
      <MyProfilesClient initialData={initialData} />
    </VaTasksDesignShell>
  );
}
