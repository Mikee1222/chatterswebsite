import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission, hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createPhase, getPhasesByTask } from "@/services/task-phases";

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
  const taskId = searchParams.get("task_id");
  if (!taskId) return NextResponse.json({ error: "task_id required" }, { status: 400 });
  const phases = await getPhasesByTask(taskId);
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
