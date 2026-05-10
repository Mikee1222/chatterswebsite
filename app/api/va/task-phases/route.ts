import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getPhasesByTask } from "@/services/task-phases";
import { getVaTaskById } from "@/services/va-tasks";

function taskVisibleToVa(assignedToIds: string[], vaUserId: string): boolean {
  if (assignedToIds.length === 0) return true;
  return assignedToIds.includes(vaUserId);
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const vaId = session.airtableUserId ?? session.id;
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("task_id");
  if (!taskId?.trim()) {
    return NextResponse.json({ error: "task_id required" }, { status: 400 });
  }
  const task = await getVaTaskById(taskId.trim());
  if (!task || !taskVisibleToVa(task.assigned_to_ids, vaId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const phases = await getPhasesByTask(taskId.trim());
  return NextResponse.json({ phases });
}
