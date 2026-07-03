import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { VaMarketingClient } from "@/components/va-marketing-client";
import { VaTasksDesignShell } from "@/components/va-tasks-design-shell";

export default async function VaMarketingPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "virtual_assistant") redirect(ROUTES.dashboard);
  await assertVaTypeCanAccessNavHref(user, ROUTES.va.marketingAccounts);

  return (
    <VaTasksDesignShell>
      <VaMarketingClient />
    </VaTasksDesignShell>
  );
}
