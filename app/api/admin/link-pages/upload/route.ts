import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const type = String(form.get("type") ?? "asset").trim() || "asset";
  const pageId = String(form.get("pageId") ?? "").trim();
  const allowedTypes = new Set(["background", "profile", "block", "asset"]);
  if (!allowedTypes.has(type)) {
    return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
  }

  const maxBytes = type === "background" || type === "profile" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    const maxMb = maxBytes / (1024 * 1024);
    return NextResponse.json({ error: `File too large (max ${maxMb}MB)` }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File upload not configured" }, { status: 503 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const folder = pageId ? `link-pages/${pageId}/${type}` : `link-pages/${type}`;
  const filename = `${folder}/${Date.now()}-${safeName}`;
  const blob = await put(filename, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return NextResponse.json({ url: blob.url });
}
