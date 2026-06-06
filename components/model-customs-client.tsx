"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  ListChecks,
  Package,
  StickyNote,
} from "lucide-react";
import { updateMyModelCustomRequestAction } from "@/app/actions/model-customs";
import { ROUTES } from "@/lib/routes";
import { selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { CustomRequest, CustomRequestModelStatus } from "@/types";

type Lang = "en" | "es";

type Props = {
  requests: CustomRequest[];
  language: Lang;
};

function t(lang: Lang, en: string, es: string) {
  return lang === "es" ? es : en;
}

const MODEL_STATUSES: CustomRequestModelStatus[] = [
  "waiting_schedule",
  "scheduled",
  "in_progress",
  "completed",
  "uploaded",
  "declined",
];

function statusLabel(lang: Lang, s: CustomRequestModelStatus): string {
  const map: Record<CustomRequestModelStatus, [string, string]> = {
    waiting_schedule: ["Waiting for schedule", "Esperando programación"],
    scheduled: ["Scheduled", "Programado"],
    in_progress: ["In progress", "En curso"],
    completed: ["Completed", "Completado"],
    uploaded: ["Uploaded", "Subido"],
    declined: ["Declined", "Rechazado"],
  };
  const pair = map[s];
  return t(lang, pair[0], pair[1]);
}

function adminLabel(lang: Lang, a: CustomRequest["admin_status"]): string {
  if (a === "accepted") return t(lang, "Accepted", "Aceptado");
  if (a === "rejected") return t(lang, "Rejected", "Rechazado");
  return t(lang, "Pending review", "Pendiente de revisión");
}

export function ModelCustomsClient({ requests, language }: Props) {
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(requests[0]?.id ?? null);
  const [notesById, setNotesById] = React.useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const r of requests) o[r.id] = r.model_notes ?? "";
    return o;
  });
  const [statusById, setStatusById] = React.useState<Record<string, CustomRequestModelStatus>>(() => {
    const o: Record<string, CustomRequestModelStatus> = {};
    for (const r of requests) o[r.id] = r.model_status;
    return o;
  });
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [errorById, setErrorById] = React.useState<Record<string, string | null>>({});
  const [successId, setSuccessId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNotesById((prev) => {
      const next = { ...prev };
      for (const r of requests) if (next[r.id] === undefined) next[r.id] = r.model_notes ?? "";
      return next;
    });
    setStatusById((prev) => {
      const next = { ...prev };
      for (const r of requests) if (next[r.id] === undefined) next[r.id] = r.model_status;
      return next;
    });
  }, [requests]);

  const handleSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setErrorById((m) => ({ ...m, [id]: null }));
    setSuccessId(null);
    setBusyId(id);
    const res = await updateMyModelCustomRequestAction(
      id,
      notesById[id] ?? "",
      statusById[id] ?? "waiting_schedule"
    );
    setBusyId(null);
    if (!res.success) {
      setErrorById((m) => ({ ...m, [id]: res.error }));
      return;
    }
    setSuccessId(id);
    router.refresh();
    window.setTimeout(() => setSuccessId((cur) => (cur === id ? null : cur)), 2200);
  };

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center backdrop-blur-xl">
        <Package className="mx-auto h-10 w-10 text-white/35" aria-hidden />
        <p className="mt-4 text-sm text-white/60">
          {t(language, "No custom requests are assigned to you yet.", "Aún no tienes encargos personalizados asignados.")}
        </p>
        <Link
          href={ROUTES.model.home}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-pink-300 hover:text-pink-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t(language, "Back to home", "Volver al inicio")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href={ROUTES.model.home}
        className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {t(language, "Back to home", "Volver al inicio")}
      </Link>

      <ul className="space-y-4">
        {requests.map((r) => {
          const open = openId === r.id;
          const accepted = r.admin_status === "accepted";
          const rejected = r.admin_status === "rejected";
          const err = errorById[r.id];
          const notes = notesById[r.id] ?? "";
          const st = statusById[r.id] ?? r.model_status;

          return (
            <li
              key={r.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : r.id)}
                className="flex w-full items-start gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4 text-left transition-colors hover:bg-white/[0.06]"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pink-400/20 bg-pink-500/10 text-pink-200">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-white">{r.request_title || t(language, "Custom", "Personalizado")}</span>
                  <span className="mt-1 block text-xs text-white/50">
                    {r.fan_username ? `${t(language, "Fan", "Fan")}: ${r.fan_username} · ` : null}
                    {adminLabel(language, r.admin_status)}
                    {"· "}
                    {statusLabel(language, r.model_status)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-white/45">{open ? "−" : "+"}</span>
              </button>

              {open && (
                <div className="p-5 pt-4">
                  {r.request_details ? (
                    <p className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/75">
                      {r.request_details}
                    </p>
                  ) : null}

                  {rejected ? (
                    <p className="text-sm text-white/55">
                      {t(language, "This request was not accepted. You cannot submit updates.", "Este encargo no fue aceptado. No puedes enviar actualizaciones.")}
                    </p>
                  ) : (
                    <form onSubmit={(e) => void handleSubmit(e, r.id)} className="space-y-4">
                      <motion.div layout>
                        <FormField
                          label={t(language, "Delivery notes", "Notas de entrega")}
                          icon={<StickyNote />}
                          htmlFor={`custom-notes-${r.id}`}
                          description={
                            accepted
                              ? t(
                                  language,
                                  "Share links, filenames, or what you delivered.",
                                  "Enlaces, nombres de archivo o qué entregaste."
                                )
                              : t(
                                  language,
                                  "You can leave notes anytime. Status changes unlock after the agency accepts the request.",
                                  "Puedes dejar notas en cualquier momento. Los cambios de estado se desbloquean cuando la agencia acepte el encargo."
                                )
                          }
                          error={err ?? undefined}
                          staggerIndex={0}
                        >
                          <FormTextarea
                            id={`custom-notes-${r.id}`}
                            value={notes}
                            onChange={(e) => setNotesById((m) => ({ ...m, [r.id]: e.target.value }))}
                            rows={4}
                            placeholder={t(language, "Optional notes…", "Notas opcionales…")}
                          />
                        </FormField>
                      </motion.div>

                      <FormField
                        label={t(language, "Your progress", "Tu progreso")}
                        icon={<ListChecks />}
                        htmlFor={`custom-status-${r.id}`}
                        staggerIndex={1}
                        description={
                          !accepted
                            ? t(language, "Locked until the request is accepted.", "Bloqueado hasta que el encargo sea aceptado.")
                            : undefined
                        }
                      >
                        <FormSelect
                          id={`custom-status-${r.id}`}
                          value={st}
                          disabled={!accepted}
                          onChange={(e) =>
                            setStatusById((m) => ({
                              ...m,
                              [r.id]: e.target.value as CustomRequestModelStatus,
                            }))
                          }
                        >
                          {MODEL_STATUSES.map((s) => (
                            <option key={s} value={s} className={selectOptionClass}>
                              {statusLabel(language, s)}
                            </option>
                          ))}
                        </FormSelect>
                      </FormField>

                      <FormSubmitButton
                        disabled={busyId === r.id}
                        loading={busyId === r.id}
                        success={successId === r.id}
                        successLabel={t(language, "Saved", "Guardado")}
                        className="w-full sm:max-w-md"
                      >
                        {busyId === r.id
                          ? t(language, "Saving…", "Guardando…")
                          : t(language, "Save update", "Guardar actualización")}
                      </FormSubmitButton>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
