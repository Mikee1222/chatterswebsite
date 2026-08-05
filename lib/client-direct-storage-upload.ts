"use client";

/**
 * Browser helper: get a signed upload URL, PUT the file to Supabase Storage,
 * return the durable `sb://` token for the subsequent form POST.
 */

import type { DirectUploadPurpose } from "@/lib/direct-storage-upload";
import {
  CHATTER_ATTACHMENT_MAX_BYTES,
  CHATTER_ATTACHMENT_MAX_MB,
} from "@/lib/chatter-attachment-constants";

export async function uploadScreenshotToSupabaseStorage(
  file: File,
  purpose: DirectUploadPurpose,
  opts?: { itemId?: string }
): Promise<{ sbUrl: string; filename: string }> {
  if (file.size <= 0) throw new Error("Screenshot file is empty.");
  if (file.size > CHATTER_ATTACHMENT_MAX_BYTES) {
    throw new Error(`Screenshot must be under ${CHATTER_ATTACHMENT_MAX_MB}MB.`);
  }
  const contentType = file.type || "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error("Screenshot must be an image file.");
  }

  const mintRes = await fetch("/api/attachments/upload-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      filename: file.name || "screenshot.png",
      contentType,
      size: file.size,
      ...(opts?.itemId ? { itemId: opts.itemId } : {}),
    }),
  });
  const mintJson = (await mintRes.json().catch(() => ({}))) as {
    error?: string;
    signedUrl?: string;
    token?: string;
    path?: string;
    sbUrl?: string;
  };
  if (!mintRes.ok || !mintJson.signedUrl || !mintJson.sbUrl || !mintJson.path || !mintJson.token) {
    throw new Error(mintJson.error || "Could not prepare screenshot upload.");
  }

  // Prefer Storage SDK uploadToSignedUrl (handles FormData + upsert headers).
  // Fall back to raw PUT against the signed URL if the browser client is unavailable.
  const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
  const client = getSupabaseBrowserClient();
  if (client) {
    const { error } = await client.storage
      .from("attachments")
      .uploadToSignedUrl(mintJson.path, mintJson.token, file, {
        contentType,
        upsert: true,
      });
    if (error) {
      throw new Error(error.message || "Screenshot upload to storage failed.");
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
      throw new Error(
        detail.trim() || `Screenshot upload failed (${putRes.status}).`
      );
    }
  }

  return {
    sbUrl: mintJson.sbUrl,
    filename: file.name || "screenshot.png",
  };
}
