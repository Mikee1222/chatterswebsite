import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getThisWeekMonday } from "@/lib/weekly-program";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
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
  listActiveContentItems,
  qaRoleForStage,
} from "@/services/content-items";
import { ResearchStageClient } from "@/components/research-stage-client";
import { ContentQueueClient } from "@/components/content-queue-client";
import { PipelineRolePreviewBar } from "@/components/pipeline-role-preview-bar";

const DOER_STAGES: Record<string, string[]> = {
  creative: ["creative"],
  filmer: ["filming"],
  editor: ["editing"],
  "icloud-manager": ["icloud_raw", "icloud_edited"],
  "marketing-executive": ["post"],
};

export default async function ContentPipelinePage({
  searchParams,
}: {
  searchParams?: { as?: string };
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_VIEW))) redirect(ROUTES.dashboard);

  const myId = user.airtableUserId ?? user.id;
  const myRole = (user.role ?? "").trim().toLowerCase();
  const canQa = await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_QA);
  const canManage = await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE);
  const week = getThisWeekMonday();

  const asParam = (searchParams?.as ?? "").trim().toLowerCase();
  const previewing = canManage && !!asParam;
  const role = previewing ? asParam : myRole;
  const roleCanQa = previewing ? ["head-of-marketing", "supervisor"].includes(role) : canQa;

  async function withIdeas(bunches: ResearchBunch[]) {
    return Promise.all(bunches.map(async (b) => ({ bunch: b, ideas: await listIdeasForBunch(b.id) })));
  }

  let myItems: Awaited<ReturnType<typeof listItemsForAssignee>> = [];
  let qaItems: Awaited<ReturnType<typeof listItemsAwaitingQa>> = [];
  let blockedItems: Awaited<ReturnType<typeof listBlockedItems>> = [];
  let assignedCreators: { model_id: string; model_name: string }[] = [];
  let myBunches: Awaited<ReturnType<typeof withIdeas>> = [];
  let qaBunches: Awaited<ReturnType<typeof withIdeas>> = [];

  if (previewing) {
    // Preview a role: pipeline-wide slices for that role (not tied to admin's assignments).
    const doerStages = DOER_STAGES[role] ?? [];
    const [active, awaiting, awaitingBunches, creators] = await Promise.all([
      doerStages.length ? listActiveContentItems().catch(() => []) : Promise.resolve([]),
      roleCanQa ? listItemsAwaitingQa().catch(() => []) : Promise.resolve([]),
      roleCanQa ? listBunchesAwaitingQa().catch(() => []) : Promise.resolve([]),
      role === "researcher" ? listActiveGunzoTeamModelss().catch(() => []) : Promise.resolve([]),
    ]);
    myItems = active.filter((i) => doerStages.includes(i.stage) && i.status !== "awaiting_qa");
    qaItems = awaiting.filter((i) => qaRoleForStage(i.stage) === role);
    qaBunches = await withIdeas(awaitingBunches);
    assignedCreators = creators.filter((c) => c.model_id && c.model_name).map((c) => ({ model_id: c.model_id, model_name: c.model_name }));
  } else {
    // Real view for the logged-in user.
    const [assignments, myBunchesRaw, qaBunchesRaw] = await Promise.all([
      listActiveAssignments().catch(() => []),
      listBunchesForResearcher(myId).catch(() => []),
      canQa ? listBunchesAwaitingQa().catch(() => []) : Promise.resolve([]),
    ]);
    assignedCreators = assignments
      .filter((a) => a.role === "researcher" && a.user_id === myId && a.creator_model_id)
      .map((a) => ({ model_id: a.creator_model_id, model_name: a.creator_name }));
    [myBunches, qaBunches] = await Promise.all([withIdeas(myBunchesRaw), withIdeas(qaBunchesRaw)]);
    const [mine, qaAll, blocked] = await Promise.all([
      listItemsForAssignee(myId).catch(() => []),
      canQa ? listItemsAwaitingQa().catch(() => []) : Promise.resolve([]),
      canManage ? listBlockedItems().catch(() => []) : Promise.resolve([]),
    ]);
    myItems = mine;
    qaItems = qaAll.filter((it) => canManage || qaRoleForStage(it.stage) === myRole);
    blockedItems = blocked;
  }

  const showQueue = previewing ? (DOER_STAGES[role] ?? []).length > 0 || roleCanQa : true;
  const showResearch = previewing ? role === "researcher" || roleCanQa : true;

  return (
    <div className="w-full max-w-full space-y-10 px-4 py-6 md:px-6">
      {canManage && <PipelineRolePreviewBar current={asParam} />}
      {showQueue && (
        <ContentQueueClient myItems={myItems} qaItems={qaItems} blockedItems={blockedItems} canManage={previewing ? false : canManage} />
      )}
      {showResearch && (
        <ResearchStageClient
          canQa={roleCanQa}
          assignedCreators={assignedCreators}
          myBunches={myBunches}
          qaBunches={qaBunches}
          week={week}
        />
      )}
    </div>
  );
}
