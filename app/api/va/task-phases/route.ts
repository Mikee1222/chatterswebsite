import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getVaTaskById } from "@/services/va-tasks";
import { getPhasesByTask } from "@/services/task-phases";

function vaCanReadTask(
  session: { id: string; airtableUserId: string | null },
  task: { assigned_to_ids: string[] },
): boolean {
  const uid = session.airtableUserId ?? session.id;
  if (task.assigned_to_ids.length === 0) return true;
  return task.assigned_to_ids.includes(uid);
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "va-tasks:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.tasks);
  if (blocked) return blocked;
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("task_id")?.trim();
  if (!taskId) return NextResponse.json({ error: "task_id required" }, { status: 400 });

  const task = await getVaTaskById(taskId);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!vaCanReadTask(session, task)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const phases = await getPhasesByTask(taskId);
  return NextResponse.json({ phases });
}
