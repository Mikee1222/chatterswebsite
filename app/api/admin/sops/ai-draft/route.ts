import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { draftSopFromBullets } from "@/services/ai-powered-features";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/sops/ai-draft — draft SOP markdown from bullets (never auto-saves).
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SOPS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    bullets?: string;
    roleName?: string;
    departmentName?: string;
  };
  const bullets = String(body.bullets ?? "").trim();
  if (!bullets) {
    return NextResponse.json({ error: "bullets required" }, { status: 400 });
  }

  try {
    const draft = await draftSopFromBullets({
      title: String(body.title ?? "").trim(),
      bullets,
      roleName: body.roleName,
      departmentName: body.departmentName,
    });
    return NextResponse.json({ draft });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Draft failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
