import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { trackLinkClick, extractClientIp } from "@/services/link-page-analytics";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageId = url.searchParams.get("page")?.trim() ?? "";
  const blockId = url.searchParams.get("block")?.trim() ?? "";
  const targetUrl = url.searchParams.get("url")?.trim() ?? "";

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const hdrs = await headers();
  trackLinkClick({
    pageId,
    blockId,
    ip: extractClientIp(hdrs),
    userAgent: hdrs.get("user-agent") ?? "",
    referrer: hdrs.get("referer") ?? "",
    sessionId: url.searchParams.get("session") ?? "",
    utmSource: url.searchParams.get("utm_source") ?? "",
    utmMedium: url.searchParams.get("utm_medium") ?? "",
    utmCampaign: url.searchParams.get("utm_campaign") ?? "",
  });

  return NextResponse.redirect(parsed.toString(), 301);
}
