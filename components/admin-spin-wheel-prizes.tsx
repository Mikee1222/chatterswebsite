"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, GripVertical, Loader2, Plus, X } from "lucide-react";
import { saveSpinWheelPrizesAction } from "@/app/actions/spin-wheel-prizes";
import type { SpinPrizeRow } from "@/services/spin-wheel";
import {
  SPIN_PRIZE_UI_TYPES,
  defaultHexForSpinPrizeUi,
  spinPrizeDbToUi,
  type SpinPrizeUiType,
} from "@/lib/spin-wheel-prize-types";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";

const cardClass = cn(
  "rounded-xl border border-white/[0.08] bg-zinc-950/80 p-5",
  "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
);

const pinkButtonSmallClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110";

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
      return "Points";
    case "bonus":
      return "Bonus";
    case "break":
      return "Break";
    case "double_points":
      return "Double points";
    case "custom":
      return "Custom";
    default:
      return ui;
  }
}

function prizeTypeBadgeClass(ui: SpinPrizeUiType): string {
  switch (ui) {
    case "points":
      return "border-violet-500/40 bg-violet-500/15 text-violet-200";
    case "bonus":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "break":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    case "double_points":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "custom":
      return "border-gray-500/40 bg-gray-500/15 text-gray-300";
    default:
      return "border-white/20 bg-white/10 text-white/80";
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

function formatPrizeValue(d: Draft): string {
  switch (d.prizeTypeUi) {
    case "points":
      return `${d.prize_value || "0"} pts`;
    case "bonus":
      return `€${d.prize_value || "0"}`;
    case "break":
      return `${d.prize_value || "0"} min`;
    case "double_points":
      return "Double points";
    case "custom":
      return "Custom";
    default:
      return d.prize_value;
  }
}

function draftsEqual(a: Draft[], b: Draft[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((d, i) => {
    const o = b[i];
    if (!o) return false;
    return (
      d.id === o.id &&
      d.prizeTypeUi === o.prizeTypeUi &&
      d.label === o.label &&
      d.prize_value === o.prize_value &&
      d.probability === o.probability &&
      d.active === o.active &&
      d.color === o.color
    );
  });
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
        checked ? "border-emerald-500/50 bg-emerald-500/30" : "border-white/20 bg-white/10"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
          checked ? "left-[18px]" : "left-0.5"
        )}
      />
    </button>
  );
}

