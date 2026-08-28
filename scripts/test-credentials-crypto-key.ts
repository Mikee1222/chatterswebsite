/**
 * Unit smoke test for CREDENTIALS_ENCRYPTION_KEY parsing (hex + base64).
 *   npx tsx scripts/test-credentials-crypto-key.ts
 */

import { randomBytes } from "crypto";
import {
  encryptCredentialPayload,
  decryptCredentialPayload,
  parseCredentialsEncryptionKeyForTest,
} from "../lib/credentials-crypto";

function assert(name: string, ok: boolean) {
  console.log(`${name}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) process.exitCode = 1;
}

const hexKey = randomBytes(32).toString("hex");
const b64Key = randomBytes(32).toString("base64");

assert("hex key parses to 32 bytes", parseCredentialsEncryptionKeyForTest(hexKey).length === 32);
assert("base64 key parses to 32 bytes", parseCredentialsEncryptionKeyForTest(b64Key).length === 32);
assert(
  "quoted hex key parses",
  parseCredentialsEncryptionKeyForTest(`"${hexKey}"`).length === 32,
);

let anthropicRejected = false;
try {
  parseCredentialsEncryptionKeyForTest("sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789AB");
} catch (e) {
  anthropicRejected = e instanceof Error && e.message.includes("Anthropic API key");
}
assert("sk-ant key rejected with clear error", anthropicRejected);

process.env.CREDENTIALS_ENCRYPTION_KEY = hexKey;
const ciphertext = encryptCredentialPayload({ password: "roundtrip-test" });
const decrypted = decryptCredentialPayload(ciphertext);
assert("encrypt/decrypt roundtrip (hex)", decrypted.password === "roundtrip-test");

process.env.CREDENTIALS_ENCRYPTION_KEY = b64Key;
const ciphertext2 = encryptCredentialPayload({ password: "roundtrip-b64" });
const decrypted2 = decryptCredentialPayload(ciphertext2);
assert("encrypt/decrypt roundtrip (base64)", decrypted2.password === "roundtrip-b64");

console.log("Done.");
