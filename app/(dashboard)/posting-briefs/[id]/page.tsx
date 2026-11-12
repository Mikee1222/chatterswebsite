import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import {
  getAssignedModelIdsForUser,
  getPostingBriefById,
} from "@/services/posting-briefs";
import { getModelById } from "@/services/modelss";
import { PostingBriefDetail } from "@/components/posting-brief-detail";
import { PostingNotifyVasButton } from "@/components/posting-notify-vas-button";
import { VA_BTN_PRIMARY, VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { isSlotRecordingBriefApproved } from "@/services/brief-slot-links";
import { SlotBriefPublishNow } from "@/components/slot-brief-publish-now";

type Props = { params: Promise<{ id: string }> };

export default async function PostingBriefDetailPage({ params }: Props) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const canManage = await hasPermission(user, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  const canView = await hasPermission(user, PERMISSIONS.POSTING_BRIEFS_VIEW);
  if (!canManage && !canView) redirect(ROUTES.dashboard);
  // Marketing Manager: tells the VAs to post once the edited videos are in the folder.
  const canNotifyVas = canManage || (await hasPermission(user, PERMISSIONS.MARKETING_MANAGE));

  const { id } = await params;
  const brief = await getPostingBriefById(id).catch(() => null);
  if (!brief) notFound();

  if (!canManage) {
    const a = await getAssignedModelIdsForUser(user.airtableUserId ?? user.id);
    const b =
      user.airtableUserId && user.airtableUserId !== user.id
        ? await getAssignedModelIdsForUser(user.id)
        : [];
    const allowed = new Set([...a, ...b]);
    if (!allowed.has(brief.model_id)) redirect(ROUTES.postingBriefs);
    if (brief.status === "draft") redirect(ROUTES.postingBriefs);
  }

  const model = await getModelById(brief.model_id).catch(() => null);
  // Draft although the idea's recording brief is approved → offer "Publish now".
  const stuckDraft =
    canManage &&
    brief.status === "draft" &&
    Boolean(brief.winner_video_id) &&
    (await isSlotRecordingBriefApproved(brief.winner_video_id as string));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link
          href={ROUTES.postingBriefs}
          className={cn(VA_BTN_SECONDARY, "inline-flex min-h-10 items-center gap-2 px-3 text-sm")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        {canManage ? (
          <Link
            href={ROUTES.postingBriefEdit(brief.id)}
            className={cn(VA_BTN_PRIMARY, "min-h-10 px-4 text-sm")}
          >
            Edit
          </Link>
        ) : null}
        {canNotifyVas ? (
          <PostingNotifyVasButton
            briefId={brief.id}
            disabledReason={
              brief.status === "draft"
                ? stuckDraft
                  ? "Still a draft — press Publish now first"
                  : "Still a draft — it goes live when the recording brief is approved"
                : brief.status === "archived"
                  ? "This brief is archived"
                  : undefined
            }
          />
        ) : null}
      </div>
      {stuckDraft ? (
        <SlotBriefPublishNow
          winnerVideoId={brief.winner_video_id as string}
          briefId={brief.id}
          kind="posting"
        />
      ) : null}
      <PostingBriefDetail
        brief={brief}
        modelName={model?.model_name}
        editingBriefId={brief.editing_brief_id}
      />
    </div>
  );
}
