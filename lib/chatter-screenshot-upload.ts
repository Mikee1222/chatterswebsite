import { put } from "@vercel/blob";
import { CHATTER_ATTACHMENT_MAX_BYTES } from "@/lib/chatter-attachment-constants";

function safeScreenshotBasename(original: string): string {
  const stripped = original.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const base = stripped.length > 0 ? stripped.slice(0, 120) : "screenshot";
  const hasKnownExt = /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(base);
  const key = hasKnownExt ? base : `${base}.png`;
  return key.slice(0, 180);
}

/** Upload one image screenshot for rebill/tip forms (blob when configured, else data URL fallback). */
export async function chatterScreenshotAttachments(
  file: File | null,
  blobFolder: string,
  entityId: string
): Promise<Array<{ url: string; filename?: string }>> {
  if (!file || file.size <= 0 || file.size >= CHATTER_ATTACHMENT_MAX_BYTES) return [];
  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/")) return [];

  const useBlobStore = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const name = safeScreenshotBasename(file.name);

  if (useBlobStore) {
    const blob = await put(`${blobFolder}/${entityId}/${name}`, file, { access: "public" });
    return [{ url: blob.url, filename: name }];
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(new Uint8Array(bytes)).toString("base64");
  return [{ filename: file.name || name, url: `data:${mime};base64,${base64}` }];
}
