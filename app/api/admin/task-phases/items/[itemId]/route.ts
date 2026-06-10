import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { deletePhaseItem, updatePhaseItem } from "@/services/task-phases";

export async function PATCH(req: Request, ctx: { params: Promise<{ itemId: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "va-tasks:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { itemId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  await updatePhaseItem(itemId, body as Parameters<typeof updatePhaseItem>[1]);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ itemId: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "va-tasks:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { itemId } = await ctx.params;
  await deletePhaseItem(itemId);
  return NextResponse.json({ success: true });
}
