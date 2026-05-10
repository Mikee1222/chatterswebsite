"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Edit } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import { GlassModal } from "@/components/ui/glass-modal";
import { FormInput } from "@/components/ui/form-input";
import { Label } from "@/components/ui/form";
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

type Props = {
  initialReasons: MistakeReasonRecord[];
};

type FormState = {
  label: string;
  category: MistakeReasonCategory;
  points_deduction: number;
  active: boolean;
};

const emptyForm: FormState = {
  label: "",
  category: "Low",
  points_deduction: 0,
  active: true,
};

export function AdminMistakeReasonsClient({ initialReasons }: Props) {
  const { addToast } = useToast();
  const [reasons, setReasons] = React.useState(initialReasons);
  const [modal, setModal] = React.useState<"add" | "edit" | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);

  const byCategory = React.useCallback(
    (cat: MistakeReasonCategory) =>
      reasons.filter((r) => r.category === cat).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    [reasons]
  );

  function openAddReason(cat: MistakeReasonCategory) {
    setForm({ ...emptyForm, category: cat });
    setEditId(null);
    setModal("add");
  }

  function openEditReason(r: MistakeReasonRecord) {
    setEditId(r.id);
    setForm({
      label: r.label,
      category: r.category,
      points_deduction: r.points_deduction,
      active: r.active,
    });
    setModal("edit");
  }

  async function saveModal() {
    if (!form.label.trim()) {
      addToast(localToast("mr-empty", "Label required", "Enter a reason label.", "normal"));
      return;
    }
    setSaving(true);
    try {
      if (modal === "add") {
        const res = await fetch("/api/admin/mistake-reasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label.trim(),
            category: form.category,
            points_deduction: form.points_deduction,
            active: form.active,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("fail");
        const reason = data.reason as MistakeReasonRecord | undefined;
        if (reason) setReasons((p) => [...p, reason].sort((a, b) => a.sort_order - b.sort_order));
        addToast(localToast("mr-add", "Created", "Reason added.", "normal"));
      } else if (modal === "edit" && editId) {
        const res = await fetch(`/api/admin/mistake-reasons/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label.trim(),
            category: form.category,
            points_deduction: form.points_deduction,
            active: form.active,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("fail");
        const reason = data.reason as MistakeReasonRecord | undefined;
        if (reason) setReasons((p) => p.map((x) => (x.id === editId ? reason : x)));
        addToast(localToast("mr-upd", "Saved", "Reason updated.", "normal"));
      }
      setModal(null);
      setEditId(null);
    } catch {
      addToast(localToast("mr-err", "Save failed", "Try again.", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: MistakeReasonRecord) {
    const next = !r.active;
    setReasons((p) => p.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
    try {
      const res = await fetch(`/api/admin/mistake-reasons/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error("fail");
    } catch {
      setReasons((p) => p.map((x) => (x.id === r.id ? { ...x, active: r.active } : x)));
      addToast(localToast("mr-tog-e", "Update failed", "", "high"));
    }
  }

  async function moveReason(r: MistakeReasonRecord, dir: -1 | 1) {
    const list = byCategory(r.category);
    const idx = list.findIndex((x) => x.id === r.id);
    const swapWith = list[idx + dir];
    if (!swapWith) return;
    const aOrder = r.sort_order;
    const bOrder = swapWith.sort_order;
    setReasons((p) =>
      p.map((x) => {
        if (x.id === r.id) return { ...x, sort_order: bOrder };
        if (x.id === swapWith.id) return { ...x, sort_order: aOrder };
        return x;
      })
    );
    try {
      await Promise.all([
        fetch(`/api/admin/mistake-reasons/${r.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: bOrder }),
        }),
        fetch(`/api/admin/mistake-reasons/${swapWith.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: aOrder }),
        }),
      ]);
    } catch {
      setReasons((p) =>
        p.map((x) => {
          if (x.id === r.id) return { ...x, sort_order: aOrder };
          if (x.id === swapWith.id) return { ...x, sort_order: bOrder };
          return x;
        })
      );
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Mistake reasons</h1>
        <p className="mt-1 text-sm text-white/50">Configure deduction reasons by severity.</p>
      </div>

      {(["Low", "Medium", "High"] as const).map((cat) => (
        <div key={cat}>
          <div className="mb-3 flex items-center justify-between">
            <h3
              className={`font-bold ${
                cat === "High" ? "text-red-400" : cat === "Medium" ? "text-amber-400" : "text-yellow-400"
              }`}
            >
              {cat === "High" ? "🔴" : cat === "Medium" ? "🟠" : "🟡"} {cat} mistakes
            </h3>
            <button
              type="button"
              onClick={() => openAddReason(cat)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10"
            >
              + Add reason
            </button>
          </div>
          {byCategory(cat).map((r) => (
            <div key={r.id} className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  aria-label="Move up"
                  className="rounded p-0.5 text-white/35 hover:bg-white/10 hover:text-white/70"
                  onClick={() => void moveReason(r, -1)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  className="rounded p-0.5 text-white/35 hover:bg-white/10 hover:text-white/70"
                  onClick={() => void moveReason(r, 1)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className={`flex-1 text-sm ${r.active ? "text-white" : "text-white/30 line-through"}`}>{r.label}</span>
              <span className="text-xs text-white/40">{r.points_deduction} pts</span>
              <button type="button" onClick={() => openEditReason(r)} className="text-white/40 hover:text-white" aria-label="Edit">
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void toggleActive(r)}
                className={`rounded-full border px-2 py-0.5 text-xs transition-all ${
                  r.active ? "border-green-500/25 bg-green-500/15 text-green-400" : "border-white/10 bg-white/5 text-white/30"
                }`}
              >
                {r.active ? "Active" : "Hidden"}
              </button>
            </div>
          ))}
        </div>
      ))}

      <AnimatePresence>
        {modal ? (
          <GlassModal
            onClose={() => !saving && setModal(null)}
            title={modal === "add" ? "Add reason" : "Edit reason"}
            className="md:max-w-md"
          >
            <div className="space-y-3 px-4 pb-6 pt-2">
              <div>
                <Label className="text-white/70">Label</Label>
                <FormInput value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-white/70">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as MistakeReasonCategory }))}
                  className="mt-1 flex min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <Label className="text-white/70">Points deduction</Label>
                <FormInput
                  type="number"
                  min={0}
                  max={1000}
                  value={String(form.points_deduction)}
                  onChange={(e) => setForm((f) => ({ ...f, points_deduction: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                  className="mt-1"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/25"
                />
                Active
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModal(null)}
                  className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveModal()}
                  className="flex-1 rounded-xl bg-pink-500/25 py-2.5 text-sm font-semibold text-pink-100 hover:bg-pink-500/35 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </GlassModal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
