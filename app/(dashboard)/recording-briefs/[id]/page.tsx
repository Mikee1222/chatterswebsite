import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getRecordingBriefById } from "@/services/recording-briefs";
import { RecordingBriefView } from "@/components/recording-brief-view";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { getUserByAirtableId } from "@/services/users";
import {
  canAccessRecordingBrief,
  getRecordingBriefCapabilities,
} from "@/lib/recording-briefs-access";
import { VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";
import { getWardrobeItemsByIds } from "@/services/model-wardrobe";

type Props = { params: Promise<{ id: string }> };

export default async function RecordingBriefDetailPage({ params }: Props) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const caps = await getRecordingBriefCapabilities(user);
  if (!caps.length) redirect(ROUTES.dashboard);

  const { id } = await params;
  const brief = await getRecordingBriefById(id);
  if (!brief) notFound();

  const row = await getUserByAirtableId(user.airtableUserId ?? user.id).catch(() => null);
  const linked = (
    row?.linked_model_ids?.length
      ? row.linked_model_ids
      : row?.linked_model_id
        ? [row.linked_model_id]
        : []
  )
    .map((x) => x.trim())
    .filter(Boolean);

  if (!canAccessRecordingBrief(caps, brief.model_id, linked)) redirect(ROUTES.dashboard);
  if (
    !caps.includes("manage") &&
    !caps.includes("view_all") &&
    brief.status !== "published" &&
    brief.status !== "uploaded"
  ) {
    redirect(ROUTES.recordingBriefs);
  }

  const models = await listActiveGunzoTeamModelss().catch(() => []);
  const modelName = models.find((m) => m.id === brief.model_id)?.model_name;
  const canManage = await hasPermission(user, PERMISSIONS.RECORDING_BRIEFS_MANAGE);

  const wardrobeItems = await getWardrobeItemsByIds(
    [brief.outfit_item_id, brief.location_item_id].filter((x): x is string => Boolean(x)),
  ).catch(() => new Map());
  const toPhoto = (id: string | null) => {
    const it = id ? wardrobeItems.get(id) : null;
    return it ? { number: it.number, name: it.name, url: it.photo_signed_url } : null;
  };
  const wardrobePhotos = {
    outfit: toPhoto(brief.outfit_item_id),
    location: toPhoto(brief.location_item_id),
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={ROUTES.recordingBriefs} className={VA_BTN_SECONDARY}>
          Back
        </Link>
        {canManage ? (
          <Link href={ROUTES.recordingBriefEdit(brief.id)} className={VA_BTN_SECONDARY}>
            Edit
          </Link>
        ) : null}
      </div>
      <RecordingBriefView
        brief={brief}
        modelName={modelName}
        viewerMode={!canManage}
        wardrobePhotos={wardrobePhotos}
      />
    </div>
  );
}
