import { NextRequest, NextResponse } from "next/server";

/** Redirect /favicon.ico to a real PNG so the browser does not fall back to a default letter tile. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/icon-192-v2.png", request.url), 302);
}
