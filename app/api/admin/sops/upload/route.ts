import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  isAllowedDirectUploadToken,
  SOP_FILES_BUCKET,
  safeUploadBasename,
} from "@/lib/direct-storage-upload";
import { hasPermission } from "@/lib/rbac";
import { uploadToPrivateStorage } from "@/lib/supabase-signed-url";
import { readRequestFormData } from "@/lib/request-form-data";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "sops:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    let body: { url?: string; file_url?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const url = String(body.url ?? body.file_url ?? "").trim();
    if (!url) return NextResponse.json({ error: "No url" }, { status: 400 });
    if (!isAllowedDirectUploadToken(url, "sop-file")) {
      return NextResponse.json({ error: "Invalid file reference" }, { status: 400 });
    }
    const name = url.split("/").pop()?.replace(/^[a-f0-9-]+_\d+_/, "") || "file";
    return NextResponse.json({ url, name });
  }

  const formOrErr = await readRequestFormData(req);
  if (formOrErr instanceof NextResponse) return formOrErr;
  const form = formOrErr;

  const fileUrl = String(form.get("file_url") ?? "").trim();
  if (fileUrl) {
    if (!isAllowedDirectUploadToken(fileUrl, "sop-file")) {
      return NextResponse.json({ error: "Invalid file reference" }, { status: 400 });
    }
    const name = fileUrl.split("/").pop()?.replace(/^[a-f0-9-]+_\d+_/, "") || "file";
    return NextResponse.json({ url: fileUrl, name });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  if (isSupabaseBackend()) {
    const safeName = safeUploadBasename(file.name || "file.bin");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const token = await uploadToPrivateStorage({
      bucket: SOP_FILES_BUCKET,
      objectPath: `sops/${Date.now()}_${safeName}`,
      bytes,
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ url: token, name: file.name });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File upload not configured" }, { status: 503 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filename = `sops/${Date.now()}-${safeName}`;
  const blob = await put(filename, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return NextResponse.json({ url: blob.url, name: file.name });
}
