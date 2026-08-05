/**
 * Shared constants + validation for client → Supabase Storage direct uploads.
 *
 * Flow: POST /api/attachments/upload-url → client PUT to signed URL → submit
 * form/API with `sb://` (or public https for public buckets) only — avoids
 * Vercel FUNCTION_PAYLOAD_TOO_LARGE.
 */

import {
  CHATTER_ATTACHMENT_MAX_BYTES,
  CHATTER_ATTACHMENT_MAX_MB,
} from "@/lib/chatter-attachment-constants";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { parseSbStorageToken } from "@/lib/supabase-signed-url";
import { WINNER_VIDEO_MAX_FILE_BYTES } from "@/lib/winner-video-files";
import { VA_CONTENT_ASSIGNMENT_MAX_FILE_BYTES } from "@/lib/va-content-assignment-files";

export const ATTACHMENTS_BUCKET = "attachments";
export const FEEDBACK_BUCKET = "feedback-screenshots";
export const PAYMENT_PROOFS_BUCKET = "payment-proofs";
export const LINK_PAGE_ASSETS_BUCKET = "link-page-assets";
export const SOP_FILES_BUCKET = "sop-files";
export const WINNER_VIDEOS_BUCKET = "winner-videos";

export const DIRECT_UPLOAD_PURPOSES = [
  "rebills",
  "tips",
  "extra-revenue",
  "va-phase-item",
  "feedback",
  "shadowban-report",
  "marketing-phone-photos",
  "winner-video-screenshot",
  "spot-check",
  "daily-review",
  "va-mistake",
  "va-content-assignment",
  "video-transcript",
  "payment-proof",
  "sop-file",
  "link-page-asset",
  "user-contract",
] as const;

export type DirectUploadPurpose = (typeof DIRECT_UPLOAD_PURPOSES)[number];

export type DirectUploadKind = "image" | "any" | "video" | "image_or_pdf";

export type DirectUploadPurposeConfig = {
  bucket: string;
  /** Public buckets return https public URLs; private return sb:// tokens. */
  publicBucket?: boolean;
  maxBytes: number;
  kind: DirectUploadKind;
  /** Any of these permissions is enough. */
  permissions: Permission[];
  /** Extra path segment keys the mint route may require. */
  requiresItemId?: boolean;
};

export const DIRECT_UPLOAD_PURPOSE_CONFIG: Record<
  DirectUploadPurpose,
  DirectUploadPurposeConfig
