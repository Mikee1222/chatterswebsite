import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { VABlurToolClient } from "@/components/va-blur-tool-client";

const BLUR_TOOL_ROLES = new Set(["virtual_assistant", "admin", "manager"]);

export default async function VaBlurToolPage() {
  const session = await getSessionFromCookies();
  if (!session || !BLUR_TOOL_ROLES.has(session.role)) {
    redirect(ROUTES.dashboard);
  }
  if (getEffectiveStaffRole(session) === "virtual_assistant") {
    await assertVaTypeCanAccessNavHref(session, ROUTES.va.blurTool);
  }

  return <VABlurToolClient />;
}
