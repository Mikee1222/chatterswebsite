import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getPdfTemplates } from "@/services/pdf-maker";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.PDF_MAKER_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const templates = await getPdfTemplates();
    return NextResponse.json({ templates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/pdf-maker/templates]", e);
    return NextResponse.json({ error: msg || "Failed to load templates" }, { status: 500 });
  }
}
