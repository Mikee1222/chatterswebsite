"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassModal, Checkbox, ButtonPrimary, ButtonSecondary, SubmitButton } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Spinner } from "@/components/ui/spinner";
import type { MassListRecord, MassListType } from "@/services/mass-lists";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
};

const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
};

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
}: {
  list: MassListRecord;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
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
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -10px rgba(0,0,0,0.5), 0 0 40px -16px hsl(330 80% 55% / 0.06)",
      }}
    >
      <div className="absolute right-2 top-2 flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Edit list"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label={list.is_active ? "Deactivate list" : "Activate list"}
        >
          {list.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-rose-300/90 transition hover:bg-rose-500/20"
          aria-label="Delete list"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <span className="absolute left-3 top-3 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-white/10 bg-white/5 px-1.5 text-[11px] font-medium tabular-nums text-white/45">
        {list.sort_order}
      </span>
      <div className="relative mt-8 flex gap-3 pr-24">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xl ${
            isInclude
              ? "border-emerald-500/25 bg-emerald-500/10"
              : "border-rose-500/25 bg-rose-500/10"
          }`}
        >
          {list.emoji || "•"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{list.name}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/50">{list.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-0.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              isInclude
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/15 text-rose-300"
            }`}
          >
            {isInclude ? "Include" : "Exclude"}
          </span>
          {list.is_different_mass ? (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
              Different Mass
            </span>
          ) : null}
          {!list.applies_to_all_models ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
              Specific models
            </span>
          ) : null}
        </div>
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
}: {
  title: string;
  accent: "include" | "exclude";
  lists: MassListRecord[];
  onEdit: (r: MassListRecord) => void;
  onToggle: (r: MassListRecord) => void;
  onDelete: (r: MassListRecord) => void;
}) {
  const border =
    accent === "include"
      ? "border-emerald-500/15 bg-emerald-500/[0.03]"
      : "border-rose-500/15 bg-rose-500/[0.03]";
  const titleClass = accent === "include" ? "text-emerald-300/95" : "text-rose-300/95";

  return (
    <section
      className={`rounded-3xl border p-5 backdrop-blur-xl ${border}`}
      style={{
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px -16px rgba(0,0,0,0.45)",
      }}
    >
      <h2 className={`mb-4 text-lg font-bold tracking-tight ${titleClass}`}>{title}</h2>
      {lists.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/35">No lists in this category.</p>
      ) : (
        <motion.ul className="space-y-3" variants={container} initial="hidden" animate="show">
          {lists.map((list) => (
            <motion.li key={list.id} variants={itemMotion}>
              <AdminMassCard
                list={list}
                onEdit={() => onEdit(list)}
                onToggleActive={() => onToggle(list)}
                onDelete={() => onDelete(list)}
              />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}

export function AdminInformationsClient({ lists: initialLists }: { lists: MassListRecord[] }) {
  const [lists, setLists] = React.useState<MassListRecord[]>(() =>
    [...initialLists].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  );
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MassListRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm);

  React.useEffect(() => {
    setLists(
      [...initialLists].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
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

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const buildPayload = (): Omit<MassListRecord, "id" | "created_at"> => {
    const sort = Number.parseInt(form.sort_order, 10);
    return {
      emoji: form.emoji.trim(),
      name: form.name.trim(),
      type: form.type,
      description: form.description,
      is_different_mass: form.is_different_mass,
      applies_to_all_models: form.applies_to_all_models,
      model_names: form.applies_to_all_models ? "" : form.model_names.trim(),
      is_active: form.is_active,
      sort_order: Number.isFinite(sort) ? sort : 0,
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        const res = await fetch(`/api/mass-lists/${encodeURIComponent(editing.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string } & MassListRecord;
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Update failed");
          return;
        }
        const updated = data as MassListRecord;
        setLists((prev) =>
          [...prev.filter((x) => x.id !== updated.id), updated].sort(
            (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
          ),
        );
        toast.success("List updated");
      } else {
        const res = await fetch("/api/mass-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string } & MassListRecord;
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Create failed");
          return;
        }
        const created = data as MassListRecord;
        setLists((prev) =>
          [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
        );
        toast.success("List created");
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r: MassListRecord) => {
    try {
      const res = await fetch(`/api/mass-lists/${encodeURIComponent(r.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !r.is_active }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string } & MassListRecord;
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Update failed");
        return;
      }
      const updated = data as MassListRecord;
      setLists((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch {
      toast.error("Network error");
    }
  };

  const handleDelete = (r: MassListRecord) => {
    if (!window.confirm(`Delete “${r.name}”? This cannot be undone.`)) return;
    void (async () => {
      try {
        const res = await fetch(`/api/mass-lists/${encodeURIComponent(r.id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Delete failed");
          return;
        }
        setLists((prev) => prev.filter((x) => x.id !== r.id));
        toast.success("List deleted");
      } catch {
        toast.error("Network error");
      }
    })();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Informations</h1>
          <p className="mt-1 text-sm text-white/55">Manage mass message list definitions for models.</p>
        </div>
        <ButtonPrimary type="button" onClick={openCreate} className="shrink-0 self-start sm:self-auto">
          New List
        </ButtonPrimary>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminSection
          title="✅ Include"
          accent="include"
          lists={include}
          onEdit={openEdit}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
        <AdminSection
          title="❌ Exclude"
          accent="exclude"
          lists={exclude}
          onEdit={openEdit}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      </div>

      {modalOpen ? (
        <GlassModal
            onClose={() => !saving && closeModal()}
            title={editing ? "Edit List" : "New List"}
            subtitle="Configure how this list appears to chatters."
            className="md:max-w-lg"
          >
            <form onSubmit={handleSave} className="space-y-4 px-4 pb-5 pt-2 md:px-5">
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                    Emoji
                  </label>
                  <FormInput
                    value={form.emoji}
                    onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                    placeholder="🐋"
                    className="max-w-[4.5rem] text-center text-lg"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                    Name
                  </label>
                  <FormInput
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="List name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value === "exclude" ? "exclude" : "include" }))
                  }
                  className={`w-full min-h-[52px] cursor-pointer rounded-xl border bg-[#1a1a1a] px-4 py-3 text-[15px] text-white [color-scheme:dark] focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/25 ${
                    form.type === "include"
                      ? "border-emerald-500/35 ring-1 ring-emerald-500/15"
                      : "border-rose-500/35 ring-1 ring-rose-500/15"
                  }`}
                >
                  <option value="include">Include (green)</option>
                  <option value="exclude">Exclude (red)</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Description
                </label>
                <FormTextarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What this list means…"
                  rows={4}
                />
              </div>

              <Checkbox
                checked={form.is_different_mass}
                onChange={(e) => setForm((f) => ({ ...f, is_different_mass: e.target.checked }))}
                label="Different Mass"
              />

              <Checkbox
                checked={form.applies_to_all_models}
                onChange={(e) => setForm((f) => ({ ...f, applies_to_all_models: e.target.checked }))}
                label="Applies to all models"
              />

              {!form.applies_to_all_models ? (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                    Model names
                  </label>
                  <FormInput
                    value={form.model_names}
                    onChange={(e) => setForm((f) => ({ ...f, model_names: e.target.value }))}
                    placeholder="Lydia, Frost, Lina"
                  />
                </div>
              ) : null}

              <Checkbox
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                label="Active"
              />

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Sort order
                </label>
                <FormInput
                  type="number"
                  inputMode="numeric"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <ButtonSecondary type="button" className="flex-1" disabled={saving} onClick={closeModal}>
                  Cancel
                </ButtonSecondary>
                <SubmitButton className="flex-1 !w-auto min-w-0" disabled={saving}>
                  {saving ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                      Saving…
                    </span>
                  ) : (
                    "Save"
                  )}
                </SubmitButton>
              </div>
            </form>
          </GlassModal>
      ) : null}
    </div>
  );
}
