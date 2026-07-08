import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission, hasPermission } from "@/lib/rbac";
import { isVirtualVaTaskId } from "@/lib/recurrence";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createPhase,
  getPhasesForTaskDisplay,
  getPhasesForTasksDisplay,
  type TaskPhaseDisplaySpec,
} from "@/services/task-phases";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !(await hasAnyPermission(session, [
      PERMISSIONS.VA_TASKS_VIEW,
      PERMISSIONS.VA_TASKS_MANAGE,
      PERMISSIONS.TASK_PROGRESS_VIEW,
    ]))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const batchTaskIds = searchParams
    .get("task_ids")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (batchTaskIds?.length) {
    const sourceTaskIds = searchParams.get("source_task_ids")?.split(",") ?? [];
    const specs: TaskPhaseDisplaySpec[] = batchTaskIds.map((taskId, index) => ({
      taskId,
      sourceTaskId: sourceTaskIds[index]?.trim() || null,
    }));
    const phasesByTask = await getPhasesForTasksDisplay(specs);
    return NextResponse.json({ phases_by_task: phasesByTask });
  }

  const taskId = searchParams.get("task_id")?.trim();
  if (!taskId) return NextResponse.json({ error: "task_id or task_ids required" }, { status: 400 });
  const explicitSource = searchParams.get("source_task_id")?.trim() || null;
  const phases = await getPhasesForTaskDisplay(
    taskId,
    explicitSource ?? (isVirtualVaTaskId(taskId) ? null : undefined),
  );
  return NextResponse.json({ phases });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VA_TASKS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phase = await createPhase(body as Parameters<typeof createPhase>[0]);
  return NextResponse.json({ phase });
}
