/**
 * Resolve `sb://bucket/path` storage tokens to short-lived signed URLs.
 * Private buckets store durable path tokens during migration; readers mint URLs here.
 * Airtable / https URLs pass through unchanged.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

const SB_SCHEME = "sb://";
/** Default signed URL TTL (1 hour). */
const DEFAULT_EXPIRES_SEC = 60 * 60;

export function isSbStorageToken(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(SB_SCHEME);
}

/** Parse `sb://bucket/object/path` → { bucket, path }. */
export function parseSbStorageToken(token: string): { bucket: string; path: string } | null {
  if (!isSbStorageToken(token)) return null;
  const rest = token.slice(SB_SCHEME.length);
  const slash = rest.indexOf("/");
  if (slash <= 0 || slash === rest.length - 1) return null;
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  if (!bucket || !path) return null;
  return { bucket, path };
}

/**
 * Mint a signed URL for an `sb://` token. Returns the original string for non-tokens
 * (Airtable CDN, public https, etc.).
 */
export async function resolveStorageUrl(
  url: string | null | undefined,
  expiresInSec = DEFAULT_EXPIRES_SEC
): Promise<string> {
  if (!url) return "";
  if (!isSbStorageToken(url)) return url;
  const parsed = parseSbStorageToken(url);
  if (!parsed) return url;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresInSec);
  if (error || !data?.signedUrl) {
    console.error("[resolveStorageUrl]", parsed.bucket, parsed.path, error?.message);
    return url;
  }
  return data.signedUrl;
}

/** Resolve a list of URL strings (mixed sb:// and https). */
export async function resolveStorageUrls(
  urls: Array<string | null | undefined>,
  expiresInSec = DEFAULT_EXPIRES_SEC
): Promise<string[]> {
  return Promise.all(urls.map((u) => resolveStorageUrl(u, expiresInSec)));
}

export type AttachmentLike = { url: string; filename?: string };

/** Resolve `url` on attachment objects; pass through non-sb tokens. */
export async function resolveAttachmentUrls<T extends AttachmentLike>(
  attachments: T[] | null | undefined,
  expiresInSec = DEFAULT_EXPIRES_SEC
): Promise<T[]> {
  if (!attachments?.length) return [];
  return Promise.all(
    attachments.map(async (a) => ({
      ...a,
      url: await resolveStorageUrl(a.url, expiresInSec),
    }))
  );
}

/**
 * Map text[] storage columns (migration stores `sb://…` or legacy https) to
 * attachment objects, optionally minting signed URLs.
 */
export async function urlsToAttachments(
  urls: string[] | null | undefined,
  opts?: { sign?: boolean; expiresInSec?: number }
): Promise<AttachmentLike[]> {
  if (!urls?.length) return [];
  const sign = opts?.sign !== false;
  const out: AttachmentLike[] = [];
  for (const url of urls) {
    if (!url) continue;
    const resolved = sign ? await resolveStorageUrl(url, opts?.expiresInSec) : url;
    const filename = url.split("/").pop()?.replace(/^[a-f0-9]+_\d+\./, "") || undefined;
    out.push({ url: resolved, ...(filename ? { filename } : {}) });
  }
  return out;
}

/** Upload bytes to a private bucket; returns durable `sb://bucket/path` token. */
export async function uploadToPrivateStorage(opts: {
  bucket: string;
  objectPath: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<string> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.storage.from(opts.bucket).upload(opts.objectPath, opts.bytes, {
    contentType: opts.contentType || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`storage upload: ${error.message}`);
  return `sb://${opts.bucket}/${opts.objectPath}`;
}

/** Durable token for a private storage object path. */
export function privateStorageToken(bucket: string, objectPath: string): string {
  return `sb://${bucket}/${objectPath}`;
}

/**
 * Mint a short-lived signed upload URL (service role). Client PUTs bytes directly
 * to Storage — never through a Next.js / Vercel function body.
 */
export async function createPrivateStorageSignedUpload(opts: {
  bucket: string;
  objectPath: string;
  upsert?: boolean;
}): Promise<{ signedUrl: string; token: string; path: string; sbUrl: string }> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.storage
    .from(opts.bucket)
    .createSignedUploadUrl(opts.objectPath, { upsert: opts.upsert ?? true });
  if (error || !data?.signedUrl || !data.token) {
    throw new Error(`signed upload url: ${error?.message || "unknown error"}`);
  }
  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path || opts.objectPath,
    sbUrl: privateStorageToken(opts.bucket, opts.objectPath),
  };
}
