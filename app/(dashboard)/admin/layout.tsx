import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { isCustomNavRole } from "@/lib/nav-config";
import { PERMISSIONS } from "@/lib/permissions";
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

  const pathname = (await headers()).get("x-pathname") ?? "";
  const staff = getEffectiveStaffRole(user);

  // Chatter + roles DB `chatter_program:view` can surface TEAM → /admin/weekly-program in
  // shared nav; that board is for admins/custom roles. Send chatters to their schedule.
  if (staff === "chatter") {
    const p = (pathname.split("?")[0] || "").replace(/\/$/, "") || "/";
    if (p === ROUTES.admin.weeklyProgram || p.startsWith(`${ROUTES.admin.weeklyProgram}/`)) {
      redirect(ROUTES.chatter.weeklyProgram);
    }
  }

  // Shared permission-gated admin pages (e.g. PDF Maker, Accounts) — any role with the grant.
  // Chatters with chatter_program:view must still not open the admin board (personal schedule only).
  const requiredPermission = permissionForSharedAdminPath(pathname);
  if (requiredPermission && (await hasPermission(user, requiredPermission))) {
    if (staff === "chatter" && requiredPermission === PERMISSIONS.CHATTER_PROGRAM_VIEW) {
      redirect(ROUTES.chatter.weeklyProgram);
    }
    return <>{children}</>;
  }

  if (staff === "virtual_assistant") {
    if (pathname === "" || isVaReadableAdminSchedulePath(pathname)) {
      return <>{children}</>;
    }
    redirect(ROUTES.dashboard);
  }

  redirect(ROUTES.dashboard);
}
