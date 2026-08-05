import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  ATTACHMENTS_BUCKET,
  directUploadPathPrefix,
  isDirectUploadPurpose,
  safeUploadBasename,
  validateScreenshotFileMeta,
  type DirectUploadPurpose,
} from "@/lib/direct-storage-upload";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { createPrivateStorageSignedUpload } from "@/lib/supabase-signed-url";

function purposePermission(purpose: DirectUploadPurpose): Permission {
  return purpose === "va-phase-item" ? PERMISSIONS.VA_TASKS_VIEW : PERMISSIONS.SHIFTS_VIEW;
}

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
  const purpose = purposeRaw;

  if (!(await hasPermission(session, purposePermission(purpose)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (purpose === "va-phase-item" && !String(body.itemId ?? "").trim()) {
    return NextResponse.json({ error: "itemId is required for VA screenshots" }, { status: 400 });
  }

  const size = typeof body.size === "number" ? body.size : Number(body.size);
  const contentType = String(body.contentType ?? "").trim() || "image/png";
  const filename = safeUploadBasename(String(body.filename ?? "screenshot.png"));

  const metaError = validateScreenshotFileMeta({ size, contentType, filename });
  if (metaError) {
    return NextResponse.json({ error: metaError }, { status: 400 });
  }

  const userKey = (session.airtableUserId ?? session.id)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
  const prefix = directUploadPathPrefix(purpose, {
    itemId: String(body.itemId ?? "").trim() || undefined,
  });
  const objectPath = `${prefix}/${userKey}_${Date.now()}_${filename}`;

  try {
    const signed = await createPrivateStorageSignedUpload({
      bucket: ATTACHMENTS_BUCKET,
      objectPath,
      upsert: true,
    });
    return NextResponse.json({
      bucket: ATTACHMENTS_BUCKET,
      path: signed.path,
      signedUrl: signed.signedUrl,
      token: signed.token,
      sbUrl: signed.sbUrl,
    });
  } catch (err) {
    console.error("[attachments/upload-url]", err);
    return NextResponse.json({ error: "Could not create upload URL" }, { status: 502 });
  }
}
