import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  submitVideoAnalysisFeedback,
  type VideoAnalysisUserFeedback,
} from "@/services/creative-studio-video";

const ALLOWED: VideoAnalysisUserFeedback[] = ["ok", "flag_wrong", "wrong_refusal"];

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    analysisId?: string;
    feedback?: string;
  };

  const analysisId = body.analysisId?.trim();
  const feedback = body.feedback?.trim() as VideoAnalysisUserFeedback | undefined;
  if (!analysisId) return Response.json({ error: "analysisId required" }, { status: 400 });
  if (!feedback || !ALLOWED.includes(feedback)) {
    return Response.json({ error: "invalid feedback" }, { status: 400 });
  }

  const result = await submitVideoAnalysisFeedback({
    analysisId,
    userId: session.airtableUserId ?? session.id,
    feedback,
  });

  if (!result.ok) {
    return Response.json({ error: result.error ?? "failed" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
