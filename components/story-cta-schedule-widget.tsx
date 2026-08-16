"use client";

import * as React from "react";
import { ChevronDown, Link2, Sparkles } from "lucide-react";
import { WinnerVideoCopyButton } from "@/components/winner-videos-shared";
import { cn } from "@/lib/utils";
import {
  VA_CARD,
  VA_CARD_GLOW,
  VA_CHAMPAGNE_DIVIDER,
  VA_FILTER_INPUT,
  VA_MODEL_TAG,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import type { StoryCtaScheduleModel } from "@/lib/story-cta-schedule";

type SchedulePayload = {
  models: StoryCtaScheduleModel[];
  todayYmd: string;
};

function ModelScheduleTable({ model }: { model: StoryCtaScheduleModel }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0D0B0D]/40">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[rgba(255,255,255,0.06)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B8B4B8]/45">
            <th className="px-3 py-2.5 font-semibold">Day</th>
            <th className="px-3 py-2.5 font-semibold">Action</th>
            <th className="px-3 py-2.5 font-semibold">Link</th>
          </tr>
        </thead>
        <tbody>
          {model.schedule.map((row) => (
            <tr
              key={row.weekday}
              className={cn(
                "border-b border-[rgba(255,255,255,0.04)] last:border-b-0 transition-colors",
                row.isToday && "bg-[#D4AF8C]/[0.08]",
              )}
            >
              <td className="px-3 py-2.5 align-top">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium", row.isToday ? "text-[#D4AF8C]" : "text-white/85")}>
                    {row.weekday}
                  </span>
                  {row.isToday ? (
                    <span
                      className={cn(
                        VA_STATUS_BADGE,
                        "border-[#D4AF8C]/35 bg-[#D4AF8C]/12 text-[#D4AF8C]",
                      )}
                    >
                      Today
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-2.5 align-top text-[#B8B4B8]/80">{row.action.label}</td>
              <td className="px-3 py-2.5 align-top">
                {row.linkUrl ? (
                  <div className="flex min-w-0 items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      {row.linkLabel ? (
                        <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D4AF8C]/70">
                          {row.linkLabel}
                        </span>
                      ) : null}
                      <a
                        href={row.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-xs text-[#FF1493]/90 underline decoration-[#FF1493]/30 underline-offset-2 hover:text-[#FF1493]"
                      >
                        {row.linkUrl}
                      </a>
                    </div>
                    <WinnerVideoCopyButton
                      label={`Copy ${row.linkLabel ?? "link"}`}
                      onClick={() => void navigator.clipboard.writeText(row.linkUrl!)}
                    />
                  </div>
                ) : row.linkLabel ? (
                  <span className="text-xs text-[#B8B4B8]/40">Not configured</span>
                ) : (
                  <span className="text-xs text-[#B8B4B8]/30">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StoryCtaScheduleWidget() {
  const [open, setOpen] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<SchedulePayload | null>(null);
  const [selectedModelId, setSelectedModelId] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/va/story-link-schedule", { credentials: "include" })
      .then((res) => res.json())
      .then((data: SchedulePayload & { error?: string }) => {
        if (cancelled) return;
        if (!data.models) {
          setError(data.error ?? "Could not load schedule");
          setPayload(null);
          return;
        }
        setPayload({ models: data.models, todayYmd: data.todayYmd });
        if (data.models.length === 1) {
          setSelectedModelId(data.models[0]!.model_id);
        } else if (data.models.length > 1 && !selectedModelId) {
          setSelectedModelId(data.models[0]!.model_id);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load schedule");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const models = payload?.models ?? [];
  const activeModel =
    models.find((m) => m.model_id === selectedModelId) ?? (models.length === 1 ? models[0] : null);
  const showSelector = models.length > 1;

  return (
    <section className={cn(VA_CARD, VA_CARD_GLOW, "overflow-hidden")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-white/[0.02] md:p-5"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="mb-1.5 inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF8C]" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
              Story CTA rotation
            </span>
          </div>
          <h2 className="text-base font-semibold text-white md:text-lg">Weekly link schedule</h2>
          <p className="mt-0.5 text-xs text-[#B8B4B8]/55 md:text-sm">
            Mon / Wed / Sat story links — today highlighted in champagne
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-[#D4AF8C]/60 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[rgba(255,255,255,0.06)] px-4 pb-4 pt-4 md:px-5 md:pb-5">
          <div className={VA_CHAMPAGNE_DIVIDER} />

          {loading ? (
            <p className="text-sm text-[#B8B4B8]/50">Loading schedule…</p>
          ) : error ? (
            <p className="text-sm text-rose-300/90" role="alert">
              {error}
            </p>
          ) : models.length === 0 ? (
            <p className="text-sm text-[#B8B4B8]/50">No assigned models — link schedule appears here once you have creators.</p>
          ) : showSelector ? (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B8B4B8]/45">
                  Creator
                </span>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className={cn(VA_FILTER_INPUT, "w-full")}
                >
                  {models.map((m) => (
                    <option key={m.model_id} value={m.model_id}>
                      {m.model_name}
                    </option>
                  ))}
                </select>
              </label>
              {activeModel ? (
                <div className="space-y-2">
                  <span className={VA_MODEL_TAG}>{activeModel.model_name}</span>
                  <ModelScheduleTable model={activeModel} />
                </div>
              ) : null}
            </div>
          ) : activeModel ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-[#D4AF8C]/70" aria-hidden />
                <span className={VA_MODEL_TAG}>{activeModel.model_name}</span>
              </div>
              <ModelScheduleTable model={activeModel} />
            </div>
          ) : null}

          {models.length > 1 ? (
            <details className="group rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0D0B0D]/30">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-[#D4AF8C]/75 marker:content-none [&::-webkit-details-marker]:hidden">
                View all assigned creators ({models.length})
              </summary>
              <div className="space-y-4 border-t border-[rgba(255,255,255,0.06)] p-3">
                {models.map((m) => (
                  <div key={m.model_id} className="space-y-2">
                    <span className={VA_MODEL_TAG}>{m.model_name}</span>
                    <ModelScheduleTable model={m} />
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
