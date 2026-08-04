import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { duplicateTaskTemplate } from "@/services/task-templates";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.TASK_TEMPLATES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    const template = await duplicateTaskTemplate(id.trim());
    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Duplicate failed";
    const status = message === "Template not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
