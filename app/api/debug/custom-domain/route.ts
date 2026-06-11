import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { hasPermission } from "@/lib/rbac";
import { getLinkPageByCustomDomain } from "@/services/link-pages";

function isGunzoDomain(host: string): boolean {
  return (
    host.includes("gunzoteam.com") ||
    host.includes("localhost") ||
    host.includes("vercel.app")
  );
}

async function assertDebugAccess(): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (process.env.NODE_ENV !== "production") {
    return { ok: true };
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true };
}

/**
 * Custom domain routing diagnostic.
 * Available in non-production, or to admins with link-pages:manage in production.
 *
 * Airtable `custom_domain` should be stored without www (e.g. sofiapetritsi.com).
 */
export async function GET(req: Request) {
  const gate = await assertDebugAccess();
  if (!gate.ok) return gate.response;

  const host = req.headers.get("host") ?? "";
  const queryHost = new URL(req.url).searchParams.get("host")?.trim();
  const lookupHost = queryHost || host;

  let page: Awaited<ReturnType<typeof getLinkPageByCustomDomain>> = null;
  let lookupError: string | null = null;
  try {
    page = await getLinkPageByCustomDomain(lookupHost);
  } catch (err) {
    lookupError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    host,
    lookup_host: lookupHost,
    is_gunzo_domain: isGunzoDomain(lookupHost),
    page: page
      ? {
          id: page.id,
          slug: page.slug,
          title: page.title,
          custom_domain: page.custom_domain,
          status: page.status,
        }
      : null,
    lookup_error: lookupError,
    canonical_domain_format: "Store apex only in Airtable (e.g. sofiapetritsi.com, not www.sofiapetritsi.com).",
  });
}
