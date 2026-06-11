import { NextResponse } from "next/server";
import { headers as getRequestHeaders } from "next/headers";
import { getLinkPageByCustomDomain } from "@/services/link-pages";
import { getRedirectByPageAndSlug, incrementClickCount } from "@/services/link-redirects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ redirect: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { redirect } = await ctx.params;
  const hdrs = await getRequestHeaders();
  const host = (hdrs.get("host") ?? "").trim().toLowerCase().replace(/^www\./, "");
  const fallback = new URL("/", request.url);

  if (!host) {
    return NextResponse.redirect(fallback, 302);
  }

  const page = await getLinkPageByCustomDomain(host);
  if (!page) {
    return NextResponse.redirect(fallback, 302);
  }

  const row = await getRedirectByPageAndSlug(page.page_id, redirect, { activeOnly: true });
  if (!row?.destination_url) {
    return NextResponse.redirect(fallback, 302);
  }

  incrementClickCount(row.id);

  return NextResponse.redirect(row.destination_url, 301);
}
