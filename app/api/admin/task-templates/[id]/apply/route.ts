import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getNotificationUserId } from "@/lib/notification-user";
import { applyTemplateToTask } from "@/services/task-templates";
import type { TaskPhase } from "@/services/task-phases";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "va-tasks:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const data = body as {
    assignedVaId?: string;
    assignedModelId?: string;
    dueDate?: string | null;
    region?: TaskPhase["region"];
    priority?: "low" | "normal" | "high" | "urgent";
    reminderMinutesBefore?: number | null;
  };
  if (!data.assignedVaId?.trim()) {
    return NextResponse.json({ error: "assignedVaId is required" }, { status: 400 });
  }
  if (!data.assignedModelId?.trim()) {
    return NextResponse.json({ error: "assignedModelId is required" }, { status: 400 });
  }
  const actorId = getNotificationUserId(session) ?? session.airtableUserId ?? session.id;
  try {
    const result = await applyTemplateToTask(id, {
      assignedVaId: data.assignedVaId,
      assignedModelId: data.assignedModelId,
      dueDate: data.dueDate,
      region: data.region,
      assignedById: actorId,
      priority: data.priority,
      reminderMinutesBefore: data.reminderMinutesBefore,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apply failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
