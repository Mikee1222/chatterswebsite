"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import type { MistakeReasonCategory, MistakeReasonRecord } from "@/services/chatter-mistakes";

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

const CATEGORY_CONFIG = {
  Low: {
    color: "text-yellow-400",
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/5",
    badge: "border-yellow-500/25 bg-yellow-500/15 text-yellow-400",
    dot: "bg-yellow-400",
    glow: "shadow-yellow-500/10",
    emoji: "",
    defaultPts: 5,
  },
  Medium: {
    color: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    badge: "border-amber-500/25 bg-amber-500/15 text-amber-400",
    dot: "bg-amber-400",
    glow: "shadow-amber-500/10",
    emoji: "",
    defaultPts: 10,
  },
  High: {
    color: "text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    badge: "border-red-500/25 bg-red-500/15 text-red-400",
    dot: "bg-red-500",
    glow: "shadow-red-500/10",
    emoji: "",
    defaultPts: 20,
  },
} as const;

type CategoryConfig = (typeof CATEGORY_CONFIG)[MistakeReasonCategory];

function SortableReasonRow({
  reason,
  onEdit,
  onToggle,
  config,
}: {
  reason: MistakeReasonRecord;
  onEdit: (r: MistakeReasonRecord) => void;
  onToggle: (r: MistakeReasonRecord) => void;
  config: CategoryConfig;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: reason.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
        isDragging ? "scale-[1.02] shadow-2xl" : "hover:bg-white/5"
      } ${
        reason.active
          ? `${config.border} bg-white/[0.02]`
          : "border-white/5 bg-white/[0.01] opacity-50"
      }`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab touch-none text-white/20 transition-colors hover:text-white/50 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`} />

      <span
        className={`flex-1 text-sm font-medium ${
          reason.active ? "text-white" : "text-white/30 line-through"
        }`}
      >
        {reason.label}
      </span>

      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.badge}`}>
        -{reason.points_deduction} pts
      </span>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(reason)}
          className="rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
          aria-label="Edit reason"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(reason)}
          className="rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
          aria-label={reason.active ? "Hide reason" : "Show reason"}
        >
          {reason.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

type Props = {
  initialReasons: MistakeReasonRecord[];
};

export function AdminMistakeReasonsClient({ initialReasons }: Props) {
  const { addToast } = useToast();
  const [reasons, setReasons] = React.useState(initialReasons);
  const [editingReason, setEditingReason] = React.useState<MistakeReasonRecord | null>(null);
  const [addingCategory, setAddingCategory] = React.useState<MistakeReasonCategory | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState("");
  const [newPts, setNewPts] = React.useState(5);

  React.useEffect(() => {
    setReasons(initialReasons);
  }, [initialReasons]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getReasonsForCategory = React.useCallback((cat: MistakeReasonCategory) => {
    return reasons
      .filter((r) => r.category === cat)
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  }, [reasons]);

  async function handleDragEnd(event: DragEndEvent, category: MistakeReasonCategory) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const catReasons = getReasonsForCategory(category);
    const oldIndex = catReasons.findIndex((r) => r.id === active.id);
    const newIndex = catReasons.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(catReasons, oldIndex, newIndex);
    const updated = reordered.map((r, i) => ({ ...r, sort_order: i }));

    const prev = reasons;
    setReasons((p) => [...p.filter((r) => r.category !== category), ...updated]);

    try {
      const results = await Promise.all(
        updated.map((r) =>
          fetch(`/api/admin/mistake-reasons/${r.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sort_order: r.sort_order }),
          })
        )
      );
      if (results.some((r) => !r.ok)) throw new Error("reorder");
      addToast(localToast("mr-order", "Order saved", "Reason order updated.", "normal"));
    } catch {
      setReasons(prev);
      addToast(localToast("mr-order-e", "Reorder failed", "Could not save order. Try again.", "high"));
    }
  }

  async function handleToggle(reason: MistakeReasonRecord) {
    const next = !reason.active;
    setReasons((p) => p.map((r) => (r.id === reason.id ? { ...r, active: next } : r)));
    try {
      const res = await fetch(`/api/admin/mistake-reasons/${reason.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error("fail");
      const data = (await res.json().catch(() => ({}))) as { reason?: MistakeReasonRecord };
      if (data.reason) setReasons((p) => p.map((r) => (r.id === reason.id ? data.reason! : r)));
    } catch {
      setReasons((p) => p.map((r) => (r.id === reason.id ? { ...r, active: reason.active } : r)));
      addToast(localToast("mr-tog-e", "Update failed", "Could not toggle visibility.", "high"));
    }
  }

  async function handleAddReason(category: MistakeReasonCategory) {
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      const catReasons = getReasonsForCategory(category);
      const res = await fetch("/api/admin/mistake-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel.trim(),
          category,
          points_deduction: Math.max(0, Math.min(1000, Math.floor(Number(newPts) || 0))),
          active: true,
          sort_order: catReasons.length,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { reason?: MistakeReasonRecord; error?: unknown };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
      if (data.reason) setReasons((p) => [...p, data.reason!]);
      setNewLabel("");
      setNewPts(CATEGORY_CONFIG[category].defaultPts);
      setAddingCategory(null);
      addToast(localToast("mr-add", "Created", "Reason added.", "normal"));
    } catch {
      addToast(localToast("mr-add-e", "Add failed", "Could not create reason.", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave() {
    if (!editingReason) return;
    const label = editingReason.label.trim();
    if (!label) {
      addToast(localToast("mr-empty", "Label required", "Enter a reason label.", "normal"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/mistake-reasons/${editingReason.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          category: editingReason.category,
          points_deduction: Math.max(0, Math.min(1000, Math.floor(editingReason.points_deduction))),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { reason?: MistakeReasonRecord; error?: unknown };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
      if (data.reason) {
        setReasons((p) => p.map((r) => (r.id === editingReason.id ? data.reason! : r)));
      } else {
        setReasons((p) =>
          p.map((r) =>
            r.id === editingReason.id
              ? {
                  ...r,
                  label,
                  category: editingReason.category,
                  points_deduction: editingReason.points_deduction,
                }
              : r
          )
        );
      }
      setEditingReason(null);
      addToast(localToast("mr-upd", "Saved", "Reason updated.", "normal"));
    } catch {
      addToast(localToast("mr-upd-e", "Save failed", "Try again.", "high"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-pink-400/60">Administration</p>
        <h1 className="text-3xl font-bold text-white">Mistake reasons</h1>
        <p className="mt-1 text-sm text-white/40">Drag to reorder · Click edit to change label or points</p>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        {(["Low", "Medium", "High"] as const).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = getReasonsForCategory(cat).filter((r) => r.active).length;
          return (
            <div
              key={cat}
              className={`rounded-2xl border bg-white/[0.03] p-4 text-center shadow-lg ${cfg.border} ${cfg.glow}`}
            >
              <p className="mb-1 text-2xl">{cfg.emoji}</p>
              <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-white/30">{cat} active</p>
            </div>
          );
        })}
      </div>

      {(["Low", "Medium", "High"] as const).map((cat) => {
        const cfg = CATEGORY_CONFIG[cat];
        const catReasons = getReasonsForCategory(cat);

        return (
          <div key={cat} className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{cfg.emoji}</span>
                <div>
                  <h2 className={`text-lg font-bold ${cfg.color}`}>{cat} mistakes</h2>
                  <p className="text-xs text-white/30">
                    {catReasons.filter((r) => r.active).length} active · {catReasons.filter((r) => !r.active).length}{""}
                    hidden
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddingCategory(cat);
                  setNewLabel("");
                  setNewPts(cfg.defaultPts);
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all hover:opacity-90 ${cfg.badge}`}
              >
                <Plus className="h-3.5 w-3.5" />
                Add reason
              </button>
            </div>

            {addingCategory === cat ? (
              <div className={`mb-3 rounded-2xl border p-4 ${cfg.border} ${cfg.bg}`}>
                <div className="mb-3 flex gap-3">
                  <input
                    autoFocus
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddReason(cat);
                    }}
                    placeholder="Reason label…"
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-pink-500/50 focus:outline-none"
                  />
                  <div className="relative w-28">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30">
                      pts
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={newPts}
                      onChange={(e) => setNewPts(Number(e.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-8 pr-3 text-sm text-white focus:border-pink-500/50 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleAddReason(cat)}
                    disabled={!newLabel.trim() || saving}
                    className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {saving ? "Adding…" : "Add reason"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingCategory(null)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {catReasons.length > 0 ? (
              <DndContext
                id={`mistake-reasons-${cat}`}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => void handleDragEnd(e, cat)}
              >
                <SortableContext items={catReasons.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {catReasons.map((reason) => (
                      <SortableReasonRow
                        key={reason.id}
                        reason={reason}
                        config={cfg}
                        onEdit={setEditingReason}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div
                className={`rounded-2xl border border-dashed py-8 text-center text-sm text-white/20 ${cfg.border}`}
              >
                No {cat.toLowerCase()} reasons yet
              </div>
            )}
          </div>
        );
      })}

      {editingReason ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => !saving && setEditingReason(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-reason-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-reason-title" className="mb-5 text-lg font-bold text-white">
              Edit reason
            </h3>

            <div className="mb-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">Label</label>
                <input
                  value={editingReason.label}
                  onChange={(e) => setEditingReason({ ...editingReason, label: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-pink-500/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">Category</label>
                  <select
                    value={editingReason.category}
                    onChange={(e) =>
                      setEditingReason({
                        ...editingReason,
                        category: e.target.value as MistakeReasonCategory,
                      })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">
                    Points deducted
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={editingReason.points_deduction}
                    onChange={(e) =>
                      setEditingReason({
                        ...editingReason,
                        points_deduction: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-pink-500/50 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleEditSave()}
                disabled={saving}
                className="flex-1 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 font-bold text-white disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditingReason(null)}
                disabled={saving}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-white/60 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
