import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getAccountsByModel } from "@/services/marketing";
import { getPhasesByTask } from "@/services/task-phases";
import { getVaTasksForUser } from "@/services/va-tasks";

async function vaHasModelOnAssignedTaskPhases(vaUserId: string, modelId: string): Promise<boolean> {
  const tasks = await getVaTasksForUser(vaUserId);
  const mid = modelId.trim();
  if (!mid) return false;
  for (const t of tasks) {
    const phases = await getPhasesByTask(t.id);
    if (phases.some((p) => (p.assigned_model_id ?? "").trim() === mid)) return true;
  }
  return false;
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const vaId = session.airtableUserId ?? session.id;
  const { searchParams } = new URL(req.url);
  const modelId = searchParams.get("model_id")?.trim();
  if (!modelId) {
    return NextResponse.json({ error: "model_id required" }, { status: 400 });
  }
  const allowed = await vaHasModelOnAssignedTaskPhases(vaId, modelId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const accounts = await getAccountsByModel(modelId);
  return NextResponse.json({ accounts });
}
