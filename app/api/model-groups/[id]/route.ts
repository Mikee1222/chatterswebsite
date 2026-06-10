import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { deleteRecord, updateRecord } from "@/lib/airtable-server";

const TABLE = "model_groups";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "models:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const name = body?.name != null ? String(body.name).trim() : undefined;
    const model_ids =
      Array.isArray(body?.model_ids) && body.model_ids.length >= 0
        ? body.model_ids.map((v: unknown) => String(v).trim()).filter(Boolean)
        : body?.model_ids != null && typeof body.model_ids === "string"? String(body.model_ids)
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : undefined;
    const fields: Record<string, unknown> = {};
    if (name != null) fields.name = name;
    if (model_ids != null) fields.model_ids = model_ids;
    const rec = await updateRecord(TABLE, params.id, fields);
    return NextResponse.json({ id: rec.id, ...(rec.fields as object) });
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
    await deleteRecord(TABLE, params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete model group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
