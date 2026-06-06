"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  Package,
  Search,
  Upload,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  markMyCustomRequestUploadedAction,
  scheduleMyCustomRequestAction,
} from "@/app/actions/model-custom-requests";
import { CustomRequestDetailModal } from "@/components/custom-request-detail-modal";
import { MobileCard } from "@/components/mobile-card";
import { FormInput } from "@/components/ui/form-input";
import { GlassModal } from "@/components/ui/glass-modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ROUTES } from "@/lib/routes";
import { formatDateEuropean } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import { dashboardSwrKeys } from "@/lib/hooks/use-dashboard-data";
import { usePagination } from "@/lib/use-pagination";
import { cn } from "@/lib/utils";
import type { CustomRequest, CustomRequestModelStatus } from "@/types";

type Lang = "en" | "es";
type StatusTab = "all" | CustomRequestModelStatus;

function t(lang: Lang, en: string, es: string) {
  return lang === "es" ? es : en;
}

function statusKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

function displayTitle(req: CustomRequest): string {
  return (req.request_title ?? req.custom_type ?? "").trim() || "—";
}

function displayDescription(req: CustomRequest): string {
  return (req.request_details ?? req.description ?? "").trim();
}

function displayDeadline(req: CustomRequest): string {
  const raw = (req.deadline_requested ?? "").trim();
  if (raw) return formatDateEuropean(raw);
  return formatDate((req.created_at ?? "").trim()) || "—";
}

function displayScheduled(req: CustomRequest): string {
  const raw = (req.model_scheduled_date ?? "").trim();
  if (!raw) return "—";
  return formatDateEuropean(raw);
}

function modelStatusLabel(lang: Lang, s: CustomRequestModelStatus): string {
  const map: Record<CustomRequestModelStatus, [string, string]> = {
    waiting_schedule: ["Waiting schedule", "Pendiente de programar"],
    scheduled: ["Scheduled", "Programado"],
    in_progress: ["In progress", "En curso"],
    completed: ["Completed", "Completado"],
    uploaded: ["Uploaded", "Subido"],
    declined: ["Declined", "Rechazado"],
  };
  const pair = map[s] ?? ["—", "—"];
  return t(lang, pair[0], pair[1]);
}

