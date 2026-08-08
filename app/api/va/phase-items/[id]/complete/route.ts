import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionFromCookies } from "@/lib/auth";
import { jsonNoStore } from "@/lib/api-no-store";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  attachmentFromSbToken,
  isAllowedDirectScreenshotToken,
  safeUploadBasename,
} from "@/lib/direct-storage-upload";
import { hasPermission } from "@/lib/rbac";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { ROUTES } from "@/lib/routes";
import { uploadToPrivateStorage } from "@/lib/supabase-signed-url";
import { vaTaskScreenshotFileError } from "@/lib/va-task-screenshots";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getActiveVaTaskShift } from "@/services/shifts";
import { notifyAdmins, notifyByRoleConfig } from "@/services/notification-service";
import { completePhaseItem, resolvePhaseItemRowId } from "@/services/task-phases";
import { readRequestFormData } from "@/lib/request-form-data";

export const dynamic = "force-dynamic";

async function uploadPhaseScreenshot(
  itemRowId: string,
  file: File,
): Promise<{ url: string }> {
  const validationError = vaTaskScreenshotFileError(file);
  if (validationError) throw new Error(validationError);

  const name = safeUploadBasename(file.name || "screenshot.png");
  const mime = file.type || "image/png";
  if (isSupabaseBackend()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const token = await uploadToPrivateStorage({
      bucket: "attachments",
      objectPath: `va_task_phase_items/${itemRowId}/${Date.now()}_${name}`,
      bytes,
      contentType: mime,
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
  if (!session) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "va-tasks:view"))) return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;

  const vaId = session.airtableUserId ?? session.id;
  const activeShift = await getActiveVaTaskShift(vaId);
  if (!activeShift) {
    return jsonNoStore(
      { error: "Start your task shift before completing checklist items." },
      { status: 403 },
    );
  }
  if (activeShift.status === "on_break" || Boolean(activeShift.break_started_at?.trim())) {
    return jsonNoStore(
      { error: "Resume your task shift before completing checklist items." },
      { status: 403 },
    );
  }

  const { id: paramId } = await ctx.params;
  const itemRowId = await resolvePhaseItemRowId(paramId);
  if (!itemRowId) {
    return jsonNoStore({ error: "Item not found" }, { status: 404 });
  }

  const formDataOrErr = await readRequestFormData(req);
  if (formDataOrErr instanceof NextResponse) {
    // Ensure auth JSON is never publicly cacheable (same class as shift-active GETs).
    const status = formDataOrErr.status;
    const body = await formDataOrErr.json().catch(() => ({ error: "Invalid upload body" }));
    return jsonNoStore(body, { status });
  }
  const formData = formDataOrErr;

  const screenshotUrlEntries = [
    ...formData.getAll("screenshot_url"),
    ...formData.getAll("screenshot_urls"),
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  const screenshotAttachments: { url: string }[] = [];
  for (const token of screenshotUrlEntries) {
    // Accept tokens minted against either the resolved row id or the route param id.
    const ok =
      isAllowedDirectScreenshotToken(token, "va-phase-item", { itemId: itemRowId }) ||
      isAllowedDirectScreenshotToken(token, "va-phase-item", { itemId: paramId });
    if (!ok) {
      return jsonNoStore({ error: "Invalid screenshot reference" }, { status: 400 });
    }
    screenshotAttachments.push(attachmentFromSbToken(token));
  }

  const screenshotEntries = [
    ...formData.getAll("screenshot"),
    ...formData.getAll("screenshots"),
  ].filter((entry): entry is File => entry instanceof File && entry.size > 0);

  for (const screenshotFile of screenshotEntries) {
    try {
      screenshotAttachments.push(await uploadPhaseScreenshot(itemRowId, screenshotFile));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[phase-items/complete] screenshot upload failed:", e);
      const clientError =
        msg.includes("under") ||
        msg.includes("image") ||
        msg.includes("empty");
      return jsonNoStore(
        { error: clientError ? msg : `Screenshot upload failed: ${msg || "unknown error"}` },
        { status: clientError ? 400 : 502 },
      );
    }
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
    return jsonNoStore({ error: msg || "Could not complete item" }, { status: 500 });
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

  return jsonNoStore({ success: true, phaseCompleted, allPhasesCompleted });
}
