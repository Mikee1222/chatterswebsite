import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { archiveLinkPage, publishLinkPage, unpublishLinkPage } from "@/services/link-pages";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  try {
    if (body.action === "archive") {
      const page = await archiveLinkPage(id);
      revalidatePath(`/l/${page.slug}`);
      return NextResponse.json({ page });
    }
    if (body.action === "unpublish") {
      const page = await unpublishLinkPage(id);
      revalidatePath(`/l/${page.slug}`);
      return NextResponse.json({ page });
    }
    const page = await publishLinkPage(id);
    revalidatePath(`/l/${page.slug}`);
    return NextResponse.json({ page });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
