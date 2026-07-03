import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { deletePhone, getPhoneDetail, updatePhone } from "@/services/marketing";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const phone = await getPhoneDetail(id);
  if (!phone) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ phone });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updatePhone>[1] = {};
  if (typeof b.device_name === "string") patch.device_name = b.device_name.trim();
  if (typeof b.icloud_email === "string") patch.icloud_email = b.icloud_email.trim();
  if (typeof b.icloud_password === "string") patch.icloud_password = b.icloud_password;
  if (typeof b.recovery_email === "string") patch.recovery_email = b.recovery_email.trim();
  if (typeof b.recovery_phone === "string") patch.recovery_phone = b.recovery_phone.trim();
  if (typeof b.assigned_va_id === "string") patch.assigned_va_id = b.assigned_va_id;
  if (typeof b.notes === "string") patch.notes = b.notes.trim();
  if (typeof b.active === "boolean") patch.active = b.active;
  await updatePhone(id, patch);
  const phone = await getPhoneDetail(id);
  return NextResponse.json({ phone });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  await deletePhone(id);
  return NextResponse.json({ success: true });
}
