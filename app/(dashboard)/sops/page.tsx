import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { isCustomNavRole } from "@/lib/nav-config";
import { PERMISSIONS } from "@/lib/permissions";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import {
  getAllSopDepartments,
  getAllSopRoles,
  getFunctionsByRole,
  sopRoleMatchesMember,
} from "@/services/sops";
import { SopViewerClient } from "@/components/sop-viewer-client";
import { getCertificationBadgesForMember } from "@/lib/sop-academy";

export default async function SopsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const staffRole = getEffectiveStaffRole(user);
  const isStaffSopViewer = staffRole === "chatter" || staffRole === "virtual_assistant";
  const isCustomSopViewer =
    isCustomNavRole(user.role) && (await hasPermission(user, PERMISSIONS.SOPS_VIEW));
  if (!isStaffSopViewer && !isCustomSopViewer) {
    redirect(ROUTES.dashboard);
  }
  if (staffRole === "virtual_assistant") {
    await assertVaTypeCanAccessNavHref(user, ROUTES.sops);
  }

  const [allRoles, departments] = await Promise.all([
    getAllSopRoles().catch(() => []),
    getAllSopDepartments().catch(() => []),
  ]);

  const memberMatch = {
    airtableUserId: user.airtableUserId,
    memberRole: user.role,
    secondaryRole: staffRole,
  };

  const matchedRoles = allRoles
    .filter((role) => sopRoleMatchesMember(role, memberMatch))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const userId = user.airtableUserId ?? user.id;

  const [roleBundles, certificationBadges] = await Promise.all([
    Promise.all(
      matchedRoles.map(async (role) => ({
        role,
        functions: await getFunctionsByRole(role.id).catch(() => []),
      }))
    ),
    getCertificationBadgesForMember(userId, memberMatch).catch(() => []),
  ]);

  return (
    <SopViewerClient
      roleBundles={roleBundles}
      departments={departments}
      certificationBadges={certificationBadges}
    />
  );
}
