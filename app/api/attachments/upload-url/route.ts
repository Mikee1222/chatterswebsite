import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  DIRECT_UPLOAD_PURPOSE_CONFIG,
  directUploadPathPrefix,
  isDirectUploadPurpose,
  safeUploadBasename,
  validateDirectUploadFileMeta,
  type DirectUploadPurpose,
} from "@/lib/direct-storage-upload";
import { hasAnyPermission } from "@/lib/rbac";
import {
  createPrivateStorageSignedUpload,
  privateStorageToken,
} from "@/lib/supabase-signed-url";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * Mint a short-lived Supabase Storage signed upload URL.
 * Body is JSON only (no file bytes) so Vercel body limits never apply.
 */
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseBackend()) {
    return NextResponse.json(
      { error: "Direct storage upload is only available on the Supabase backend." },
      { status: 400 }
    );
  }

  let body: {
    purpose?: string;
    filename?: string;
    contentType?: string;
    size?: number;
    itemId?: string;
    pageId?: string;
    assetType?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const purposeRaw = String(body.purpose ?? "").trim();
  if (!isDirectUploadPurpose(purposeRaw)) {
    return NextResponse.json({ error: "Invalid upload purpose" }, { status: 400 });
  }
  const purpose: DirectUploadPurpose = purposeRaw;
  const cfg = DIRECT_UPLOAD_PURPOSE_CONFIG[purpose];

  if (!(await hasAnyPermission(session, cfg.permissions))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (cfg.requiresItemId && !String(body.itemId ?? "").trim()) {
    return NextResponse.json({ error: "itemId is required for this upload" }, { status: 400 });
  }

  const size = typeof body.size === "number" ? body.size : Number(body.size);
  const contentType = String(body.contentType ?? "").trim() || "application/octet-stream";
  const filename = safeUploadBasename(
    String(body.filename ?? "upload.bin"),
    "upload",
    cfg.kind
  );

  const metaError = validateDirectUploadFileMeta(purpose, { size, contentType, filename });
  if (metaError) {
    return NextResponse.json({ error: metaError }, { status: 400 });
  }

  const userKey = (session.airtableUserId ?? session.id)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
  const prefix = directUploadPathPrefix(purpose, {
    itemId: String(body.itemId ?? "").trim() || undefined,
    pageId: String(body.pageId ?? "").trim() || undefined,
    assetType: String(body.assetType ?? "").trim() || undefined,
  });
  const objectPath = `${prefix}/${userKey}_${Date.now()}_${filename}`;

  try {
    const signed = await createPrivateStorageSignedUpload({
      bucket: cfg.bucket,
      objectPath,
      upsert: true,
    });

    let publicUrl: string | undefined;
    if (cfg.publicBucket) {
      const sb = getSupabaseServiceClient();
      const { data } = sb.storage.from(cfg.bucket).getPublicUrl(objectPath);
      publicUrl = data.publicUrl || undefined;
    }

    return NextResponse.json({
      bucket: cfg.bucket,
      path: signed.path,
      signedUrl: signed.signedUrl,
      token: signed.token,
      sbUrl: signed.sbUrl || privateStorageToken(cfg.bucket, objectPath),
      ...(publicUrl ? { publicUrl } : {}),
    });
  } catch (err) {
    console.error("[attachments/upload-url]", err);
    return NextResponse.json({ error: "Could not create upload URL" }, { status: 502 });
  }
}
