import { cookies } from "next/headers";

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type SessionBody = {
  page_id?: string;
  session_id?: string;
};

/** Persist A/B session id — cookies can only be set in route handlers, not RSC pages. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SessionBody;
    const pageId = body.page_id?.trim() ?? "";
    const sessionId = body.session_id?.trim() ?? "";

    if (!pageId || !sessionId || pageId.length > 128 || sessionId.length > 128) {
      return Response.json({ ok: false }, { status: 400 });
    }

    const cookieStore = cookies();
    cookieStore.set(`lp_sid_${pageId}`, sessionId, {
      maxAge: SESSION_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
