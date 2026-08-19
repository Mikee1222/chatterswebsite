import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { isVirtualVaTaskId } from "@/lib/recurrence";
import { ROUTES } from "@/lib/routes";
import { resolveVirtualPhaseSourceId } from "@/lib/va-virtual-phases";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { getVaTaskById } from "@/services/va-tasks";
import { getPhasesForTaskDisplay } from "@/services/task-phases";
import { VA_TASK_PHASES_JSON_HEADERS } from "@/lib/va-task-phases-fetch";

export const dynamic = "force-dynamic";

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

  const explicitSource = searchParams.get("source_task_id")?.trim() || null;
  const lookupId = isVirtualVaTaskId(taskId)
    ? resolveVirtualPhaseSourceId(taskId, explicitSource)
    : taskId;
  if (!lookupId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = await getVaTaskById(lookupId);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!vaCanReadTask(session, task)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const phases = await getPhasesForTaskDisplay(taskId, explicitSource ?? lookupId);
  return NextResponse.json({ phases }, { headers: VA_TASK_PHASES_JSON_HEADERS });
}
