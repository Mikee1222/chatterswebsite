/**
 * Upload a file into an Airtable multipleAttachments field on an existing record.
 * Uses the content subdomain upload endpoint (same contract as pyAirtable upload_attachment).
 */

import { devLog } from "@/lib/dev-log";

function getCredentials(): { token: string; baseId: string } {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    throw new Error("AIRTABLE_TOKEN and AIRTABLE_BASE_ID must be set");
  }
  return { token, baseId };
}

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;

/**
 * POST JSON { contentType, filename, file: base64 } to Airtable; record must already exist.
 */
export async function uploadAirtableAttachment(opts: {
  recordId: string;
  fieldName: string;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  maxBytes?: number;
}): Promise<void> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const buf = Buffer.from(opts.bytes);
  if (buf.length > maxBytes) {
    throw new Error(`File too large (max ${maxBytes / (1024 * 1024)} MB).`);
  }
  const { token, baseId } = getCredentials();
  const pathField = encodeURIComponent(opts.fieldName);
  const url = `https://content.airtable.com/v0/${baseId}/${opts.recordId}/${pathField}/uploadAttachment`;
  const file = buf.toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contentType: opts.contentType || "application/octet-stream",
      filename: opts.filename,
      file,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    devLog("[uploadAirtableAttachment]", "failed", { status: res.status, snippet: text.slice(0, 400) });
    throw new Error(`Attachment upload failed (${res.status}).`);
  }
}
