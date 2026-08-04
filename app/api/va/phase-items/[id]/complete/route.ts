import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionFromCookies } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/data-backend";
import { hasPermission } from "@/lib/rbac";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { ROUTES } from "@/lib/routes";
import { uploadToPrivateStorage } from "@/lib/supabase-signed-url";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getActiveVaTaskShift } from "@/services/shifts";
import { notifyAdmins, notifyByRoleConfig } from "@/services/notification-service";
import { completePhaseItem, resolvePhaseItemRowId } from "@/services/task-phases";

function safeScreenshotBasename(original: string): string {
  const stripped = original.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const base = stripped.length > 0 ? stripped.slice(0, 120) : "screenshot";
  const hasKnownExt = /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(base);
  return (hasKnownExt ? base : `${base}.png`).slice(0, 180);
}

async function uploadPhaseScreenshot(
  itemRowId: string,
  file: File,
): Promise<{ url: string }> {
  const name = safeScreenshotBasename(file.name || "screenshot.png");
  if (isSupabaseBackend()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const token = await uploadToPrivateStorage({
      bucket: "attachments",
      objectPath: `va_task_phase_items/${itemRowId}/${Date.now()}_${name}`,
      bytes,
      contentType: file.type || "image/png",
    });
    return { url: token };
  }
  const blob = await put(`phase-items/${itemRowId}/${Date.now()}-${name}`, file, {
    access: "public",
  });
  return { url: blob.url };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "va-tasks:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;

  const vaId = session.airtableUserId ?? session.id;
  const activeShift = await getActiveVaTaskShift(vaId);
  if (!activeShift) {
    return NextResponse.json(
      { error: "Start your task shift before completing checklist items." },
      { status: 403 },
    );
  }

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
  const uploadErrors: string[] = [];
  for (const screenshotFile of screenshotEntries) {
    try {
      screenshotAttachments.push(await uploadPhaseScreenshot(itemRowId, screenshotFile));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[phase-items/complete] screenshot upload failed:", e);
      uploadErrors.push(msg);
    }
  }

  if (screenshotEntries.length > 0 && screenshotAttachments.length === 0) {
    return NextResponse.json(
      {
        error: `Screenshot upload failed: ${uploadErrors[0] || "unknown error"}`,
      },
      { status: 502 },
    );
  }

  const vaName = session.fullName?.trim() || session.email || "VA";

  let phaseCompleted: boolean;
  let allPhasesCompleted: boolean;
  let itemTitle: string;
  let taskId: string;
  let phaseAirtableId: string;
  try {
    ({ phaseCompleted, allPhasesCompleted, itemTitle, taskId, phaseAirtableId } = await completePhaseItem(
      itemRowId,
      vaId,
      vaName,
      screenshotAttachments.length ? { screenshotAttachments } : undefined,
    ));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[phase-items/complete] completePhaseItem failed:", e);
    return NextResponse.json({ error: msg || "Could not complete item" }, { status: 500 });
  }

  await notifyByRoleConfig(NOTIFICATION_EVENT.PHASE_TASK_COMPLETED, {
    personal_user_id: vaId,
    actor_user_id: vaId,
    actor_name: vaName,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "✅ Phase item done",
    body: `${vaName} completed "${itemTitle}".`,
    entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE_ITEM,
    entity_id: itemRowId,
  });

  if (phaseCompleted && phaseAirtableId) {
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.PHASE_COMPLETED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "🎯 Phase completed",
      body: `${vaName} completed all items in the phase.`,
      entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE,
      entity_id: phaseAirtableId,
    });
  }

  if (allPhasesCompleted && taskId) {
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.ALL_PHASES_COMPLETED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "🏆 All phases completed!",
      body: `${vaName} completed all phases for the task.`,
      entity_type: NOTIFICATION_ENTITY.VA_TASK,
      entity_id: taskId,
    });
  }

  revalidatePath(ROUTES.admin.vaTasks);
  revalidatePath(ROUTES.va.tasks);
  revalidatePath(ROUTES.va.home);

  return NextResponse.json({ success: true, phaseCompleted, allPhasesCompleted });
}