> = {
  rebills: {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: CHATTER_ATTACHMENT_MAX_BYTES,
    kind: "image",
    permissions: [PERMISSIONS.SHIFTS_VIEW],
  },
  tips: {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: CHATTER_ATTACHMENT_MAX_BYTES,
    kind: "image",
    permissions: [PERMISSIONS.SHIFTS_VIEW],
  },
  "extra-revenue": {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: CHATTER_ATTACHMENT_MAX_BYTES,
    kind: "image",
    permissions: [PERMISSIONS.SHIFTS_VIEW],
  },
  "va-phase-item": {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: CHATTER_ATTACHMENT_MAX_BYTES,
    kind: "image",
    permissions: [PERMISSIONS.VA_TASKS_VIEW],
    requiresItemId: true,
  },
  feedback: {
    bucket: FEEDBACK_BUCKET,
    maxBytes: 5 * 1024 * 1024,
    kind: "image",
    permissions: [PERMISSIONS.SETTINGS_VIEW],
  },
  "shadowban-report": {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: CHATTER_ATTACHMENT_MAX_BYTES,
    kind: "image",
    permissions: [PERMISSIONS.MARKETING_MANAGE, PERMISSIONS.MARKETING_SHADOWBAN_REPORT],
  },
  "marketing-phone-photos": {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: 4 * 1024 * 1024,
    kind: "image",
    permissions: [PERMISSIONS.MARKETING_MANAGE],
    requiresItemId: true,
  },
  "winner-video-screenshot": {
    bucket: WINNER_VIDEOS_BUCKET,
    maxBytes: 4 * 1024 * 1024,
    kind: "image",
    permissions: [PERMISSIONS.WINNER_VIDEOS_SUBMIT],
    requiresItemId: true,
  },
  "spot-check": {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: 4 * 1024 * 1024,
    kind: "any",
    permissions: [PERMISSIONS.SPOTCHECK_SUBMIT, PERMISSIONS.SPOTCHECK_MANAGE],
    requiresItemId: true,
  },
  "daily-review": {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: 4 * 1024 * 1024,
    kind: "any",
    permissions: [PERMISSIONS.DAILY_REVIEW_SUBMIT, PERMISSIONS.DAILY_REVIEW_MANAGE],
    requiresItemId: true,
  },
  "va-mistake": {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: CHATTER_ATTACHMENT_MAX_BYTES,
    kind: "image",
    permissions: [PERMISSIONS.MISTAKES_VIEW],
  },
  "va-content-assignment": {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: VA_CONTENT_ASSIGNMENT_MAX_FILE_BYTES,
    kind: "any",
    permissions: [PERMISSIONS.CONTENT_MANAGE],
  },
  "video-transcript": {
    // Large videos — winner-videos bucket allows 500MB (attachments is 50MB).
    bucket: WINNER_VIDEOS_BUCKET,
    maxBytes: WINNER_VIDEO_MAX_FILE_BYTES,
    kind: "video",
    permissions: [PERMISSIONS.VIDEO_TRANSCRIBE_ACCESS],
  },
  "payment-proof": {
    bucket: PAYMENT_PROOFS_BUCKET,
    maxBytes: 10 * 1024 * 1024,
    kind: "image_or_pdf",
    permissions: [PERMISSIONS.PAYMENTS_SUBMIT, PERMISSIONS.CLIENTS_VIEW],
  },
  "sop-file": {
    bucket: SOP_FILES_BUCKET,
    maxBytes: 10 * 1024 * 1024,
    kind: "any",
    permissions: [PERMISSIONS.SOPS_MANAGE],
  },
  "link-page-asset": {
    bucket: LINK_PAGE_ASSETS_BUCKET,
    publicBucket: true,
    maxBytes: 20 * 1024 * 1024,
    kind: "image",
    permissions: [PERMISSIONS.LINK_PAGES_MANAGE],
  },
  "user-contract": {
    bucket: ATTACHMENTS_BUCKET,
    maxBytes: 10 * 1024 * 1024,
    kind: "image_or_pdf",
    permissions: [PERMISSIONS.ACCOUNTS_CREATE, PERMISSIONS.ACCOUNTS_EDIT],
  },
};

export function isDirectUploadPurpose(v: string): v is DirectUploadPurpose {
  return (DIRECT_UPLOAD_PURPOSES as readonly string[]).includes(v);
}

export type DirectUploadPathOpts = {
  itemId?: string;
  pageId?: string;
  assetType?: string;
};

