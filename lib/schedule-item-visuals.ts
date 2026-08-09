import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  Coffee,
  FileText,
  MapPin,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Palmtree,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import type { ModelScheduleItemType } from "@/types";

/** Extract "Location: …" line from schedule details (filming sync format). */
export function extractScheduleLocation(details: string | null | undefined): string {
  if (!details?.trim()) return "";
  return details.match(/^Location:\s*(.+)$/m)?.[1]?.trim() || "";
}

/** Strip internal filming_schedule markers from model-facing details. */
export function sanitizeScheduleDetailsForDisplay(details: string | null | undefined): string {
  if (!details?.trim()) return "";
  return details
    .split("\n")
    .filter((line) => !/^filming_schedule:/i.test(line.trim()))
    .join("\n")
    .trim();
}

export type ScheduleItemVisual = {
  Icon: LucideIcon;
  /** Card / chip surface */
  surface: string;
  /** Accent bar / icon tint */
  accent: string;
  /** Soft glow ring for prominent types (content_shoot) */
  ring?: string;
  label: string;
};

const VISUALS: Record<ModelScheduleItemType, ScheduleItemVisual> = {
  script: {
    Icon: FileText,
    surface: "border-violet-400/35 bg-violet-500/12 text-violet-50",
    accent: "text-violet-300",
    label: "Script",
  },
  mass_message: {
    Icon: MessageSquare,
    surface: "border-sky-400/35 bg-sky-500/12 text-sky-50",
    accent: "text-sky-300",
    label: "Mass message",
  },
  live_stream: {
    Icon: Radio,
    surface: "border-rose-400/40 bg-rose-500/15 text-rose-50",
    accent: "text-rose-300",
    ring: "ring-1 ring-rose-400/25",
    label: "Live stream",
  },
  custom: {
    Icon: Sparkles,
    surface: "border-pink-400/35 bg-pink-500/12 text-pink-50",
    accent: "text-pink-300",
    label: "Custom",
  },
  content_shoot: {
    Icon: Clapperboard,
    surface: "border-emerald-400/45 bg-emerald-500/15 text-emerald-50",
    accent: "text-emerald-300",
    ring: "ring-1 ring-emerald-400/30 shadow-[0_0_24px_-8px_rgba(16,185,129,0.45)]",
    label: "Content shoot",
  },
  promo: {
    Icon: Megaphone,
    surface: "border-amber-400/35 bg-amber-500/12 text-amber-50",
    accent: "text-amber-300",
    label: "Promo",
  },
  meeting: {
    Icon: Users,
    surface: "border-blue-400/35 bg-blue-500/12 text-blue-50",
    accent: "text-blue-300",
    label: "Meeting",
  },
  rest: {
    Icon: Coffee,
    surface: "border-teal-400/30 bg-teal-500/10 text-teal-50",
    accent: "text-teal-300",
    label: "Rest",
  },
  time_off: {
    Icon: Palmtree,
    surface: "border-zinc-400/30 bg-zinc-500/12 text-zinc-100",
    accent: "text-zinc-300",
    label: "Time off",
  },
  va_content: {
    Icon: Palette,
    surface: "border-indigo-400/35 bg-indigo-500/12 text-indigo-50",
    accent: "text-indigo-300",
    label: "Chatting content",
  },
  other: {
    Icon: MoreHorizontal,
    surface: "border-white/20 bg-white/[0.07] text-white/90",
    accent: "text-white/55",
    label: "Other",
  },
};

export function scheduleItemVisual(itemType: string | null | undefined): ScheduleItemVisual {
  const key = (itemType || "other").toLowerCase() as ModelScheduleItemType;
  return VISUALS[key] ?? VISUALS.other;
}

export { MapPin };
