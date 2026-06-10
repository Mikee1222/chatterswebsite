import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

const ALLOWED_IMAGE_HOSTNAMES = [
  "v5.airtableusercontent.com",
  "airtableusercontent.com",
  "dl.airtable.com",
  "blob.vercel-storage.com",
  "public.blob.vercel-storage.com",
];

function isAllowedImageHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTNAMES.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

function parseSafeImageUrl(rawUrl: string | null): URL | null {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!isAllowedImageHostname(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "settings:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const imageUrl = parseSafeImageUrl(searchParams.get("url"));
  if (!imageUrl) {
    return NextResponse.json({ error: "Invalid or missing image URL" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(imageUrl, {
      headers: { Accept: "image/*" },
      redirect: "follow",
    });
  } catch {
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  }

  if (!parseSafeImageUrl(upstream.url)) {
    return NextResponse.json({ error: "Image fetch blocked" }, { status: 400 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  }

  const contentType = upstream.headers.get("Content-Type") || "image/jpeg";
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=60",
    },
  });
}
