import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { trackLinkClick, extractClientIp } from "@/services/link-page-analytics";
import { trackAbEvent } from "@/services/link-ab-testing";
import { getLinkPageBySlug } from "@/services/link-pages";
import type { LinkPageAbVariant } from "@/types";

async function resolvePageId(pageParam: string): Promise<string> {
  const trimmed = pageParam.trim();
  if (!trimmed) return "";
  const bySlug = await getLinkPageBySlug(trimmed);
  return bySlug?.page_id ?? trimmed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page")?.trim() ?? "";
  const blockId = url.searchParams.get("block")?.trim() ?? "";
  const targetUrl = url.searchParams.get("url")?.trim() ?? "";

  if (!targetUrl) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const pageId = await resolvePageId(pageParam);
  const hdrs = await headers();
  const sessionId = url.searchParams.get("session") ?? "";
  const visitorId = url.searchParams.get("visitor") ?? "";
  trackLinkClick({
    pageId,
    blockId,
    ip: extractClientIp(hdrs),
    userAgent: hdrs.get("user-agent") ?? "",
    referrer: hdrs.get("referer") ?? "",
    sessionId,
    visitorId,
    utmSource: url.searchParams.get("utm_source") ?? "",
    utmMedium: url.searchParams.get("utm_medium") ?? "",
    utmCampaign: url.searchParams.get("utm_campaign") ?? "",
  });

  const variantParam = url.searchParams.get("variant");
  if (pageId && sessionId && (variantParam === "a" || variantParam === "b")) {
    trackAbEvent({
      pageId,
      variant: variantParam as LinkPageAbVariant,
      eventType: "click",
      sessionId,
      blockId,
    });
  }

  // Meta/TikTok pixels run client-side on the link page. fbclid (and other ad click IDs)
  // pass through this 301 redirect to the destination URL automatically — no server-side
  // pixel fire is required unless you later want an explicit Lead event on outbound clicks.

  return NextResponse.redirect(parsed.toString(), 301);
}
