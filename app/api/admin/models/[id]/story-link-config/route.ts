import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getModelStoryLinkConfig,
  upsertModelStoryLinkConfig,
} from "@/services/model-story-link-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/models/[id]/story-link-config
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.ACCOUNTS_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const config = await getModelStoryLinkConfig(id);
  return NextResponse.json({
    config: config ?? { model_id: id, link_a_url: null, link_b_url: null },
  });
}

/**
 * PUT /api/admin/models/[id]/story-link-config
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.ACCOUNTS_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    link_a_url?: string | null;
    link_b_url?: string | null;
  } | null;

  try {
    const config = await upsertModelStoryLinkConfig(
      id,
      {
        link_a_url: body?.link_a_url ?? null,
        link_b_url: body?.link_b_url ?? null,
      },
      session.airtableUserId ?? session.id,
    );
    return NextResponse.json({ config });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
