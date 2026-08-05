/**
 * Shared constants + validation for client → Supabase Storage direct uploads
 * (rebills / tips / extra-revenue / VA phase screenshots).
 *
 * Flow: POST /api/attachments/upload-url → client PUT to signed URL → submit
 * form with `sb://` token only (avoids Vercel FUNCTION_PAYLOAD_TOO_LARGE).
 */

import {
  CHATTER_ATTACHMENT_MAX_BYTES,
  CHATTER_ATTACHMENT_MAX_MB,
} from "@/lib/chatter-attachment-constants";
import { parseSbStorageToken } from "@/lib/supabase-signed-url";

export const ATTACHMENTS_BUCKET = "attachments";

export const DIRECT_UPLOAD_PURPOSES = [
  "rebills",
  "tips",
  "extra-revenue",
  "va-phase-item",
] as const;

export type DirectUploadPurpose = (typeof DIRECT_UPLOAD_PURPOSES)[number];

export function isDirectUploadPurpose(v: string): v is DirectUploadPurpose {
  return (DIRECT_UPLOAD_PURPOSES as readonly string[]).includes(v);
}

/** Object-path prefix inside the attachments bucket for a purpose. */
export function directUploadPathPrefix(
  purpose: DirectUploadPurpose,
  opts?: { itemId?: string }
): string {
  if (purpose === "va-phase-item") {
    const itemId = (opts?.itemId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    return `va_task_phase_items/${itemId}`;
  }
  return `chatter/${purpose}`;
}

export function safeUploadBasename(original: string, fallback = "screenshot"): string {
  const stripped = original.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const base = stripped.length > 0 ? stripped.slice(0, 120) : fallback;
  const hasKnownExt = /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(base);
  return (hasKnownExt ? base : `${base}.png`).slice(0, 180);
}

export function validateScreenshotFileMeta(opts: {
  size: number;
  contentType?: string | null;
  filename?: string;
}): string | null {
  if (!Number.isFinite(opts.size) || opts.size <= 0) return "Screenshot file is empty.";
  if (opts.size > CHATTER_ATTACHMENT_MAX_BYTES) {
    return `Screenshot must be under ${CHATTER_ATTACHMENT_MAX_MB}MB.`;
  }
  const mime = (opts.contentType || "").trim();
  if (mime && !mime.startsWith("image/")) {
    return "Screenshot must be an image file.";
  }
  return null;
}

/**
 * Accept only durable tokens we minted for the given purpose
 * (prevents clients from attaching arbitrary sb:// paths).
 */
export function isAllowedDirectScreenshotToken(
  token: string,
  purpose: DirectUploadPurpose,
  opts?: { itemId?: string }
): boolean {
  const parsed = parseSbStorageToken(token);
  if (!parsed || parsed.bucket !== ATTACHMENTS_BUCKET) return false;
  if (parsed.path.includes("..") || parsed.path.startsWith("/")) return false;
  const prefix = directUploadPathPrefix(purpose, opts);
  return parsed.path.startsWith(`${prefix}/`);
}

export function attachmentFromSbToken(
  token: string
): { url: string; filename?: string } {
  const filename =
    token.split("/").pop()?.replace(/^[a-f0-9-]+_\d+\./, "") || undefined;
  return { url: token, ...(filename ? { filename } : {}) };
}
