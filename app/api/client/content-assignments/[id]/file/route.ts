import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { getClientModels } from "@/services/client-portal";
import { getVAContentAssignmentForModel } from "@/services/va-content-assignments";
import { isSbStorageToken, resolveStorageUrl } from "@/lib/supabase-signed-url";

export const dynamic = "force-dynamic";

/**
 * Fresh signed download for a client-portal chatting assignment file.
 * Client must be assigned to the model that owns the assignment.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: assignmentId } = await context.params;
  if (!assignmentId?.trim()) {
    return NextResponse.json({ error: "Missing assignment id." }, { status: 400 });
  }

  const modelRecordId = new URL(request.url).searchParams.get("model")?.trim() || "";
  if (!modelRecordId) {
    return NextResponse.json({ error: "Missing model." }, { status: 400 });
  }

  const clientId = getClientAirtableId(user);
  const clientModels = await getClientModels(clientId);
  const allowed = clientModels.some((m) => (m.model?.[0] ?? "").trim() === modelRecordId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const assignment = await getVAContentAssignmentForModel(assignmentId.trim(), modelRecordId, null);
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  const raw =
    assignment.file_attachment.find((a) => a.url?.trim())?.url?.trim() ||
    assignment.file_url?.trim() ||
    "";
  if (!raw) {
    return NextResponse.json({ error: "No file on this assignment." }, { status: 404 });
  }

  const target = isSbStorageToken(raw) ? await resolveStorageUrl(raw) : raw;
  if (!target || isSbStorageToken(target) || !/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: "File unavailable." }, { status: 502 });
  }

  return NextResponse.redirect(target, 302);
}
