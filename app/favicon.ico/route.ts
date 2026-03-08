import { NextRequest, NextResponse } from "next/server";

/** Redirect /favicon.ico to the app icon so the browser does not get 404. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/icon.svg", request.url), 302);
}
