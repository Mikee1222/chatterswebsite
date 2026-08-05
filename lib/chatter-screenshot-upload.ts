import { put } from "@vercel/blob";
import {
  CHATTER_ATTACHMENT_MAX_BYTES,
  CHATTER_ATTACHMENT_MAX_MB,
} from "@/lib/chatter-attachment-constants";
import { isSupabaseBackend } from "@/lib/data-backend";
import { uploadToPrivateStorage } from "@/lib/supabase-signed-url";

function safeScreenshotBasename(original: string): string {
  const stripped = original.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const base = stripped.length > 0 ? stripped.slice(0, 120) : "screenshot";
  const hasKnownExt = /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(base);
  const key = hasKnownExt ? base : `${base}.png`;
  return key.slice(0, 180);
}

/** Upload one image screenshot for rebill/tip forms (Supabase Storage, Blob, or data URL fallback). */
export async function chatterScreenshotAttachments(
  file: File | null,
  blobFolder: string,
  entityId: string
): Promise<Array<{ url: string; filename?: string }>> {
  if (!file || file.size <= 0) return [];
  if (file.size > CHATTER_ATTACHMENT_MAX_BYTES) {
    throw new Error(`Screenshot must be under ${CHATTER_ATTACHMENT_MAX_MB}MB.`);
  }
  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/")) {
    throw new Error("Screenshot must be an image file.");
  }

  const name = safeScreenshotBasename(file.name);

  if (isSupabaseBackend()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const token = await uploadToPrivateStorage({
      bucket: "attachments",
      objectPath: `chatter/${blobFolder}/${entityId}/${Date.now()}_${name}`,
      bytes,
      contentType: mime,
    });
    return [{ url: token, filename: name }];
  }

  const useBlobStore = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (useBlobStore) {
    const blob = await put(`${blobFolder}/${entityId}/${name}`, file, { access: "public" });
    return [{ url: blob.url, filename: name }];
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(new Uint8Array(bytes)).toString("base64");
  return [{ filename: file.name || name, url: `data:${mime};base64,${base64}` }];
}
