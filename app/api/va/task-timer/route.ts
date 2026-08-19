/**
 * VA task category timer API.
 * GET  ?va_task_id=...  → active timer entry for this task
 * POST { action:"start", va_task_id, category }  → start timer (ends any active first)
 * POST { action:"end", entry_id }                → end active timer
 */
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";
import {
  getActiveTimerEntry,
  startTimerEntry,
  endTimerEntry,
  getEnabledTimerCategories,
} from "@/services/task-category-timer";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.VA_TASKS_VIEW))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const va_task_id = url.searchParams.get("va_task_id")?.trim() ?? "";
  if (!va_task_id) return Response.json({ error: "va_task_id required" }, { status: 400 });

  try {
    const [entry, enabledCategories] = await Promise.all([
      getActiveTimerEntry(va_task_id, session.id),
      getEnabledTimerCategories(),
    ]);
    return Response.json({ entry, enabledCategories });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.VA_TASKS_VIEW))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { action?: string; va_task_id?: string; category?: string; entry_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "start") {
    const { va_task_id, category } = body;
    if (!va_task_id) return Response.json({ error: "va_task_id required" }, { status: 400 });
    if (!(TASK_STEP_TYPES as readonly string[]).includes(category as string))
      return Response.json({ error: "Invalid category" }, { status: 400 });

    try {
      // Enforce: one active timer per task at a time — end any active one first
      const existing = await getActiveTimerEntry(va_task_id, session.id);
      if (existing) await endTimerEntry(existing.id, session.id);

      const entry = await startTimerEntry(va_task_id, session.id, category as TaskStepType);
      return Response.json({ entry });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
    }
  }

  if (body.action === "end") {
    const { entry_id } = body;
    if (!entry_id) return Response.json({ error: "entry_id required" }, { status: 400 });
    try {
      const entry = await endTimerEntry(entry_id, session.id);
      return Response.json({ entry });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
    }
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
