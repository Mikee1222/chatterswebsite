/**
 * Server-side AES-256-GCM encryption for credential vault secrets.
 * Never import from client components. Never log keys or plaintext.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Normalize env value: trim whitespace and optional surrounding quotes. */
function normalizeEncryptionKeyRaw(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseEncryptionKey(raw: string): Buffer {
  const normalized = normalizeEncryptionKeyRaw(raw);

  if (/^sk-(ant-)?api/i.test(normalized)) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY appears to be an Anthropic API key (sk-ant-…). " +
        "Set a dedicated 32-byte key here (openssl rand -hex 32 or openssl rand -base64 32) — " +
        "do not reuse ANTHROPIC_API_KEY.",
    );
  }

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    key = Buffer.from(normalized, "hex");
  } else {
    const padded =
      normalized.length % 4 === 0
        ? normalized
        : normalized + "=".repeat(4 - (normalized.length % 4));
    key = Buffer.from(padded, "base64");
  }

  if (key.length !== 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (base64- or 64-char hex-encoded)",
    );
  }
  return key;
}

function getEncryptionKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw?.trim()) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not configured");
  }

  return parseEncryptionKey(raw);
}

/** Test-only export: validate key material without touching process.env. */
export function parseCredentialsEncryptionKeyForTest(raw: string): Buffer {
  return parseEncryptionKey(raw);
}

/** Encrypt a JSON-serializable object into a single ciphertext string. */
export function encryptCredentialPayload(payload: Record<string, unknown>): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/** Decrypt ciphertext back to a plain object. */
export function decryptCredentialPayload(ciphertext: string): Record<string, string> {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid credential ciphertext format");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error("Invalid credential ciphertext components");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(decrypted) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid decrypted credential payload");
  }

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    out[k] = v == null ? "" : String(v);
  }
  return out;
}
