import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import {
  getAllSopDepartments,
  getAllSopRoles,
  getFunctionsByRole,
  sopRoleMatchesMember,
} from "@/services/sops";
import { SopViewerClient } from "@/components/sop-viewer-client";
import type { SopAuthRole } from "@/types";

export default async function SopsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const staffRole = getEffectiveStaffRole(user);
  if (staffRole !== "chatter" && staffRole !== "virtual_assistant") {
    redirect(ROUTES.dashboard);
  }

  const staffAuthRole = staffRole as SopAuthRole;

  const [allRoles, departments] = await Promise.all([
    getAllSopRoles().catch(() => []),
    getAllSopDepartments().catch(() => []),
  ]);

  const matchedRoles = allRoles
    .filter((role) =>
      sopRoleMatchesMember(role, {
        airtableUserId: user.airtableUserId,
        staffRole: staffAuthRole,
      })
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const roleBundles = await Promise.all(
    matchedRoles.map(async (role) => ({
      role,
      functions: await getFunctionsByRole(role.id).catch(() => []),
    }))
  );

  return (
    <div className="relative min-h-full w-full">
      <SopViewerClient roleBundles={roleBundles} departments={departments} />
    </div>
  );
}
