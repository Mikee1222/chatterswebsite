import { NextResponse } from "next/server";
import { deleteWhale } from "@/app/actions/whales";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "whales:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const res = await deleteWhale(id);
  if (!res.success) {
    const status = res.error === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: res.error ?? "Delete failed" }, { status });
  }
  return NextResponse.json({ success: true });
}
