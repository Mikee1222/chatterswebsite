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
import type { ModelTier, ModelTierRecord } from "@/services/model-tiers";
import type { PricingRow, PricingSpecial, SpenderTier } from "@/services/pricing";

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

type TabId = "lists" | "tiers" | "pricing";

const MODEL_TIER_ORDER: ModelTier[] = ["high", "medium", "low"];
const SPENDER_ORDER: SpenderTier[] = ["high", "medium", "low", "medium_low"];

function spenderLabel(s: SpenderTier): string {
  if (s === "medium_low") return "Medium-Low";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

type TierFormState = {
  model_name: string;
  tier: ModelTier;
  sort_order: string;
  is_active: boolean;
};

function emptyTierForm(tier: ModelTier): TierFormState {
  return { model_name: "", tier, sort_order: "0", is_active: true };
}

function recordToTierForm(r: ModelTierRecord): TierFormState {
  return {
    model_name: r.model_name,
    tier: r.tier,
    sort_order: String(r.sort_order),
    is_active: r.is_active,
  };
}

type PricingRowFormState = {
  model_tier: ModelTier;
  spender_tier: SpenderTier;
  video_number: string;
  price_normal: string;
  price_negotiation: string;
  description: string;
  notes: string;
  is_active: boolean;
  sort_order: string;
};

function emptyPricingRowForm(): PricingRowFormState {
  return {
    model_tier: "high",
    spender_tier: "high",
    video_number: "1",
    price_normal: "",
    price_negotiation: "",
    description: "",
    notes: "",
    is_active: true,
    sort_order: "0",
  };
}

function rowToForm(r: PricingRow): PricingRowFormState {
  return {
    model_tier: r.model_tier,
    spender_tier: r.spender_tier,
    video_number: String(r.video_number),
    price_normal: r.price_normal,
    price_negotiation: r.price_negotiation,
    description: r.description,
    notes: r.notes,
    is_active: r.is_active,
    sort_order: String(r.sort_order),
  };
}

type PricingSpecialFormState = {
  label: string;
  price_normal: string;
  price_negotiation: string;
  description: string;
  models_applicable: string;
  is_active: boolean;
  sort_order: string;
};

function emptySpecialForm(): PricingSpecialFormState {
  return {
    label: "",
    price_normal: "",
    price_negotiation: "",
    description: "",
    models_applicable: "ALL",
    is_active: true,
    sort_order: "0",
  };
}

function specialToForm(s: PricingSpecial): PricingSpecialFormState {
  return {
    label: s.label,
    price_normal: s.price_normal,
    price_negotiation: s.price_negotiation,
    description: s.description,
    models_applicable: s.models_applicable,
    is_active: s.is_active,
    sort_order: String(s.sort_order),
  };
}

function sortTiers(ts: ModelTierRecord[]): ModelTierRecord[] {
  return [...ts].sort((a, b) => a.sort_order - b.sort_order || a.model_name.localeCompare(b.model_name));
}

function sortPricingRows(rs: PricingRow[]): PricingRow[] {
  return [...rs].sort((a, b) => a.sort_order - b.sort_order || a.video_number - b.video_number);
}

function sortSpecials(ss: PricingSpecial[]): PricingSpecial[] {
  return [...ss].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export function AdminInformationsClient({
  lists: initialLists,
  tiers: initialTiers,
  pricingRows: initialPricingRows,
  pricingSpecials: initialPricingSpecials,
}: {
  lists: MassListRecord[];
  tiers: ModelTierRecord[];
  pricingRows: PricingRow[];
  pricingSpecials: PricingSpecial[];
}) {
  const [tab, setTab] = React.useState<TabId>("lists");

  const [lists, setLists] = React.useState<MassListRecord[]>(() =>
    [...initialLists].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  );
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MassListRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm);

  const [tiers, setTiers] = React.useState<ModelTierRecord[]>(() => sortTiers(initialTiers));
  const [tierModalOpen, setTierModalOpen] = React.useState(false);
  const [tierEditing, setTierEditing] = React.useState<ModelTierRecord | null>(null);
  const [tierForm, setTierForm] = React.useState<TierFormState>(emptyTierForm("medium"));
  const [tierSaving, setTierSaving] = React.useState(false);
  const [tierTierLocked, setTierTierLocked] = React.useState(false);

  const [pricingRows, setPricingRows] = React.useState<PricingRow[]>(() => sortPricingRows(initialPricingRows));
  const [pricingSpecials, setPricingSpecials] = React.useState<PricingSpecial[]>(() =>
    sortSpecials(initialPricingSpecials),
  );
  const [filterMt, setFilterMt] = React.useState<ModelTier | "all">("all");
  const [filterSt, setFilterSt] = React.useState<SpenderTier | "all">("all");
  const [rowModalOpen, setRowModalOpen] = React.useState(false);
  const [rowEditing, setRowEditing] = React.useState<PricingRow | null>(null);
  const [rowForm, setRowForm] = React.useState<PricingRowFormState>(emptyPricingRowForm());
  const [rowSaving, setRowSaving] = React.useState(false);
  const [specialModalOpen, setSpecialModalOpen] = React.useState(false);
  const [specialEditing, setSpecialEditing] = React.useState<PricingSpecial | null>(null);
  const [specialForm, setSpecialForm] = React.useState<PricingSpecialFormState>(emptySpecialForm());
  const [specialSaving, setSpecialSaving] = React.useState(false);

  React.useEffect(() => {
    setLists([...initialLists].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
  }, [initialLists]);

  React.useEffect(() => {
    setTiers(sortTiers(initialTiers));
  }, [initialTiers]);

  React.useEffect(() => {
    setPricingRows(sortPricingRows(initialPricingRows));
  }, [initialPricingRows]);

  React.useEffect(() => {
    setPricingSpecials(sortSpecials(initialPricingSpecials));
  }, [initialPricingSpecials]);

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

  const openTierModalCreate = (preset?: ModelTier) => {
    setTierEditing(null);
    setTierForm(emptyTierForm(preset ?? "medium"));
    setTierTierLocked(preset !== undefined);
    setTierModalOpen(true);
  };

  const openTierModalEdit = (r: ModelTierRecord) => {
    setTierEditing(r);
    setTierForm(recordToTierForm(r));
    setTierTierLocked(false);
    setTierModalOpen(true);
  };

  const closeTierModal = () => {
    if (tierSaving) return;
    setTierModalOpen(false);
    setTierEditing(null);
    setTierTierLocked(false);
  };

  const handleTierSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = tierForm.model_name.trim();
    if (!name) {
      toast.error("Model name is required");
      return;
    }
    const sort = Number.parseInt(tierForm.sort_order, 10);
    const sort_order = Number.isFinite(sort) ? sort : 0;
    setTierSaving(true);
    try {
      if (tierEditing) {
        const res = await fetch(`/api/model-tiers/${encodeURIComponent(tierEditing.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            model_name: name,
            tier: tierForm.tier,
            is_active: tierForm.is_active,
            sort_order,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string } & ModelTierRecord;
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Update failed");
          return;
        }
        const updated = data as ModelTierRecord;
        setTiers((prev) => sortTiers([...prev.filter((x) => x.id !== updated.id), updated]));
        toast.success("Model tier updated");
      } else {
        const res = await fetch("/api/model-tiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            model_name: name,
            tier: tierForm.tier,
            is_active: tierForm.is_active,
            sort_order,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string } & ModelTierRecord;
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Create failed");
          return;
        }
        const created = data as ModelTierRecord;
        setTiers((prev) => sortTiers([...prev, created]));
        toast.success("Model tier created");
      }
      closeTierModal();
    } finally {
      setTierSaving(false);
    }
  };

  const handleTierDelete = (r: ModelTierRecord) => {
    if (!window.confirm(`Delete model tier “${r.model_name}”?`)) return;
    void (async () => {
      try {
        const res = await fetch(`/api/model-tiers/${encodeURIComponent(r.id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Delete failed");
          return;
        }
        setTiers((prev) => prev.filter((x) => x.id !== r.id));
        toast.success("Deleted");
      } catch {
        toast.error("Network error");
      }
    })();
  };

  const filteredRows = React.useMemo(() => {
    return pricingRows.filter((r) => {
      if (filterMt !== "all" && r.model_tier !== filterMt) return false;
      if (filterSt !== "all" && r.spender_tier !== filterSt) return false;
      return true;
    });
  }, [pricingRows, filterMt, filterSt]);

  const openRowCreate = () => {
    setRowEditing(null);
    setRowForm(emptyPricingRowForm());
    setRowModalOpen(true);
  };

  const openRowEdit = (r: PricingRow) => {
    setRowEditing(r);
    setRowForm(rowToForm(r));
    setRowModalOpen(true);
  };

  const closeRowModal = () => {
    if (rowSaving) return;
    setRowModalOpen(false);
    setRowEditing(null);
  };

  const handleRowSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const vn = Number.parseInt(rowForm.video_number, 10);
    const so = Number.parseInt(rowForm.sort_order, 10);
    const payloadBase = {
      model_tier: rowForm.model_tier,
      spender_tier: rowForm.spender_tier,
      video_number: Number.isFinite(vn) ? vn : 0,
      price_normal: rowForm.price_normal,
      price_negotiation: rowForm.price_negotiation,
      description: rowForm.description,
      notes: rowForm.notes,
      is_active: rowForm.is_active,
      sort_order: Number.isFinite(so) ? so : 0,
    };
    setRowSaving(true);
    try {
      if (rowEditing) {
        const res = await fetch(`/api/pricing/${encodeURIComponent(rowEditing.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type: "row", ...payloadBase }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string } & PricingRow;
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Update failed");
          return;
        }
        const updated = data as PricingRow;
        setPricingRows((prev) => sortPricingRows([...prev.filter((x) => x.id !== updated.id), updated]));
        toast.success("Pricing row updated");
      } else {
        const res = await fetch("/api/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type: "row", ...payloadBase }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string } & PricingRow;
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Create failed");
          return;
        }
        const created = data as PricingRow;
        setPricingRows((prev) => sortPricingRows([...prev, created]));
        toast.success("Pricing row created");
      }
      closeRowModal();
    } finally {
      setRowSaving(false);
    }
  };

  const handleRowDelete = (r: PricingRow) => {
    if (!window.confirm(`Delete pricing row #${r.video_number} (${r.model_tier} / ${r.spender_tier})?`)) return;
    void (async () => {
      try {
        const res = await fetch(`/api/pricing/${encodeURIComponent(r.id)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type: "row" }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Delete failed");
          return;
        }
        setPricingRows((prev) => prev.filter((x) => x.id !== r.id));
        toast.success("Deleted");
      } catch {
        toast.error("Network error");
      }
    })();
  };

  const openSpecialCreate = () => {
    setSpecialEditing(null);
    setSpecialForm(emptySpecialForm());
    setSpecialModalOpen(true);
  };

  const openSpecialEdit = (s: PricingSpecial) => {
    setSpecialEditing(s);
    setSpecialForm(specialToForm(s));
    setSpecialModalOpen(true);
  };

  const closeSpecialModal = () => {
    if (specialSaving) return;
    setSpecialModalOpen(false);
    setSpecialEditing(null);
  };

  const handleSpecialSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialForm.label.trim()) {
      toast.error("Label is required");
      return;
    }
    const so = Number.parseInt(specialForm.sort_order, 10);
    const payloadBase = {
      label: specialForm.label.trim(),
      price_normal: specialForm.price_normal,
      price_negotiation: specialForm.price_negotiation,
      description: specialForm.description,
      models_applicable: specialForm.models_applicable,
      is_active: specialForm.is_active,
      sort_order: Number.isFinite(so) ? so : 0,
    };
    setSpecialSaving(true);
    try {
      if (specialEditing) {
        const res = await fetch(`/api/pricing/${encodeURIComponent(specialEditing.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type: "special", ...payloadBase }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string } & PricingSpecial;
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Update failed");
          return;
        }
        const updated = data as PricingSpecial;
        setPricingSpecials((prev) => sortSpecials([...prev.filter((x) => x.id !== updated.id), updated]));
        toast.success("Special updated");
      } else {
        const res = await fetch("/api/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type: "special", ...payloadBase }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string } & PricingSpecial;
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Create failed");
          return;
        }
        const created = data as PricingSpecial;
        setPricingSpecials((prev) => sortSpecials([...prev, created]));
        toast.success("Special created");
      }
      closeSpecialModal();
    } finally {
      setSpecialSaving(false);
    }
  };

  const handleSpecialDelete = (s: PricingSpecial) => {
    if (!window.confirm(`Delete special “${s.label}”?`)) return;
    void (async () => {
      try {
        const res = await fetch(`/api/pricing/${encodeURIComponent(s.id)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type: "special" }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Delete failed");
          return;
        }
        setPricingSpecials((prev) => prev.filter((x) => x.id !== s.id));
        toast.success("Deleted");
      } catch {
        toast.error("Network error");
      }
    })();
  };

  const tierColumnMeta: Record<
    ModelTier,
    { title: string; emoji: string; border: string; header: string }
  > = {
    high: {
      title: "High",
      emoji: "",
      border: "border-amber-500/25 bg-amber-500/[0.06]",
      header: "text-amber-200",
    },
    medium: {
      title: "Medium",
      emoji: "◼",
      border: "border-sky-500/25 bg-sky-500/[0.06]",
      header: "text-sky-200",
    },
    low: {
      title: "Low",
      emoji: "",
      border: "border-white/15 bg-white/[0.04]",
      header: "text-white/80",
    },
  };

  const tabBtn = (id: TabId, label: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setTab(id)}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        tab === id
          ? "border-pink-500/40 bg-pink-500/20 text-white shadow-[0_0_20px_-8px_rgba(236,72,153,0.5)]"
          : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/85"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Informations</h1>
          <p className="mt-1 text-sm text-white/55">
            Manage mass message lists, model tiers, and pricing tables for chatters.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabBtn("lists", "Mass Lists")}
            {tabBtn("tiers", "Model Tiers")}
            {tabBtn("pricing", "Pricing")}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          {tab === "lists" ? (
            <ButtonPrimary type="button" onClick={openCreate}>
              New List
            </ButtonPrimary>
          ) : null}
          {tab === "tiers" ? (
            <>
              <ButtonPrimary type="button" onClick={() => openTierModalCreate()}>
                Add Model
              </ButtonPrimary>
            </>
          ) : null}
          {tab === "pricing" ? (
            <>
              <ButtonPrimary type="button" onClick={openRowCreate}>
                Add Row
              </ButtonPrimary>
              <ButtonSecondary type="button" onClick={openSpecialCreate}>
                Add Special
              </ButtonSecondary>
            </>
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
          />
          <AdminSection
            title="Exclude"
            accent="exclude"
            lists={exclude}
            onEdit={openEdit}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        </div>
      ) : null}

      {tab === "tiers" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {MODEL_TIER_ORDER.map((mt) => {
            const meta = tierColumnMeta[mt];
            const col = tiers.filter((t) => t.tier === mt);
            return (
              <section
                key={mt}
                className={`rounded-3xl border p-4 backdrop-blur-xl ${meta.border}`}
                style={{
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px -16px rgba(0,0,0,0.45)",
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className={`text-base font-bold tracking-tight ${meta.header}`}>
                    {meta.emoji} {meta.title}
                  </h2>
                  <ButtonSecondary type="button" className="!px-3 !py-1.5 text-xs" onClick={() => openTierModalCreate(mt)}>
                    Add Model
                  </ButtonSecondary>
                </div>
                <div className="flex flex-wrap gap-2">
                  {col.length === 0 ? (
                    <p className="w-full py-6 text-center text-xs text-white/40">No models</p>
                  ) : (
                    col.map((t) => (
                      <span
                        key={t.id}
                        className={`group relative inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                          t.is_active
                            ? "border-white/15 bg-white/10 text-white/90"
                            : "border-white/10 bg-white/5 text-white/45"
                        }`}
                      >
                        {t.model_name}
                        <span className="ml-1 inline-flex gap-0.5 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
                            aria-label={`Edit ${t.model_name}`}
                            onClick={() => openTierModalEdit(t)}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-0.5 text-rose-300/70 hover:bg-rose-500/15"
                            aria-label={`Delete ${t.model_name}`}
                            onClick={() => handleTierDelete(t)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {tab === "pricing" ? (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <span className="mr-1 self-center text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Model tier
            </span>
            {(["all", "high", "medium", "low"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilterMt(v)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  filterMt === v
                    ? "border-pink-500/40 bg-pink-500/15 text-white"
                    : "border-white/10 bg-white/5 text-white/55 hover:text-white/80"
                }`}
              >
                {v === "all" ? "All" : v === "high" ? "High" : v === "medium" ? "◼ Medium" : "Low"}
              </button>
            ))}
            <span className="mx-2 hidden h-4 w-px self-center bg-white/15 sm:inline" />
            <span className="w-full text-[11px] font-semibold uppercase tracking-wider text-white/40 sm:ml-1 sm:w-auto sm:self-center">
              Spender tier
            </span>
            {(["all", "high", "medium", "low", "medium_low"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilterSt(v)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  filterSt === v
                    ? "border-violet-500/40 bg-violet-500/15 text-white"
                    : "border-white/10 bg-white/5 text-white/55 hover:text-white/80"
                }`}
              >
                {v === "all" ? "All" : spenderLabel(v)}
              </button>
            ))}
          </div>

          <div className="space-y-8">
            {MODEL_TIER_ORDER.map((mt) => {
              const mtRows = filteredRows.filter((r) => r.model_tier === mt);
              if (mtRows.length === 0) return null;
              return (
                <div key={mt}>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/70">
                    {mt === "high" ? "High" : mt === "medium" ? "◼ Medium" : "Low"} tier models
                  </h3>
                  <div className="space-y-6">
                    {SPENDER_ORDER.map((st) => {
                      const rows = mtRows.filter((r) => r.spender_tier === st);
                      if (rows.length === 0) return null;
                      return (
                        <div key={`${mt}-${st}`}>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">
                            Spender: {spenderLabel(st)}
                          </h4>
                          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                            <table className="min-w-full text-left text-sm text-white/85">
                              <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/45">
                                <tr>
                                  <th className="px-3 py-2">#</th>
                                  <th className="px-3 py-2">Normal</th>
                                  <th className="px-3 py-2">Neg.</th>
                                  <th className="px-3 py-2">Description</th>
                                  <th className="px-3 py-2">Notes</th>
                                  <th className="px-3 py-2">Sort</th>
                                  <th className="px-3 py-2 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r) => (
                                  <tr
                                    key={r.id}
                                    className={`border-b border-white/[0.06] ${r.is_active ? "" : "opacity-50"}`}
                                  >
                                    <td className="px-3 py-2 tabular-nums text-white/60">{r.video_number}</td>
                                    <td className="max-w-[120px] truncate px-3 py-2">{r.price_normal}</td>
                                    <td className="max-w-[100px] truncate px-3 py-2">{r.price_negotiation}</td>
                                    <td className="max-w-[220px] truncate px-3 py-2 text-white/70">{r.description}</td>
                                    <td className="max-w-[140px] truncate px-3 py-2 text-white/50">{r.notes || "—"}</td>
                                    <td className="px-3 py-2 tabular-nums text-white/45">{r.sort_order}</td>
                                    <td className="px-3 py-2 text-right">
                                      <button
                                        type="button"
                                        className="mr-1 inline-flex rounded-lg border border-white/10 p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                                        aria-label="Edit row"
                                        onClick={() => openRowEdit(r)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-flex rounded-lg border border-rose-500/20 p-1.5 text-rose-300/80 hover:bg-rose-500/15"
                                        aria-label="Delete row"
                                        onClick={() => handleRowDelete(r)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <section>
            <h3 className="mb-3 text-lg font-bold text-white">Special Prices</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {pricingSpecials.length === 0 ? (
                <p className="text-sm text-white/40">No specials.</p>
              ) : (
                pricingSpecials.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-4 ${s.is_active ? "" : "opacity-50"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{s.label}</p>
                        <p className="mt-1 text-xs text-white/55">
                          {s.price_normal} · <span className="text-white/40">neg</span> {s.price_negotiation || "—"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded-lg border border-white/10 p-1.5 text-white/55 hover:bg-white/10"
                          onClick={() => openSpecialEdit(s)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-500/20 p-1.5 text-rose-300/80 hover:bg-rose-500/15"
                          onClick={() => handleSpecialDelete(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-white/60">{s.description}</p>
                    <span className="mt-2 inline-block rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                      {s.models_applicable}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}

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
                  placeholder=""
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

      {tierModalOpen ? (
        <GlassModal
          onClose={closeTierModal}
          title={tierEditing ? "Edit Model Tier" : "Add Model Tier"}
          subtitle="Assign a model to a tier and ordering."
          className="md:max-w-md"
        >
          <form onSubmit={handleTierSave} className="space-y-4 px-4 pb-5 pt-2 md:px-5">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Model name
              </label>
              <FormInput
                value={tierForm.model_name}
                onChange={(e) => setTierForm((f) => ({ ...f, model_name: e.target.value }))}
                placeholder="Diana"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Tier
              </label>
              <select
                value={tierForm.tier}
                disabled={tierTierLocked && !tierEditing}
                onChange={(e) =>
                  setTierForm((f) => ({
                    ...f,
                    tier: e.target.value === "medium" ? "medium" : e.target.value === "low" ? "low" : "high",
                  }))
                }
                className="w-full min-h-[48px] cursor-pointer rounded-xl border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-white [color-scheme:dark] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <Checkbox
              checked={tierForm.is_active}
              onChange={(e) => setTierForm((f) => ({ ...f, is_active: e.target.checked }))}
              label="Active"
            />
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Sort order
              </label>
              <FormInput
                type="number"
                inputMode="numeric"
                value={tierForm.sort_order}
                onChange={(e) => setTierForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <ButtonSecondary type="button" className="flex-1" disabled={tierSaving} onClick={closeTierModal}>
                Cancel
              </ButtonSecondary>
              <SubmitButton className="flex-1 !w-auto min-w-0" disabled={tierSaving}>
                {tierSaving ? (
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

      {rowModalOpen ? (
        <GlassModal
          onClose={closeRowModal}
          title={rowEditing ? "Edit Pricing Row" : "Add Pricing Row"}
          subtitle="Video ladder pricing for a model and spender tier."
          className="md:max-w-lg"
        >
          <form onSubmit={handleRowSave} className="max-h-[70vh] space-y-3 overflow-y-auto px-4 pb-5 pt-2 md:px-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Model tier
                </label>
                <select
                  value={rowForm.model_tier}
                  onChange={(e) =>
                    setRowForm((f) => ({
                      ...f,
                      model_tier: e.target.value === "medium" ? "medium" : e.target.value === "low" ? "low" : "high",
                    }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-white [color-scheme:dark]"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Spender tier
                </label>
                <select
                  value={rowForm.spender_tier}
                  onChange={(e) =>
                    setRowForm((f) => ({
                      ...f,
                      spender_tier:
                        e.target.value === "medium_low"
                          ? "medium_low"
                          : e.target.value === "medium"
                            ? "medium"
                            : e.target.value === "low"
                              ? "low"
                              : "high",
                    }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-white [color-scheme:dark]"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="medium_low">Medium-Low</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Video #
                </label>
                <FormInput
                  type="number"
                  inputMode="numeric"
                  value={rowForm.video_number}
                  onChange={(e) => setRowForm((f) => ({ ...f, video_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Sort order
                </label>
                <FormInput
                  type="number"
                  inputMode="numeric"
                  value={rowForm.sort_order}
                  onChange={(e) => setRowForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Normal price
              </label>
              <FormInput
                value={rowForm.price_normal}
                onChange={(e) => setRowForm((f) => ({ ...f, price_normal: e.target.value }))}
                placeholder="25 – 40"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Negotiation
              </label>
              <FormInput
                value={rowForm.price_negotiation}
                onChange={(e) => setRowForm((f) => ({ ...f, price_negotiation: e.target.value }))}
                placeholder="TW or range"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Description
              </label>
              <FormTextarea
                rows={3}
                value={rowForm.description}
                onChange={(e) => setRowForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Notes
              </label>
              <FormTextarea
                rows={2}
                value={rowForm.notes}
                onChange={(e) => setRowForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <Checkbox
              checked={rowForm.is_active}
              onChange={(e) => setRowForm((f) => ({ ...f, is_active: e.target.checked }))}
              label="Active"
            />
            <div className="flex gap-3 pt-2">
              <ButtonSecondary type="button" className="flex-1" disabled={rowSaving} onClick={closeRowModal}>
                Cancel
              </ButtonSecondary>
              <SubmitButton className="flex-1 !w-auto min-w-0" disabled={rowSaving}>
                {rowSaving ? (
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

      {specialModalOpen ? (
        <GlassModal
          onClose={closeSpecialModal}
          title={specialEditing ? "Edit Special" : "Add Special"}
          subtitle="One-off pricing entries (sextape, customs, calls)."
          className="md:max-w-lg"
        >
          <form onSubmit={handleSpecialSave} className="space-y-3 px-4 pb-5 pt-2 md:px-5">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Label
              </label>
              <FormInput
                value={specialForm.label}
                onChange={(e) => setSpecialForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Normal
                </label>
                <FormInput
                  value={specialForm.price_normal}
                  onChange={(e) => setSpecialForm((f) => ({ ...f, price_normal: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Negotiation
                </label>
                <FormInput
                  value={specialForm.price_negotiation}
                  onChange={(e) => setSpecialForm((f) => ({ ...f, price_negotiation: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Description
              </label>
              <FormTextarea
                rows={4}
                value={specialForm.description}
                onChange={(e) => setSpecialForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Models applicable
              </label>
              <FormInput
                value={specialForm.models_applicable}
                onChange={(e) => setSpecialForm((f) => ({ ...f, models_applicable: e.target.value }))}
                placeholder="ALL"
              />
            </div>
            <Checkbox
              checked={specialForm.is_active}
              onChange={(e) => setSpecialForm((f) => ({ ...f, is_active: e.target.checked }))}
              label="Active"
            />
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                Sort order
              </label>
              <FormInput
                type="number"
                inputMode="numeric"
                value={specialForm.sort_order}
                onChange={(e) => setSpecialForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <ButtonSecondary type="button" className="flex-1" disabled={specialSaving} onClick={closeSpecialModal}>
                Cancel
              </ButtonSecondary>
              <SubmitButton className="flex-1 !w-auto min-w-0" disabled={specialSaving}>
                {specialSaving ? (
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
