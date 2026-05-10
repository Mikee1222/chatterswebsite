import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getVaTaskById } from "@/services/va-tasks";
import { notify } from "@/services/notification-service";
import { listAllUsers } from "@/services/users";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { formatDateTimeAthens } from "@/lib/format";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = params.id?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const task = await getVaTaskById(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (task.status === "done" || task.status === "skipped") {
    return NextResponse.json({ error: "Task is already finished" }, { status: 400 });
  }

  let recipientIds: string[] = [...task.assigned_to_ids];
  if (recipientIds.length === 0) {
    const allUsers = await listAllUsers();
    recipientIds = allUsers
      .filter((u) => u.role === "virtual_assistant" && (u.status ?? "").toLowerCase() === "active" && u.id)
      .map((u) => u.id);
  }

  const dueLine = task.due_date?.trim()
    ? `Due: ${formatDateTimeAthens(task.due_date)}`
    : "Please complete or update this task.";

  const slot = Date.now();
  await Promise.all(
    recipientIds.map((userId) =>
      notify({
        user_id: userId,
        event_type: NOTIFICATION_EVENT.VA_TASK_REMINDER,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: `Task reminder: ${task.title}`,
        body: `An admin asked you to review this task. ${dueLine}`,
        entity_type: NOTIFICATION_ENTITY.VA_TASK,
        entity_id: `va_task_admin_remind:${task.id}:${slot}:${userId}`,
      }).catch(() => {})
    )
  );

  return NextResponse.json({ success: true, notified: recipientIds.length });
}
