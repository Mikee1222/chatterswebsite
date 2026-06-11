import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getLinkPageById, reorderBlocks } from "@/services/link-pages";

type Ctx = { params: Promise<{ id: string }> };

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
    const body = (await request.json()) as { orderedIds?: string[] };
    const orderedIds = body.orderedIds ?? [];
    const blocks = await reorderBlocks(page.page_id, orderedIds);
    revalidatePath(`/l/${page.slug}`);
    return NextResponse.json({ blocks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reorder failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
