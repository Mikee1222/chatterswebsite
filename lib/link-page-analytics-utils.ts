import type { AnalyticsTrend, AnalyticsTrendDirection } from "@/types";

const ATHENS_TZ = "Europe/Athens";

export function cleanReferrerLabel(referrer: string): string {
  const r = referrer.trim().toLowerCase();
  if (!r || r === "direct") return "Direct";
  if (r.includes("instagram.com") || r.includes("l.instagram.com")) return "Instagram";
  if (r.includes("t.co") || r.includes("twitter.com") || r.includes("x.com")) return "Twitter/X";
  if (r.includes("facebook.com") || r.includes("fb.com") || r.includes("fb.me")) return "Facebook";
  if (r.includes("tiktok.com")) return "TikTok";
  if (r.includes("google.")) return "Google";
  if (r.includes("youtube.com") || r.includes("youtu.be")) return "YouTube";
  if (r.includes("telegram.")) return "Telegram";
  if (r.includes("linkedin.com")) return "LinkedIn";
  if (r.includes("reddit.com")) return "Reddit";
  if (r.includes("pinterest.com")) return "Pinterest";
  if (r.includes("snapchat.com")) return "Snapchat";
  if (r.includes("discord.com") || r.includes("discord.gg")) return "Discord";
  try {
    const u = new URL(r.startsWith("http") ? r : `https://${r}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return referrer.length > 48 ? `${referrer.slice(0, 45)}…` : referrer;
  }
}

const REFERRER_ICONS: Record<string, string> = {
  Direct: "↗",
  Instagram: "📸",
  "Twitter/X": "𝕏",
  Facebook: "📘",
  TikTok: "🎵",
  Google: "🔍",
  YouTube: "▶",
  Telegram: "✈",
  LinkedIn: "💼",
  Reddit: "🔴",
  Pinterest: "📌",
  Snapchat: "👻",
  Discord: "💬",
};

export function getReferrerIcon(label: string): string {
  return REFERRER_ICONS[label] ?? "🌐";
}

const COUNTRY_TO_ISO: Record<string, string> = {
  Greece: "GR",
  "United States": "US",
  "United Kingdom": "GB",
  Germany: "DE",
  France: "FR",
  Italy: "IT",
  Spain: "ES",
  Netherlands: "NL",
  Belgium: "BE",
  Portugal: "PT",
  Poland: "PL",
  Romania: "RO",
  Bulgaria: "BG",
  Cyprus: "CY",
  Turkey: "TR",
  Canada: "CA",
  Australia: "AU",
  Brazil: "BR",
  Mexico: "MX",
  India: "IN",
  Japan: "JP",
  "South Korea": "KR",
  China: "CN",
  Russia: "RU",
  Ukraine: "UA",
  Sweden: "SE",
  Norway: "NO",
  Denmark: "DK",
  Finland: "FI",
  Austria: "AT",
  Switzerland: "CH",
  Ireland: "IE",
  "Czech Republic": "CZ",
  Czechia: "CZ",
  Hungary: "HU",
  Croatia: "HR",
  Serbia: "RS",
  Israel: "IL",
  "United Arab Emirates": "AE",
  "Saudi Arabia": "SA",
  Egypt: "EG",
  "South Africa": "ZA",
  Argentina: "AR",
  Colombia: "CO",
  Chile: "CL",
  Philippines: "PH",
  Indonesia: "ID",
  Thailand: "TH",
  Vietnam: "VN",
  Malaysia: "MY",
  Singapore: "SG",
  "New Zealand": "NZ",
  Unknown: "",
};

export function countryToFlag(country: string): string {
  const iso = COUNTRY_TO_ISO[country];
  if (!iso || iso.length !== 2) return "🌍";
  const upper = iso.toUpperCase();
  return String.fromCodePoint(
    ...[...upper].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
  );
}

export function ymdInAthens(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: ATHENS_TZ }).format(d);
}

export function hourInAthens(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return -1;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value;
  return hour != null ? Number.parseInt(hour, 10) : -1;
}

/** Start of calendar day in Athens, offset days from today (0 = today). */
export function athensDayStart(daysOffset = 0): Date {
  const nowYmd = ymdInAthens(new Date().toISOString());
  const [y, m, d] = nowYmd.split("-").map(Number);
  const targetYmd = ymdInAthens(new Date(Date.UTC(y, m - 1, d + daysOffset)).toISOString());

  let lo = Date.now() - 48 * 3_600_000 + daysOffset * 86_400_000;
  let hi = Date.now() + 48 * 3_600_000 + daysOffset * 86_400_000;
  while (hi - lo > 60_000) {
    const mid = Math.floor((lo + hi) / 2);
    const midYmd = ymdInAthens(new Date(mid).toISOString());
    if (midYmd < targetYmd) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

export function computeTrend(current: number, previous: number): AnalyticsTrend {
  if (previous === 0 && current === 0) {
    return { current, previous, changePercent: 0, direction: "flat" };
  }
  if (previous === 0) {
    return { current, previous, changePercent: 100, direction: "up" };
  }
  const changePercent = Math.round(((current - previous) / previous) * 100);
  let direction: AnalyticsTrendDirection = "flat";
  if (changePercent > 0) direction = "up";
  else if (changePercent < 0) direction = "down";
  return { current, previous, changePercent: Math.abs(changePercent), direction };
}

export function withPercent<T extends { count: number }>(
  items: T[],
  total: number
): Array<T & { percent: number }> {
  return items.map((item) => ({
    ...item,
    percent: total > 0 ? Math.round((item.count / total) * 100) : 0,
  }));
}

export function last7DayLabels(): string[] {
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    labels.push(ymdInAthens(new Date(Date.now() - i * 86400000).toISOString()));
  }
  return labels;
}