/** Object-path prefix inside the purpose bucket. */
export function directUploadPathPrefix(
  purpose: DirectUploadPurpose,
  opts?: DirectUploadPathOpts
): string {
  const itemId = (opts?.itemId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  switch (purpose) {
    case "va-phase-item":
      return `va_task_phase_items/${itemId}`;
    case "rebills":
    case "tips":
    case "extra-revenue":
      return `chatter/${purpose}`;
    case "feedback":
      return `feedback`;
    case "shadowban-report":
      return `shadowban-reports`;
    case "marketing-phone-photos":
      return `marketing_phones/${itemId}/phone_photos`;
    case "winner-video-screenshot":
      return `winner_videos/${itemId}/screenshot`;
    case "spot-check":
      return `marketing_spot_checks/${itemId}/attachments`;
    case "daily-review":
      return `marketing_daily_reviews/${itemId}/attachments`;
    case "va-mistake":
      return `chatter_mistakes/pending/screenshot`;
    case "va-content-assignment":
      return `va_content_assignments/pending/file_attachment`;
    case "video-transcript":
      return `video_transcripts/pending/video_file`;
    case "payment-proof":
      return `proofs`;
    case "sop-file":
      return `sops`;
    case "link-page-asset": {
      const type = (opts?.assetType || "asset").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      const pageId = (opts?.pageId || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
      return pageId ? `link-pages/${pageId}/${type}` : `link-pages/${type}`;
    }
    case "user-contract":
      return `users/pending/contract_attachments`;
    default: {
      const _exhaustive: never = purpose;
      return _exhaustive;
    }
  }
}

const IMAGE_EXTS = "png|jpe?g|gif|webp|heic|bmp|svg";
const VIDEO_EXTS = "mp4|mov|webm|avi|m4v";
const PDF_EXTS = "pdf";

export function safeUploadBasename(
  original: string,
  fallback = "upload",
  kind: DirectUploadKind = "any"
): string {
  const stripped = original.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const base = stripped.length > 0 ? stripped.slice(0, 120) : fallback;
  if (kind === "image") {
    const hasExt = new RegExp(`\\.(${IMAGE_EXTS})$`, "i").test(base);
    return (hasExt ? base : `${base}.png`).slice(0, 180);
  }
  if (kind === "video") {
    const hasExt = new RegExp(`\\.(${VIDEO_EXTS})$`, "i").test(base);
    return (hasExt ? base : `${base}.mp4`).slice(0, 180);
  }
  if (kind === "image_or_pdf") {
    const hasExt = new RegExp(`\\.(${IMAGE_EXTS}|${PDF_EXTS})$`, "i").test(base);
    return (hasExt ? base : `${base}.bin`).slice(0, 180);
  }
  return base.slice(0, 180) || fallback;
}

export function validateDirectUploadFileMeta(
  purpose: DirectUploadPurpose,
  opts: { size: number; contentType?: string | null; filename?: string }
): string | null {
  const cfg = DIRECT_UPLOAD_PURPOSE_CONFIG[purpose];
  if (!Number.isFinite(opts.size) || opts.size <= 0) return "File is empty.";
  if (opts.size > cfg.maxBytes) {
    const mb = Math.round(cfg.maxBytes / (1024 * 1024));
    return `File must be under ${mb}MB.`;
  }
  const mime = (opts.contentType || "").trim().toLowerCase();
  const name = (opts.filename || "").toLowerCase();
  if (cfg.kind === "image") {
    if (mime && !mime.startsWith("image/")) return "File must be an image.";
  } else if (cfg.kind === "video") {
    const okMime =
      !mime ||
      mime.startsWith("video/") ||
      mime === "application/octet-stream";
    const okExt = /\.(mp4|mov|webm|avi|m4v)$/i.test(name);
    if (!okMime && !okExt) return "File must be a video.";
  } else if (cfg.kind === "image_or_pdf") {
    const ok =
      !mime ||
      mime.startsWith("image/") ||
      mime === "application/pdf" ||
      mime === "application/octet-stream";
    if (!ok) return "File must be an image or PDF.";
  }
  return null;
}

/** @deprecated Use validateDirectUploadFileMeta — kept for tip/rebill callers. */
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
export function isAllowedDirectUploadToken(
  token: string,
  purpose: DirectUploadPurpose,
  opts?: DirectUploadPathOpts
): boolean {
  const cfg = DIRECT_UPLOAD_PURPOSE_CONFIG[purpose];
  if (cfg.publicBucket) {
    // Public assets are https URLs under the project storage host — callers
    // validate via isAllowedPublicStorageUrl when needed.
    return token.startsWith("http://") || token.startsWith("https://") || token.startsWith("sb://");
  }
  const parsed = parseSbStorageToken(token);
  if (!parsed || parsed.bucket !== cfg.bucket) return false;
  if (parsed.path.includes("..") || parsed.path.startsWith("/")) return false;
  const prefix = directUploadPathPrefix(purpose, opts);
  return parsed.path.startsWith(`${prefix}/`);
}

/** @deprecated Alias for screenshot-era callers. */
export function isAllowedDirectScreenshotToken(
  token: string,
  purpose: DirectUploadPurpose,
  opts?: DirectUploadPathOpts
): boolean {
  return isAllowedDirectUploadToken(token, purpose, opts);
}

export function attachmentFromSbToken(
  token: string
): { url: string; filename?: string } {
  const filename =
    token.split("/").pop()?.replace(/^[a-f0-9-]+_\d+\./, "") || undefined;
  return { url: token, ...(filename ? { filename } : {}) };
}

export function attachmentsFromSbTokens(
  tokens: string[]
): Array<{ url: string; filename?: string }> {
  return tokens.filter(Boolean).map(attachmentFromSbToken);
}
