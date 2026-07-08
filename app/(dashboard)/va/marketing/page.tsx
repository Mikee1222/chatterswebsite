import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { VaMarketingClient } from "@/components/va-marketing-client";
import { VaTasksDesignShell } from "@/components/va-tasks-design-shell";

export default async function VaMarketingPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect(ROUTES.dashboard);
  if (!(await hasPermission(session, PERMISSIONS.MARKETING_VIEW))) {
    redirect(ROUTES.dashboard);
  }

  if (getEffectiveStaffRole(session) === "virtual_assistant") {
    await assertVaTypeCanAccessNavHref(session, ROUTES.va.marketingAccounts);
  }

  return (
    <VaTasksDesignShell>
      <VaMarketingClient />
    </VaTasksDesignShell>
  );
}
