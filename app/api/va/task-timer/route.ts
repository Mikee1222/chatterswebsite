/**
 * VA per-item task timer API.
 * GET  → active timer entry for this VA (at most one across all tasks)
 * POST { action:"start", va_task_id, task_phase_item_id, category } → start item timer
 * POST { action:"end", entry_id } → end active timer
 *
 * Policy: ONE active item-timer per VA at a time. Starting a new item auto-ends any other.
 */
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";
import {
  getActiveTimerForVa,
  startTimerEntry,
  endTimerEntry,
  getEnabledTimerCategories,
  getLatestDurationsForTask,
} from "@/services/task-category-timer";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.VA_TASKS_VIEW))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const vaTaskId = new URL(req.url).searchParams.get("va_task_id")?.trim() || "";

  try {
    const [entry, enabledCategories, itemDurations] = await Promise.all([
      getActiveTimerForVa(session.id),
      getEnabledTimerCategories(),
      vaTaskId ? getLatestDurationsForTask(vaTaskId, session.id) : Promise.resolve({}),
    ]);
    return Response.json({ entry, enabledCategories, itemDurations });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.VA_TASKS_VIEW))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    action?: string;
    va_task_id?: string;
    task_phase_item_id?: string;
    category?: string;
    entry_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "start") {
    const { va_task_id, task_phase_item_id, category } = body;
    if (!va_task_id) return Response.json({ error: "va_task_id required" }, { status: 400 });
    if (!task_phase_item_id) return Response.json({ error: "task_phase_item_id required" }, { status: 400 });
    if (!(TASK_STEP_TYPES as readonly string[]).includes(category as string))
      return Response.json({ error: "Invalid category" }, { status: 400 });

    const enabled = await getEnabledTimerCategories();
    if (!enabled.includes(category as TaskStepType))
      return Response.json({ error: "Timer not enabled for this category" }, { status: 400 });

    try {
      const entry = await startTimerEntry({
        va_task_id,
        task_phase_item_id,
        va_id: session.id,
        category: category as TaskStepType,
      });
      return Response.json({ entry });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed";
      if (message.includes("already completed")) {
        return Response.json({ error: message }, { status: 409 });
      }
      return Response.json({ error: message }, { status: 500 });
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
