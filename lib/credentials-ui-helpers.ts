/** Shared UI helpers for Password Library category normalization and visuals. */

export const EXPECTED_MODEL_CATEGORY_KEYS = [
  "onlyfans",
  "instagram",
  "tiktok",
  "facebook",
  "snapchat",
  "twitter",
  "email",
  "apple",
  "sim",
  "paypal",
  "youtube",
] as const;

export type ExpectedCategoryKey = (typeof EXPECTED_MODEL_CATEGORY_KEYS)[number];

export const EXPECTED_CATEGORY_LABELS: Record<ExpectedCategoryKey, string> = {
  onlyfans: "OnlyFans",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  snapchat: "Snapchat",
  twitter: "Twitter/X",
  email: "Email",
  apple: "Apple ID",
  sim: "SIM Card",
  paypal: "PayPal",
  youtube: "YouTube",
};

export type CategoryVisual = {
  label: string;
  bg: string;
  text: string;
  initials: string;
  chartColor: string;
};

export function normalizeCategoryKey(category: string): string {
  const c = category.trim().toLowerCase();
  if (c.includes("onlyfans") || c === "of") return "onlyfans";
  if (c.includes("instagram") || c === "ig") return "instagram";
  if (c.includes("tiktok") || c === "tt") return "tiktok";
  if (c.includes("facebook") || c === "fb") return "facebook";
  if (c.includes("snap")) return "snapchat";
  if (c.includes("twitter") || c === "x") return "twitter";
  if (c.includes("youtube") || c === "yt") return "youtube";
  if (c.includes("paypal")) return "paypal";
  if (c.includes("apple") || c.includes("icloud")) return "apple";
  if (c.includes("sim")) return "sim";
  if (c.includes("email") || c.includes("mail")) return "email";
  if (c.includes("phone")) return "sim";
  if (c.includes("payment") || c.includes("bank")) return "paypal";
  if (c === "other" || c === "general") return "other";
  return c || "other";
}

export function categoryVisual(category: string): CategoryVisual {
  const key = normalizeCategoryKey(category);
  switch (key) {
    case "instagram":
      return {
        label: category,
        bg: "linear-gradient(135deg,#f09433,#bc1888,#833ab4)",
        text: "#fff",
        initials: "IG",
        chartColor: "#E1306C",
      };
    case "tiktok":
      return {
        label: category,
        bg: "#010101",
        text: "#69C9D0",
        initials: "TT",
        chartColor: "#69C9D0",
      };
    case "facebook":
      return {
        label: category,
        bg: "#1877F2",
        text: "#fff",
        initials: "FB",
        chartColor: "#1877F2",
      };
    case "snapchat":
      return {
        label: category,
        bg: "#FFFC00",
        text: "#111",
        initials: "SC",
        chartColor: "#FFFC00",
      };
    case "paypal":
      return {
        label: category,
        bg: "#003087",
        text: "#fff",
        initials: "PP",
        chartColor: "#003087",
      };
    case "apple":
      return {
        label: category,
        bg: "#555",
        text: "#fff",
        initials: "AP",
        chartColor: "#A2AAAD",
      };
    case "onlyfans":
      return {
        label: category,
        bg: "#00AFF0",
        text: "#fff",
        initials: "OF",
        chartColor: "#00AFF0",
      };
    case "email":
      return {
        label: category,
        bg: "rgba(212,175,140,0.25)",
        text: "#D4AF8C",
        initials: "@",
        chartColor: "#D4AF8C",
      };
    case "sim":
      return {
        label: category,
        bg: "rgba(16,185,129,0.2)",
        text: "#6ee7b7",
        initials: "SIM",
        chartColor: "#10B981",
      };
    case "twitter":
      return {
        label: category,
        bg: "#000",
        text: "#fff",
        initials: "X",
        chartColor: "#1DA1F2",
      };
    case "youtube":
      return {
        label: category,
        bg: "#FF0000",
        text: "#fff",
        initials: "YT",
        chartColor: "#FF0000",
      };
    case "other":
      return {
        label: category,
        bg: "rgba(255,255,255,0.08)",
        text: "rgba(255,255,255,0.7)",
        initials: "••",
        chartColor: "rgba(255,255,255,0.35)",
      };
    default:
      return {
        label: category,
        bg: "rgba(255,255,255,0.08)",
        text: "rgba(255,255,255,0.7)",
        initials: category.slice(0, 2).toUpperCase() || "••",
        chartColor: "rgba(212,175,140,0.55)",
      };
  }
}

export type AttentionReason = "banned" | "deactivated" | "not_working";

const ATTENTION_PATTERNS: { reason: AttentionReason; re: RegExp }[] = [
  { reason: "banned", re: /\bbanned\b/i },
  { reason: "deactivated", re: /\bdeactivated\b/i },
  { reason: "not_working", re: /not working/i },
];

export function detectAttentionReason(notes: string): AttentionReason | null {
  const text = notes.trim();
  if (!text) return null;
  for (const { reason, re } of ATTENTION_PATTERNS) {
    if (re.test(text)) return reason;
  }
  return null;
}

export function attentionReasonLabel(reason: AttentionReason): string {
  switch (reason) {
    case "banned":
      return "Banned / flagged";
    case "deactivated":
      return "Deactivated";
    case "not_working":
      return "Not working";
  }
}

/** Split Notion-style / pasted backup codes into individual tokens. */
export function parseBackupCodes(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];
  const parts = text
    .split(/[\n\r,;|]+|\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1) return parts;
  // Single long whitespace-separated line of codes
  const spaced = text.split(/\s+/).map((p) => p.trim()).filter(Boolean);
  return spaced.length > 1 ? spaced : [text];
}

export type LabeledNotePair = { label: string; value: string };

/**
 * Parse pipe-delimited labeled notes from Notion SIM imports, e.g.
 * `Sim Number: 694… | Pin1: 0581 | PUK1: 86226079`
 */
export function parseLabeledPipeNotes(raw: string): LabeledNotePair[] | null {
  const text = raw.trim();
  if (!text.includes("|") || !text.includes(":")) return null;
  const chunks = text.split("|").map((c) => c.trim()).filter(Boolean);
  if (chunks.length < 2) return null;
  const pairs: LabeledNotePair[] = [];
  for (const chunk of chunks) {
    const idx = chunk.indexOf(":");
    if (idx <= 0) return null;
    const label = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    if (!label || !value) return null;
    pairs.push({ label, value });
  }
  return pairs;
}

/** Card preview when username/email are empty but notes hold the real payload (e.g. SIM). */
export function entryCardSecondaryPreview(entry: {
  category: string;
  fields: { username?: string; email?: string };
  has_value: Partial<Record<string, boolean>>;
}): string | null {
  if (entry.fields.username?.trim() || entry.fields.email?.trim()) return null;
  if (!entry.has_value.notes) return null;
  return normalizeCategoryKey(entry.category) === "sim"
    ? "SIM number, PIN & PUK in notes — open to reveal"
    : "Details stored in notes — open to reveal";
}
