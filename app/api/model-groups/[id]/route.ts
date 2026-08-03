import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { deleteModelGroup, updateModelGroup } from "@/services/model-groups";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "models:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const group = await updateModelGroup(params.id, {
      name: body?.name != null ? String(body.name).trim() : undefined,
      model_ids: body?.model_ids,
      description: body?.description != null ? String(body.description) : undefined,
    });
    return NextResponse.json(group);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update model group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "models:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await deleteModelGroup(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete model group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
