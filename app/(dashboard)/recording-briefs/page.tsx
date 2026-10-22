import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listRecordingBriefs } from "@/services/recording-briefs";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { RecordingBriefsClient } from "@/components/recording-briefs-client";
import { getBriefReminderLeadHours } from "@/services/brief-reminder-settings";
import { getUserByAirtableId } from "@/services/users";

export default async function RecordingBriefsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const canManage = await hasPermission(user, PERMISSIONS.RECORDING_BRIEFS_MANAGE);
  const canViewOwn = await hasPermission(user, PERMISSIONS.RECORDING_BRIEFS_VIEW_OWN);
  const canViewAll = await hasPermission(user, PERMISSIONS.RECORDING_BRIEFS_VIEW_ALL);
  if (!canManage && !canViewOwn && !canViewAll) redirect(ROUTES.dashboard);

  let modelIds: string[] | undefined;
  if (!canManage && !canViewAll) {
    const row = await getUserByAirtableId(user.airtableUserId ?? user.id).catch(() => null);
    modelIds = (
      row?.linked_model_ids?.length
        ? row.linked_model_ids
        : row?.linked_model_id
          ? [row.linked_model_id]
          : []
    )
      .map((id) => id.trim())
      .filter(Boolean);
  }

  const [briefsRaw, models, leadHours] = await Promise.all([
    listRecordingBriefs({
      status: canManage || canViewAll ? "all" : "active",
      model_ids: modelIds,
    }).catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
    getBriefReminderLeadHours().catch(() => 3),
  ]);

  const briefs =
    canManage || canViewAll
      ? briefsRaw
      : briefsRaw.filter((b) => b.status === "published" || b.status === "uploaded");

  const modelNameById: Record<string, string> = {};
  for (const m of models) {
    modelNameById[m.id] = m.model_name;
  }

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <RecordingBriefsClient
        initialBriefs={briefs}
        canManage={canManage}
        canViewOwn={canViewOwn}
        models={models.map((m) => ({ id: m.id, model_name: m.model_name }))}
        modelNameById={modelNameById}
        reminderLeadHours={leadHours}
      />
    </div>
  );
}
