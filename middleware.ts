import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-config";
import { ROUTES } from "@/lib/routes";
import { verifySessionToken } from "@/lib/session-token";

const PUBLIC_PATHS = [ROUTES.login];

/** Paths that must never be blocked by auth (PWA, static assets). Bypass auth and return next() immediately. */
const PUBLIC_ASSET_PREFIXES = [
  "/_next/static",
  "/_next/image",
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
  return PUBLIC_ASSET_PREFIXES.some((prefix) => p.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAssetPath(pathname)) {
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

  return NextResponse.next();
}

// Run middleware for app routes only; do NOT run for static/PWA assets (they bypass auth via isPublicAssetPath if they ever hit middleware)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api|apple-touch-icon|icon\\.svg|icons/|manifest|sw\\.js|workbox-|fonts/|images/).*)",
  ],
};
