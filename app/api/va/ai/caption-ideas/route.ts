import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { generateCaptionHashtagIdeas } from "@/services/ai-ops-features";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !(await hasAnyPermission(session, [
      PERMISSIONS.CONTENT_VIEW,
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.MARKETING_VIEW,
    ]))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    modelRecordId?: string;
    modelName?: string;
    topicHint?: string;
    force?: boolean;
  };
  const modelRecordId = (body.modelRecordId ?? "").trim();
  if (!modelRecordId) {
    return NextResponse.json({ error: "modelRecordId required" }, { status: 400 });
  }

  try {
    const result = await generateCaptionHashtagIdeas({
      modelRecordId,
      modelName: body.modelName,
      topicHint: body.topicHint,
      force: Boolean(body.force),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Caption generation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
