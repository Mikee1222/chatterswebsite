export function cleanReferrerLabel(referrer: string): string {
  const r = referrer.trim().toLowerCase();
  if (!r || r === "direct") return "Direct";
  if (r.includes("instagram.com") || r.includes("l.instagram.com")) return "Instagram";
  if (r.includes("t.co") || r.includes("twitter.com") || r.includes("x.com")) return "Twitter/X";
  if (r.includes("facebook.com") || r.includes("fb.com")) return "Facebook";
  if (r.includes("tiktok.com")) return "TikTok";
  if (r.includes("google.")) return "Google";
  if (r.includes("youtube.com") || r.includes("youtu.be")) return "YouTube";
  if (r.includes("telegram.")) return "Telegram";
  try {
    const u = new URL(r.startsWith("http") ? r : `https://${r}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return referrer.length > 48 ? `${referrer.slice(0, 45)}…` : referrer;
  }
}
