import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listActiveUsers } from "@/services/users";
import { listActiveAssignments, CREATOR_ASSIGNED_ROLES, CENTRAL_ROLES, getCentralPipelineOwners } from "@/services/creator-assignments";
import {
  PipelineAssignmentsClient,
  type AssignmentCreator,
  type AssignmentUser,
} from "@/components/pipeline-assignments-client";

/**
 * Content Pipeline — creator ↔ role assignments (Phase 2).
 * Manager sets which person owns each creator-assigned stage; drives auto-routing.
 */
export default async function PipelineAssignmentsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE))) {
    redirect(ROUTES.dashboard);
  }

  const [creatorRecords, users, assignments, centralOwners] = await Promise.all([
    listActiveGunzoTeamModelss().catch(() => []),
    listActiveUsers().catch(() => []),
    listActiveAssignments().catch(() => []),
    getCentralPipelineOwners().catch(() => ({} as Record<string, string>)),
  ]);

  const creators: AssignmentCreator[] = creatorRecords
    .filter((c) => c.model_id && c.model_name)
    .map((c) => ({ model_id: c.model_id, model_name: c.model_name }))
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  const usersByRole: Record<string, AssignmentUser[]> = {};
  for (const role of CREATOR_ASSIGNED_ROLES) {
    usersByRole[role] = users
      .filter((u) => (u.role ?? "").trim().toLowerCase() === role && u.id)
      // Route by Airtable record id (matches session airtableUserId), not the slug.
      .map((u) => ({ user_id: u.id, full_name: u.full_name || u.user_id }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  const allUsers: AssignmentUser[] = users
    .filter((u) => u.id)
    .map((u) => ({ user_id: u.id, full_name: u.full_name || u.user_id }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  // Map current assignment: `${role}__${creator_model_id}` → user_id
  const current: Record<string, string> = {};
  for (const a of assignments) {
    if (a.user_id) current[`${a.role}__${a.creator_model_id}`] = a.user_id;
  }

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <PipelineAssignmentsClient
        creators={creators}
        roles={[...CREATOR_ASSIGNED_ROLES]}
        usersByRole={usersByRole}
        initialAssignments={current}
        centralRoles={[...CENTRAL_ROLES]}
        allUsers={allUsers}
        initialCentral={centralOwners}
      />
    </div>
  );
}
