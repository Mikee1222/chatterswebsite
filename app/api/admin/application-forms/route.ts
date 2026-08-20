import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createApplicationForm, listApplicationForms } from "@/services/application-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/application-forms */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const forms = await listApplicationForms();
    return NextResponse.json({ forms });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load forms";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/admin/application-forms */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    description?: string;
    slug?: string;
  } | null;

  try {
    const form = await createApplicationForm({
      title: body?.title ?? "",
      description: body?.description,
      slug: body?.slug,
      created_by: session.airtableUserId ?? session.id,
    });
    return NextResponse.json({ form }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
