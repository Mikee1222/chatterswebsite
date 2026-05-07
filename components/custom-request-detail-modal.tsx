"use client";

import * as React from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { BeautifulDetailModal, type BeautifulDetailTimelineItem } from "@/components/beautiful-detail-modal";
import { gradientClassForCustomRequest } from "@/lib/detail-modal-gradients";
import type { CustomRequest, CustomRequestAdminStatus, CustomRequestModelStatus } from "@/types";

export type CustomRequestDetailLanguage = "en" | "es";
export type CustomRequestDetailVariant = "model" | "agency";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: CustomRequest | null;
  language: CustomRequestDetailLanguage;
  variant: CustomRequestDetailVariant;
  /** Model: opens schedule flow (e.g. parent closes detail and opens schedule modal). */
  onSchedule?: () => void;
  /** Model: opens mark-uploaded flow. */
  onMarkUploaded?: () => void;
  children?: React.ReactNode;
};

function t(lang: CustomRequestDetailLanguage, en: string, es: string) {
  return lang === "es" ? es : en;
}

function displayType(req: CustomRequest): string {
  return (req.custom_type ?? req.request_title ?? "").trim() || "—";
}

const EN_GB_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

function formatUkLongDate(raw: string): string {
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-GB", EN_GB_DATE);
  const slice = raw.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) {
    const d2 = new Date(`${slice}T12:00:00.000Z`);
    if (!Number.isNaN(d2.getTime())) return d2.toLocaleDateString("en-GB", EN_GB_DATE);
  }
  return raw.trim();
}

function displayRequestedDate(req: CustomRequest, lang: CustomRequestDetailLanguage): string {
  const raw = (req.deadline_requested ?? "").trim();
  if (raw) {
    return formatUkLongDate(raw);
  }
  const c = (req.created_at ?? "").trim();
  if (!c) return "—";
  const d = new Date(c);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", EN_GB_DATE);
}

