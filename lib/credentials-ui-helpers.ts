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
