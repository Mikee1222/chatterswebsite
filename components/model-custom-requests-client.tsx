"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useSWRConfig } from "swr";
import { ArrowLeft, Package, Sparkles } from "lucide-react";
import {
  markMyCustomRequestUploadedAction,
  scheduleMyCustomRequestAction,
} from "@/app/actions/model-custom-requests";
import { GlassModal } from "@/components/ui/glass-modal";
import { CustomRequestDetailModal } from "@/components/custom-request-detail-modal";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { dashboardSwrKeys } from "@/lib/hooks/use-dashboard-data";
import type { CustomRequest, CustomRequestModelStatus } from "@/types";

type Lang = "en" | "es";

type FilterTab = "pending" | "scheduled" | "uploaded";

function t(lang: Lang, en: string, es: string) {
  return lang === "es" ? es : en;
}

function displayType(req: CustomRequest): string {
  return (req.custom_type ?? req.request_title ?? "").trim() || "—";
}

function displayRequestedDate(req: CustomRequest): string {
  const raw = (req.deadline_requested ?? "").trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }
    return raw.slice(0, 10);
  }
  const c = (req.created_at ?? "").trim();
  if (!c) return "—";
  const d = new Date(c);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function modelStatusLabel(lang: Lang, s: CustomRequestModelStatus): string {
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

function rowInTab(req: CustomRequest, tab: FilterTab): boolean {
  const m = req.model_status;
  if (tab === "pending") return m === "waiting_schedule";
  if (tab === "scheduled") return m === "scheduled" || m === "in_progress";
  return m === "uploaded" || m === "completed";
}

type Props = {
  requests: CustomRequest[];
  language: Lang;
};

export function ModelCustomRequestsClient({ requests, language }: Props) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [tab, setTab] = React.useState<FilterTab>("pending");
  const [detail, setDetail] = React.useState<CustomRequest | null>(null);
  const [scheduleFor, setScheduleFor] = React.useState<CustomRequest | null>(null);
  const [confirmUpload, setConfirmUpload] = React.useState<CustomRequest | null>(null);

  const [scheduleDate, setScheduleDate] = React.useState("");
  const [scheduleStart, setScheduleStart] = React.useState("10:00");
  const [scheduleEnd, setScheduleEnd] = React.useState("11:00");
  const [scheduleNotes, setScheduleNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => requests.filter((r) => rowInTab(r, tab)), [requests, tab]);

  const counts = React.useMemo(() => {
    let pending = 0;
    let scheduled = 0;
    let uploaded = 0;
    for (const r of requests) {
      if (r.model_status === "waiting_schedule") pending++;
      if (r.model_status === "scheduled" || r.model_status === "in_progress") scheduled++;
      if (r.model_status === "uploaded" || r.model_status === "completed") uploaded++;
    }
    return { pending, scheduled, uploaded };
  }, [requests]);

  React.useEffect(() => {
    if (!scheduleFor) return;
    const d = (scheduleFor.model_scheduled_date ?? "").trim();
    setScheduleDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "");
    setScheduleNotes("");
    setFormError(null);
  }, [scheduleFor]);

  React.useEffect(() => {
    if (confirmUpload) setFormError(null);
  }, [confirmUpload]);

  const submitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleFor) return;
    setBusy(true);
    setFormError(null);
    const res = await scheduleMyCustomRequestAction({
      recordId: scheduleFor.id,
      date: scheduleDate,
      startTime: scheduleStart,
      endTime: scheduleEnd,
      notes: scheduleNotes,
    });
    setBusy(false);
    if (!res.success) {
      setFormError(res.error);
      return;
    }
    setScheduleFor(null);
    setDetail((d) => (d?.id === scheduleFor.id ? { ...d, model_status: "scheduled" } : d));
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    router.refresh();
  };

  const submitUploaded = async () => {
    if (!confirmUpload) return;
    setBusy(true);
    setFormError(null);
    const res = await markMyCustomRequestUploadedAction(confirmUpload.id);
    setBusy(false);
    if (!res.success) {
      setFormError(res.error);
      return;
    }
    setConfirmUpload(null);
    setDetail((d) => (d?.id === confirmUpload.id ? { ...d, model_status: "uploaded" } : d));
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    router.refresh();
  };

  const tabs: { id: FilterTab; label: [string, string]; count: number }[] = [
    { id: "pending", label: ["Pending", "Pendientes"], count: counts.pending },
    { id: "scheduled", label: ["Scheduled", "Programados"], count: counts.scheduled },
    { id: "uploaded", label: ["Uploaded", "Subidos"], count: counts.uploaded },
  ];

  return (
    <div className="space-y-6">
      <Link
        href={ROUTES.model.home}
        className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {t(language, "Back to home", "Volver al inicio")}
      </Link>

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-pink-400/50 bg-pink-500/15 text-pink-100 shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.35)]"
                : "border-white/10 bg-black/30 text-white/65 hover:border-white/20 hover:text-white"
            )}
          >
            {t(language, label[0], label[1])}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                tab === id ? "bg-pink-500/25 text-pink-100" : "bg-white/10 text-white/55"
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center backdrop-blur-xl">
          <Package className="mx-auto h-10 w-10 text-white/35" aria-hidden />
          <p className="mt-4 text-sm text-white/60">
            {t(language, "Nothing in this tab yet.", "No hay elementos en esta pestaña.")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                  <th className="px-4 py-3 font-semibold">{t(language, "Fan", "Fan")}</th>
                  <th className="px-4 py-3 font-semibold">{t(language, "Type", "Tipo")}</th>
                  <th className="px-4 py-3 font-semibold">{t(language, "Price", "Precio")}</th>
                  <th className="px-4 py-3 font-semibold">{t(language, "Requested", "Solicitado")}</th>
                  <th className="px-4 py-3 font-semibold">{t(language, "Status", "Estado")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetail(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetail(r);
                      }
                    }}
                    className="cursor-pointer border-b border-white/[0.06] transition-colors hover:bg-pink-500/[0.06]"
                  >
                    <td className="px-4 py-3 font-medium text-white">{r.fan_username?.trim() || "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-white/80">{displayType(r)}</td>
                    <td className="px-4 py-3 text-pink-200/95">{r.price?.trim() || "—"}</td>
                    <td className="px-4 py-3 text-white/60">{displayRequestedDate(r)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-400/20 bg-pink-500/10 px-2.5 py-1 text-xs font-medium text-pink-100/95">
                        <Sparkles className="h-3.5 w-3.5 opacity-80" aria-hidden />
                        {modelStatusLabel(language, r.model_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CustomRequestDetailModal
        open={detail != null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        request={detail}
        language={language}
        variant="model"
        onSchedule={() => {
          if (!detail) return;
          setScheduleFor(detail);
          setDetail(null);
        }}
        onMarkUploaded={() => {
          if (!detail) return;
          setConfirmUpload(detail);
          setDetail(null);
        }}
      >
        {detail?.model_notes ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">{t(language, "Your notes", "Tus notas")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{detail.model_notes}</p>
          </section>
        ) : null}
      </CustomRequestDetailModal>

      <AnimatePresence>
        {scheduleFor ? (
          <GlassModal
            onClose={() => !busy && setScheduleFor(null)}
            title={t(language, "Schedule custom", "Programar encargo")}
            subtitle={scheduleFor.request_title || ""}
          >
            <form onSubmit={(e) => void submitSchedule(e)} className="space-y-4 px-4 py-5 md:px-5">
              {formError ? (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{formError}</p>
              ) : null}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-white/45" htmlFor="cr-date">
                  {t(language, "Date", "Fecha")}
                </label>
                <input
                  id="cr-date"
                  type="date"
                  required
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-pink-400/30 focus:ring-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-white/45" htmlFor="cr-start">
                    {t(language, "Start", "Inicio")}
                  </label>
                  <input
                    id="cr-start"
                    type="time"
                    required
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-pink-400/30 focus:ring-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-white/45" htmlFor="cr-end">
                    {t(language, "End", "Fin")}
                  </label>
                  <input
                    id="cr-end"
                    type="time"
                    required
                    value={scheduleEnd}
                    onChange={(e) => setScheduleEnd(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-pink-400/30 focus:ring-2"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-white/45" htmlFor="cr-notes">
                  {t(language, "Notes", "Notas")}
                </label>
                <textarea
                  id="cr-notes"
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  rows={3}
                  placeholder={t(language, "Optional…", "Opcional…")}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-pink-400/30 focus:ring-2"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setScheduleFor(null)}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {t(language, "Cancel", "Cancelar")}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? t(language, "Saving…", "Guardando…") : t(language, "Save schedule", "Guardar")}
                </button>
              </div>
            </form>
          </GlassModal>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {confirmUpload ? (
          <GlassModal
            onClose={() => !busy && setConfirmUpload(null)}
            title={t(language, "Mark as uploaded?", "¿Marcar como subido?")}
            subtitle={confirmUpload.request_title || ""}
          >
            <div className="space-y-4 px-4 py-5 md:px-5">
              {formError ? (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{formError}</p>
              ) : null}
              <p className="text-sm leading-relaxed text-white/65">
                {t(
                  language,
                  "This tells the chatter and admins the custom content is uploaded. You can still add notes from the agency tools if needed.",
                  "Esto avisa al chatter y a la administración de que el contenido ya está subido."
                )}
              </p>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmUpload(null)}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {t(language, "Cancel", "Cancelar")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitUploaded()}
                  className="rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? t(language, "Updating…", "Actualizando…") : t(language, "Confirm", "Confirmar")}
                </button>
              </div>
            </div>
          </GlassModal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
