import { NextResponse } from "next/server";
import { getModelApiContext } from "@/lib/model-context-server";
import { getVAContentAssignmentForModel } from "@/services/va-content-assignments";
import { isSbStorageToken, resolveStorageUrl } from "@/lib/supabase-signed-url";

export const dynamic = "force-dynamic";

/**
 * Fresh signed download for a model-owned chatting assignment file.
 * Avoids embedding short-lived Storage signed URLs in SSR HTML (1h TTL / PWA cache).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getModelApiContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: assignmentId } = await context.params;
  if (!assignmentId?.trim()) {
    return NextResponse.json({ error: "Missing assignment id." }, { status: 400 });
  }

  const stable = ctx.modelRecord.model_id?.trim() || null;
  const assignment = await getVAContentAssignmentForModel(
    assignmentId.trim(),
    ctx.linkedModelId,
    stable
  );
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

  // mapRow already signs sb://; re-resolve defensively if a token slipped through.
  const target = isSbStorageToken(raw) ? await resolveStorageUrl(raw) : raw;
  if (!target || isSbStorageToken(target) || !/^https?:\/\//i.test(target)) {
    return NextResponse.json({ error: "File unavailable." }, { status: 502 });
  }

  return NextResponse.redirect(target, 302);
}
