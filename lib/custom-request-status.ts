import { getWeekStartYmdInAthens } from "@/lib/airtable-datetime";
import type { CustomRequest, CustomRequestType } from "@/types";

export type CustomRequestDisplayStatus =
  | "pending"
  | "rejected"
  | "accepted"
  | "scheduled"
  | "in_progress"
  | "delivered"
  | "completed"
  | "declined";

export type CustomRequestLang = "en" | "es";

export const CUSTOM_REQUEST_STATUS_LABELS: Record<
  CustomRequestDisplayStatus,
  { en: string; es: string }
> = {
  pending: { en: "Pending", es: "Pendiente" },
  rejected: { en: "Rejected", es: "Rechazado" },
  accepted: { en: "Accepted", es: "Aceptado" },
  scheduled: { en: "Scheduled", es: "Programado" },
  in_progress: { en: "In progress", es: "En curso" },
  delivered: { en: "Delivered", es: "Entregado" },
  completed: { en: "Completed", es: "Completado" },
  declined: { en: "Declined", es: "Rechazado por modelo" },
};

export const CUSTOM_REQUEST_STATUS_CLASS: Record<CustomRequestDisplayStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  rejected: "border-rose-500/35 bg-rose-500/15 text-rose-300",
  accepted: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  scheduled: "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
  in_progress: "border-violet-500/30 bg-violet-500/15 text-violet-300",
  delivered: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  completed: "border-green-500/30 bg-green-500/15 text-green-300",
  declined: "border-rose-500/35 bg-rose-500/15 text-rose-300",
};

export const CUSTOM_REQUEST_STATUS_ORDER: CustomRequestDisplayStatus[] = [
  "pending",
  "accepted",
  "scheduled",
  "in_progress",
  "delivered",
  "completed",
  "rejected",
  "declined",
];

export function getCustomRequestDisplayStatus(req: CustomRequest): CustomRequestDisplayStatus {
  if (req.admin_status === "pending") return "pending";
  if (req.admin_status === "rejected") return "rejected";
  const k = (req.model_status || "").trim().toLowerCase();
  if (k === "declined") return "declined";
  if (k === "uploaded") return "delivered";
  if (k === "completed") return "completed";
  if (k === "in_progress") return "in_progress";
  if (k === "scheduled") return "scheduled";
  return "accepted";
}

export function customRequestStatusLabel(
  status: CustomRequestDisplayStatus,
  lang: CustomRequestLang = "en",
): string {
  return CUSTOM_REQUEST_STATUS_LABELS[status][lang];
}

export function displayCustomRequestTitle(req: CustomRequest): string {
  return (req.request_title ?? req.custom_type ?? "").trim() || "—";
}

export function displayCustomRequestDescription(req: CustomRequest): string {
  return (req.request_details ?? req.description ?? "").trim();
}

export function resolveCustomRequestType(req: CustomRequest): CustomRequestType | "other" {
  const raw = (req.custom_type ?? req.request_title ?? "").toLowerCase();
  if (raw.includes("video")) return "video";
  if (raw.includes("photo")) return "photo_set";
  if (raw.includes("voice") || req.custom_type === "voice_note") return "voice_note";
  if (raw.includes("rating") || req.custom_type === "rating") return "rating";
  if (raw.includes("special") || req.custom_type === "special_request") return "special_request";
  return req.custom_type ?? "other";
}

export function customRequestTypeLabel(type: CustomRequestType | "other"): string {
  if (type === "video") return "Video";
  if (type === "photo_set") return "Photo set";
  if (type === "voice_note") return "Voice note";
  if (type === "rating") return "Rating";
  if (type === "special_request") return "Special";
  return "Other";
}

export function customRequestTypeBadgeClass(type: CustomRequestType | "other"): string {
  if (type === "video") return "border-violet-500/30 bg-violet-500/15 text-violet-300";
  if (type === "photo_set") return "border-blue-500/30 bg-blue-500/15 text-blue-300";
  if (type === "voice_note") return "border-cyan-500/30 bg-cyan-500/15 text-cyan-300";
  return "border-white/15 bg-white/5 text-white/60";
}

export function countCustomRequestsThisWeek(rows: CustomRequest[]): number {
  const weekStart = getWeekStartYmdInAthens(0);
  return rows.filter((r) => (r.created_at ?? "").slice(0, 10) >= weekStart).length;
}

export function countCustomRequestsByDisplayStatus(rows: CustomRequest[]) {
  const c: Record<CustomRequestDisplayStatus, number> & { total: number } = {
    total: rows.length,
    pending: 0,
    rejected: 0,
    accepted: 0,
    scheduled: 0,
    in_progress: 0,
    delivered: 0,
    completed: 0,
    declined: 0,
  };
  for (const r of rows) {
    c[getCustomRequestDisplayStatus(r)] += 1;
  }
  return c;
}

export function customRequestCanMarkDelivered(req: CustomRequest): boolean {
  if (req.admin_status !== "accepted") return false;
  const s = getCustomRequestDisplayStatus(req);
  return s === "accepted" || s === "scheduled" || s === "in_progress";
}

export function customRequestIsPending(req: CustomRequest): boolean {
  return getCustomRequestDisplayStatus(req) === "pending";
}
