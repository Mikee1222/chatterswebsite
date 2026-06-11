import { writeEnhancedEvent, extractClientIp } from "@/services/link-page-analytics";
import type { LinkPageAnalyticsEventType } from "@/types";

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
    const pageId = body.page_id?.trim() ?? "";
    const visitorId = body.visitor_id?.trim() ?? "";

    if (!pageId || !visitorId) {
      return Response.json({ ok: false });
    }

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
