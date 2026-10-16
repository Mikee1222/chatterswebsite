import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import {
  getAssignedModelIdsForUser,
  listPostingBriefs,
} from "@/services/posting-briefs";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { PostingBriefsClient } from "@/components/posting-briefs-client";

export default async function PostingBriefsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const canManage = await hasPermission(user, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  const canView = await hasPermission(user, PERMISSIONS.POSTING_BRIEFS_VIEW);
  if (!canManage && !canView) redirect(ROUTES.dashboard);

  let modelIds: string[] | undefined;
  if (!canManage) {
    const a = await getAssignedModelIdsForUser(user.airtableUserId ?? user.id);
    const b =
      user.airtableUserId && user.airtableUserId !== user.id
        ? await getAssignedModelIdsForUser(user.id)
        : [];
    modelIds = [...new Set([...a, ...b])];
  }

  const [briefs, models] = await Promise.all([
    listPostingBriefs({ status: "active", model_ids: modelIds }).catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);

  const modelNameById: Record<string, string> = {};
  for (const m of models) {
    modelNameById[m.id] = m.model_name;
  }

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <PostingBriefsClient
        initialBriefs={briefs}
        canManage={canManage}
        models={models.map((m) => ({ id: m.id, model_name: m.model_name }))}
        modelNameById={modelNameById}
      />
    </div>
  );
}
