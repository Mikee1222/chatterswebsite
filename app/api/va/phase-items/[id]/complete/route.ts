import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { notifyAdmins, notifyByRoleConfig } from "@/services/notification-service";
import { completePhaseItem, resolvePhaseItemRowId } from "@/services/task-phases";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "va-tasks:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;

  const { id: paramId } = await ctx.params;
  const itemRowId = await resolvePhaseItemRowId(paramId);
  if (!itemRowId) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const screenshotEntries = [
    ...formData.getAll("screenshot"),
    ...formData.getAll("screenshots"),
  ].filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const screenshotAttachments: { url: string }[] = [];
  for (const screenshotFile of screenshotEntries) {
    try {
      const blob = await put(`phase-items/${itemRowId}/${Date.now()}-${screenshotFile.name}`, screenshotFile, {
        access: "public",
      });
      screenshotAttachments.push({ url: blob.url });
    } catch (e) {
      console.error("[phase-items/complete] screenshot upload failed:", e);
    }
  }

  const vaId = session.airtableUserId ?? session.id;
  const vaName = session.fullName?.trim() || session.email || "VA";

  const { phaseCompleted, allPhasesCompleted, itemTitle, taskId, phaseAirtableId } = await completePhaseItem(
    itemRowId,
    vaId,
    vaName,
    screenshotAttachments.length ? { screenshotAttachments } : undefined,
  );

  await notifyByRoleConfig(NOTIFICATION_EVENT.PHASE_TASK_COMPLETED, {
    personal_user_id: vaId,
    actor_user_id: vaId,
    actor_name: vaName,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "✅ Phase Item Done",
    body: `✅ ${vaName} completed: "${itemTitle}"`,
    entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE_ITEM,
    entity_id: itemRowId,
  });

  if (phaseCompleted && phaseAirtableId) {
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.PHASE_COMPLETED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "🎯 Phase Completed",
      body: `🎯 All items in the phase were completed by ${vaName}`,
      entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE,
      entity_id: phaseAirtableId,
    });
  }

  if (allPhasesCompleted && taskId) {
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.ALL_PHASES_COMPLETED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "🏆 All Phases Completed!",
      body: `🏆 ${vaName} completed all phases for task`,
      entity_type: NOTIFICATION_ENTITY.VA_TASK,
      entity_id: taskId,
    });
  }

  revalidatePath(ROUTES.admin.vaTasks);

  return NextResponse.json({ success: true, phaseCompleted, allPhasesCompleted });
}
