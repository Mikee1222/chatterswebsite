import type { CustomRequest } from "@/types";

/** Tailwind gradient stops (used with `bg-gradient-to-r`). */
export function gradientClassForCustomRequest(req: Pick<CustomRequest, "custom_type" | "request_title">): string {
  const raw = `${req.custom_type ?? ""} ${req.request_title ?? ""}`.toLowerCase();
  if (raw.includes("video")) return "from-pink-500 via-fuchsia-600 to-purple-700";
  if (raw.includes("photo")) return "from-sky-500 via-cyan-500 to-teal-600";
  if (raw.includes("voice") || raw.includes("rating") || raw.includes("special")) {
    return "from-violet-500 via-purple-600 to-indigo-700";
  }
  if (raw.includes("custom") || raw.includes("request")) return "from-emerald-500 via-teal-500 to-cyan-600";
  return "from-orange-500 via-rose-500 to-red-600";
}

export function gradientClassForContentType(raw: string | null | undefined): string {
  const s = (raw || "").toLowerCase();
  if (s.includes("video") || s.includes("reel")) return "from-pink-500 via-fuchsia-600 to-purple-700";
  if (s.includes("photo") || s.includes("image")) return "from-sky-500 via-cyan-500 to-teal-600";
  if (s.includes("live")) return "from-rose-500 via-orange-500 to-amber-500";
  if (s.includes("story") || s.includes("post")) return "from-indigo-500 to-purple-600";
  return "from-slate-600 via-zinc-700 to-slate-800";
}

export function gradientClassForScheduleItemType(itemType: string | null | undefined): string {
  const t = (itemType || "").toLowerCase();
  if (t === "live_stream") return "from-rose-500 via-pink-600 to-fuchsia-700";
  if (t === "content_shoot") return "from-emerald-500 via-teal-500 to-cyan-600";
  if (t === "custom") return "from-pink-500 via-fuchsia-600 to-purple-700";
  if (t === "script") return "from-violet-500 via-purple-600 to-indigo-700";
  if (t === "mass_message") return "from-sky-500 via-cyan-500 to-blue-600";
  if (t === "va_content") return "from-indigo-500 via-blue-600 to-violet-700";
  if (t === "meeting" || t === "promo") return "from-blue-500 via-indigo-600 to-violet-700";
  if (t === "time_off" || t === "rest") return "from-zinc-500 to-slate-700";
  return "from-pink-500 via-purple-600 to-indigo-700";
}

export function gradientClassForCalendarKind(kind: string | null | undefined): string {
  const k = (kind || "").toLowerCase();
  if (k === "custom") return "from-emerald-500 via-teal-500 to-cyan-600";
  if (k === "va") return "from-blue-500 via-cyan-500 to-teal-600";
  if (k === "task") return "from-amber-500 via-orange-500 to-rose-600";
  return "from-slate-600 to-zinc-800";
}
