"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassModal, Checkbox, ButtonPrimary, ButtonSecondary, SubmitButton } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Spinner } from "@/components/ui/spinner";
import { PriceMenusAdminPanel } from "@/components/price-menus-admin-panel";
import type { MassListRecord, MassListType } from "@/services/mass-lists";
import type { PriceMenusBundle } from "@/services/price-menus";

const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
};

type TabId = "lists" | "pricing";

type FormState = {
  emoji: string;
  name: string;
  type: MassListType;
  description: string;
  is_different_mass: boolean;
  applies_to_all_models: boolean;
  model_names: string;
  is_active: boolean;
  sort_order: string;
};

function emptyForm(): FormState {
  return {
    emoji: "",
    name: "",
    type: "include",
    description: "",
    is_different_mass: false,
    applies_to_all_models: true,
    model_names: "",
    is_active: true,
    sort_order: "0",
  };
}

function recordToForm(r: MassListRecord): FormState {
  return {
    emoji: r.emoji,
    name: r.name,
    type: r.type,
    description: r.description,
    is_different_mass: r.is_different_mass,
    applies_to_all_models: r.applies_to_all_models,
    model_names: r.model_names,
    is_active: r.is_active,
    sort_order: String(r.sort_order),
  };
}

function AdminMassCard({
  list,
  onEdit,
  onToggleActive,
  onDelete,
  canManage = false,
}: {
  list: MassListRecord;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  canManage?: boolean;
}) {
  const isInclude = list.type === "include";
  return (
    <motion.div
      variants={itemMotion}
      className={`group relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl transition-all ${
        list.is_active ? "opacity-100" : "opacity-55"
      } ${
        isInclude
          ? "border-emerald-500/20 bg-emerald-500/[0.04] hover:border-emerald-400/35"
          : "border-rose-500/20 bg-rose-500/[0.04] hover:border-rose-400/35"
      }`}
    >
      <div className="flex gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xl ${
            isInclude ? "border-emerald-500/25 bg-emerald-500/10" : "border-rose-500/25 bg-rose-500/10"
          }`}
        >
          {list.emoji || "•"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{list.name}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/50">{list.description}</p>
          {!list.applies_to_all_models && list.model_names ? (
            <p className="mt-2 text-[11px] text-white/40">Models: {list.model_names}</p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleActive}
              className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white"
            >
              {list.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-rose-500/20 p-1.5 text-rose-300/70 hover:text-rose-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function AdminSection({
  title,
  accent,
  lists,
  onEdit,
  onToggle,
  onDelete,
  canManage,
}: {
  title: string;
  accent: "include" | "exclude";
  lists: MassListRecord[];
  onEdit: (r: MassListRecord) => void;
  onToggle: (r: MassListRecord) => void;
  onDelete: (r: MassListRecord) => void;
  canManage: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border p-5 ${
        accent === "include"
          ? "border-emerald-500/15 bg-emerald-500/[0.03]"
          : "border-rose-500/15 bg-rose-500/[0.03]"
      }`}
    >
      <h2
        className={`mb-4 text-lg font-bold ${
          accent === "include" ? "text-emerald-300/95" : "text-rose-300/95"
        }`}
      >
        {title}
      </h2>
      <div className="space-y-3">
        {lists.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/35">No lists.</p>
        ) : (
          lists.map((list) => (
            <AdminMassCard
              key={list.id}
              list={list}
              canManage={canManage}
              onEdit={() => onEdit(list)}
              onToggleActive={() => onToggle(list)}
              onDelete={() => onDelete(list)}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function AdminInformationsClient({
  lists: initialLists,
  priceMenus,
  canManage = false,
}: {
  lists: MassListRecord[];
  priceMenus: PriceMenusBundle;
  canManage?: boolean;
}) {
  const [tab, setTab] = React.useState<TabId>("pricing");
  const [lists, setLists] = React.useState<MassListRecord[]>(() =>
    [...initialLists].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  );
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MassListRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm);

  React.useEffect(() => {
    setLists(
      [...initialLists].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    );
  }, [initialLists]);

  const include = React.useMemo(() => lists.filter((l) => l.type === "include"), [lists]);
  const exclude = React.useMemo(() => lists.filter((l) => l.type === "exclude"), [lists]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };
  const openEdit = (r: MassListRecord) => {
    setEditing(r);
    setForm(recordToForm(r));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        emoji: form.emoji,
        name: form.name.trim(),
        type: form.type,
        description: form.description,
        is_different_mass: form.is_different_mass,
        applies_to_all_models: form.applies_to_all_models,
        model_names: form.model_names,
        is_active: form.is_active,
        sort_order: Number.parseInt(form.sort_order, 10) || 0,
      };
      if (editing) {
        const res = await fetch(`/api/mass-lists/${encodeURIComponent(editing.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as MassListRecord & { error?: string };
        if (!res.ok) throw new Error(data.error || "Update failed");
        setLists((prev) =>
          [...prev.filter((x) => x.id !== data.id), data].sort(
            (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
          )
        );
      } else {
        const res = await fetch("/api/mass-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as MassListRecord & { error?: string };
        if (!res.ok) throw new Error(data.error || "Create failed");
        setLists((prev) =>
          [...prev, data].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        );
      }
      setModalOpen(false);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r: MassListRecord) => {
    try {
      const res = await fetch(`/api/mass-lists/${encodeURIComponent(r.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !r.is_active }),
      });
      const data = (await res.json().catch(() => ({}))) as MassListRecord & { error?: string };
      if (!res.ok) throw new Error(data.error || "Toggle failed");
      setLists((prev) => prev.map((x) => (x.id === data.id ? data : x)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  const handleDelete = async (r: MassListRecord) => {
    if (!window.confirm(`Delete “${r.name}”?`)) return;
    try {
      const res = await fetch(`/api/mass-lists/${encodeURIComponent(r.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Delete failed");
      }
      setLists((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const tabBtn = (id: TabId, label: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setTab(id)}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        tab === id
          ? "border-amber-400/45 bg-amber-500/20 text-amber-50"
          : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/85"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Informations</h1>
          <p className="mt-1 text-sm text-white/55">
            {canManage
              ? "Manage mass lists and price menus linked directly to models."
              : "View mass lists and price menus."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabBtn("pricing", "Pricing")}
            {tabBtn("lists", "Mass Lists")}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          {canManage && tab === "lists" ? (
            <ButtonPrimary type="button" onClick={openCreate}>
              New List
            </ButtonPrimary>
          ) : null}
        </div>
      </div>

      {tab === "lists" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AdminSection
            title="Include"
            accent="include"
            lists={include}
            onEdit={openEdit}
            onToggle={handleToggle}
            onDelete={handleDelete}
            canManage={canManage}
          />
          <AdminSection
            title="Exclude"
            accent="exclude"
            lists={exclude}
            onEdit={openEdit}
            onToggle={handleToggle}
            onDelete={handleDelete}
            canManage={canManage}
          />
        </div>
      ) : (
        <PriceMenusAdminPanel initial={priceMenus} canManage={canManage} />
      )}

      {modalOpen ? (
      <GlassModal
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        title={editing ? "Edit mass list" : "New mass list"}
        subtitle="Visible to chatters on Informations."
      >
        <div className="space-y-3">
          <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-white/45">
            Emoji
            <FormInput
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
            />
          </label>
          <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-white/45">
            Name
            <FormInput
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-white/45">
            Type
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value === "exclude" ? "exclude" : "include",
                }))
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              <option value="include">Include</option>
              <option value="exclude">Exclude</option>
            </select>
          </label>
          <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-white/45">
            Description
            <FormTextarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <Checkbox
            checked={form.is_different_mass}
            onChange={(e) => setForm((f) => ({ ...f, is_different_mass: e.target.checked }))}
            label="Different mass"
          />
          <Checkbox
            checked={form.applies_to_all_models}
            onChange={(e) => setForm((f) => ({ ...f, applies_to_all_models: e.target.checked }))}
            label="Applies to all models"
          />
          {!form.applies_to_all_models ? (
            <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-white/45">
              Model names (comma-separated)
              <FormInput
                value={form.model_names}
                onChange={(e) => setForm((f) => ({ ...f, model_names: e.target.value }))}
              />
            </label>
          ) : null}
          <Checkbox
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            label="Active"
          />
          <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-white/45">
            Sort order
            <FormInput
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <ButtonSecondary type="button" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </ButtonSecondary>
            <SubmitButton type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : "Save"}
            </SubmitButton>
          </div>
        </div>
      </GlassModal>
      ) : null}
    </div>
  );
}
