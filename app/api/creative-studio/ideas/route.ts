import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  deleteIdea,
  listIdeas,
  saveIdea,
  updateIdea,
  type CreativeIdeaType,
} from "@/services/creative-studio";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const modelId = new URL(req.url).searchParams.get("modelId")?.trim();
  if (!modelId) return Response.json({ error: "modelId required" }, { status: 400 });
  const ideas = await listIdeas(modelId);
  return Response.json({ ideas });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    model_id?: string;
    idea_type?: CreativeIdeaType;
    platform?: string;
    title?: string;
    content?: string;
    meta?: Record<string, unknown>;
  };
  if (!body.model_id?.trim() || !body.content?.trim()) {
    return Response.json({ error: "model_id and content required" }, { status: 400 });
  }
  const idea = await saveIdea({
    model_id: body.model_id.trim(),
    idea_type: body.idea_type ?? "caption",
    platform: body.platform,
    title: body.title,
    content: body.content,
    meta: body.meta,
    userId: session.airtableUserId ?? session.id,
  });
  return Response.json({ idea });
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    is_favourite?: boolean;
    thumbs?: -1 | 0 | 1;
    title?: string;
    delete?: boolean;
  };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  if (body.delete) {
    await deleteIdea(body.id);
    return Response.json({ ok: true });
  }
  const idea = await updateIdea(body.id, {
    is_favourite: body.is_favourite,
    thumbs: body.thumbs,
    title: body.title,
  });
  return Response.json({ idea });
}
