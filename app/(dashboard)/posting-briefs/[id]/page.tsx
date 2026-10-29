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
import { VA_BTN_PRIMARY, VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export default async function PostingBriefDetailPage({ params }: Props) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const canManage = await hasPermission(user, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  const canView = await hasPermission(user, PERMISSIONS.POSTING_BRIEFS_VIEW);
  if (!canManage && !canView) redirect(ROUTES.dashboard);

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
      </div>
      <PostingBriefDetail
        brief={brief}
        modelName={model?.model_name}
        editingBriefId={brief.editing_brief_id}
      />
    </div>
  );
}
