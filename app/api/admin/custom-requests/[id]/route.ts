import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { revalidateCustomRequestSurfaces } from "@/lib/revalidate-custom-request-paths";
import { deleteCustomRequestRecord } from "@/services/custom-requests";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "custom-requests:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const recordId = id?.trim();
  if (!recordId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await deleteCustomRequestRecord(recordId);
    revalidateCustomRequestSurfaces();
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Delete failed." }, { status: 400 });
  }
}
