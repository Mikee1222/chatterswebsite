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
import { getUserPermissions, hasAnyPermission } from "@/lib/rbac";

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

  // Chatter + roles DB grants can surface agency-wide admin boards via shared nav.
  // Those boards are for admins/custom roles — send chatters to their personal surfaces.
  if (staff === "chatter") {
    const p = (pathname.split("?")[0] || "").replace(/\/$/, "") || "/";
    if (p === ROUTES.admin.weeklyProgram || p.startsWith(`${ROUTES.admin.weeklyProgram}/`)) {
      redirect(ROUTES.chatter.weeklyProgram);
    }
    if (p === ROUTES.admin.finesBonuses || p.startsWith(`${ROUTES.admin.finesBonuses}/`)) {
      redirect(ROUTES.finesBonuses);
    }
    if (
      p === ROUTES.admin.customRequests ||
      p.startsWith(`${ROUTES.admin.customRequests}/`) ||
      p === ROUTES.admin.customs ||
      p.startsWith(`${ROUTES.admin.customs}/`)
    ) {
      redirect(ROUTES.chatter.requestCustom);
    }
  }

  // Shared permission-gated admin pages (e.g. PDF Maker, Accounts, Instagram Insights) —
  // any role with one of the listed grants. Chatters with chatter_program:view must still
  // not open the admin board (personal schedule only).
  const requiredPermissions = permissionForSharedAdminPath(pathname);
  if (requiredPermissions && (await hasAnyPermission(user, [...requiredPermissions]))) {
    if (
      staff === "chatter" &&
      requiredPermissions.includes(PERMISSIONS.CHATTER_PROGRAM_VIEW)
    ) {
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