function StatusBadge({ status, lang }: { status: CustomRequestModelStatus; lang: Lang }) {
  const k = statusKey(status);
  const variant =
    k === "waiting_schedule"
      ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
      : k === "scheduled"
        ? "border-sky-500/30 bg-sky-500/15 text-sky-300"
        : k === "in_progress"
          ? "border-violet-500/30 bg-violet-500/15 text-violet-300"
          : k === "uploaded"
            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
            : k === "completed"
              ? "border-green-500/30 bg-green-500/15 text-green-300"
              : k === "declined"
                ? "border-rose-500/35 bg-rose-500/15 text-rose-300"
                : "border-white/15 bg-white/[0.06] text-white/70";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium", variant)}>
      {modelStatusLabel(lang, status)}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accentClass,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accentClass: string;
}) {
  return (
    <MobileCard
      padding="md"
      className={cn("min-w-[140px] shrink-0 snap-start border-white/10 bg-white/[0.04]", accentClass)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/55">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </MobileCard>
  );
}

const STATUS_TABS: CustomRequestModelStatus[] = [
  "waiting_schedule",
  "scheduled",
  "in_progress",
  "uploaded",
  "completed",
  "declined",
];

type Props = {
  requests: CustomRequest[];
  language: Lang;
};

export function ModelCustomRequestsClient({ requests, language }: Props) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [filter, setFilter] = React.useState<StatusTab>("waiting_schedule");
  const [search, setSearch] = React.useState("");
  const [detail, setDetail] = React.useState<CustomRequest | null>(null);
  const [scheduleFor, setScheduleFor] = React.useState<CustomRequest | null>(null);
  const [confirmUpload, setConfirmUpload] = React.useState<CustomRequest | null>(null);

  const [scheduleDate, setScheduleDate] = React.useState("");
  const [scheduleStart, setScheduleStart] = React.useState("10:00");
  const [scheduleEnd, setScheduleEnd] = React.useState("11:00");
  const [scheduleNotes, setScheduleNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const counts = React.useMemo(() => {
    const c: Record<CustomRequestModelStatus, number> & { total: number } = {
      total: requests.length,
      waiting_schedule: 0,
      scheduled: 0,
      in_progress: 0,
      uploaded: 0,
      completed: 0,
      declined: 0,
    };
    for (const r of requests) {
      const k = statusKey(r.model_status);
      if (k === "waiting_schedule") c.waiting_schedule += 1;
      else if (k === "scheduled") c.scheduled += 1;
      else if (k === "in_progress") c.in_progress += 1;
      else if (k === "uploaded") c.uploaded += 1;
      else if (k === "completed") c.completed += 1;
      else if (k === "declined") c.declined += 1;
    }
    return c;
  }, [requests]);

  const filtered = React.useMemo(() => {
    let list = filter === "all" ? [...requests] : requests.filter((r) => statusKey(r.model_status) === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const blob = `${r.fan_username ?? ""} ${r.request_title ?? ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    const createdMs = (r: CustomRequest) => Date.parse(r.created_at || "") || 0;
    return [...list].sort((a, b) => createdMs(b) - createdMs(a));
  }, [requests, filter, search]);

  const { page, setPage, totalPages, paginated, reset } = usePagination(filtered, 20);

  React.useEffect(() => {
    reset();
  }, [filter, search, reset]);

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

  const clearFilters = () => {
    setSearch("");
    setFilter("waiting_schedule");
  };

  const activeFilterCount = (search.trim() ? 1 : 0) + (filter !== "waiting_schedule" ? 1 : 0);

  const submitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleFor) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await scheduleMyCustomRequestAction({
        recordId: scheduleFor.id,
        date: scheduleDate,
        startTime: scheduleStart,
        endTime: scheduleEnd,
        notes: scheduleNotes,
      });
      if (!res.success) {
        setFormError(res.error);
        return;
      }
      setScheduleFor(null);
      setDetail((d) => (d?.id === scheduleFor.id ? { ...d, model_status: "scheduled" } : d));
      await mutate(dashboardSwrKeys.notificationsUnreadCount);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const submitUploaded = async () => {
    if (!confirmUpload) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await markMyCustomRequestUploadedAction(confirmUpload.id);
      if (!res.success) {
        setFormError(res.error);
        return;
      }
      setConfirmUpload(null);
      setDetail((d) => (d?.id === confirmUpload.id ? { ...d, model_status: "uploaded" } : d));
      await mutate(dashboardSwrKeys.notificationsUnreadCount);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const tabLabel = (key: StatusTab): string => {
    if (key === "all") return t(language, "All", "Todos");
    return modelStatusLabel(language, key);
  };

  const tabCount = (key: StatusTab): number => {
    if (key === "all") return counts.total;
    return (counts as Record<string, number>)[key] ?? 0;
  };

  return (
    <div className="space-y-6">
      <Link
        href={ROUTES.model.home}
        className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {t(language, "Back to home", "Volver al inicio")}
      </Link>

      <div className="-mx-1 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        <div className="flex min-w-min gap-3">
          <StatCard
            label={t(language, "Total", "Total")}
            value={counts.total}
            icon={Package}
            accentClass="border-white/10 ring-white/[0.06]"
          />
          <StatCard
            label={t(language, "Waiting schedule", "Pendiente")}
            value={counts.waiting_schedule}
            icon={Clock}
            accentClass="border-amber-500/25 bg-amber-500/5 ring-amber-500/10"
          />
          <StatCard
            label={t(language, "Scheduled", "Programado")}
            value={counts.scheduled}
            icon={CalendarClock}
            accentClass="border-sky-500/25 bg-sky-500/5 ring-sky-500/10"
          />
          <StatCard
            label={t(language, "In progress", "En curso")}
            value={counts.in_progress}
            icon={Calendar}
            accentClass="border-violet-500/25 bg-violet-500/5 ring-violet-500/10"
          />
          <StatCard
            label={t(language, "Uploaded", "Subido")}
            value={counts.uploaded}
            icon={Upload}
            accentClass="border-emerald-500/25 bg-emerald-500/5 ring-emerald-500/10"
          />
          <StatCard
            label={t(language, "Completed", "Completado")}
            value={counts.completed}
            icon={CheckCircle2}
            accentClass="border-green-500/25 bg-green-500/5 ring-green-500/10"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
            {t(language, "Status", "Estado")}
          </span>
          {(["all", ...STATUS_TABS] as StatusTab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === key
                  ? "border-pink-400/55 bg-pink-500/20 text-pink-100"
                  : "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
              )}
            >
              {tabLabel(key)}
              <span className="ml-1 text-white/45">{tabCount(key)}</span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(language, "Search fan or title…", "Buscar fan o título…")}
              className="border-white/10 bg-zinc-950/80 pl-9"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilterCount > 0 ? (
            <span className="rounded-full border border-pink-500/35 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-100">
              {activeFilterCount} {t(language, "filter", "filtro")}
              {activeFilterCount === 1 ? "" : t(language, "s", "s")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilterCount === 0}
            className="inline-flex items-center gap-1 text-xs font-medium text-pink-300/90 underline-offset-4 hover:text-pink-200 hover:underline disabled:opacity-40"
          >
            <X className="h-3 w-3" aria-hidden />
            {t(language, "Clear filters", "Limpiar filtros")}
          </button>
          <span className="ml-auto text-xs text-white/45">
            {filtered.length} {t(language, "shown", "mostrados")}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/35">
            <Package className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-medium text-white/75">
            {t(language, "No matching requests", "No hay encargos")}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {t(language, "Try a different status tab or clear your filters.", "Prueba otro estado o limpia los filtros.")}
          </p>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-pink-500/35 bg-pink-500/15 px-4 py-2 text-xs font-semibold text-pink-200 hover:bg-pink-500/25"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t(language, "Clear filters", "Limpiar filtros")}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((r) => {
              const k = statusKey(r.model_status);
              const canSchedule = k === "waiting_schedule";
              const canMarkUploaded = k === "scheduled" || k === "in_progress";
              const desc = displayDescription(r);

              return (
                <MobileCard
                  key={r.id}
                  onClick={() => setDetail(r)}
                  padding="none"
                  className="flex overflow-hidden border-white/10 bg-zinc-950/80 ring-white/[0.06] transition hover:bg-white/[0.03]"
                >
                  <div className="w-1 shrink-0 bg-gradient-to-b from-pink-500/80 to-fuchsia-600/60" aria-hidden />
                  <div className="min-w-0 flex-1 p-4 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white" title={displayTitle(r)}>
                          {displayTitle(r)}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/55">
                          <User className="h-3 w-3 shrink-0" aria-hidden />@{r.fan_username?.trim() || "—"}
                        </p>
                        {(r.assigned_model_name ?? "").trim() ? (
                          <p className="mt-0.5 text-xs text-white/45">{r.assigned_model_name}</p>
                        ) : null}
                      </div>
                      <StatusBadge status={r.model_status} lang={language} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md border border-pink-500/25 bg-pink-500/10 px-2 py-0.5 text-sm font-semibold text-pink-100">
                        <DollarSign className="h-3.5 w-3.5" aria-hidden />
                        {r.price?.trim() || "—"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                        <Clock className="h-3 w-3" aria-hidden />
                        {t(language, "Due", "Vence")} {displayDeadline(r)}
                      </span>
                      {r.model_scheduled_date ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                          <CalendarClock className="h-3 w-3" aria-hidden />
                          {displayScheduled(r)}
                        </span>
                      ) : null}
                    </div>

                    {desc ? (
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/55">{desc}</p>
                    ) : null}

                    {canSchedule || canMarkUploaded ? (
                      <div className="mt-3 flex gap-2 border-t border-white/10 pt-3" onClick={(e) => e.stopPropagation()}>
                        {canSchedule ? (
                          <button
                            type="button"
                            onClick={() => setScheduleFor(r)}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/15 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/25"
                          >
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                            {t(language, "Schedule", "Programar")}
                          </button>
                        ) : null}
                        {canMarkUploaded ? (
                          <button
                            type="button"
                            onClick={() => setConfirmUpload(r)}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25"
                          >
                            <Upload className="h-3.5 w-3.5" aria-hidden />
                            {t(language, "Mark uploaded", "Marcar subido")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </MobileCard>
              );
            })}
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            totalItems={filtered.length}
          />
        </>
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
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
              {t(language, "Your notes", "Tus notas")}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{detail.model_notes}</p>
          </section>
        ) : null}
      </CustomRequestDetailModal>

      {scheduleFor ? (
        <GlassModal
          onClose={() => !busy && setScheduleFor(null)}
          title={t(language, "Schedule custom", "Programar encargo")}
          subtitle={displayTitle(scheduleFor)}
          className="md:max-w-lg"
        >
          <form onSubmit={(e) => void submitSchedule(e)} className="space-y-4 p-5">
            {formError ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{formError}</p>
            ) : null}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-white/50" htmlFor="cr-date">
                {t(language, "Date", "Fecha")}
              </label>
              <FormInput
                id="cr-date"
                type="date"
                required
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="border-white/10 bg-zinc-950/80"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-white/50" htmlFor="cr-start">
                  {t(language, "Start", "Inicio")}
                </label>
                <FormInput
                  id="cr-start"
                  type="time"
                  required
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="border-white/10 bg-zinc-950/80"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-white/50" htmlFor="cr-end">
                  {t(language, "End", "Fin")}
                </label>
                <FormInput
                  id="cr-end"
                  type="time"
                  required
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  className="border-white/10 bg-zinc-950/80"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-white/50" htmlFor="cr-notes">
                {t(language, "Notes", "Notas")}
              </label>
              <textarea
                id="cr-notes"
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                rows={3}
                placeholder={t(language, "Optional…", "Opcional…")}
                className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/40"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setScheduleFor(null)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                {t(language, "Cancel", "Cancelar")}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-500/40 bg-pink-500/20 px-4 py-2 text-sm font-semibold text-pink-100 hover:bg-pink-500/30 disabled:opacity-45"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {t(language, "Saving…", "Guardando…")}
                  </>
                ) : (
                  t(language, "Save schedule", "Guardar")
                )}
              </button>
            </div>
          </form>
        </GlassModal>
      ) : null}

      {confirmUpload ? (
        <GlassModal
          onClose={() => !busy && setConfirmUpload(null)}
          title={t(language, "Mark as uploaded?", "¿Marcar como subido?")}
          subtitle={displayTitle(confirmUpload)}
          className="md:max-w-lg"
        >
          <div className="space-y-4 p-5">
            {formError ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{formError}</p>
            ) : null}
            <p className="text-sm leading-relaxed text-white/65">
              {t(
                language,
                "This tells the chatter and admins the custom content is uploaded. You can still add notes from the agency tools if needed.",
                "Esto avisa al chatter y a la administración de que el contenido ya está subido."
              )}
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmUpload(null)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                {t(language, "Cancel", "Cancelar")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitUploaded()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-45"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {t(language, "Updating…", "Actualizando…")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {t(language, "Confirm", "Confirmar")}
                  </>
                )}
              </button>
            </div>
          </div>
        </GlassModal>
      ) : null}
    </div>
  );
}
