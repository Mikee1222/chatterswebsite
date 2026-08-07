import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listEditAssignmentsForEditor } from "@/services/editing";
import { EditAssignmentsClient } from "@/components/edit-assignments-client";

export default async function EditAssignmentsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.EDITING_VIEW_ASSIGNMENTS))) {
    redirect(ROUTES.dashboard);
  }
  // Manage holders use Bunches for assignment + progress overview.
  if (await hasPermission(user, PERMISSIONS.EDITING_MANAGE)) {
    redirect(ROUTES.admin.bunches);
  }

  const editorId = user.airtableUserId ?? user.id;
  const assignments = await listEditAssignmentsForEditor(editorId).catch(() => []);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <EditAssignmentsClient initialAssignments={assignments} />
    </div>
  );
}