export function AdminSpinWheelPrizesSection({ initialPrizes }: { initialPrizes: SpinPrizeRow[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const initialDrafts = React.useMemo(() => initialPrizes.map(rowToDraft), [initialPrizes]);
  const [drafts, setDrafts] = React.useState<Draft[]>(() => initialPrizes.map(rowToDraft));
  const [deletedIds, setDeletedIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [dragIx, setDragIx] = React.useState<number | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [addForm, setAddForm] = React.useState<Draft>(() => newDraft());

  React.useEffect(() => {
    setDrafts(initialPrizes.map(rowToDraft));
    setDeletedIds([]);
    setExpandedId(null);
  }, [initialPrizes]);

  const prizesDirty = deletedIds.length > 0 || !draftsEqual(drafts, initialDrafts);

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((rows) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        let next = { ...r, ...patch };
        if (patch.prizeTypeUi != null && patch.color == null && patch.prizeTypeUi !== r.prizeTypeUi) {
          next = { ...next, color: defaultHexForSpinPrizeUi(patch.prizeTypeUi) };
        }
        return next;
      })
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
    if (expandedId === row.id) setExpandedId(null);
  }

  function confirmAddPrize() {
    setDrafts((rows) => [...rows, { ...addForm, id: `new-${crypto.randomUUID()}` }]);
    setAddForm(newDraft());
    setShowAddForm(false);
  }

  function cancelAddForm() {
    setAddForm(newDraft());
    setShowAddForm(false);
  }

  const activeDrafts = drafts.filter((d) => d.active);
  const totalWeight = activeDrafts.reduce((s, d) => s + Math.max(0, d.probability), 0);

  const maxEffectivePct =
    totalWeight > 0
      ? Math.max(...activeDrafts.map((d) => (Math.max(0, d.probability) / totalWeight) * 100))
      : 0;
  const distributionWarning = maxEffectivePct > 60;

  function effectivePct(d: Draft): number {
    if (!d.active || totalWeight <= 0) return 0;
    return (Math.max(0, d.probability) / totalWeight) * 100;
  }

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
    <section className={cardClass}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-white">Spin wheel prizes</h2>
          <p className="mt-1 text-sm text-white/50">Drag to reorder. Probability is relative weight.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prizesDirty ? (
            <span className="inline-flex items-center gap-2 text-xs text-amber-300/90">
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
              Unsaved changes
            </span>
          ) : null}
          <button type="button" onClick={() => setShowAddForm(true)} className={pinkButtonSmallClass}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add prize
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {drafts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-white/45">
            No prizes yet — add one to populate the spin wheel.
          </p>
        ) : (
          drafts.map((d, index) => {
            const expanded = expandedId === d.id;
            const pct = effectivePct(d);
            return (
              <div
                key={d.id}
                className={cn(
                  "rounded-lg border border-white/[0.08] bg-black/25 transition-opacity",
                  !d.active && "opacity-60"
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
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => setDragIx(index)}
                    onDragEnd={() => setDragIx(null)}
                    className="cursor-grab touch-none rounded-md p-1 text-white/40 hover:text-white/70 active:cursor-grabbing"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" aria-hidden />
                  </button>

                  <span
                    className="h-5 w-5 shrink-0 rounded-full border border-white/20"
                    style={{ backgroundColor: d.color.startsWith("#") ? d.color : "#a855f7" }}
                    aria-hidden
                  />

                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      prizeTypeBadgeClass(d.prizeTypeUi)
                    )}
                  >
                    {typeLabel(d.prizeTypeUi)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{d.label || "Untitled"}</p>
                    <p className="truncate text-xs text-white/45">{formatPrizeValue(d)}</p>
                  </div>

                  {d.active && totalWeight > 0 ? (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-white/70">
                      {pct.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-white/30">—</span>
                  )}

                  <ToggleSwitch
                    checked={d.active}
                    onChange={(v) => updateDraft(index, { active: v })}
                    label={`${d.label} active`}
                  />

                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : d.id)}
                    className="rounded-md p-1 text-white/40 hover:text-white/70"
                    aria-label={expanded ? "Collapse prize" : "Edit prize"}
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="rounded-md p-1 text-white/40 transition hover:text-red-400"
                    aria-label="Delete prize"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {expanded ? (
                  <div className="space-y-3 border-t border-white/[0.06] px-3 pb-3 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-white/45">Prize type</label>
                        <select
                          value={d.prizeTypeUi}
                          onChange={(e) => updateDraft(index, { prizeTypeUi: e.target.value as SpinPrizeUiType })}
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                        >
                          {SPIN_PRIZE_UI_TYPES.map((opt) => (
                            <option key={opt} value={opt}>
                              {typeLabel(opt)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-white/45">
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
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                          placeholder={d.prizeTypeUi === "custom" ? "e.g. Free coffee, Gift card…" : "Shown on the wheel"}
                        />
                      </div>
                    </div>
                    {extraFieldLabel(d.prizeTypeUi) ? (
                      <div>
                        <label className="mb-1 block text-xs text-white/45">{extraFieldLabel(d.prizeTypeUi)}</label>
                        <input
                          value={d.prize_value}
                          onChange={(e) => updateDraft(index, { prize_value: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                        />
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[7rem] flex-1">
                        <label className="mb-1 block text-xs text-white/45">Weight</label>
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
                            className="w-full rounded-lg border border-white/10 bg-zinc-950 py-2 pl-3 pr-8 text-sm text-white"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
                            wt
                          </span>
                        </div>
                      </div>
                      <div className="min-w-[5rem]">
                        <label className="mb-1 block text-xs text-white/45">Color</label>
                        <input
                          type="color"
                          value={d.color.startsWith("#") ? d.color : "#a855f7"}
                          onChange={(e) => updateDraft(index, { color: e.target.value })}
                          className="h-9 w-full min-w-[4rem] cursor-pointer rounded-lg border border-white/10 bg-black"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {showAddForm ? (
        <div className="mt-3 space-y-3 rounded-lg border border-[hsl(330,70%,55%)]/25 bg-[hsl(330,70%,55%)]/5 p-4">
          <p className="text-sm font-medium text-white">New prize</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-white/45">Prize type</label>
              <select
                value={addForm.prizeTypeUi}
                onChange={(e) => {
                  const ui = e.target.value as SpinPrizeUiType;
                  setAddForm((f) => ({
                    ...f,
                    prizeTypeUi: ui,
                    color: defaultHexForSpinPrizeUi(ui),
                  }));
                }}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              >
                {SPIN_PRIZE_UI_TYPES.map((opt) => (
                  <option key={opt} value={opt}>
                    {typeLabel(opt)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/45">
                {addForm.prizeTypeUi === "custom" ? "Label (prize text)" : "Label"}
              </label>
              <input
                value={addForm.label}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    label: e.target.value,
                    ...(f.prizeTypeUi === "custom" ? { prize_value: e.target.value } : {}),
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
                placeholder="Shown on the wheel"
              />
            </div>
          </div>
          {extraFieldLabel(addForm.prizeTypeUi) ? (
            <div>
              <label className="mb-1 block text-xs text-white/45">{extraFieldLabel(addForm.prizeTypeUi)}</label>
              <input
                value={addForm.prize_value}
                onChange={(e) => setAddForm((f) => ({ ...f, prize_value: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[7rem] flex-1">
              <label className="mb-1 block text-xs text-white/45">Weight</label>
              <input
                type="number"
                min={0}
                value={addForm.probability}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    probability: e.target.value === "" ? 0 : Number(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="min-w-[5rem]">
              <label className="mb-1 block text-xs text-white/45">Color</label>
              <input
                type="color"
                value={addForm.color.startsWith("#") ? addForm.color : "#a855f7"}
                onChange={(e) => setAddForm((f) => ({ ...f, color: e.target.value }))}
                className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-black"
              />
            </div>
            <label className="flex items-center gap-2 pb-1 text-xs text-white/55">
              <ToggleSwitch
                checked={addForm.active}
                onChange={(v) => setAddForm((f) => ({ ...f, active: v }))}
                label="New prize active"
              />
              Active
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={confirmAddPrize} className={pinkButtonSmallClass}>
              Add
            </button>
            <button
              type="button"
              onClick={cancelAddForm}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "mt-4 rounded-lg border px-4 py-3 text-sm",
          distributionWarning
            ? "border-amber-500/30 bg-amber-500/10 text-amber-100/90"
            : "border-emerald-500/25 bg-emerald-500/10 text-emerald-100/90"
        )}
      >
        <p className="font-medium tabular-nums">
          Total weight: {totalWeight}{" "}
          <span className="font-normal text-white/50">(effective: {activeDrafts.length} active prizes)</span>
        </p>
        {totalWeight > 0 && activeDrafts.length > 0 ? (
          <ul className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-xs text-white/60">
            {activeDrafts.map((d) => (
              <li key={d.id} className="flex justify-between gap-4">
                <span className="min-w-0 truncate">{d.label || "Untitled"}</span>
                <span className="shrink-0 tabular-nums">{effectivePct(d).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-white/45">Activate at least one prize with positive weight.</p>
        )}
      </div>

      <button
        type="button"
        disabled={saving || (!prizesDirty && drafts.length === 0)}
        onClick={() => void saveAll()}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
        {saving ? "Saving…" : "Save prizes"}
      </button>
    </section>
  );
}
