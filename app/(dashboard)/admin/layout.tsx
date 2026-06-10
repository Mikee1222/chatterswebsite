import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { isCustomNavRole } from "@/lib/nav-config";
import { ROUTES } from "@/lib/routes";
import { isVaReadableAdminSchedulePath } from "@/lib/va-schedule-overview-access";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getUserPermissions } from "@/lib/rbac";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  if (user.role === "admin" || user.role === "manager") {
    return <>{children}</>;
  }

  if (isCustomNavRole(user.role)) {
    const perms = await getUserPermissions(user);
    if (perms.length > 0) return <>{children}</>;
    redirect(ROUTES.dashboard);
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
