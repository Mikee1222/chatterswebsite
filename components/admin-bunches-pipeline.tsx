"use client";

import * as React from "react";
import { AlertTriangle, CalendarDays, Loader2 } from "lucide-react";
import {
  VA_CARD,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { EDITING_STATUS_STYLES } from "@/lib/editing-helpers";
import { FILMING_STATUS_STYLES } from "@/lib/filming-helpers";
import { ICLOUD_STATUS_STYLES, materialRunwayAlert, daysUntilMaterialDate } from "@/lib/icloud-helpers";
import type { ModelMaterialRunway } from "@/services/icloud";
import type { VideoBunch } from "@/services/winner-sourcing";
import { cn } from "@/lib/utils";

const STAGES = ["Sourcing", "Scripting", "Filming", "Editing", "iCloud"] as const;

function stageIndex(b: VideoBunch): number {
  if (b.icloud_status === "organized") return 4;
  if (b.editing_status === "uploaded") return 4; // in iCloud stage
  if (b.editing_status === "assigned" || b.editing_status === "in_progress") return 3;
  if (b.filming_status === "uploaded") return 3; // ready for editing
  if (b.filming_status === "assigned" || b.filming_status === "in_progress") return 2;
  if (b.assigned_creative_id || b.assigned_filmer_id) return 2;
  if (b.assigned_creative_id) return 1;
  // Heuristic: any provided slots → sourcing active
  if ((b.provided_count ?? 0) > 0 || (b.pending_review_count ?? 0) > 0) return 0;
  if (b.assigned_creative_id) return 1;
  return 0;
}

function PipelineStepper({ active }: { active: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STAGES.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <React.Fragment key={label}>
            {i > 0 ? (
              <span
                className={cn(
                  "hidden h-px w-4 sm:block",
                  done || current ? "bg-[#D4AF8C]/50" : "bg-white/10",
                )}
              />
            ) : null}
            <span
              className={cn(
                VA_STATUS_BADGE,
                "text-[9px]",
                current
                  ? "bg-[#FF1493]/20 text-[#FF1493]"
                  : done
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-white/5 text-white/35",
              )}
            >
              {label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function AdminBunchesPipeline({
  bunches,
  modelRunways,
  loading,
}: {
  bunches: VideoBunch[];
  modelRunways: ModelMaterialRunway[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className={cn(VA_CARD, "flex items-center justify-center gap-2 py-16 text-sm text-[#B8B4B8]/50")}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pipeline…
      </div>
    );
  }

  const alerts = modelRunways.filter((m) => m.alert !== "ok");

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-7">
        <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[#FF1493]/10 blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
          Command center
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Bunch Pipeline Overview</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#B8B4B8]/65">
          Full stage timeline · model material runway · filming schedule context
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={cn(VA_STATUS_BADGE, "bg-white/10 text-white/70")}>
            {bunches.length} bunches
          </span>
          <span className={cn(VA_STATUS_BADGE, "bg-amber-500/15 text-amber-300")}>
            {alerts.length} runway alert{alerts.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className={cn(VA_CARD, "space-y-3 p-5")}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-semibold text-white">Material runway alerts</h3>
          </div>
          <ul className="space-y-2">
            {alerts.map((m) => (
              <li
                key={m.model_id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2",
                  m.alert === "past"
                    ? "border-red-500/25 bg-red-500/8"
                    : "border-amber-500/25 bg-amber-500/8",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-white">{m.model_name}</p>
                  <p className="text-xs text-[#B8B4B8]/60">
                    Furthest material until {m.furthest_material_until ?? "—"}
                    {m.days_remaining != null
                      ? m.days_remaining < 0
                        ? ` · ${Math.abs(m.days_remaining)}d past`
                        : ` · ${m.days_remaining}d left`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    VA_STATUS_BADGE,
                    m.alert === "past" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300",
                  )}
                >
                  {m.alert === "past" ? "Past" : "Soon"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={cn(VA_CARD, "space-y-3 p-5")}>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#D4AF8C]/80" />
          <h3 className="text-sm font-semibold text-white">Model runway & shoots</h3>
        </div>
        {modelRunways.length === 0 ? (
          <p className="text-xs text-[#B8B4B8]/45">No model runway data yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {modelRunways.map((m) => {
              const days = m.days_remaining ?? daysUntilMaterialDate(m.furthest_material_until);
              const alert = m.alert ?? materialRunwayAlert(days);
              return (
                <li key={m.model_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{m.model_name}</p>
                    <p className="mt-0.5 text-xs text-[#B8B4B8]/55">
                      Material until {m.furthest_material_until ?? "—"}
                      {alert !== "ok" ? (
                        <span
                          className={cn(
                            "ml-2",
                            alert === "past" ? "text-red-300" : "text-amber-300",
                          )}
                        >
                          ({alert})
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-[#B8B4B8]/55">
                    <p>
                      Next shoot:{" "}
                      {m.next_shoot
                        ? `${m.next_shoot.schedule_date}${m.next_shoot.start_time ? ` ${m.next_shoot.start_time}` : ""}`
                        : "—"}
                    </p>
                    <p className="mt-0.5">
                      Last shoot: {m.last_shoot ? m.last_shoot.schedule_date : "—"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Stage timeline by bunch</h3>
        {bunches.length === 0 ? (
          <div className={cn(VA_CARD, "py-10 text-center text-sm text-[#B8B4B8]/45")}>No bunches.</div>
        ) : (
          <ul className="space-y-3">
            {bunches.map((b) => {
              const idx = stageIndex(b);
              const film = FILMING_STATUS_STYLES[b.filming_status] ?? FILMING_STATUS_STYLES.unassigned;
              const edit = EDITING_STATUS_STYLES[b.editing_status] ?? EDITING_STATUS_STYLES.unassigned;
              const cloud = ICLOUD_STATUS_STYLES[b.icloud_status] ?? ICLOUD_STATUS_STYLES.pending;
              return (
                <li key={b.id} className={cn(VA_CARD, "space-y-3 p-4")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-white">{b.name}</p>
                      <p className="text-xs text-[#D4AF8C]/80">{b.model_name || "—"}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={cn(VA_STATUS_BADGE, film.className)}>Film: {film.label}</span>
                      <span className={cn(VA_STATUS_BADGE, edit.className)}>Edit: {edit.label}</span>
                      <span className={cn(VA_STATUS_BADGE, cloud.className)}>iCloud: {cloud.label}</span>
                    </div>
                  </div>
                  <PipelineStepper active={idx} />
                  <p className="text-[11px] text-[#B8B4B8]/45">
                    Creative: {b.assigned_creative_name || "—"} · Filmer: {b.assigned_filmer_name || "—"} ·
                    Editor: {b.assigned_editor_name || "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
