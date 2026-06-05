import { put } from "@vercel/blob";

const MAX_BYTES = 10 * 1024 * 1024;

function safeBasename(original: string): string {
  const stripped = original.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  return (stripped.length > 0 ? stripped.slice(0, 120) : "proof").slice(0, 180);
}

function isAllowedProof(file: File): boolean {
  return file.type === "application/pdf" || file.type.startsWith("image/");
}

/** Upload payment proof to Vercel Blob when configured. */
export async function uploadClientPaymentProof(
  file: File
): Promise<{ url: string; filename: string }> {
  if (!isAllowedProof(file)) {
    throw new Error("Invalid file type. Only images or PDF files are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File too large. Maximum 10MB.");
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("Proof upload is not configured. Submit without a file or contact support.");
  }

  const name = safeBasename(file.name);
  const blob = await put(`client-proofs/${Date.now()}-${name}`, file, { access: "public" });
  return { url: blob.url, filename: name };
}
