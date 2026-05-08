"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Loader2, X } from "lucide-react";
import { saveSpinWheelPrizesAction } from "@/app/actions/spin-wheel-prizes";
import type { SpinPrizeRow } from "@/services/spin-wheel";
import {
  SPIN_PRIZE_UI_TYPES,
  defaultHexForSpinPrizeUi,
  spinPrizeDbToUi,
  spinPrizeTypeBadgeClass,
  type SpinPrizeUiType,
} from "@/lib/spin-wheel-prize-types";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

type Draft = {
  id: string;
  prizeTypeUi: SpinPrizeUiType;
  label: string;
  prize_value: string;
  probability: number;
  active: boolean;
  color: string;
};

function rowToDraft(p: SpinPrizeRow): Draft {
  const ui = spinPrizeDbToUi(p.prize_type);
  return {
    id: p.id,
    prizeTypeUi: ui,
    label: p.label,
    prize_value: p.prize_value,
    probability: p.probability,
    active: p.active,
    color: p.color?.trim() || defaultHexForSpinPrizeUi(ui),
  };
}

function newDraft(): Draft {
  const ui: SpinPrizeUiType = "points";
  return {
    id: `new-${crypto.randomUUID()}`,
    prizeTypeUi: ui,
    label: "New prize",
    prize_value: "100",
    probability: 10,
    active: true,
    color: defaultHexForSpinPrizeUi(ui),
  };
}

function typeLabel(ui: SpinPrizeUiType): string {
  switch (ui) {
    case "points":
      return "points";
    case "bonus":
      return "bonus";
    case "break":
      return "break";
    case "double_points":
      return "double_points";
    case "custom":
      return "custom";
    default:
      return ui;
  }
}

function extraFieldLabel(ui: SpinPrizeUiType): string | null {
  switch (ui) {
    case "points":
      return "Points amount";
    case "bonus":
      return "Euro amount (€)";
    case "break":
      return "Minutes";
    case "custom":
      return null;
    default:
      return null;
  }
}

