import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserPermissions } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { shouldUsePersonalVaTasksNav } from "@/lib/nav-config";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getNotificationUserId } from "@/lib/notification-user";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getVaTaskById, updateVaTask } from "@/services/va-tasks";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;

  const perms = await getUserPermissions(session);
  const canUpdatePersonal =
    getEffectiveStaffRole(session) === "virtual_assistant" ||
    shouldUsePersonalVaTasksNav(session.role, perms);
  if (!canUpdatePersonal) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const vaId = getNotificationUserId(session) ?? session.airtableUserId ?? session.id;
  if (!vaId) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

  const { id: taskId } = await ctx.params;
  const task = await getVaTaskById(taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const visible = task.assigned_to_ids.length === 0 || task.assigned_to_ids.includes(vaId);
  if (!visible) return NextResponse.json({ error: "This task is not assigned to you." }, { status: 403 });

  let body: { completed_notes?: unknown };
  try {
    body = (await req.json()) as { completed_notes?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const notes = typeof body.completed_notes === "string" ? body.completed_notes.trim() : "";

  try {
    await updateVaTask(taskId, { completed_notes: notes });
    revalidatePath(ROUTES.va.tasks);
    revalidatePath(ROUTES.admin.vaTasks);
    return NextResponse.json({ success: true, completed_notes: notes });
  } catch (e) {
    console.error("[va/tasks/notes] update failed:", e);
    return NextResponse.json({ error: "Could not save notes" }, { status: 500 });
  }
}
