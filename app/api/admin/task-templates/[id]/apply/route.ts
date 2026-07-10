import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getNotificationUserId } from "@/lib/notification-user";
import { applyTemplateToTask, type ApplyTemplateInput } from "@/services/task-templates";
import type { TaskPhase } from "@/services/task-phases";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VA_TASKS_MANAGE))) {
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
    assignedVaIds?: string[];
    assignedModelIds?: string[];
    assignedModelId?: string;
    dueDate?: string | null;
    region?: TaskPhase["region"];
    priority?: "low" | "normal" | "high" | "urgent";
    reminderMinutesBefore?: number | null;
    is_recurring?: boolean;
    recurrence_type?: string | null;
    recurrence_days?: string[];
    recurrence_interval?: number | null;
    recurrence_end_date?: string | null;
  };
  const assignedVaIds = [
    ...new Set(
      (Array.isArray(data.assignedVaIds) ? data.assignedVaIds : data.assignedVaId ? [data.assignedVaId] : [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  if (assignedVaIds.length === 0) {
    return NextResponse.json({ error: "At least one assignee is required" }, { status: 400 });
  }
  const assignedModelIds = [
    ...new Set(
      (Array.isArray(data.assignedModelIds) ? data.assignedModelIds : data.assignedModelId ? [data.assignedModelId] : [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  if (assignedModelIds.length === 0) {
    return NextResponse.json({ error: "assignedModelIds is required" }, { status: 400 });
  }
  const actorId = getNotificationUserId(session) ?? session.airtableUserId ?? session.id;
  try {
    const result = await applyTemplateToTask(id, {
      assignedVaIds,
      assignedModelIds,
      dueDate: data.dueDate,
      region: data.region,
      assignedById: actorId,
      priority: data.priority,
      reminderMinutesBefore: data.reminderMinutesBefore,
      is_recurring: Boolean(data.is_recurring),
      recurrence_type: data.recurrence_type as ApplyTemplateInput["recurrence_type"],
      recurrence_days: data.recurrence_days as ApplyTemplateInput["recurrence_days"],
      recurrence_interval: data.recurrence_interval,
      recurrence_end_date: data.recurrence_end_date,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apply failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
