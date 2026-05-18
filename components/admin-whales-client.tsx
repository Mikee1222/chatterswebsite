"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Check,
  Copy,
  DollarSign,
  Filter,
  Heart,
  Search,
  Skull,
  SlidersHorizontal,
  StickyNote,
  Trash2,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { MobileCard } from "@/components/mobile-card";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  assignWhaleToChatter,
  assignWhaleToModel,
  clearWhaleChatter,
  clearWhaleModel,
  updateWhaleFields,
} from "@/app/actions/whales";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { ButtonSecondary } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Whale } from "@/types";
import {
  RELATIONSHIP_STATUS_OPTIONS,
  WHALE_STATUS_OPTIONS,
  HOURS_ACTIVE_OPTIONS,
  whaleStatusBadgeVariant,
} from "@/lib/airtable-options";
import { WHALES_STATUS_FILTER_NOT_ASSIGNED } from "@/lib/whales-filters";

const ADMIN_WHALE_QUICK_STATUS_FILTERS: { value: string; label: string }[] = [
  ...WHALE_STATUS_OPTIONS.map((st) => ({ value: st, label: st })),
  { value: WHALES_STATUS_FILTER_NOT_ASSIGNED, label: "Not assigned yet" },
];

type Chatter = { id: string; full_name: string };
type ModelOption = { id: string; name: string };

export type AdminWhalesInitialFilters = {
  chatter?: string;
  model?: string;
  relationship?: string;
  status?: string;
  q?: string;
};

export type WhaleStatusCounts = {
  total: number;
  active: number;
  inactive: number;
  dead: number;
  deleted: number;
};

type Props = {
  whales: Whale[];
  nextOffset: string | null;
  pageSize: number;
  statusCounts: WhaleStatusCounts;
  chatters: Chatter[];
  modelOptions: ModelOption[];
  revenueByModel: [string, number][];
  revenueByChatter: [string, number][];
  initialFilters: AdminWhalesInitialFilters;
  /** VA read-only: no assigns, edits, or deletes. */
  readOnly?: boolean;
  /** `va` shows read-only title + badge; default admin header. */
  headerVariant?: "admin" | "va";
};

