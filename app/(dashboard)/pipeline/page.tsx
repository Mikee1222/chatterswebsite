import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getThisWeekMonday } from "@/lib/weekly-program";
import { listActiveAssignments } from "@/services/creator-assignments";
import {
  listBunchesForResearcher,
  listBunchesAwaitingQa,
  listIdeasForBunch,
  type ResearchBunch,
} from "@/services/research-bunches";
import {
  listItemsForAssignee,
  listItemsAwaitingQa,
  listBlockedItems,
  qaRoleForStage,
} from "@/services/content-items";
import { ResearchStageClient } from "@/components/research-stage-client";
import { ContentQueueClient } from "@/components/content-queue-client";

/**
 * Content Pipeline entry — Research stage (Phase 3).
 * Researchers manage their idea bunches; QA (Manos) reviews & approves → spawns Creative items.
 * Later phases add the downstream stage views for the other roles.
 */
export default async function ContentPipelinePage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_VIEW))) {
    redirect(ROUTES.dashboard);
  }

  const myId = user.airtableUserId ?? user.id;
  const myRole = (user.role ?? "").trim().toLowerCase();
  const canQa = await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_QA);
  const canManage = await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE);
  const week = getThisWeekMonday();

  async function withIdeas(bunches: ResearchBunch[]) {
    return Promise.all(
      bunches.map(async (bunch) => ({ bunch, ideas: await listIdeasForBunch(bunch.id) }))
    );
  }

  const [assignments, myBunchesRaw, qaBunchesRaw] = await Promise.all([
    listActiveAssignments().catch(() => []),
    listBunchesForResearcher(myId).catch(() => []),
    canQa ? listBunchesAwaitingQa().catch(() => []) : Promise.resolve([]),
  ]);

  const assignedCreators = assignments
    .filter((a) => a.role === "researcher" && a.user_id === myId && a.creator_model_id)
    .map((a) => ({ model_id: a.creator_model_id, model_name: a.creator_name }));

  const [myBunches, qaBunches] = await Promise.all([withIdeas(myBunchesRaw), withIdeas(qaBunchesRaw)]);

  // Content-item queues (Creative → Post stages)
  const [myItems, qaItemsAll, blockedItems] = await Promise.all([
    listItemsForAssignee(myId).catch(() => []),
    canQa ? listItemsAwaitingQa().catch(() => []) : Promise.resolve([]),
    canManage ? listBlockedItems().catch(() => []) : Promise.resolve([]),
  ]);
  const qaItems = qaItemsAll.filter((it) => canManage || qaRoleForStage(it.stage) === myRole);

  return (
    <div className="w-full max-w-full space-y-10 px-4 py-6 md:px-6">
      <ContentQueueClient myItems={myItems} qaItems={qaItems} blockedItems={blockedItems} canManage={canManage} />
      <ResearchStageClient
        canQa={canQa}
        assignedCreators={assignedCreators}
        myBunches={myBunches}
        qaBunches={qaBunches}
        week={week}
      />
    </div>
  );
}
