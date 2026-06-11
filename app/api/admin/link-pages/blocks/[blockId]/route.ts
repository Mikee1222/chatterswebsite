import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getRecord } from "@/lib/airtable-server";
import { LINK_PAGE_BLOCKS_TABLE } from "@/lib/link-pages-schema";
import {
  deleteBlock,
  getLinkPageByPageId,
  upsertBlock,
  type UpsertBlockInput,
} from "@/services/link-pages";

type Ctx = { params: Promise<{ blockId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { blockId } = await ctx.params;
  try {
    const body = (await request.json()) as UpsertBlockInput;
    const block = await upsertBlock(blockId, body);
    const page = await getLinkPageByPageId(block.page_id);
    if (page?.slug) revalidatePath(`/l/${page.slug}`);
    return NextResponse.json({ block });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update block failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { blockId } = await ctx.params;
  try {
    let slug: string | undefined;
    try {
      const rec = await getRecord<{ page_id?: string }>(LINK_PAGE_BLOCKS_TABLE, blockId);
      const page = await getLinkPageByPageId(rec.fields.page_id ?? "");
      slug = page?.slug;
    } catch {
      // block may not exist
    }
    await deleteBlock(blockId);
    if (slug) revalidatePath(`/l/${slug}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete block failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
