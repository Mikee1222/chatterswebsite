import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSessionFromCookies } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  isAllowedDirectUploadToken,
  LINK_PAGE_ASSETS_BUCKET,
  safeUploadBasename,
} from "@/lib/direct-storage-upload";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { readRequestFormData } from "@/lib/request-form-data";

const COMPRESS_THRESHOLD_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formOrErr = await readRequestFormData(req);
  if (formOrErr instanceof NextResponse) return formOrErr;
  const form = formOrErr;

  const type = String(form.get("type") ?? "asset").trim() || "asset";
  const pageId = String(form.get("pageId") ?? "").trim();
  const allowedTypes = new Set(["background", "profile", "block", "asset"]);
  if (!allowedTypes.has(type)) {
    return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
  }

  const fileUrl = String(form.get("file_url") ?? "").trim();
  if (fileUrl) {
    if (!isAllowedDirectUploadToken(fileUrl, "link-page-asset", { pageId, assetType: type })) {
      return NextResponse.json({ error: "Invalid file reference" }, { status: 400 });
    }
    return NextResponse.json({ url: fileUrl });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  if (isSupabaseBackend()) {
    // Sharp compression deferred on supabase path — client sends original (or direct-uploads).
    const safeName = safeUploadBasename(file.name || "asset.bin", "asset", "image");
    const folder = pageId ? `link-pages/${pageId}/${type}` : `link-pages/${type}`;
    const objectPath = `${folder}/${Date.now()}_${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sb = getSupabaseServiceClient();
    const { error } = await sb.storage.from(LINK_PAGE_ASSETS_BUCKET).upload(objectPath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
    if (error) {
      console.error("[link-pages/upload] storage upload failed:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 502 });
    }
    const { data } = sb.storage.from(LINK_PAGE_ASSETS_BUCKET).getPublicUrl(objectPath);
    if (!data?.publicUrl) {
      return NextResponse.json({ error: "Upload succeeded but no public URL" }, { status: 502 });
    }
    return NextResponse.json({ url: data.publicUrl });
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
