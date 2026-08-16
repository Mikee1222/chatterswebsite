import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
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

  const [canViewCredentials, canManageCredentials, idRows] = await Promise.all([
    hasPermission(session, PERMISSIONS.CREDENTIALS_VIEW),
    hasPermission(session, PERMISSIONS.CREDENTIALS_MANAGE),
    getSupabaseServiceClient()
      .from("modelss")
      .select("id, airtable_id")
      .then(({ data }) => data ?? []),
  ]);

  const modelUuidByPublicId: Record<string, string> = {};
  for (const row of idRows) {
    if (row.airtable_id) modelUuidByPublicId[row.airtable_id] = row.id;
  }

  return (
    <VaTasksDesignShell>
      <VaMarketingClient
        canViewCredentials={canViewCredentials}
        canManageCredentials={canManageCredentials}
        modelUuidByPublicId={modelUuidByPublicId}
      />
    </VaTasksDesignShell>
  );
}