function notesSummary(notes: string | undefined, maxLen = 40): string {
  if (!notes?.trim()) return "—";
  const t = notes.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

function label(value: string): string {
  return value.replace(/_/g, " ");
}

const badgeVariants = {
  default: "bg-white/10 text-white/80 border-white/15",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  pink: "bg-[hsl(330,80%,55%)]/15 text-[hsl(330,90%,75%)] border-[hsl(330,80%,55%)]/25",
  slate: "bg-white/5 text-white/60 border-white/10",
  unassigned: "bg-amber-500/10 text-amber-200/90 border-amber-500/20",
} as const;

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: keyof typeof badgeVariants;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeVariants[variant]}`}
    >
      {children}
    </span>
  );
}

/** Inline popover anchored to trigger – stays in table cell, no portal. Use for table dropdowns. */
function InlinePopover({
  open,
  onClose,
  wrapperRef,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open, onClose, wrapperRef]);

  if (!open) return null;

  return (
    <div
      className={`absolute left-0 top-full z-[9999] mt-1 max-h-[min(400px,80vh)] min-w-full overflow-y-auto rounded-xl border border-white/10 bg-black/95 shadow-xl backdrop-blur-xl transition-opacity duration-150 ${className}`}
      style={{
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px -8px rgba(0,0,0,0.6)",
        position: "absolute",
        zIndex: 9999,
      }}
    >
      {children}
    </div>
  );
}

function ModelCell({
  whale,
  modelOptions,
  onSave,
  onClear,
  unassignedLabel = "unassigned",
}: {
  whale: Whale;
  modelOptions: ModelOption[];
  onSave: (id: string, modelId: string, modelName: string) => Promise<{ success: boolean; error?: string }>;
  onClear: (id: string) => Promise<{ success: boolean; error?: string }>;
  unassignedLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modelOptions;
    return modelOptions.filter((m) => m.name.toLowerCase().includes(q));
  }, [modelOptions, search]);

  const hasModel = !!(whale.assigned_model_id?.trim() || whale.assigned_model_name?.trim());
  const displayName = whale.assigned_model_name?.trim() || "—";

  async function handleSelect(m: ModelOption | null) {
    setSaving(true);
    const res = m ? await onSave(whale.id, m.id, m.name) : await onClear(whale.id);
    setSaving(false);
    if (res.success) setOpen(false);
  }

  const btnClass = hasModel
    ? "inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left text-sm text-white/90 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-60"
    : "inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-left text-sm text-amber-200/90 transition-colors hover:border-amber-500/35 hover:bg-amber-500/15 disabled:opacity-60";

  return (
    <div ref={wrapperRef} className="relative inline-block min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={saving}
        className={btnClass}
      >
        <span className="truncate">{hasModel ? displayName : unassignedLabel}</span>
        {saving ? <span className="text-[10px] text-white/40">Saving…</span> : <span className="text-white/40">▾</span>}
      </button>
      <InlinePopover open={open} onClose={() => setOpen(false)} wrapperRef={wrapperRef} className="w-64 p-2">
        <FormInput
          type="text"
          placeholder="Search models…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!min-h-10 py-2 text-sm"
        />
        <div className="max-h-[200px] overflow-y-auto overscroll-contain">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 border-b border-white/5"
          >
            — none —
          </button>
          {filtered.length === 0 ? (
            <p className="py-3 text-center text-sm text-white/50">No models match</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelect(m)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10"
              >
                {m.name || m.id}
              </button>
            ))
          )}
        </div>
      </InlinePopover>
    </div>
  );
}

function ChatterCell({
  whale,
  chatters,
  onSave,
  onClear,
  unassignedLabel = "+ assign chatter",
}: {
  whale: Whale;
  chatters: Chatter[];
  onSave: (id: string, chatterId: string, chatterName: string) => Promise<{ success: boolean; error?: string }>;
  onClear: (id: string) => Promise<{ success: boolean; error?: string }>;
  unassignedLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chatters;
    return chatters.filter((c) => (c.full_name || c.id).toLowerCase().includes(q));
  }, [chatters, search]);

  const hasChatter = !!(whale.assigned_chatter_id?.trim() || whale.assigned_chatter_name?.trim());
  const displayName = whale.assigned_chatter_name?.trim() || "—";

  async function handleSelect(c: Chatter | null) {
    setSaving(true);
    const res = c ? await onSave(whale.id, c.id, c.full_name) : await onClear(whale.id);
    setSaving(false);
    if (res.success) setOpen(false);
  }

  const btnClass = hasChatter
    ? "inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left text-sm text-white/90 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-60"
    : "inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-left text-sm text-amber-200/90 transition-colors hover:border-amber-500/35 hover:bg-amber-500/15 disabled:opacity-60";

  return (
    <div ref={wrapperRef} className="relative inline-block min-w-0 max-w-full">
      {hasChatter ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={saving}
          className={btnClass}
        >
          <span className="truncate">{displayName}</span>
          {saving ? <span className="text-[10px] text-white/40">Saving…</span> : <span className="text-white/40">▾</span>}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={saving}
          className={btnClass}
        >
          <span className="truncate">{unassignedLabel}</span>
          {saving ? <span className="text-[10px] text-white/40">Saving…</span> : <span className="text-white/40">▾</span>}
        </button>
      )}
      <InlinePopover open={open} onClose={() => setOpen(false)} wrapperRef={wrapperRef} className="min-w-[220px] p-2 z-[9999]">
        <FormInput
          type="text"
          placeholder="Search chatters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!min-h-10 py-2 text-sm"
        />
        <div className="max-h-[200px] overflow-y-auto overscroll-contain">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="block w-full rounded-lg px-4 py-2 text-left text-sm text-white/70 hover:bg-white/10 border-b border-white/5"
          >
            — none —
          </button>
          {filtered.length === 0 ? (
            <p className="px-4 py-2 text-sm text-white/50">No chatters match</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="block w-full px-4 py-2 text-left text-sm text-white/90 hover:bg-white/10"
              >
                {c.full_name || c.id}
              </button>
            ))
          )}
        </div>
      </InlinePopover>
    </div>
  );
}

type SelectBadgeCellProps = {
  value: string | null;
  options: readonly string[];
  whaleId: string;
  field: string;
  onSave: (id: string, payload: Record<string, string>) => Promise<{ success: boolean }>;
  badgeVariant?: keyof typeof badgeVariants;
  /** When true, show "—" for empty value and include a blank option to clear (e.g. relationship_status). */
  allowEmpty?: boolean;
};

function SelectBadgeCell({
  value,
  options,
  whaleId,
  field,
  onSave,
  badgeVariant,
  allowEmpty = false,
}: SelectBadgeCellProps) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const displayValue = allowEmpty && (value === "" || value == null) ? "—" : label(value ?? "");

  async function handleSelect(opt: string) {
    if (opt === value) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const res = await onSave(whaleId, { [field]: opt });
    setSaving(false);
    if (res.success) setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative inline-block min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 transition-colors hover:border-white/20 hover:bg-white/5 disabled:opacity-60"
      >
        <Badge variant={badgeVariant ?? "default"}>{displayValue}</Badge>
        {saving ? <span className="text-[10px] text-white/40">Saving…</span> : <span className="text-white/40">▾</span>}
      </button>
      <InlinePopover open={open} onClose={() => setOpen(false)} wrapperRef={wrapperRef} className="min-w-[140px] py-1">
        {(allowEmpty ? ["", ...options] : options).map((opt) => (
          <button
            key={opt || "__empty__"}
            type="button"
            onClick={() => handleSelect(opt)}
            className="block w-full px-4 py-2 text-left text-sm text-white/90 hover:bg-white/10"
          >
            {opt === "" ? "— none —" : label(opt)}
          </button>
        ))}
      </InlinePopover>
    </div>
  );
}

function HoursActiveCell({
  value,
  whaleId,
  onSave,
}: {
  value: string[];
  whaleId: string;
  onSave: (id: string, payload: Record<string, string[]>) => Promise<{ success: boolean }>;
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(value ?? []);
  const [saving, setSaving] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) setSelected(value ?? []);
  }, [open, value]);

  function toggle(option: string) {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((s) => s !== option) : [...prev, option]
    );
  }

  async function handleSave() {
    setSaving(true);
    const res = await onSave(whaleId, { hours_active: selected });
    setSaving(false);
    if (res.success) setOpen(false);
  }

  const displayList = (value ?? []).filter(Boolean);

  return (
    <div ref={wrapperRef} className="relative inline-block min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-left text-white/80 transition-colors hover:border-white/20 hover:bg-white/5 disabled:opacity-60"
      >
        {displayList.length === 0 ? (
          <span className="text-white/50">—</span>
        ) : (
          displayList.map((slot) => (
            <span
              key={slot}
              className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-medium text-white/90"
            >
              {slot}
            </span>
          ))
        )}
        {saving && <span className="ml-1 text-[10px] text-white/40">Saving…</span>}
        {!saving && <span className="text-white/40">▾</span>}
      </button>
      <InlinePopover open={open} onClose={() => setOpen(false)} wrapperRef={wrapperRef} className="min-w-[200px] p-3">
        <p className="mb-2 text-xs font-medium text-white/60">Hours active</p>
        <div className="space-y-1.5">
          {HOURS_ACTIVE_OPTIONS.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/90 hover:bg-white/10"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-[hsl(330,80%,55%)] focus:ring-[hsl(330,80%,55%)]/40"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-[hsl(330,80%,55%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(330,80%,50%)]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </InlinePopover>
    </div>
  );
}

function NotesCell({
  value,
  whaleId,
  onSave,
}: {
  value: string;
  whaleId: string;
  onSave: (id: string, payload: Record<string, string>) => Promise<{ success: boolean }>;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [saving, setSaving] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) setDraft(value ?? "");
  }, [open, value]);

  async function handleSave() {
    setSaving(true);
    const res = await onSave(whaleId, { notes: draft.trim() });
    setSaving(false);
    if (res.success) setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative block w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="block w-full truncate rounded-lg border border-white/10 px-2 py-1 text-left text-sm text-white/70 transition-colors hover:border-white/20 hover:bg-white/5 disabled:opacity-60"
        title={value || undefined}
      >
        {notesSummary(value, 40)}
        {saving && <span className="ml-1 text-[10px] text-white/40">Saving…</span>}
      </button>
      <InlinePopover open={open} onClose={() => setOpen(false)} wrapperRef={wrapperRef} className="w-72 p-3">
        <FormTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Notes…"
          className="mb-3 min-h-0 resize-y text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-[hsl(330,80%,55%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(330,80%,50%)]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </InlinePopover>
    </div>
  );
}

const DEBOUNCE_MS = 280;

type WhaleRowProps = {
  whale: Whale;
  rowIndex: number;
  chatters: Chatter[];
  modelOptions: ModelOption[];
  readOnly?: boolean;
  onAssignChatter: (id: string, chatterId: string, chatterName: string) => Promise<{ success: boolean; error?: string }>;
  onAssignModel: (id: string, modelId: string, modelName: string) => Promise<{ success: boolean; error?: string }>;
  onClearChatter: (id: string) => Promise<{ success: boolean; error?: string }>;
  onClearModel: (id: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateFields: (id: string, payload: Record<string, string | string[]>) => Promise<{ success: boolean; error?: string }>;
  onRequestDeleteWhale: (w: Whale) => void;
  deleting: boolean;
};

function exportWhalesToCsv(whales: Whale[]) {
  const headers = [
    "id",
    "whale_id",
    "created_by",
    "username",
    "platform",
    "status",
    "model",
    "chatter",
    "relationship",
    "total_spent",
    "notes",
  ] as const;
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = whales.map((w) =>
    [
      w.id,
      w.whale_id ?? "",
      w.created_by ?? "",
      w.username ?? "",
      w.platform ?? "",
      w.status ?? "",
      w.assigned_model_name ?? "",
      w.assigned_chatter_name ?? "",
      w.relationship_status ?? "",
      String(w.total_spent ?? ""),
      (w.notes ?? "").replace(/\r?\n/g, " "),
    ].map((c) => escape(String(c)))
  );
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `whales-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminWhaleHistorySheet({
  whale,
  onClose,
  readOnly,
}: {
  whale: Whale;
  onClose: () => void;
  readOnly?: boolean;
}) {
  React.useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    body.style.overflow = "hidden";
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      layout={false}
      className="fixed inset-0 z-[70] flex justify-end"
      initial={{ opacity: 0, pointerEvents: "none" }}
      animate={{ opacity: 1, pointerEvents: "auto" }}
      exit={{
        opacity: 0,
        pointerEvents: "none",
        transition: { opacity: { duration: 0.15 }, pointerEvents: { duration: 0 } },
      }}
      transition={{ duration: 0.15 }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <motion.aside
        layout={false}
        className="relative z-[1] flex h-full w-full max-w-md flex-col border-l border-white/10 bg-black/95 shadow-2xl"
        initial={{ x: 40 }}
        animate={{ x: 0 }}
        exit={{ x: 40 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">History</h2>
          <p className="mt-1 text-sm text-white/55">{whale.username || "—"}</p>
          <p className="mt-2 text-xs text-white/45">
            Full transaction log and activity feed live on the whale detail page.
          </p>
          <Link
            href={ROUTES.whaleDetail(whale.id)}
            className="mt-4 inline-flex rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/25"
          >
            Open whale detail →
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-white/60">
          {readOnly ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-xs text-white/40">Assigned chatter:</span>
              <span className="text-sm font-medium text-white">{whale.assigned_chatter_name?.trim() || "—"}</span>
            </div>
          ) : null}
          <p className="text-xs uppercase tracking-wider text-white/40">Whale ID</p>
          <p className="mt-1 font-mono text-xs text-white/80">{whale.whale_id || "—"}</p>
          {whale.created_by?.trim() ? (
            <div className="mt-3 flex items-center justify-between border-b border-white/5 py-2">
              <span className="text-xs uppercase tracking-widest text-white/30">Added by</span>
              <span className="text-sm text-white/60">{whale.created_by}</span>
            </div>
          ) : null}
          <p className="mt-4 text-xs uppercase tracking-wider text-white/40">Totals (from record)</p>
          <p className="mt-1 text-white/80">${whale.total_spent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="border-t border-white/10 p-4">
          <ButtonSecondary type="button" className="w-full" onClick={onClose}>
            Close
          </ButtonSecondary>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function AdminEditWhaleModal({
  whale,
  onClose,
  onUpdateFields,
}: {
  whale: Whale;
  onClose: () => void;
  onUpdateFields: WhaleRowProps["onUpdateFields"];
}) {
  const [username, setUsername] = React.useState(whale.username ?? "");
  const [notes, setNotes] = React.useState(whale.notes ?? "");
  const [relationship, setRelationship] = React.useState(whale.relationship_status ?? "");
  const [status, setStatus] = React.useState(whale.status);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setUsername(whale.username ?? "");
    setNotes(whale.notes ?? "");
    setRelationship(whale.relationship_status ?? "");
    setStatus(whale.status);
  }, [whale]);

  React.useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    body.style.overflow = "hidden";
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await onUpdateFields(whale.id, {
      username: username.trim(),
      notes: notes.trim(),
      relationship_status: relationship,
      status,
    });
    setPending(false);
    if (res.success) onClose();
  }

  return (
    <motion.div
      layout={false}
      className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6"
      initial={{ opacity: 0, pointerEvents: "none" }}
      animate={{ opacity: 1, pointerEvents: "auto" }}
      exit={{
        opacity: 0,
        pointerEvents: "none",
        transition: { opacity: { duration: 0.15 }, pointerEvents: { duration: 0 } },
      }}
      transition={{ duration: 0.15 }}
    >
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <motion.div
        layout={false}
        className="relative z-[1] max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-black/95 p-6 shadow-2xl md:rounded-2xl"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">Edit whale</h2>
        <p className="mt-1 text-sm text-white/50">{whale.username || whale.whale_id}</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <FormField label="Username" icon={<User />} htmlFor={`admin-whale-edit-user-${whale.id}`}>
            <FormInput
              id={`admin-whale-edit-user-${whale.id}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </FormField>
          <FormField label="Relationship" icon={<Heart />} htmlFor={`admin-whale-edit-rel-${whale.id}`}>
            <CustomSelect
              id={`admin-whale-edit-rel-${whale.id}`}
              value={relationship}
              onChange={(v) => setRelationship(v as typeof relationship)}
              placeholder="—"
              options={[
                { value: "", label: "—" },
                ...RELATIONSHIP_STATUS_OPTIONS.map((o) => ({ value: o, label: label(o) })),
              ]}
            />
          </FormField>
          <FormField label="Status" icon={<Activity />} htmlFor={`admin-whale-edit-status-${whale.id}`}>
            <CustomSelect
              id={`admin-whale-edit-status-${whale.id}`}
              value={status}
              onChange={(v) => setStatus(v as Whale["status"])}
              options={WHALE_STATUS_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </FormField>
          <FormField label="Notes" icon={<StickyNote />} htmlFor={`admin-whale-edit-notes-${whale.id}`}>
            <FormTextarea
              id={`admin-whale-edit-notes-${whale.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
            />
          </FormField>
          <div className="flex flex-wrap gap-2 pt-2">
            <FormSubmitButton type="submit" disabled={pending} loading={pending} className="min-w-[10rem]">
              {pending ? "Saving…" : "Save changes"}
            </FormSubmitButton>
            <ButtonSecondary type="button" onClick={onClose}>
              Cancel
            </ButtonSecondary>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function CopyUsernameButton({ username }: { username: string }) {
  const [copied, setCopied] = React.useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    void navigator.clipboard.writeText(username).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy username"
      className="shrink-0 rounded-md p-0.5 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

const WhaleAdminCard = React.memo(function WhaleAdminCard({
  whale,
  rowIndex,
  chatters,
  modelOptions,
  readOnly = false,
  onAssignChatter,
  onAssignModel,
  onClearChatter,
  onClearModel,
  onUpdateFields,
  onRequestDeleteWhale,
  deleting,
  onOpenEdit,
  onOpenHistory,
}: WhaleRowProps & {
  onOpenEdit: (w: Whale) => void;
  onOpenHistory: (w: Whale) => void;
}) {
  const [relSaving, setRelSaving] = React.useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = React.useState(false);
  const quickActionsRef = React.useRef<HTMLDivElement>(null);
  const avatarLetter = (whale.username?.trim()?.[0] ?? whale.whale_id?.trim()?.[0] ?? "?").toUpperCase();
  const statusChipClass =
    whale.status === "Active"
      ? "bg-green-500/20 text-green-400"
      : whale.status === "Inactive"
        ? "bg-amber-500/20 text-amber-300"
        : whale.status === "Dead"
          ? "bg-white/10 text-white/70"
          : "bg-red-500/20 text-red-300";

  const canQuickToggle = whale.status === "Active" || whale.status === "Inactive";
  const nextToggleStatus = whale.status === "Active" ? "Inactive" : "Active";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rowIndex, 12) * 0.03, ease: "easeOut" }}
      className="min-w-0"
    >
      <div
        className={`rounded-2xl border border-white/[0.12] bg-white/[0.05] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/[0.04] transition-all hover:border-pink-400/25 hover:bg-white/[0.08] hover:shadow-[0_0_40px_-20px_rgba(236,72,153,0.25)] ${
          deleting ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {deleting ? (
          <div className="mb-3 inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300">
            Deleting whale...
          </div>
        ) : null}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-lg font-bold text-white shadow-md shadow-pink-500/25 ring-2 ring-white/10">
                {avatarLetter}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h3 className="truncate text-base font-semibold text-white">{whale.username || "—"}</h3>
                  {whale.username?.trim() ? (
                    <CopyUsernameButton username={whale.username} />
                  ) : null}
                </div>
                <p className="truncate font-mono text-xs text-white/30">{whale.whale_id || "—"}</p>
                {whale.created_by?.trim() ? (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/20">
                    <span>Added by</span>
                    <span className="font-medium text-white/35">{whale.created_by}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${statusChipClass}`}>{whale.status}</span>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Model</p>
            <p className="mt-1 truncate text-sm font-medium text-white">{whale.assigned_model_name?.trim() || "—"}</p>
            {!readOnly ? (
              <div className="mt-2">
                <ModelCell
                  whale={whale}
                  modelOptions={modelOptions}
                  onSave={onAssignModel}
                  onClear={onClearModel}
                  unassignedLabel="Assign model"
                />
              </div>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Chatter</p>
            <p className="mt-1 truncate text-sm font-medium text-white">{whale.assigned_chatter_name?.trim() || "—"}</p>
            {!readOnly ? (
              <div className="mt-2">
                <ChatterCell
                  whale={whale}
                  chatters={chatters}
                  onSave={onAssignChatter}
                  onClear={onClearChatter}
                  unassignedLabel="Assign chatter"
                />
              </div>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Relationship</p>
            <div className="mt-1.5">
              {readOnly ? (
                <Badge variant="default">
                  {whale.relationship_status?.trim() ? label(whale.relationship_status) : "—"}
                </Badge>
              ) : (
                <CustomSelect
                  portaled={true}
                  value={whale.relationship_status || ""}
                  disabled={relSaving}
                  placeholder="—"
                  className="!min-h-0 !py-1.5 !px-2.5 !text-sm"
                  options={[
                    { value: "", label: "—" },
                    ...RELATIONSHIP_STATUS_OPTIONS.map((o) => ({ value: o, label: label(o) })),
                  ]}
                  onChange={(v) => {
                    void (async () => {
                      setRelSaving(true);
                      await onUpdateFields(whale.id, { relationship_status: v });
                      setRelSaving(false);
                    })();
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">Hours active</p>
          <div className="mt-1.5">
            {readOnly ? (
              <div className="flex flex-wrap gap-1.5">
                {(whale.hours_active ?? []).filter(Boolean).length === 0 ? (
                  <span className="text-sm text-white/50">—</span>
                ) : (
                  (whale.hours_active ?? [])
                    .filter(Boolean)
                    .map((slot) => (
                      <span
                        key={slot}
                        className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-medium text-white/90"
                      >
                        {slot}
                      </span>
                    ))
                )}
              </div>
            ) : (
              <HoursActiveCell value={whale.hours_active ?? []} whaleId={whale.id} onSave={onUpdateFields} />
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">Notes</p>
          <div className="mt-1.5">
            {readOnly ? (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-sm text-white/70">
                {whale.notes?.trim() ? whale.notes : "—"}
              </p>
            ) : (
              <NotesCell value={whale.notes ?? ""} whaleId={whale.id} onSave={onUpdateFields} />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {readOnly ? (
            <button
              type="button"
              onClick={() => onOpenHistory(whale)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10"
            >
              View history
            </button>
          ) : (
            <>
              <div ref={quickActionsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setQuickActionsOpen((v) => !v)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10"
                >
                  Quick actions ▾
                </button>
                <InlinePopover
                  open={quickActionsOpen}
                  onClose={() => setQuickActionsOpen(false)}
                  wrapperRef={quickActionsRef}
                  className="w-52 py-1 bottom-full mb-1 top-auto"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setQuickActionsOpen(false);
                      onOpenHistory(whale);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                  >
                    View history
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickActionsOpen(false);
                      onOpenEdit(whale);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                  >
                    Edit whale
                  </button>
                  {canQuickToggle ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickActionsOpen(false);
                        void onUpdateFields(whale.id, { status: nextToggleStatus });
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                    >
                      Mark {nextToggleStatus}
                    </button>
                  ) : null}
                  <div className="my-1 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={() => {
                      setQuickActionsOpen(false);
                      onRequestDeleteWhale(whale);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete whale
                  </button>
                </InlinePopover>
              </div>

              {!canQuickToggle ? (
                <SelectBadgeCell
                  value={whale.status}
                  options={WHALE_STATUS_OPTIONS}
                  whaleId={whale.id}
                  field="status"
                  onSave={onUpdateFields}
                  badgeVariant={whaleStatusBadgeVariant(whale.status) as keyof typeof badgeVariants}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});

function buildWhalesSearchParams(filters: AdminWhalesInitialFilters, offset?: string | null): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.chatter) p.set("chatter", filters.chatter);
  if (filters.model) p.set("model", filters.model);
  if (filters.relationship) p.set("relationship", filters.relationship);
  if (filters.status) p.set("status", filters.status);
  if (filters.q) p.set("q", filters.q);
  if (offset) p.set("offset", offset);
  return p;
}

export function AdminWhalesClient({
  whales: initialWhales,
  nextOffset,
  pageSize,
  statusCounts,
  chatters,
  modelOptions,
  revenueByModel,
  revenueByChatter,
  initialFilters,
  readOnly = false,
  headerVariant = "admin",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [localWhales, setLocalWhales] = React.useState<Whale[]>(initialWhales);
  const [filterChatter, setFilterChatter] = React.useState(initialFilters.chatter ?? "");
  const [filterModel, setFilterModel] = React.useState(initialFilters.model ?? "");
  const [filterRelationship, setFilterRelationship] = React.useState(initialFilters.relationship ?? "");
  const [filterStatus, setFilterStatus] = React.useState(initialFilters.status ?? "");
  const [filterSearch, setFilterSearch] = React.useState(initialFilters.q ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [editingWhale, setEditingWhale] = React.useState<Whale | null>(null);
  const [historyWhale, setHistoryWhale] = React.useState<Whale | null>(null);
  const [cardPage, setCardPage] = React.useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [deletingWhaleIds, setDeletingWhaleIds] = React.useState<Record<string, boolean>>({});
  const [toast, setToast] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [whalePendingDelete, setWhalePendingDelete] = React.useState<Whale | null>(null);
  const [confirmingWhaleDelete, setConfirmingWhaleDelete] = React.useState(false);

  const CLIENT_PAGE_SIZE = 24;

  const closeHistorySheet = React.useCallback(() => {
    setHistoryWhale(null);
  }, []);

  const closeEditWhaleModal = React.useCallback(() => {
    setEditingWhale(null);
  }, []);

  React.useEffect(() => {
    setLocalWhales(initialWhales);
    setCardPage(0);
  }, [initialWhales]);

  React.useEffect(() => {
    setFilterChatter(initialFilters.chatter ?? "");
    setFilterModel(initialFilters.model ?? "");
    setFilterRelationship(initialFilters.relationship ?? "");
    setFilterStatus(initialFilters.status ?? "");
    setFilterSearch(initialFilters.q ?? "");
  }, [initialFilters.chatter, initialFilters.model, initialFilters.relationship, initialFilters.status, initialFilters.q]);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = React.useRef({ filterChatter, filterModel, filterRelationship, filterStatus, filterSearch });
  filtersRef.current = { filterChatter, filterModel, filterRelationship, filterStatus, filterSearch };

  const pushFiltersToUrl = React.useCallback(
    (filters: { chatter: string; model: string; relationship: string; status: string; q: string }, offset?: string | null) => {
      const p = buildWhalesSearchParams(
        {
          chatter: filters.chatter || undefined,
          model: filters.model || undefined,
          relationship: filters.relationship || undefined,
          status: filters.status || undefined,
          q: filters.q || undefined,
        },
        offset ?? undefined
      );
      const qs = p.toString();
      const path = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      router.replace(path, { scroll: false });
    },
    [router]
  );

  const scheduleUrlUpdate = React.useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const f = filtersRef.current;
      pushFiltersToUrl(
        { chatter: f.filterChatter, model: f.filterModel, relationship: f.filterRelationship, status: f.filterStatus, q: f.filterSearch },
        null
      );
    }, DEBOUNCE_MS);
  }, [pushFiltersToUrl]);

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const onFilterChange = React.useCallback(
    (updates: Partial<{ chatter: string; model: string; relationship: string; status: string; q: string }>) => {
      if ("chatter" in updates) setFilterChatter(updates.chatter ?? "");
      if ("model" in updates) setFilterModel(updates.model ?? "");
      if ("relationship" in updates) setFilterRelationship(updates.relationship ?? "");
      if ("status" in updates) setFilterStatus(updates.status ?? "");
      if ("q" in updates) setFilterSearch(updates.q ?? "");
      scheduleUrlUpdate();
    },
    [scheduleUrlUpdate]
  );

  const currentOffset = searchParams.get("offset");
  const hasNext = !!nextOffset;
  const hasPrev = !!currentOffset;
  const clientPageCount = Math.max(1, Math.ceil(localWhales.length / CLIENT_PAGE_SIZE));
  const visibleWhales = localWhales.slice(cardPage * CLIENT_PAGE_SIZE, (cardPage + 1) * CLIENT_PAGE_SIZE);
  const cardRangeStart = localWhales.length === 0 ? 0 : cardPage * CLIENT_PAGE_SIZE + 1;
  const cardRangeEnd = Math.min((cardPage + 1) * CLIENT_PAGE_SIZE, localWhales.length);

  const goToFirst = React.useCallback(() => {
    pushFiltersToUrl(
      { chatter: filterChatter, model: filterModel, relationship: filterRelationship, status: filterStatus, q: filterSearch },
      null
    );
  }, [pushFiltersToUrl, filterChatter, filterModel, filterRelationship, filterStatus, filterSearch]);

  const goToNext = React.useCallback(() => {
    if (!nextOffset) return;
    pushFiltersToUrl(
      { chatter: filterChatter, model: filterModel, relationship: filterRelationship, status: filterStatus, q: filterSearch },
      nextOffset
    );
  }, [nextOffset, pushFiltersToUrl, filterChatter, filterModel, filterRelationship, filterStatus, filterSearch]);

  const maxModelRev = Math.max(1, ...revenueByModel.map(([, v]) => v));
  const maxChatterRev = Math.max(1, ...revenueByChatter.map(([, v]) => v));
  const totalTxnRevenue = React.useMemo(
    () => revenueByModel.reduce((sum, [, v]) => sum + (Number.isFinite(v) ? v : 0), 0),
    [revenueByModel]
  );

  const updateWhaleInList = React.useCallback((whaleId: string, patch: Partial<Whale>) => {
    setLocalWhales((prev) =>
      prev.map((w) => (w.id === whaleId ? { ...w, ...patch } : w))
    );
  }, []);

  const handleAssignChatter = React.useCallback(
    async (whaleId: string, chatterId: string, chatterName: string) => {
      if (readOnly) return { success: false as const, error: "Read-only" };
      setError(null);
      const prev = localWhales.find((w) => w.id === whaleId);
      if (prev) updateWhaleInList(whaleId, { assigned_chatter_id: chatterId, assigned_chatter_name: chatterName });
      const res = await assignWhaleToChatter(whaleId, chatterId, chatterName);
      if (res.success) {
        router.refresh();
      } else {
        if (prev) updateWhaleInList(whaleId, { assigned_chatter_id: prev.assigned_chatter_id, assigned_chatter_name: prev.assigned_chatter_name });
        setError(res.error ?? "Failed to update");
      }
      return res;
    },
    [router, localWhales, updateWhaleInList, readOnly]
  );

  const handleAssignModel = React.useCallback(
    async (whaleId: string, modelId: string, modelName: string) => {
      if (readOnly) return { success: false as const, error: "Read-only" };
      setError(null);
      const prev = localWhales.find((w) => w.id === whaleId);
      if (prev) updateWhaleInList(whaleId, { assigned_model_id: modelId, assigned_model_name: modelName });
      const res = await assignWhaleToModel(whaleId, modelId, modelName);
      if (res.success) {
        router.refresh();
      } else {
        if (prev) updateWhaleInList(whaleId, { assigned_model_id: prev.assigned_model_id, assigned_model_name: prev.assigned_model_name });
        setError(res.error ?? "Failed to update");
      }
      return res;
    },
    [router, localWhales, updateWhaleInList, readOnly]
  );

  const handleClearModel = React.useCallback(
    async (whaleId: string) => {
      if (readOnly) return { success: false as const, error: "Read-only" };
      setError(null);
      const prev = localWhales.find((w) => w.id === whaleId);
      if (prev) updateWhaleInList(whaleId, { assigned_model_id: "", assigned_model_name: "" });
      const res = await clearWhaleModel(whaleId);
      if (res.success) {
        router.refresh();
      } else {
        if (prev) updateWhaleInList(whaleId, { assigned_model_id: prev.assigned_model_id, assigned_model_name: prev.assigned_model_name });
        setError(res.error ?? "Failed to clear");
      }
      return res;
    },
    [router, localWhales, updateWhaleInList, readOnly]
  );

  const handleClearChatter = React.useCallback(
    async (whaleId: string) => {
      if (readOnly) return { success: false as const, error: "Read-only" };
      setError(null);
      const prev = localWhales.find((w) => w.id === whaleId);
      if (prev) updateWhaleInList(whaleId, { assigned_chatter_id: "", assigned_chatter_name: "" });
      const res = await clearWhaleChatter(whaleId);
      if (res.success) {
        router.refresh();
      } else {
        if (prev) updateWhaleInList(whaleId, { assigned_chatter_id: prev.assigned_chatter_id, assigned_chatter_name: prev.assigned_chatter_name });
        setError(res.error ?? "Failed to clear");
      }
      return res;
    },
    [router, localWhales, updateWhaleInList, readOnly]
  );

  const activeFilterCount = React.useMemo(() => {
    let n = 0;
    if (filterChatter.trim()) n++;
    if (filterModel.trim()) n++;
    if (filterRelationship.trim()) n++;
    if (filterStatus.trim()) n++;
    if (filterSearch.trim()) n++;
    return n;
  }, [filterChatter, filterModel, filterRelationship, filterStatus, filterSearch]);

  const chatterFilterOptions = React.useMemo(
    () => [
      { value: "", label: "Chatter" },
      ...chatters.map((c) => ({ value: c.id, label: c.full_name || c.id })),
    ],
    [chatters]
  );
  const modelFilterOptionsSelect = React.useMemo(
    () => [
      { value: "", label: "Model" },
      ...modelOptions.map((m) => ({ value: m.id, label: m.name || m.id })),
    ],
    [modelOptions]
  );
  const relationshipFilterOptions = React.useMemo(
    () => [
      { value: "", label: "Relationship" },
      ...RELATIONSHIP_STATUS_OPTIONS.map((o) => ({ value: o, label: o })),
    ],
    []
  );
  const statusFilterOptions = React.useMemo(
    () => [
      { value: "", label: "Status" },
      ...WHALE_STATUS_OPTIONS.map((o) => ({ value: o, label: o })),
      { value: WHALES_STATUS_FILTER_NOT_ASSIGNED, label: "Not assigned yet" },
    ],
    []
  );

  const clearAllFilters = React.useCallback(() => {
    setFilterChatter("");
    setFilterModel("");
    setFilterRelationship("");
    setFilterStatus("");
    setFilterSearch("");
    setMobileFiltersOpen(false);
    pushFiltersToUrl({ chatter: "", model: "", relationship: "", status: "", q: "" }, null);
  }, [pushFiltersToUrl]);

  const selectTriggerClass =
    "border-white/12 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-pink-400/25 hover:bg-white/[0.06]";

  const adminFilterFields = (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:gap-3">
      <div className="min-w-0 flex-1 md:min-w-[220px]">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-pink-200/70">
          <Search className="h-3 w-3 opacity-80" aria-hidden />
          Search
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pink-300/40" aria-hidden />
          <input
            type="search"
            placeholder="Username or whale ID…"
            value={filterSearch}
            onChange={(e) => onFilterChange({ q: e.target.value })}
            className={cn(
              "h-11 w-full rounded-xl border py-0 pl-10 pr-4 text-sm text-white outline-none transition-all",
              "border-white/12 bg-black/35 placeholder:text-white/35",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
              "focus:border-pink-400/45 focus:bg-black/50 focus:ring-2 focus:ring-pink-500/20"
            )}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1 md:min-w-[160px]">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Chatter</p>
        <CustomSelect
          portaled={true}
          value={filterChatter}
          onChange={(v) => onFilterChange({ chatter: v })}
          options={chatterFilterOptions}
          triggerClassName={selectTriggerClass}
        />
      </div>
      <div className="min-w-0 flex-1 md:min-w-[160px]">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Model</p>
        <CustomSelect
          portaled={true}
          value={filterModel}
          onChange={(v) => onFilterChange({ model: v })}
          options={modelFilterOptionsSelect}
          triggerClassName={selectTriggerClass}
        />
      </div>
      <div className="min-w-0 flex-1 md:min-w-[150px]">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Relationship</p>
        <CustomSelect
          portaled={true}
          value={filterRelationship}
          onChange={(v) => onFilterChange({ relationship: v })}
          options={relationshipFilterOptions}
          triggerClassName={selectTriggerClass}
        />
      </div>
      <div className="min-w-0 flex-1 md:min-w-[150px]">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Status</p>
        <CustomSelect
          portaled={true}
          value={filterStatus}
          onChange={(v) => onFilterChange({ status: v })}
          options={statusFilterOptions}
          triggerClassName={selectTriggerClass}
        />
      </div>
    </div>
  );

  const handleUpdateFields = React.useCallback(
    async (whaleId: string, payload: Record<string, string | string[]>) => {
      if (readOnly) return { success: false as const, error: "Read-only" };
      setError(null);
      const prev = localWhales.find((w) => w.id === whaleId);
      if (prev) {
        const patch: Partial<Whale> = {};
        if ("relationship_status" in payload) patch.relationship_status = payload.relationship_status as Whale["relationship_status"];
        if ("status" in payload) patch.status = payload.status as Whale["status"];
        if ("hours_active" in payload) patch.hours_active = Array.isArray(payload.hours_active) ? payload.hours_active : [];
        if ("notes" in payload) patch.notes = String(payload.notes);
        if ("username" in payload) patch.username = String(payload.username);
        if (Object.keys(patch).length) updateWhaleInList(whaleId, patch);
      }
      const res = await updateWhaleFields(whaleId, payload as Parameters<typeof updateWhaleFields>[1]);
      if (res.success) {
        router.refresh();
      } else {
        if (prev) setLocalWhales((list) => list.map((w) => (w.id === whaleId ? prev : w)));
        setError(res.error ?? "Failed to update");
      }
      return res;
    },
    [router, localWhales, updateWhaleInList, readOnly]
  );

  const handleRequestDeleteWhale = React.useCallback((w: Whale) => {
    if (readOnly) return;
    setError(null);
    setWhalePendingDelete(w);
  }, [readOnly]);

  const handleConfirmDeleteWhale = React.useCallback(async () => {
    if (readOnly || !whalePendingDelete) return;
    const whaleId = whalePendingDelete.id;
    const label = whalePendingDelete.username || "Whale";
    setError(null);
    setConfirmingWhaleDelete(true);
    setDeletingWhaleIds((prev) => ({ ...prev, [whaleId]: true }));
    try {
      const res = await fetch(`/api/whales/${encodeURIComponent(whaleId)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const msg = data.error ?? "Failed to delete whale";
        setError(msg);
        setToast({ type: "error", message: msg });
        return;
      }
      setLocalWhales((prev) => prev.filter((w) => w.id !== whaleId));
      setToast({ type: "success", message: `${label} deleted.` });
      setWhalePendingDelete(null);
      router.refresh();
    } catch {
      const msg = "Failed to delete whale";
      setError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setConfirmingWhaleDelete(false);
      setDeletingWhaleIds((prev) => {
        const next = { ...prev };
        delete next[whaleId];
        return next;
      });
    }
  }, [whalePendingDelete, router, readOnly]);

  return (
    <div className="space-y-6 md:space-y-8">
      {headerVariant === "va" ? (
        <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold text-white">Whales</h1>
              <p className="mt-1 text-sm text-white/40">All agency whales — read-only view</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-white/40">
              View only
            </span>
          </div>
          {readOnly ? (
            <button
              type="button"
              onClick={() => exportWhalesToCsv(localWhales)}
              className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              Export CSV
            </button>
          ) : null}
        </div>
      ) : (
        <div>
          <h1 className="bg-gradient-to-r from-white via-white to-white/75 bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-3xl">
            Whales
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-white/55">
            All whales. Edit inline. Revenue from whale_transactions.
          </p>
        </div>
      )}

      {/* Summary stats (global totals across all whales, not filtered table) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MobileCard padding="md">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/80 ring-1 ring-white/[0.06]">
              <Users className="h-5 w-5 text-zinc-300" aria-hidden />
            </div>
            <p className="text-2xl font-bold tabular-nums text-white">{statusCounts.total}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Total</p>
          </div>
        </MobileCard>
        <MobileCard padding="md" className="border-emerald-500/15">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/20">
              <TrendingUp className="h-5 w-5 text-emerald-400" aria-hidden />
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-300">{statusCounts.active}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/80">Active</p>
          </div>
        </MobileCard>
        <MobileCard padding="md" className="border-amber-500/15">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/20">
              <User className="h-5 w-5 text-amber-300" aria-hidden />
            </div>
            <p className="text-2xl font-bold tabular-nums text-amber-200">{statusCounts.inactive}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/80">Inactive</p>
          </div>
        </MobileCard>
        <MobileCard padding="md">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08]">
              <Skull className="h-5 w-5 text-zinc-400" aria-hidden />
            </div>
            <p className="text-2xl font-bold tabular-nums text-white/90">{statusCounts.dead}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Dead</p>
          </div>
        </MobileCard>
        <MobileCard padding="md" className="border-red-500/20">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-400/25">
              <Trash2 className="h-5 w-5 text-red-400" aria-hidden />
            </div>
            <p className="text-2xl font-bold tabular-nums text-red-200/90">{statusCounts.deleted}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-400/80">Deleted</p>
          </div>
        </MobileCard>
        <MobileCard padding="md" className="border-pink-500/20">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/15 ring-1 ring-pink-400/25">
              <DollarSign className="h-5 w-5 text-pink-400" aria-hidden />
            </div>
            <p className="text-2xl font-bold tabular-nums text-pink-100">
              ${totalTxnRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-pink-400/80">Txn revenue</p>
          </div>
        </MobileCard>
      </div>

      {/* Revenue bars */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Revenue by model</h3>
          <div className="mt-4 space-y-2">
            {revenueByModel.slice(0, 10).map(([name, value]) => (
              <div key={name} className="flex items-center gap-3">
                <span className="w-28 truncate text-sm text-white/80">{name || "—"}</span>
                <div className="min-w-0 flex-1 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-[hsl(330,80%,55%)]/80"
                    style={{ width: `${Math.min(100, (value / maxModelRev) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-white/90">${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            {revenueByModel.length === 0 && <p className="py-4 text-sm text-white/50">No transaction data</p>}
          </div>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Revenue by chatter</h3>
          <div className="mt-4 space-y-2">
            {revenueByChatter.slice(0, 10).map(([name, value]) => (
              <div key={name} className="flex items-center gap-3">
                <span className="w-28 truncate text-sm text-white/80">{name || "—"}</span>
                <div className="min-w-0 flex-1 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-emerald-500/70"
                    style={{ width: `${Math.min(100, (value / maxChatterRev) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-white/90">${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            {revenueByChatter.length === 0 && <p className="py-4 text-sm text-white/50">No transaction data</p>}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}
      {toast ? (
        <div
          className={`fixed bottom-20 right-4 z-[120] rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur ${
            toast.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
              : "border-red-500/30 bg-red-500/15 text-red-200"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {!readOnly ? (
        <ConfirmDeleteModal
          open={whalePendingDelete != null}
          title="Delete whale?"
          description={
            <>
              Are you sure you want to delete{" "}
              <span className="font-medium text-white">
                {whalePendingDelete?.username || whalePendingDelete?.whale_id || "this whale"}
              </span>
              ? This action cannot be undone.
            </>
          }
          onClose={() => {
            if (!confirmingWhaleDelete) setWhalePendingDelete(null);
          }}
          onConfirm={handleConfirmDeleteWhale}
          confirming={confirmingWhaleDelete}
        />
      ) : null}

      {/* Filters + search (debounced) */}
      <div
        className={cn(
          "relative mb-6 overflow-hidden rounded-2xl border border-white/[0.12] p-4 md:p-5",
          "bg-gradient-to-br from-pink-500/[0.09] via-violet-950/25 to-black/80",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-24px_rgba(236,72,153,0.18)]"
        )}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl"
          aria-hidden
        />
        <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="hidden items-center gap-2 text-sm font-semibold text-white md:inline-flex">
              <SlidersHorizontal className="h-4 w-4 text-pink-300/90" aria-hidden />
              Filters
            </h2>
            {activeFilterCount > 0 ? (
              <span className="hidden h-6 min-w-[1.5rem] items-center justify-center rounded-full border border-pink-400/30 bg-pink-500/20 px-2 text-xs font-semibold text-pink-100 md:inline-flex">
                {activeFilterCount}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/35 px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:border-pink-400/35 hover:bg-pink-500/10 md:hidden"
            >
              <Filter className="h-4 w-4 text-pink-300/90" aria-hidden />
              Filters
              {activeFilterCount > 0 ? (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-pink-400/35 bg-pink-500/25 px-1.5 text-[10px] font-bold text-pink-50">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {readOnly ? (
              <button
                type="button"
                onClick={() => exportWhalesToCsv(localWhales)}
                className="hidden rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10 md:inline-flex"
              >
                Export CSV
              </button>
            ) : null}
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-lg border border-pink-400/25 bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-200 transition-colors hover:border-pink-300/40 hover:bg-pink-500/20"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative hidden md:block">{adminFilterFields}</div>
        <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.08] pt-4 md:mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Quick status</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onFilterChange({ status: "" })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                !filterStatus
                  ? "border-pink-500/45 bg-pink-500/20 text-pink-100"
                  : "border-white/12 bg-black/30 text-white/65 hover:border-white/25 hover:text-white/90"
              )}
            >
              All statuses
            </button>
            {ADMIN_WHALE_QUICK_STATUS_FILTERS.map(({ value: stValue, label: stLabel }) => (
              <button
                key={stValue}
                type="button"
                onClick={() => onFilterChange({ status: stValue })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  filterStatus === stValue
                    ? "border-pink-500/45 bg-pink-500/20 text-pink-100"
                    : stValue === "Active"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90 hover:border-emerald-400/40"
                      : stValue === "Inactive" || stValue === WHALES_STATUS_FILTER_NOT_ASSIGNED
                        ? "border-amber-500/25 bg-amber-500/10 text-amber-200/90 hover:border-amber-400/40"
                        : "border-white/12 bg-black/30 text-white/65 hover:border-white/25 hover:text-white/90"
                )}
              >
                {stLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileFiltersOpen ? (
          <motion.div
            key="admin-whale-filter-sheet"
            className="fixed inset-0 z-[80] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close filters"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileFiltersOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-whale-filters-sheet-title"
              className="absolute bottom-0 left-0 right-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-pink-500/20 bg-gradient-to-b from-zinc-950 to-black p-6 pb-8 shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="mx-auto mb-5 flex w-12 shrink-0 rounded-full bg-white/20 py-1" aria-hidden>
                <span className="mx-auto h-1 w-10 rounded-full bg-white/40" />
              </div>
              <p id="admin-whale-filters-sheet-title" className="mb-4 text-sm font-semibold text-white">
                Filters
              </p>
              {adminFilterFields}
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="mt-6 w-full rounded-xl border border-pink-400/35 bg-gradient-to-r from-pink-500/25 to-fuchsia-600/20 py-3.5 text-sm font-semibold text-pink-50 shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.35)] transition hover:brightness-110"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="glass-card overflow-hidden p-4 md:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {localWhales.length === 0 ? (
            <p className="col-span-full py-12 text-center text-sm text-white/50">No whales on this page</p>
          ) : (
            visibleWhales.map((w, index) => (
              <WhaleAdminCard
                key={w.id}
                whale={w}
                rowIndex={cardPage * CLIENT_PAGE_SIZE + index}
                chatters={chatters}
                modelOptions={modelOptions}
                readOnly={readOnly}
                onAssignChatter={handleAssignChatter}
                onAssignModel={handleAssignModel}
                onClearChatter={handleClearChatter}
                onClearModel={handleClearModel}
                onUpdateFields={handleUpdateFields}
                onRequestDeleteWhale={handleRequestDeleteWhale}
                deleting={!!deletingWhaleIds[w.id]}
                onOpenEdit={setEditingWhale}
                onOpenHistory={setHistoryWhale}
              />
            ))
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-white/60">
            Cards {cardRangeStart}–{cardRangeEnd} of {localWhales.length} on this load (up to {pageSize} from server)
            {clientPageCount > 1 ? ` · page ${cardPage + 1} / ${clientPageCount}` : ""}
            {hasNext ? " · more available (Next)" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {clientPageCount > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setCardPage((p) => Math.max(0, p - 1))}
                  disabled={cardPage <= 0}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                >
                  Prev cards
                </button>
                <button
                  type="button"
                  onClick={() => setCardPage((p) => Math.min(clientPageCount - 1, p + 1))}
                  disabled={cardPage >= clientPageCount - 1}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                >
                  Next cards
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={goToFirst}
              disabled={!hasPrev}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
            >
              First
            </button>
            <button
              type="button"
              onClick={goToNext}
              disabled={!hasNext}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
            >
              Next load
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {historyWhale ? (
          <AdminWhaleHistorySheet
            key={historyWhale.id}
            whale={historyWhale}
            readOnly={readOnly}
            onClose={closeHistorySheet}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {!readOnly && editingWhale ? (
          <AdminEditWhaleModal
            key={editingWhale.id}
            whale={editingWhale}
            onClose={closeEditWhaleModal}
            onUpdateFields={handleUpdateFields}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
