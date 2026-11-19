/**
 * Hermes agent token format: gz_agent_ + 40 chars from [A-Za-z0-9].
 * Generation uses crypto.randomBytes + rejection sampling (no modulo bias).
 */

import { createHash, randomBytes } from "crypto";

export const AGENT_TOKEN_PREFIX = "gz_agent_";
export const AGENT_TOKEN_RANDOM_LEN = 40;
/** First 12 characters of the full token (includes gz_agent_ + 3 random). */
export const AGENT_TOKEN_DISPLAY_PREFIX_LEN = 12;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ALPHABET_LEN = 62;
/** Largest multiple of 62 that fits in a byte — reject bytes >= this. */
const REJECT_THRESHOLD = 256 - (256 % ALPHABET_LEN); // 248

export function generateAgentTokenPlaintext(): string {
  let out = "";
  while (out.length < AGENT_TOKEN_RANDOM_LEN) {
    const bytes = randomBytes(AGENT_TOKEN_RANDOM_LEN * 2);
    for (let i = 0; i < bytes.length && out.length < AGENT_TOKEN_RANDOM_LEN; i++) {
      const b = bytes[i]!;
      if (b >= REJECT_THRESHOLD) continue;
      out += ALPHABET[b % ALPHABET_LEN]!;
    }
  }
  return `${AGENT_TOKEN_PREFIX}${out}`;
}

export function isAgentTokenFormat(token: string): boolean {
  if (!token.startsWith(AGENT_TOKEN_PREFIX)) return false;
  const rest = token.slice(AGENT_TOKEN_PREFIX.length);
  if (rest.length !== AGENT_TOKEN_RANDOM_LEN) return false;
  return /^[A-Za-z0-9]+$/.test(rest);
}

export function hashAgentToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function agentTokenDisplayPrefix(plaintext: string): string {
  return plaintext.slice(0, AGENT_TOKEN_DISPLAY_PREFIX_LEN);
}
