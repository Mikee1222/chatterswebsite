import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listGetMySocialModelLinks,
  saveGetMySocialModelLinks,
  type GetMySocialModelLinkInput,
} from "@/services/getmysocial-model-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/models/[id]/getmysocial-links
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.ACCOUNTS_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const links = await listGetMySocialModelLinks(id);
  return NextResponse.json({ links });
}

/**
 * PUT /api/admin/models/[id]/getmysocial-links
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.ACCOUNTS_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    links?: GetMySocialModelLinkInput[];
  } | null;
  const inputs = Array.isArray(body?.links) ? body!.links : [];

  try {
    const links = await saveGetMySocialModelLinks(id, inputs);
    return NextResponse.json({ links });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
