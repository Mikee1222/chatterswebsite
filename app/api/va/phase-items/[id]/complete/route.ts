import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionFromCookies } from "@/lib/auth";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { notifyAdmins } from "@/services/notification-service";
import { completePhaseItem, resolvePhaseItemRowId } from "@/services/task-phases";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;

  const { id: paramId } = await ctx.params;
  const itemRowId = await resolvePhaseItemRowId(paramId);
  if (!itemRowId) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const screenshotEntry = formData.get("screenshot");
  const screenshotFile = screenshotEntry instanceof File && screenshotEntry.size > 0 ? screenshotEntry : null;

  const screenshotAttachments: { url: string }[] = [];
  if (screenshotFile) {
    try {
      const blob = await put(`phase-items/${itemRowId}/${screenshotFile.name}`, screenshotFile, {
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

  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.PHASE_TASK_COMPLETED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "Phase item done",
    body: `${vaName} completed: "${itemTitle}"`,
    entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE_ITEM,
    entity_id: itemRowId,
  });

  if (phaseCompleted && phaseAirtableId) {
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.PHASE_COMPLETED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "Phase completed",
      body: `All items in the phase were completed by ${vaName}`,
      entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE,
      entity_id: phaseAirtableId,
    });
  }

  if (allPhasesCompleted && taskId) {
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.ALL_PHASES_COMPLETED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "All phases completed",
      body: `${vaName} completed all phases for task`,
      entity_type: NOTIFICATION_ENTITY.VA_TASK,
      entity_id: taskId,
    });
  }

  return NextResponse.json({ success: true, phaseCompleted, allPhasesCompleted });
}
