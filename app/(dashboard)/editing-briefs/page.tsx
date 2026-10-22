import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listEditingBriefs } from "@/services/editing-briefs";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listUsersWithPermission } from "@/services/users";
import { EditingBriefsClient } from "@/components/editing-briefs-client";
import { sessionUserIds } from "@/lib/editing-briefs-access";

export default async function EditingBriefsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const canManage = await hasPermission(user, PERMISSIONS.EDITING_BRIEFS_MANAGE);
  const canViewAssigned = await hasPermission(user, PERMISSIONS.EDITING_BRIEFS_VIEW_ASSIGNED);
  const canReview = await hasPermission(user, PERMISSIONS.EDITING_BRIEFS_REVIEW);
  const canViewAll = await hasPermission(user, PERMISSIONS.EDITING_BRIEFS_VIEW_ALL);
  if (!canManage && !canViewAssigned && !canReview && !canViewAll) {
    redirect(ROUTES.dashboard);
  }

  const [briefsRaw, models, editors] = await Promise.all([
    listEditingBriefs({
      status: canManage || canReview || canViewAll ? "all" : "active",
    }).catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
    listUsersWithPermission(PERMISSIONS.EDITING_BRIEFS_VIEW_ASSIGNED).catch(() => []),
  ]);

  let briefs = briefsRaw;
  if (!canManage && !canViewAll && !canReview) {
    const ids = new Set(sessionUserIds(user));
    briefs = briefsRaw.filter(
      (b) =>
        ids.has(b.assigned_editor_id.trim()) &&
        b.status !== "draft" &&
        b.status !== "archived",
    );
  }

  const modelNameById: Record<string, string> = {};
  for (const m of models) modelNameById[m.id] = m.model_name;
  const editorNameById: Record<string, string> = {};
  for (const e of editors) editorNameById[e.id] = e.full_name || e.email || e.id;

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <EditingBriefsClient
        initialBriefs={briefs}
        canManage={canManage}
        canViewAssigned={canViewAssigned}
        canReview={canReview}
        models={models.map((m) => ({ id: m.id, model_name: m.model_name }))}
        editors={editors.map((e) => ({
          id: e.id,
          full_name: e.full_name || e.email || e.id,
        }))}
        modelNameById={modelNameById}
        editorNameById={editorNameById}
      />
    </div>
  );
}
