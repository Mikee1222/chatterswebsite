import { NextResponse } from "next/server";
import { getLinkPageBySlugFresh } from "@/services/link-pages";
import { getRedirectByPageAndSlug, incrementClickCount } from "@/services/link-redirects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; redirect: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { slug, redirect } = await ctx.params;
  const fallback = new URL(`/l/${encodeURIComponent(slug)}`, request.url);

  const page = await getLinkPageBySlugFresh(slug);
  if (!page || page.status !== "published") {
    return NextResponse.redirect(fallback, 302);
  }

  const row = await getRedirectByPageAndSlug(page.page_id, redirect, { activeOnly: true });
  if (!row?.destination_url) {
    return NextResponse.redirect(fallback, 302);
  }

  incrementClickCount(row.id);

  return NextResponse.redirect(row.destination_url, 301);
}
