import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

const COMPRESS_THRESHOLD_BYTES = 5 * 1024 * 1024;

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

  const compressionDisabled =
    form.get("compress") === "false" || form.get("disableCompression") === "true";
  const shouldCompress = file.size > COMPRESS_THRESHOLD_BYTES && !compressionDisabled;

  let uploadBody: Buffer | File = file;
  let uploadContentType = file.type;
  let uploadName = file.name;

  if (shouldCompress) {
    const input = Buffer.from(await file.arrayBuffer());
    uploadBody = await sharp(input)
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    uploadContentType = "image/webp";
    uploadName = file.name.replace(/\.[^.]+$/, "") + ".webp";
  } else {
    // Compression disabled — upload original file
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File upload not configured" }, { status: 503 });
  }

  const safeName = uploadName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const folder = pageId ? `link-pages/${pageId}/${type}` : `link-pages/${type}`;
  const filename = `${folder}/${Date.now()}-${safeName}`;
  const blob = await put(filename, uploadBody, {
    access: "public",
    addRandomSuffix: false,
    contentType: uploadContentType,
  });
  return NextResponse.json({ url: blob.url });
}
