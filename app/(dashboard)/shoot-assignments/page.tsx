import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listShootAssignmentsForFilmer } from "@/services/filming";
import { ShootAssignmentsClient } from "@/components/shoot-assignments-client";

export default async function ShootAssignmentsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.FILMING_VIEW_ASSIGNMENTS))) {
    redirect(ROUTES.dashboard);
  }
  // Manage holders use Bunches for assignment + progress overview.
  if (await hasPermission(user, PERMISSIONS.FILMING_MANAGE)) {
    redirect(ROUTES.admin.bunches);
  }

  const filmerId = user.airtableUserId ?? user.id;
  const assignments = await listShootAssignmentsForFilmer(filmerId).catch(() => []);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <ShootAssignmentsClient initialAssignments={assignments} />
    </div>
  );
}
