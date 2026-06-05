import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { deleteClientModelAssignment } from "@/services/client-portal";

function isAdminOrManager(session: Awaited<ReturnType<typeof getSessionFromCookies>>) {
  return session != null && (session.role === "admin" || session.role === "manager");
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
