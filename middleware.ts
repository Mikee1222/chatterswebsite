import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-config";
import { ROUTES } from "@/lib/routes";
import { verifySessionToken } from "@/lib/session-token";
import { isVaReadableAdminSchedulePath } from "@/lib/va-schedule-overview-access";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getLinkPageByCustomDomainFresh } from "@/services/link-pages";

const PUBLIC_PATHS = [ROUTES.login, "/l/", "/r/", "/api/l/"];

/** Paths that must never be blocked by auth (PWA, static assets, public link pages). Bypass auth and return next() immediately. */
const PUBLIC_ASSET_PREFIXES = [
  "/_next/static",
  "/_next/image",
  "/api/l/",
  "/api/",
  "/favicon.ico",
  "/apple-touch-icon",
  "/icon.svg",
  "/icons/",
  "/manifest",
  "/sw.js",
  "/workbox-",
  "/fonts/",
  "/images/",
];

function isPublicAssetPath(pathname: string): boolean {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (p === "/favicon.ico" || p === "/icon.svg" || p === "/sw.js") return true;
  if (p === "/manifest.webmanifest" || p.startsWith("/manifest.")) return true;
  if (/^\/icon-\d/.test(p)) return true;
  return PUBLIC_ASSET_PREFIXES.some((prefix) => p.startsWith(prefix));
}

function isPublicAppPath(pathname: string): boolean {
  if (pathname.startsWith("/l/") || pathname.startsWith("/r/") || pathname.startsWith("/api/l/")) return true;
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isGunzoDomain(host: string): boolean {
  return (
    host.includes("gunzoteam.com") ||
    host.includes("localhost") ||
    host.includes("vercel.app")
  );
}

const CUSTOM_DOMAIN_404_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>404 Not Found</title></head>
<body><h1>404 Not Found</h1><p>The page you requested could not be found.</p></body>
</html>`;

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Custom domains — never run auth or expose Gunzo internal pages
  if (!isGunzoDomain(host)) {
    const bareHost = host.split(":")[0]?.toLowerCase() ?? "";

    // Canonicalize www → apex so Airtable apex-only custom_domain values always match
    if (bareHost.startsWith("www.") && !pathname.startsWith("/api/")) {
      const apexUrl = new URL(request.url);
      apexUrl.host = bareHost.slice(4);
      return NextResponse.redirect(apexUrl, 301);
    }

    if (pathname.startsWith("/api/l/")) return NextResponse.next();
    if (pathname.startsWith("/r/")) return NextResponse.next();
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon") ||
      pathname.includes(".")
    ) {
      return NextResponse.next();
    }

    try {
      const page = await getLinkPageByCustomDomainFresh(bareHost || host);
      if (page && page.status === "published") {
        return NextResponse.rewrite(new URL(`/l/${page.slug}`, request.url));
      }
    } catch (e) {
      console.error("[middleware] custom domain error:", e);
    }

    return new NextResponse(CUSTOM_DOMAIN_404_HTML, {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  }

  // Gunzo app domain — public paths bypass auth
  if (isPublicAppPath(pathname) || isPublicAssetPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = await verifySessionToken(token ?? undefined);
  const sessionValid = !!user;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (sessionValid) {
      return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
    }
    return NextResponse.next();
  }

  if (!sessionValid) {
    const loginUrl = new URL(ROUTES.login, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/model" || pathname.startsWith("/model/")) {
    if (user.role !== "model") {
      return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
    }
  }

  if (pathname === "/client" || pathname.startsWith("/client/")) {
    if (user.role !== "client") {
      return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
    }
  }

  if (getEffectiveStaffRole(user) === "virtual_assistant" && pathname.startsWith("/admin")) {
    if (!isVaReadableAdminSchedulePath(pathname)) {
      return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Run middleware for app routes only; do NOT run for static/PWA assets (they bypass auth via isPublicAssetPath if they ever hit middleware)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api|l/|r/|apple-touch-icon|icon\\.svg|icon-\\d|icons/|manifest|sw\\.js|workbox-|fonts/|images/).*)",
  ],
};
