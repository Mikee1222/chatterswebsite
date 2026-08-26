/**
 * Persist Winner Hub thumbnails to Supabase Storage.
 *
 * ClarioSuite / Instagram Graph CDN URLs are signed (`oh`/`oe`) and expire
 * within days — storing them raw on winner_submissions leaves broken <img>s.
 */

import { WINNER_VIDEOS_BUCKET } from "@/lib/direct-storage-upload";
import { isSbStorageToken, uploadToPrivateStorage } from "@/lib/supabase-signed-url";

const MAX_THUMB_BYTES = 4 * 1024 * 1024;

export function isEphemeralIgCdnUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith("cdninstagram.com") ||
      host.endsWith("fbcdn.net") ||
      host === "instagram.com" ||
      host.endsWith(".instagram.com")
    );
  } catch {
    return false;
  }
}

/** True when we should download + cache (empty or still an ephemeral IG CDN URL). */
export function needsWinnerThumbnailCache(url: string | null | undefined): boolean {
  const t = (url ?? "").trim();
  if (!t) return true;
  if (isSbStorageToken(t)) return false;
  return isEphemeralIgCdnUrl(t);
}

function extFromContentType(ct: string): string {
  const lower = ct.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Download a remote image (while the CDN signature is still valid) and upload
 * to the private winner-videos bucket. Returns durable `sb://` token.
 */
export async function cacheWinnerThumbnailFromUrl(opts: {
  sourceUrl: string;
  submissionId: string;
}): Promise<string | null> {
  const sourceUrl = opts.sourceUrl.trim();
  const submissionId = opts.submissionId.trim();
  if (!sourceUrl || !submissionId) return null;
  if (isSbStorageToken(sourceUrl)) return sourceUrl;

  let res: Response;
  try {
    res = await fetch(sourceUrl, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "GunzoAgencyWinnerThumbCache/1.0",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    console.warn(
      "[winner-thumb] fetch failed",
      submissionId,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }

  if (!res.ok) {
    console.warn("[winner-thumb] fetch HTTP", res.status, submissionId);
    return null;
  }

  const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0]!.trim();
  if (!contentType.startsWith("image/")) {
    console.warn("[winner-thumb] non-image content-type", contentType, submissionId);
    return null;
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.byteLength || buf.byteLength > MAX_THUMB_BYTES) {
    console.warn("[winner-thumb] bad size", buf.byteLength, submissionId);
    return null;
  }

  const ext = extFromContentType(contentType);
  const objectPath = `winner_submissions/${submissionId}/thumbnail.${ext}`;
  return uploadToPrivateStorage({
    bucket: WINNER_VIDEOS_BUCKET,
    objectPath,
    bytes: buf,
    contentType,
  });
}
