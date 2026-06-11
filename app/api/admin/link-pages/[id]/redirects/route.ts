import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getLinkPageById } from "@/services/link-pages";
import {
  createRedirect,
  listRedirectsForPage,
  type CreateRedirectInput,
} from "@/services/link-redirects";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const page = await getLinkPageById(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const redirects = await listRedirectsForPage(page.page_id);
  return NextResponse.json({ redirects });
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const page = await getLinkPageById(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const body = (await request.json()) as Omit<CreateRedirectInput, "page_id">;
    const redirect = await createRedirect({
      ...body,
      page_id: page.page_id,
    });
    revalidatePath(`/l/${page.slug}`);
    if (page.custom_domain) {
      revalidatePath(`/r/${redirect.slug}`);
    }
    return NextResponse.json({ redirect }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create redirect failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
