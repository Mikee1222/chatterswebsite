import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createModelGroup, listModelGroups } from "@/services/model-groups";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "models:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const groups = await listModelGroups();
    return NextResponse.json(groups);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load model groups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "models:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    const group = await createModelGroup({
      name,
      model_ids: body?.model_ids,
      description: body?.description,
    });
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create model group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
