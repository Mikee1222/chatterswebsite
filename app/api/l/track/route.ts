import { writeEnhancedEvent, extractClientIp } from "@/services/link-page-analytics";
import { getLinkPageBySlug } from "@/services/link-pages";
import type { LinkPageAnalyticsEventType } from "@/types";

async function resolvePageId(pageParam: string): Promise<string> {
  const trimmed = pageParam.trim();
  if (!trimmed) return "";
  const bySlug = await getLinkPageBySlug(trimmed);
  return bySlug?.page_id ?? trimmed;
}

type TrackBody = {
  page_id?: string;
  visitor_id?: string;
  session_id?: string;
  is_new_visitor?: boolean;
  is_new_session?: boolean;
  event_type?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TrackBody;
    const pageParam = body.page_id?.trim() ?? "";
    const visitorId = body.visitor_id?.trim() ?? "";

    if (!pageParam || !visitorId) {
      return Response.json({ ok: false });
    }

    const pageId = await resolvePageId(pageParam);

    const eventType: LinkPageAnalyticsEventType =
      body.event_type === "link_click" ? "link_click" : "page_view";

    await writeEnhancedEvent({
      pageId,
      visitorId,
      sessionId: body.session_id?.trim() ?? "",
      isNewVisitor: body.is_new_visitor === true,
      isNewSession: body.is_new_session === true,
      eventType,
      ip: extractClientIp(request.headers),
      userAgent: request.headers.get("user-agent") ?? "",
      referrer: body.referrer ?? "",
      utmSource: body.utm_source ?? "",
      utmMedium: body.utm_medium ?? "",
      utmCampaign: body.utm_campaign ?? "",
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false });
  }
}
