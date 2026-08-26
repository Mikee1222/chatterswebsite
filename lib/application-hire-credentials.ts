/**
 * Hire credential helpers: cosmetic Gunzo username + strong password.
 * Password encryption uses Password Library AES-256-GCM (credentials-crypto).
 */

import { randomBytes, randomInt } from "crypto";

/** Greek → Latin transliteration for cosmetic usernames. */
const GREEK_TO_LATIN: Record<string, string> = {
  α: "a",
  ά: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  έ: "e",
  ζ: "z",
  η: "i",
  ή: "i",
  θ: "th",
  ι: "i",
  ί: "i",
  ϊ: "i",
  ΐ: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  ό: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "y",
  ύ: "y",
  ϋ: "y",
  ΰ: "y",
  φ: "f",
  χ: "ch",
  ψ: "ps",
  ω: "o",
  ώ: "o",
};

export function transliterateGreekToLatin(input: string): string {
  let out = "";
  for (const ch of input.normalize("NFC")) {
    const lower = ch.toLowerCase();
    if (GREEK_TO_LATIN[lower]) {
      out += GREEK_TO_LATIN[lower];
    } else {
      out += ch;
    }
  }
  return out;
}

/** First name token → lowercase alphanumeric only. */
export function deriveHireFirstname(fullName: string): string {
  const raw = transliterateGreekToLatin(fullName.trim());
  const first = raw.split(/\s+/)[0] ?? "";
  const cleaned = first.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned || "candidate";
}

const SUFFIX_ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomHireSuffix(length = 4): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += SUFFIX_ALPHANUM[randomInt(SUFFIX_ALPHANUM.length)]!;
  }
  return s;
}

/** Format: {firstname}+{suffix}gunzo@gmail.com */
export function buildHireUsername(firstname: string, suffix: string): string {
  return `${firstname}+${suffix}gunzo@gmail.com`;
}

const PASSWORD_LOWER = "abcdefghijkmnopqrstuvwxyz";
const PASSWORD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASSWORD_DIGITS = "23456789";
const PASSWORD_SYMBOLS = "!@#$%&*?";
const PASSWORD_ALL = PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGITS + PASSWORD_SYMBOLS;

/** Strong random password 12–16 chars (mixed case + digits + symbol). */
export function generateStrongHirePassword(length?: number): string {
  const len = length ?? randomInt(12, 17);
  const picks: string[] = [
    PASSWORD_LOWER[randomInt(PASSWORD_LOWER.length)]!,
    PASSWORD_UPPER[randomInt(PASSWORD_UPPER.length)]!,
    PASSWORD_DIGITS[randomInt(PASSWORD_DIGITS.length)]!,
    PASSWORD_SYMBOLS[randomInt(PASSWORD_SYMBOLS.length)]!,
  ];
  while (picks.length < len) {
    picks.push(PASSWORD_ALL[randomInt(PASSWORD_ALL.length)]!);
  }
  // Fisher–Yates with crypto randomness
  for (let i = picks.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [picks[i], picks[j]] = [picks[j]!, picks[i]!];
  }
  return picks.join("");
}

/** Extra entropy helper retained for callers that want raw bytes. */
export function randomHexToken(byteLength = 8): string {
  return randomBytes(byteLength).toString("hex");
}
