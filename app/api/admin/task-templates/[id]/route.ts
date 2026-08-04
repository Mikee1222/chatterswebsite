import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  deleteTaskTemplate,
  getTaskTemplateDetail,
  updateTaskTemplate,
} from "@/services/task-templates";
import type { TaskTemplateCategory } from "@/services/task-templates";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // VA task managers need detail to apply a template while editing a task (same gate as list).
  const canManageTemplates = await hasPermission(session, PERMISSIONS.TASK_TEMPLATES_MANAGE);
  const canManageVaTasks = await hasPermission(session, PERMISSIONS.VA_TASKS_MANAGE);
  if (!canManageTemplates && !canManageVaTasks) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const template = await getTaskTemplateDetail(id);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.TASK_TEMPLATES_MANAGE))) {
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
    name?: string;
    description?: string;
    category?: TaskTemplateCategory;
    is_active?: boolean;
    phases?: Parameters<typeof updateTaskTemplate>[1]["phases"];
  };
  const template = await updateTaskTemplate(id, data);
  return NextResponse.json({ template });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.TASK_TEMPLATES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  await deleteTaskTemplate(id);
  return NextResponse.json({ ok: true });
}
