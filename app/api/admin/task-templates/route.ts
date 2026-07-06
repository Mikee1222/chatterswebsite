import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createTaskTemplate, getAllTaskTemplatesAdmin } from "@/services/task-templates";
import type { TaskTemplateCategory } from "@/services/task-templates";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canManageTemplates = await hasPermission(session, PERMISSIONS.TASK_TEMPLATES_MANAGE);
  const canManageVaTasks = await hasPermission(session, PERMISSIONS.VA_TASKS_MANAGE);
  if (!canManageTemplates && !canManageVaTasks) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const templates = await getAllTaskTemplatesAdmin();
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.TASK_TEMPLATES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
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
    phases?: Parameters<typeof createTaskTemplate>[0]["phases"];
  };
  if (!data.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const template = await createTaskTemplate({
    name: data.name,
    description: data.description,
    category: data.category,
    phases: data.phases,
  });
  return NextResponse.json({ template });
}
