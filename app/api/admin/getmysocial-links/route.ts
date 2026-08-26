import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  GetMySocialApiError,
  isGetMySocialConfigured,
  listAllGetMySocialLinks,
} from "@/lib/getmysocial-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/admin/getmysocial-links
 * Live GetMySocial link list for linking models.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isGetMySocialConfigured()) {
    return NextResponse.json(
      {
        error: "API key not configured",
        code: "missing_api_key",
        links: [],
        count: 0,
        configured: false,
        emptyReason: "missing_api_key" as const,
        message:
          "API key not configured. Mint a key in GetMySocial → Dashboard → Settings → API Keys, set GETMYSOCIAL_API_KEY in Vercel Production, and redeploy.",
      },
      { status: 503 }
    );
  }

  try {
    const links = await listAllGetMySocialLinks({ pageSize: 100, maxPages: 20 });
    const mapped = links.map((l) => ({
      id: l.id,
      shortcode: l.shortcode,
      display_name: l.display_name ?? l.name_user ?? l.shortcode,
      status: l.status,
      type: l.type,
    }));
    return NextResponse.json({
      links: mapped,
      count: mapped.length,
      configured: true,
      emptyReason: mapped.length === 0 ? ("no_links" as const) : null,
      message:
        mapped.length === 0
          ? "No GetMySocial links on this account — create pages in the GetMySocial dashboard first."
          : null,
    });
  } catch (err) {
    console.error("[admin/getmysocial-links]", err);
    if (err instanceof GetMySocialApiError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          links: [],
          count: 0,
          configured: true,
          emptyReason: "api_error" as const,
          message: err.message,
        },
        { status }
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch GetMySocial links",
        links: [],
        count: 0,
        configured: true,
        emptyReason: "api_error" as const,
      },
      { status: 500 }
    );
  }
}
