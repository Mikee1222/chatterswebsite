import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { pushToPostingBrief } from "@/services/creative-studio";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const canStudio = await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE);
  const canBriefs = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  if (!canStudio || !canBriefs) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    briefId?: string;
    postId?: string;
    caption?: string;
    text_on_screen?: string;
  };
  if (!body.briefId?.trim()) {
    return Response.json({ error: "briefId required" }, { status: 400 });
  }

  const result = await pushToPostingBrief({
    briefId: body.briefId.trim(),
    postId: body.postId?.trim(),
    caption: body.caption,
    text_on_screen: body.text_on_screen,
  });
  if (!result.ok) return Response.json({ error: result.error ?? "Failed" }, { status: 400 });
  console.info("[creative-studio] push-to-brief", {
    briefId: body.briefId,
    postId: body.postId ?? null,
  });
  return Response.json({ ok: true });
}
