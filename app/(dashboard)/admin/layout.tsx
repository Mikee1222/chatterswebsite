import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { isVaReadableAdminSchedulePath } from "@/lib/va-schedule-overview-access";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (await hasPermission(user, PERMISSIONS.ROLES_VIEW)) {
    return <>{children}</>;
  }
  if (getEffectiveStaffRole(user) === "virtual_assistant") {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (pathname !== "" && !isVaReadableAdminSchedulePath(pathname)) {
      redirect(ROUTES.dashboard);
    }
    return <>{children}</>;
  }
  redirect(ROUTES.dashboard);
}
