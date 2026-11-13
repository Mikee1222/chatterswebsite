import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getEditingBriefById } from "@/services/editing-briefs";
import { EditingBriefView } from "@/components/editing-brief-view";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listUsersWithPermission } from "@/services/users";
import {
  canAccessEditingBrief,
  canViewEditingBriefAsBunchEditor,
  getEditingBriefCapabilities,
  sessionUserIds,
} from "@/lib/editing-briefs-access";
import { VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";
import { isSlotRecordingBriefApproved } from "@/services/brief-slot-links";
import { getBunchEditorIdForWinnerVideo } from "@/services/winner-sourcing";
import { SlotBriefPublishNow } from "@/components/slot-brief-publish-now";

type Props = { params: Promise<{ id: string }> };

export default async function EditingBriefDetailPage({ params }: Props) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const caps = await getEditingBriefCapabilities(user);
  if (!caps.length) redirect(ROUTES.dashboard);

  const { id } = await params;
  const brief = await getEditingBriefById(id);
  if (!brief) notFound();

  const userIds = sessionUserIds(user);
  let ok = userIds.some((uid) =>
    canAccessEditingBrief(caps, brief.assigned_editor_id, uid),
  );
  // The editor assigned to the bunch this brief belongs to can open it too, even when the
  // brief's own assigned editor is someone else (they work this bunch from the Editor tab).
  // Read-only — the same rule the read API applies, so the two never diverge.
  if (!ok && caps.includes("view_assigned") && brief.winner_video_id) {
    const bunchEditorId = await getBunchEditorIdForWinnerVideo(brief.winner_video_id);
    if (canViewEditingBriefAsBunchEditor(caps, userIds, bunchEditorId)) ok = true;
  }
  if (!ok) redirect(ROUTES.dashboard);

  if (
    !caps.includes("manage") &&
    !caps.includes("view_all") &&
    !caps.includes("review") &&
    (brief.status === "draft" || brief.status === "archived")
  ) {
    redirect(ROUTES.editingBriefs);
  }

  const [models, editors] = await Promise.all([
    listActiveGunzoTeamModelss().catch(() => []),
    listUsersWithPermission(PERMISSIONS.EDITING_BRIEFS_VIEW_ASSIGNED).catch(() => []),
  ]);
  const modelName = models.find((m) => m.id === brief.model_id)?.model_name;
  const editorName = editors.find((e) => e.id === brief.assigned_editor_id)?.full_name;
  const canManage = await hasPermission(user, PERMISSIONS.EDITING_BRIEFS_MANAGE);
  // Draft although the idea's recording brief is approved → offer "Publish now".
  const stuckDraft =
    canManage &&
    brief.status === "draft" &&
    Boolean(brief.winner_video_id) &&
    (await isSlotRecordingBriefApproved(brief.winner_video_id as string));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={ROUTES.editingBriefs} className={VA_BTN_SECONDARY}>
          Back
        </Link>
        {canManage ? (
          <Link href={ROUTES.editingBriefEdit(brief.id)} className={VA_BTN_SECONDARY}>
            Edit
          </Link>
        ) : null}
      </div>
      {stuckDraft ? (
        <SlotBriefPublishNow
          winnerVideoId={brief.winner_video_id as string}
          briefId={brief.id}
          kind="editing"
        />
      ) : null}
      <EditingBriefView brief={brief} modelName={modelName} editorName={editorName ?? undefined} />
    </div>
  );
}
