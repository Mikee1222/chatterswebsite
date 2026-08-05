import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  isAllowedDirectUploadToken,
  PAYMENT_PROOFS_BUCKET,
  safeUploadBasename,
} from "@/lib/direct-storage-upload";
import { hasAnyPermission } from "@/lib/rbac";
import { uploadToPrivateStorage } from "@/lib/supabase-signed-url";
import { readRequestFormData } from "@/lib/request-form-data";

const ALLOWED = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "application/pdf",
];

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasAnyPermission(session, ["payments:submit", "clients:view"]))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    let body: { url?: string; proof_url?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const url = String(body.url ?? body.proof_url ?? "").trim();
    if (!url) return NextResponse.json({ error: "No url" }, { status: 400 });
    if (!isAllowedDirectUploadToken(url, "payment-proof")) {
      return NextResponse.json({ error: "Invalid proof reference" }, { status: 400 });
    }
    return NextResponse.json({ url });
  }

  const formOrErr = await readRequestFormData(req);
  if (formOrErr instanceof NextResponse) return formOrErr;
  const form = formOrErr;

  const proofUrl = String(form.get("proof_url") ?? "").trim();
  if (proofUrl) {
    if (!isAllowedDirectUploadToken(proofUrl, "payment-proof")) {
      return NextResponse.json({ error: "Invalid proof reference" }, { status: 400 });
    }
    return NextResponse.json({ url: proofUrl });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const clientId = session.airtableUserId ?? session.id;
  const safeName = safeUploadBasename(file.name || "proof.bin", "proof", "image_or_pdf");

  if (isSupabaseBackend()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const token = await uploadToPrivateStorage({
      bucket: PAYMENT_PROOFS_BUCKET,
      objectPath: `proofs/${clientId}/${Date.now()}_${safeName}`,
      bytes,
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ url: token });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File upload not configured" }, { status: 503 });
  }

  const filename = `proofs/${clientId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const blob = await put(filename, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return NextResponse.json({ url: blob.url });
}
