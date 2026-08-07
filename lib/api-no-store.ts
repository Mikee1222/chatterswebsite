import { NextResponse } from "next/server";

/** Authenticated JSON must never be cached (mobile Safari + SW are aggressive with `public`). */
export const API_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

export function jsonNoStore(
  body: unknown,
  init?: { status?: number; headers?: HeadersInit },
): NextResponse {
  const headers = new Headers(init?.headers);
  for (const [k, v] of Object.entries(API_NO_STORE_HEADERS)) {
    headers.set(k, v);
  }
  return NextResponse.json(body, { status: init?.status, headers });
}