export function AdminSpinWheelPrizesSection({ initialPrizes }: { initialPrizes: SpinPrizeRow[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [drafts, setDrafts] = React.useState<Draft[]>(() => initialPrizes.map(rowToDraft));
  const [deletedIds, setDeletedIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [dragIx, setDragIx] = React.useState<number | null>(null);

  React.useEffect(() => {
    setDrafts(initialPrizes.map(rowToDraft));
    setDeletedIds([]);
  }, [initialPrizes]);

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((rows) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        let next = { ...r, ...patch };
        if (patch.prizeTypeUi != null && patch.color == null && patch.prizeTypeUi !== r.prizeTypeUi) {
          next = { ...next, color: defaultHexForSpinPrizeUi(patch.prizeTypeUi) };
        }
        return next;
      }),
    );
  }

  function moveRow(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setDrafts((rows) => {
      const copy = [...rows];
      const [item] = copy.splice(from, 1);
      if (!item) return rows;
      copy.splice(to, 0, item);
      return copy;
    });
  }

  function removeRow(index: number) {
    const row = drafts[index];
    if (!row) return;
    if (!row.id.startsWith("new-")) setDeletedIds((prev) => [...prev, row.id]);
    setDrafts((rows) => rows.filter((_, i) => i !== index));
  }

  function addRow() {
    setDrafts((rows) => [...rows, newDraft()]);
  }

  const activeDrafts = drafts.filter((d) => d.active);
  const totalWeight = activeDrafts.reduce((s, d) => s + Math.max(0, d.probability), 0);

  async function saveAll() {
    setSaving(true);
    try {
      const prizes = drafts.map((d, sort_order) => ({
        id: d.id,
        label: d.label,
        prizeTypeUi: d.prizeTypeUi,
        prize_value: d.prize_value,
        probability: Math.max(0, Math.floor(d.probability)),
        active: d.active,
        color: d.color,
        sort_order,
      }));
      const res = await saveSpinWheelPrizesAction({ prizes, deletedIds });
      if (!res.success) {
        addToast(localToast(`sw-save-err-${Date.now()}`, "Could not save prizes", res.error, "high"));
        return;
      }
      const uniqWarnings = [...new Set(res.warnings)];
      addToast(localToast(`sw-save-ok-${Date.now()}`, "Prizes saved", "Spin wheel configuration was updated.", "normal"));
      uniqWarnings.forEach((w, i) => {
        addToast(localToast(`sw-warn-${Date.now()}-${i}`, "Heads up", w, "high"));
      });
      setDeletedIds([]);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/50">
          Manage segments and odds. Ordering is mirrored on the wheel (set sort order via drag handles). Add a numeric{" "}
          <code className="text-white/65">sort_order</code> field in Airtable if order does not persist.
        </p>
        <button
          type="button"
          onClick={addRow}
          className="rounded-xl border border-pink-500/40 bg-pink-500/15 px-3 py-1.5 text-xs font-semibold text-pink-200 hover:bg-pink-500/25"
        >
          + Add prize
        </button>
      </div>

      <div className="space-y-3">
        {drafts.length === 0 ? (
          <p className="text-sm text-white/45">No prizes yet — add one to populate the spin wheel.</p>
        ) : (
          drafts.map((d, index) => (
            <div
              key={d.id}
              className={cn(
                "mb-3 rounded-2xl border border-white/10 bg-white/5 p-4",
                !d.active ? "opacity-60" : null,
              )}
              onDragOver={(e) => {
                if (dragIx == null) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (dragIx == null) return;
                e.preventDefault();
                moveRow(dragIx, index);
                setDragIx(null);
              }}
            >
              <div className="mb-3 flex flex-wrap items-start gap-3">
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDragIx(index)}
                  onDragEnd={() => setDragIx(null)}
                  className="mt-7 cursor-grab touch-none rounded-lg border border-white/10 bg-black/40 p-1.5 text-white/50 hover:text-white/70 active:cursor-grabbing"
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="h-5 w-5" aria-hidden />
                </button>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        spinPrizeTypeBadgeClass(d.prizeTypeUi),
                      )}
                    >
                      {typeLabel(d.prizeTypeUi)}
                    </span>
                    <label className="flex items-center gap-2 text-xs text-white/55">
                      <input
                        type="checkbox"
                        checked={d.active}
                        onChange={(e) => updateDraft(index, { active: e.target.checked })}
                        className="rounded border-white/20"
                      />
                      Active (on wheel)
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/45">Prize type</label>
                      <select
                        value={d.prizeTypeUi}
                        onChange={(e) => updateDraft(index, { prizeTypeUi: e.target.value as SpinPrizeUiType })}
                        className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                      >
                        {SPIN_PRIZE_UI_TYPES.map((opt) => (
                          <option key={opt} value={opt}>
                            {typeLabel(opt)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/45">
                        {d.prizeTypeUi === "custom" ? "Label (prize text)" : "Label"}
                      </label>
                      <input
                        value={d.label}
                        onChange={(e) =>
                          updateDraft(index, {
                            label: e.target.value,
                            ...(d.prizeTypeUi === "custom" ? { prize_value: e.target.value } : {}),
                          })
                        }
                        className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                        placeholder={
                          d.prizeTypeUi === "custom"
                            ? "e.g. Free coffee, Gift card…"
                            : "Shown on the wheel"
                        }
                      />
                    </div>
                  </div>
                  {extraFieldLabel(d.prizeTypeUi) ? (
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/45">
                        {extraFieldLabel(d.prizeTypeUi)}
                      </label>
                      <input
                        value={d.prize_value}
                        onChange={(e) => updateDraft(index, { prize_value: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                        placeholder={d.prizeTypeUi === "custom" ? "e.g. Free coffee, Day off" : ""}
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[8rem] flex-1">
                      <label className="mb-1 block text-[11px] font-medium text-white/45">Probability</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          value={Number.isFinite(d.probability) ? d.probability : 0}
                          onChange={(e) =>
                            updateDraft(index, {
                              probability: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-white/10 bg-zinc-950 py-2 pl-3 pr-9 text-sm text-white"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
                          %
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/35">
                        Uses the same integer <strong className="font-medium text-white/50">weight</strong> as before; effective % is
                        weight ÷ active total (below).
                      </p>
                    </div>
                    <div className="min-w-[6rem]">
                      <label className="mb-1 block text-[11px] font-medium text-white/45">Color</label>
                      <input
                        type="color"
                        value={d.color.startsWith("#") ? d.color : "#a855f7"}
                        onChange={(e) => updateDraft(index, { color: e.target.value })}
                        className="h-10 w-full min-w-[4rem] cursor-pointer rounded-lg border border-white/10 bg-black"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="ml-auto shrink-0 text-red-400 hover:text-red-300"
                  aria-label="Delete prize"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 text-sm text-white/70">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Probability helper</p>
        <p className="mt-2 font-medium tabular-nums text-white/85">Total weight (active prizes): {totalWeight}</p>
        {totalWeight > 0 && activeDrafts.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[13px]">
            <li className="text-white/45">Effective chances:</li>
            {activeDrafts.map((d) => {
              const w = Math.max(0, d.probability);
              const pct = (w / totalWeight) * 100;
              return (
                <li key={d.id} className="flex justify-between gap-4">
                  <span className="min-w-0 truncate">{d.label || "(untitled)"}</span>
                  <span className="shrink-0 tabular-nums text-white/80">{pct.toFixed(1)}%</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-white/45">Activate at least one prize with positive weight to see percentages.</p>
        )}
      </div>

      <button
        type="button"
        disabled={saving || (drafts.length === 0 && deletedIds.length === 0)}
        onClick={() => void saveAll()}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 px-4 text-sm font-semibold text-white shadow-lg shadow-pink-900/40 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
        {saving ? "Saving…" : "Save all prizes"}
      </button>
    </section>
  );
}
