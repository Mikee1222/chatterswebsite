"use client";

/**
 * Browser helper: get a signed upload URL, PUT the file to Supabase Storage,
 * return the durable `sb://` token (or public https for public buckets) for the
 * subsequent form/API POST.
 */

import {
  DIRECT_UPLOAD_PURPOSE_CONFIG,
  type DirectUploadPurpose,
  type DirectUploadPathOpts,
} from "@/lib/direct-storage-upload";

export type DirectUploadResult = {
  sbUrl: string;
  filename: string;
  /** Public https URL when purpose uses a public bucket; else same as sbUrl. */
  url: string;
};

export async function uploadFileToSupabaseStorage(
  file: File,
  purpose: DirectUploadPurpose,
  opts?: DirectUploadPathOpts & { contentType?: string }
): Promise<DirectUploadResult> {
  const cfg = DIRECT_UPLOAD_PURPOSE_CONFIG[purpose];
  if (file.size <= 0) throw new Error("File is empty.");
  if (file.size > cfg.maxBytes) {
    const mb = Math.round(cfg.maxBytes / (1024 * 1024));
    throw new Error(`File must be under ${mb}MB.`);
  }

  const contentType =
    opts?.contentType || file.type || "application/octet-stream";

  const mintRes = await fetch("/api/attachments/upload-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      filename: file.name || "upload.bin",
      contentType,
      size: file.size,
      ...(opts?.itemId ? { itemId: opts.itemId } : {}),
      ...(opts?.pageId ? { pageId: opts.pageId } : {}),
      ...(opts?.assetType ? { assetType: opts.assetType } : {}),
    }),
  });
  const mintJson = (await mintRes.json().catch(() => ({}))) as {
    error?: string;
    signedUrl?: string;
    token?: string;
    path?: string;
    sbUrl?: string;
    publicUrl?: string;
    bucket?: string;
  };
  if (!mintRes.ok || !mintJson.signedUrl || !mintJson.path || !mintJson.token) {
    throw new Error(mintJson.error || "Could not prepare upload.");
  }

  const bucket = mintJson.bucket || cfg.bucket;

  // Prefer Storage SDK uploadToSignedUrl (handles FormData + upsert headers).
  // Fall back to raw PUT against the signed URL if the browser client is unavailable.
  const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
  const client = getSupabaseBrowserClient();
  if (client) {
    const { error } = await client.storage
      .from(bucket)
      .uploadToSignedUrl(mintJson.path, mintJson.token, file, {
        contentType,
        upsert: true,
      });
    if (error) {
      throw new Error(error.message || "Upload to storage failed.");
    }
  } else {
    const putRes = await fetch(mintJson.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: file,
    });
    if (!putRes.ok) {
      const detail = await putRes.text().catch(() => "");
      throw new Error(detail.trim() || `Upload failed (${putRes.status}).`);
    }
  }

  const url = mintJson.publicUrl || mintJson.sbUrl;
  if (!url) throw new Error("Upload succeeded but no file URL was returned.");

  return {
    sbUrl: mintJson.sbUrl || url,
    filename: file.name || "upload.bin",
    url,
  };
}

/** Screenshot-era alias used by rebills / tips / extra-revenue / VA phase items. */
export async function uploadScreenshotToSupabaseStorage(
  file: File,
  purpose: DirectUploadPurpose,
  opts?: { itemId?: string }
): Promise<{ sbUrl: string; filename: string }> {
  const cfg = DIRECT_UPLOAD_PURPOSE_CONFIG[purpose];
  if (cfg.kind === "image" && file.type && !file.type.startsWith("image/")) {
    throw new Error("Screenshot must be an image file.");
  }
  const result = await uploadFileToSupabaseStorage(file, purpose, opts);
  return { sbUrl: result.sbUrl, filename: result.filename };
}

export async function uploadFilesToSupabaseStorage(
  files: File[],
  purpose: DirectUploadPurpose,
  opts?: DirectUploadPathOpts
): Promise<DirectUploadResult[]> {
  const out: DirectUploadResult[] = [];
  for (const file of files) {
    out.push(await uploadFileToSupabaseStorage(file, purpose, opts));
  }
  return out;
}
