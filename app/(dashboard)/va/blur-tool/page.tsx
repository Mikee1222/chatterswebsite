import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { VABlurToolClient } from "@/components/va-blur-tool-client";

export default async function VaBlurToolPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect(ROUTES.login);
  if (!(await hasPermission(session, PERMISSIONS.BLUR_TOOL_ACCESS))) {
    redirect(ROUTES.dashboard);
  }
  if (getEffectiveStaffRole(session) === "virtual_assistant") {
    await assertVaTypeCanAccessNavHref(session, ROUTES.va.blurTool);
  }

  return <VABlurToolClient />;
}
