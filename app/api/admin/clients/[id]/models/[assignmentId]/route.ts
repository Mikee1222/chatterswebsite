import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { deleteClientModelAssignment } from "@/services/client-portal";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "clients:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { assignmentId } = await ctx.params;
  if (!assignmentId?.trim()) {
    return NextResponse.json({ error: "Missing assignment id" }, { status: 400 });
  }

  try {
    await deleteClientModelAssignment(assignmentId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove model assignment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
