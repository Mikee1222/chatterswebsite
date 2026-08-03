import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isSupabaseBackend } from "@/lib/data-backend";
import { getLinkPageById, getLinkPageByPageId, updateLinkPage } from "@/services/link-pages";
import {
  createAbVariantPage,
  getAbTestResults,
  startAbTest,
  stopAbTest,
} from "@/services/link-ab-testing";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const page = await getLinkPageById(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = await getAbTestResults(page);
  let variantPage = null;
  if (page.ab_variant_id) {
    const variantMeta = await getLinkPageByPageId(page.ab_variant_id);
    if (variantMeta) {
      variantPage = await getLinkPageById(variantMeta.id);
    }
  }

  return NextResponse.json({ page, results, variantPage });
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await request.json()) as { action?: string; testName?: string };

  try {
    if (body.action === "create_variant") {
      const variant = await createAbVariantPage(id);
      await updateLinkPage(id, { ab_variant_id: variant.page_id });
      if (!isSupabaseBackend()) {
        const { invalidateListRecordsReadCacheForTable } = await import("@/lib/airtable-server");
        const { LINK_PAGES_TABLE } = await import("@/lib/link-pages-schema");
        invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
      }
      return NextResponse.json({ variant }, { status: 201 });
    }

    const testName = body.testName?.trim() || "A/B Test";
    const { page, variantPageId } = await startAbTest(id, testName);
    revalidatePath(`/l/${page.slug}`);
    return NextResponse.json({ page, variantPageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start A/B test";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const page = await stopAbTest(id);
    revalidatePath(`/l/${page.slug}`);
    return NextResponse.json({ page });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stop A/B test";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