function formatCreatedAt(req: CustomRequest): string {
  const c = (req.created_at ?? "").trim();
  if (!c) return "—";
  const d = new Date(c);
  if (Number.isNaN(d.getTime())) return c.slice(0, 16);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function modelStatusLabel(lang: CustomRequestDetailLanguage, s: CustomRequestModelStatus): string {
  const map: Record<CustomRequestModelStatus, [string, string]> = {
    waiting_schedule: ["Pending schedule", "Pendiente de programar"],
    scheduled: ["Scheduled", "Programado"],
    in_progress: ["In progress", "En curso"],
    completed: ["Completed", "Completado"],
    uploaded: ["Uploaded", "Subido"],
    declined: ["Declined", "Rechazado"],
  };
  const pair = map[s] ?? ["—", "—"];
  return t(lang, pair[0], pair[1]);
}

function adminStatusLabel(lang: CustomRequestDetailLanguage, s: CustomRequestAdminStatus): string {
  const map: Record<CustomRequestAdminStatus, [string, string]> = {
    pending: ["Pending review", "Pendiente de revisión"],
    accepted: ["Accepted", "Aceptado"],
    rejected: ["Rejected", "Rechazado"],
  };
  const pair = map[s] ?? [s, s];
  return t(lang, pair[0], pair[1]);
}

function formatScheduleLine(req: CustomRequest): string {
  const dateRaw = (req.model_scheduled_date ?? "").trim();
  if (!dateRaw) return "—";
  const dateLabel = formatUkLongDate(dateRaw);
  const a = req.model_scheduled_start ? new Date(req.model_scheduled_start) : null;
  const b = req.model_scheduled_end ? new Date(req.model_scheduled_end) : null;
  if (a && b && !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
    const ta = a.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const tb = b.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${dateLabel} · ${ta}–${tb}`;
  }
  return dateLabel;
}

function formatUploadedAt(req: CustomRequest): string {
  const raw = (req.uploaded_at ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function modelStatusLabelEn(s: CustomRequestModelStatus): string {
  const map: Record<CustomRequestModelStatus, string> = {
    waiting_schedule: "Waiting schedule",
    scheduled: "Scheduled",
    in_progress: "In progress",
    completed: "Completed",
    uploaded: "Uploaded",
    declined: "Declined",
  };
  return map[s] ?? s;
}

function buildTimeline(
  req: CustomRequest,
  lang: CustomRequestDetailLanguage,
  variant: CustomRequestDetailVariant
): BeautifulDetailTimelineItem[] {
  const submittedVal = formatCreatedAt(req);
  const adminLabel =
    variant === "model"
      ? t(lang, "Agency decision", "Decisión de agencia")
      : t(lang, "Agency review", "Revisión de agencia");
  const adminDetail = adminStatusLabel(lang, req.admin_status);
  const modelLabel = variant === "model" ? t(lang, "Model pipeline", "Flujo del modelo") : "Model pipeline";
  const modelDetail =
    variant === "model" ? modelStatusLabel(lang, req.model_status) : modelStatusLabelEn(req.model_status);

  let adminStatus: BeautifulDetailTimelineItem["status"] = "done";
  if (req.admin_status === "pending") adminStatus = "active";
  else adminStatus = "done";

  let modelStatus: BeautifulDetailTimelineItem["status"] = "pending";
  if (req.admin_status === "pending") modelStatus = "pending";
  else if (req.admin_status === "rejected") modelStatus = "pending";
  else if (req.model_status === "uploaded" || req.model_status === "completed") modelStatus = "done";
  else if (req.model_status === "scheduled" || req.model_status === "in_progress") modelStatus = "active";
  else if (req.admin_status === "accepted") modelStatus = req.model_status === "waiting_schedule" ? "active" : "pending";

  return [
    {
      id: "submitted",
      label: t(lang, "Request submitted", "Solicitud enviada"),
      value: submittedVal,
      status: "done",
    },
    {
      id: "agency",
      label: adminLabel,
      value: adminDetail,
      status: adminStatus,
    },
    {
      id: "model",
      label: modelLabel,
      value: modelDetail,
      status: modelStatus,
    },
  ];
}

export function CustomRequestDetailModal({
  open,
  onOpenChange,
  request,
  language,
  variant,
  onSchedule,
  onMarkUploaded,
  children,
}: Props) {
  const headerGradientClass = request ? gradientClassForCustomRequest(request) : undefined;

  const subtitle = request
    ? variant === "model"
      ? `${request.fan_username?.trim() || "—"} · ${displayType(request)} · ${(request.requested_by_chatter_name ?? request.chatter_name)?.trim() || "—"}`
      : `${request.fan_username?.trim() || "—"} · ${(request.assigned_model_name ?? request.model_name)?.trim() || request.assigned_model_id || "—"} · ${(request.requested_by_chatter_name ?? request.chatter_name ?? "").trim() || "—"}`
    : "";

  const stats =
    request && variant === "model"
      ? [
          {
            label: t(language, "Price", "Precio"),
            value: request.price?.trim() || "—",
            accent: "pink" as const,
            icon: <CircleDollarSign className="h-5 w-5" aria-hidden />,
          },
          {
            label: t(language, "Model status", "Estado modelo"),
            value: modelStatusLabel(language, request.model_status),
            accent: "purple" as const,
            icon: <Sparkles className="h-5 w-5" aria-hidden />,
          },
          {
            label: t(language, "Agency status", "Estado agencia"),
            value: adminStatusLabel(language, request.admin_status),
            accent: "blue" as const,
            icon: <Shield className="h-5 w-5" aria-hidden />,
          },
          {
            label: t(language, "Requested", "Solicitado"),
            value: displayRequestedDate(request, language),
            accent: "amber" as const,
            icon: <CalendarClock className="h-5 w-5" aria-hidden />,
          },
        ]
      : request && variant === "agency"
        ? [
            {
              label: t(language, "Price", "Precio"),
              value: request.price?.trim() || "—",
              accent: "pink" as const,
              icon: <CircleDollarSign className="h-5 w-5" aria-hidden />,
            },
            {
              label: t(language, "Admin status", "Estado admin"),
              value: adminStatusLabel(language, request.admin_status),
              accent: "purple" as const,
              icon: <Shield className="h-5 w-5" aria-hidden />,
            },
            {
              label: t(language, "Model status", "Estado modelo"),
              value: modelStatusLabelEn(request.model_status),
              accent: "blue" as const,
              icon: <User className="h-5 w-5" aria-hidden />,
            },
            {
              label: t(language, "Scheduled", "Programado"),
              value:
                request.model_status === "scheduled" ||
                request.model_status === "in_progress" ||
                request.model_status === "uploaded" ||
                request.model_status === "completed"
                  ? formatScheduleLine(request)
                  : "—",
              accent: "amber" as const,
              icon: <CalendarClock className="h-5 w-5" aria-hidden />,
            },
          ]
        : [];

  const shootWindow =
    request &&
    (request.model_status === "scheduled" ||
      request.model_status === "in_progress" ||
      request.model_status === "uploaded" ||
      request.model_status === "completed")
      ? formatScheduleLine(request)
      : undefined;

  const uploadInfo =
    request && (request.model_status === "uploaded" || request.model_status === "completed")
      ? formatUploadedAt(request)
      : undefined;

  const timeline = request ? buildTimeline(request, language, variant) : [];

  const title =
    request?.request_title?.trim() ||
    t(language, "Request details", "Detalle del encargo");

  const badge = t(language, "Custom request", "Encargo");

  const footer =
    request && variant === "model" ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.06]"
        >
          {t(language, "Close", "Cerrar")}
        </button>
        {request.model_status === "waiting_schedule" && onSchedule ? (
          <button
            type="button"
            onClick={() => {
              onSchedule();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-900/30"
          >
            <Clock className="h-4 w-4" aria-hidden />
            {t(language, "Schedule", "Programar")}
          </button>
        ) : null}
        {(request.model_status === "scheduled" || request.model_status === "in_progress") && onMarkUploaded ? (
          <button
            type="button"
            onClick={() => {
              onMarkUploaded();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-400/35 bg-pink-500/15 px-4 py-2.5 text-sm font-semibold text-pink-100"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {t(language, "Mark as uploaded", "Marcar como subido")}
          </button>
        ) : null}
      </div>
    ) : request && variant === "agency" ? (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          {t(language, "Close", "Cerrar")}
        </button>
      </div>
    ) : null;

  return (
    <BeautifulDetailModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      badge={badge}
      headerGradientClass={headerGradientClass}
      stats={stats}
      timeline={timeline}
      description={request?.request_details?.trim() ? request.request_details : undefined}
      shootWindow={shootWindow}
      uploadInfo={uploadInfo}
      footer={footer}
    >
      {children}
    </BeautifulDetailModal>
  );
}
