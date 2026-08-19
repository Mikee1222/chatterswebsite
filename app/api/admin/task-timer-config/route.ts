import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";
import { getTimerConfigs, updateTimerConfig } from "@/services/task-category-timer";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.TASK_TEMPLATES_MANAGE))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const configs = await getTimerConfigs();
    return Response.json({ configs });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.TASK_TEMPLATES_MANAGE))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { category?: string; timer_enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const category = body.category as TaskStepType;
  if (!(TASK_STEP_TYPES as readonly string[]).includes(category))
    return Response.json({ error: "Invalid category" }, { status: 400 });
  if (typeof body.timer_enabled !== "boolean")
    return Response.json({ error: "timer_enabled must be boolean" }, { status: 400 });

  try {
    await updateTimerConfig(category, body.timer_enabled);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
