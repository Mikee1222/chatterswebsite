import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { isCustomNavRole } from "@/lib/nav-config";
import { ROUTES } from "@/lib/routes";
import {
  isVaReadableAdminSchedulePath,
  permissionForSharedAdminPath,
} from "@/lib/va-schedule-overview-access";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getUserPermissions, hasPermission } from "@/lib/rbac";

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
    if (pathname === "" || isVaReadableAdminSchedulePath(pathname)) {
      return <>{children}</>;
    }
    // Shared permission-gated admin pages (e.g. PDF Maker, Accounts) are reachable by any role
    // holding the permission, matching the page's own bare hasPermission guard.
    const requiredPermission = permissionForSharedAdminPath(pathname);
    if (requiredPermission && (await hasPermission(user, requiredPermission))) {
      return <>{children}</>;
    }
    redirect(ROUTES.dashboard);
  }

  redirect(ROUTES.dashboard);
}
