import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-config";
import { ROUTES } from "@/lib/routes";
import { verifySessionToken } from "@/lib/session-token";
import { isVaReadableAdminSchedulePath } from "@/lib/va-schedule-overview-access";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getLinkPageByCustomDomain } from "@/services/link-pages";

const PUBLIC_PATHS = [ROUTES.login, "/l/", "/api/l/"];

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
  if (pathname.startsWith("/l/") || pathname.startsWith("/api/l/")) return true;
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isGunzoDomain(host: string): boolean {
  return (
    host.includes("gunzoteam.com") ||
    host.includes("localhost") ||
    host.includes("vercel.app")
  );
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Custom domains — never run auth; rewrite root to /l/{slug} when configured
  if (!isGunzoDomain(host)) {
    if (isPublicAppPath(pathname) || isPublicAssetPath(pathname)) {
      return NextResponse.next();
    }
    if (!pathname.startsWith("/l/") && !pathname.startsWith("/api/")) {
      try {
        const page = await getLinkPageByCustomDomain(host);
        if (page?.slug) {
          const rewriteUrl = request.nextUrl.clone();
          rewriteUrl.pathname = `/l/${page.slug}`;
          return NextResponse.rewrite(rewriteUrl);
        }
      } catch {
        // unknown custom domain — serve without auth
      }
    }
    return NextResponse.next();
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
    "/((?!_next/static|_next/image|favicon\\.ico|api|l/|apple-touch-icon|icon\\.svg|icon-\\d|icons/|manifest|sw\\.js|workbox-|fonts/|images/).*)",
  ],
};
