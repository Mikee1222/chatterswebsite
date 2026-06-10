import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { isVaReadableAdminSchedulePath } from "@/lib/va-schedule-overview-access";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { hasAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

const ADMIN_AREA_PERMISSIONS = [
  PERMISSIONS.ACCOUNTS_VIEW,
  PERMISSIONS.ACCOUNTS_CREATE,
  PERMISSIONS.BILLING_VIEW,
  PERMISSIONS.EARNINGS_VIEW,
  PERMISSIONS.MODELS_VIEW,
  PERMISSIONS.SHIFTS_MANAGE,
  PERMISSIONS.MARKETING_VIEW,
  PERMISSIONS.WHALES_MANAGE,
  PERMISSIONS.VA_TASKS_VIEW,
  PERMISSIONS.SOPS_MANAGE,
  PERMISSIONS.ROLES_VIEW,
  PERMISSIONS.CHALLENGES_MANAGE,
  PERMISSIONS.REWARDS_CONFIG,
  PERMISSIONS.NOTIFICATIONS_VIEW,
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (await hasAnyPermission(user, [...ADMIN_AREA_PERMISSIONS])) {
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
