/**
 * Client-side image downscale + JPEG re-encode before upload (wardrobe photos).
 * Keeps Supabase storage + egress small: a phone photo (4–8MB HEIC/JPEG) becomes
 * a ~150–300KB JPEG at max 1280px. Falls back to the original when the browser
 * cannot decode the file (then the server-side size cap still applies).
 */

export const WARDROBE_PHOTO_MAX_EDGE = 1280;
export const WARDROBE_PHOTO_QUALITY = 0.82;

export async function compressImageForUpload(
  file: File,
  opts?: { maxEdge?: number; quality?: number },
): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) return file;
  const maxEdge = opts?.maxEdge ?? WARDROBE_PHOTO_MAX_EDGE;
  const quality = opts?.quality ?? WARDROBE_PHOTO_QUALITY;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    // Only swap when it actually helps.
    if (blob.size >= file.size && scale === 1) return file;
    const name = (file.name || "photo").replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
