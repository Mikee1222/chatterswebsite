import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getLinkPageById } from "@/services/link-pages";
import {
  deleteRedirect,
  getRedirectById,
  updateRedirect,
  type UpdateRedirectInput,
} from "@/services/link-redirects";

type Ctx = { params: Promise<{ id: string; redirectId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, redirectId } = await ctx.params;
  const page = await getLinkPageById(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await getRedirectById(redirectId);
  if (!existing || existing.page_id !== page.page_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as UpdateRedirectInput;
    const redirect = await updateRedirect(redirectId, body);
    revalidatePath(`/l/${page.slug}`);
    revalidatePath(`/l/${page.slug}/${redirect.slug}`);
    if (page.custom_domain) {
      revalidatePath(`/r/${redirect.slug}`);
    }
    return NextResponse.json({ redirect });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update redirect failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, redirectId } = await ctx.params;
  const page = await getLinkPageById(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await getRedirectById(redirectId);
  if (!existing || existing.page_id !== page.page_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteRedirect(redirectId);
    revalidatePath(`/l/${page.slug}`);
    revalidatePath(`/l/${page.slug}/${existing.slug}`);
    if (page.custom_domain) {
      revalidatePath(`/r/${existing.slug}`);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete redirect failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
