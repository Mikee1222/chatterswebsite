"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { updateWhale } from "@/services/whales";
import { createWhaleTransaction } from "@/services/whale-transactions";
import { Input, Textarea, Label, ButtonSecondary } from "@/components/ui/form";
import { CustomSelect } from "@/components/ui/custom-select";
import type { Whale, TransactionType, TransactionCurrency } from "@/types";
import {
  RELATIONSHIP_STATUS_OPTIONS,
  WHALE_STATUS_OPTIONS,
  HOURS_ACTIVE_OPTIONS,
  whaleStatusBadgeVariant,
  TRANSACTION_TYPES,
  TRANSACTION_CURRENCY_OPTIONS,
} from "@/lib/airtable-options";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Fish, Filter, History, PenSquare, Plus, Receipt, UserRound } from "lucide-react";

function notesSummary(notes: string | undefined, maxLen = 50): string {
  if (!notes?.trim()) return "—";
  const t = notes.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

function label(value: string): string {
  return value.replace(/_/g, " ");
}

function looksLikeRecordId(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return /^rec[A-Za-z0-9]{14}$/.test(value.trim()) || value.trim().startsWith("rec");
}

function displayModelName(whale: Whale, modelNames: Record<string, string>): string {
  const snapshot = whale.assigned_model_name?.trim();
  if (snapshot && !looksLikeRecordId(snapshot)) return snapshot;
  const resolved = whale.assigned_model_id && modelNames[whale.assigned_model_id]?.trim();
  if (resolved) return resolved;
  return "—";
}

function whaleInitials(username: string | undefined, whaleId: string | undefined): string {
  const u = (username || "").trim();
  if (u) {
    const parts = u.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    return u.slice(0, 2).toUpperCase();
  }
  const id = (whaleId || "").trim();
  return id.slice(0, 2).toUpperCase() || "?";
}

function WhaleAvatarPlaceholder({
  username,
  whaleId,
  className,
}: {
  username: string | undefined;
  whaleId: string | undefined;
  className?: string;
}) {
  const initials = whaleInitials(username, whaleId);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-700 text-sm font-bold uppercase tracking-tight text-white shadow-inner ring-2 ring-white/20",
        "h-12 w-12 text-[13px] md:h-14 md:w-14 md:text-sm",
        className
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function WhaleStatusIndicator({ status }: { status: Whale["status"] }) {
  const dot =
    status === "Active" ? (
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-55" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_hsl(142_76%_50%/0.8)]" />
      </span>
    ) : status === "Inactive" ? (
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]" />
    ) : status === "Dead" ? (
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/40" />
    ) : (
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]" />
    );

  const label = status === "Deleted Account" ? "Deleted account" : status;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-xs font-semibold text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        status === "Active" && "border-emerald-500/35 bg-emerald-500/10",
        status === "Inactive" && "border-amber-500/30 bg-amber-500/10"
      )}
      title={status}
    >
      {dot}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

function MyWhalesEmptyState({
  type,
  onClearFilters,
}: {
  type: "none" | "filters";
  onClearFilters?: () => void;
}) {
  if (type === "filters") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center px-4 py-16 text-center"
      >
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/12 bg-gradient-to-br from-white/[0.08] to-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <Filter className="h-9 w-9 text-pink-200/70" aria-hidden />
        </div>
        <p className="text-lg font-semibold text-white">No whales match these filters</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">
          Adjust search or a dropdown — your assigned whales are still on file.
        </p>
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-8 rounded-xl border border-pink-400/40 bg-gradient-to-r from-pink-500/25 to-fuchsia-600/20 px-6 py-2.5 text-sm font-semibold text-pink-50 shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.35)] transition hover:brightness-110"
          >
            Clear filters
          </button>
        ) : null}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center px-4 py-16 text-center"
    >
      <div className="relative mb-8">
        <div
          className="absolute inset-0 -m-6 animate-pulse rounded-full bg-pink-500/25 blur-3xl"
          aria-hidden
        />
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-pink-400/35 bg-gradient-to-br from-pink-500/35 via-fuchsia-900/40 to-violet-950/50 shadow-[0_0_40px_-10px_hsl(330_80%_55%/0.45),inset_0_1px_0_rgba(255,255,255,0.12)]">
          <Fish className="h-16 w-16 text-pink-50/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]" strokeWidth={1.25} aria-hidden />
        </div>
        <motion.div
          className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/60 shadow-lg backdrop-blur-sm"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 22 }}
          aria-hidden
        >
          <UserRound className="h-5 w-5 text-pink-200/90" />
        </motion.div>
      </div>
      <p className="text-lg font-semibold text-white">No whales yet</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">
        When whales are assigned to you, they show up here. Use the + button in the app header to add one yourself.
      </p>
      <Link
        href={ROUTES.chatter.myWhalesNew}
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-pink-400/45 bg-gradient-to-r from-pink-500/30 to-fuchsia-600/25 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_28px_-8px_hsl(330_80%_55%/0.4)] transition hover:brightness-110"
      >
        <Plus className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Add a whale
      </Link>
    </motion.div>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "emerald" | "amber" | "pink" | "slate";
}) {
  const variants = {
    default: "bg-white/10 text-white/80 border-white/15",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    pink: "bg-[hsl(330,80%,55%)]/15 text-[hsl(330,90%,75%)] border-[hsl(330,80%,55%)]/25",
    slate: "bg-white/5 text-white/60 border-white/10",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

function FloatingPopover({
  open,
  onClose,
  anchorRef,
  children,
  className = "",
  placement = "bottom",
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  placement?: "bottom" | "top";
}) {
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const popoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open || !anchorRef.current || typeof document === "undefined") return;
    const rect = anchorRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const padding = 6;
    const estimatedHeight = 320;
    const estimatedWidth = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeAbove = placement === "top" || (placement === "bottom" && spaceBelow < estimatedHeight && spaceAbove > spaceBelow);
    const top = placeAbove ? rect.top - estimatedHeight - padding : rect.bottom + padding;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - estimatedWidth - 8));
    setPosition({ top, left });
  }, [open, anchorRef, placement]);

  React.useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      const el = popoverRef.current;
      const anchor = anchorRef.current;
      if (el?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  const popover = (
    <div
      ref={popoverRef}
      className={`fixed z-[9999] max-h-[min(420px,80vh)] overflow-y-auto rounded-xl border border-white/10 bg-black/95 shadow-xl backdrop-blur-xl ${className}`}
      style={{
        top: position.top,
        left: position.left,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px -8px rgba(0,0,0,0.6)",
      }}
    >
      {children}
    </div>
  );

  return createPortal(popover, document.body);
}

function SelectCell({
  value,
  options,
  whaleId,
  field,
  onSave,
  badgeVariant = "default",
}: {
  value: string;
  options: readonly string[];
  whaleId: string;
  field: string;
  onSave: (id: string, payload: Record<string, string>) => Promise<void>;
  badgeVariant?: "default" | "emerald" | "amber" | "pink" | "slate";
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

  async function handleSelect(option: string) {
    if (option === value) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(whaleId, { [field]: option });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-left transition-colors hover:border-white/20 hover:bg-white/5 disabled:opacity-60"
      >
        <Badge variant={badgeVariant}>{value ? label(value) : "—"}</Badge>
        {saving ? (
          <span className="text-[10px] text-white/40">Saving…</span>
        ) : (
          <span className="text-white/30">▾</span>
        )}
      </button>
      <FloatingPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} className="min-w-[160px] py-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => handleSelect(opt)}
            className="block w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10"
          >
            {label(opt)}
          </button>
        ))}
      </FloatingPopover>
    </>
  );
}

function HoursActiveCell({
  value,
  whaleId,
  onSave,
}: {
  value: string[];
  whaleId: string;
  onSave: (id: string, payload: Record<string, string | string[]>) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(value ?? []);
  const [saving, setSaving] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

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
    try {
      await onSave(whaleId, { hours_active: selected });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const displayList = (value ?? []).filter(Boolean);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 text-left text-white/80 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white/95 disabled:opacity-60"
        title={displayList.length ? "Edit hours active" : "Set hours active"}
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
        {!saving && <span className="text-white/30">▾</span>}
      </button>
      <FloatingPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} className="min-w-[200px] p-3">
        <label className="mb-2 block text-xs font-medium text-white/60">Hours active</label>
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
      </FloatingPopover>
    </>
  );
}

function NotesCell({
  value,
  whaleId,
  onSave,
}: {
  value: string;
  whaleId: string;
  onSave: (id: string, payload: Record<string, string>) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [saving, setSaving] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) setDraft(value ?? "");
  }, [open, value]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(whaleId, { notes: draft.trim() });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="block w-full truncate rounded-lg border border-transparent px-2 py-1 text-left text-white/70 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white/85 disabled:opacity-60"
        title={value || undefined}
      >
        {notesSummary(value, 50)}
        {saving && <span className="ml-1 text-[10px] text-white/40">Saving…</span>}
      </button>
      <FloatingPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} className="w-72 p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Notes…"
          className="mb-3 min-h-0 resize-y"
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
      </FloatingPopover>
    </>
  );
}

function ChatterWhaleHistorySheet({ whale, onClose }: { whale: Whale; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <motion.aside
        className="relative z-[1] flex h-full w-full max-w-md flex-col border-l border-white/10 bg-black/95 shadow-2xl"
        initial={{ x: 48 }}
        animate={{ x: 0 }}
        exit={{ x: 48 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">History</h2>
          <p className="mt-1 text-sm text-white/55">{whale.username || "—"}</p>
          <p className="mt-2 text-xs text-white/45">
            Open the whale detail page for the full transaction list and activity timeline.
          </p>
          <Link
            href={ROUTES.whaleDetail(whale.id)}
            className="mt-4 inline-flex rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/25"
          >
            View full history →
          </Link>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Whale ID</p>
            <p className="mt-1 font-mono text-xs text-white/80">{whale.whale_id || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Total spent (record)</p>
            <p className="mt-1 text-white/85">${whale.total_spent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </div>
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

function LogTransactionQuickForm({
  whale,
  modelNames,
  onClose,
}: {
  whale: Whale;
  modelNames: Record<string, string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const now = new Date();
  const [sessionMinutes, setSessionMinutes] = React.useState("30");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState<TransactionCurrency>("usd");
  const [type, setType] = React.useState<TransactionType>("sexting + videos");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);
  const modelName = displayModelName(whale, modelNames);
  const chatterId = whale.assigned_chatter_id?.trim();
  const chatterName = whale.assigned_chatter_name?.trim() || "Chatter";
  const sessionMinutesNum = sessionMinutes.trim() ? parseInt(sessionMinutes, 10) : NaN;
  const validMins = Number.isInteger(sessionMinutesNum) && sessionMinutesNum >= 0;

  const currencyOptions = React.useMemo(
    () => TRANSACTION_CURRENCY_OPTIONS.map((c) => ({ value: c, label: c })),
    []
  );
  const typeOptions = React.useMemo(
    () => TRANSACTION_TYPES.map((t) => ({ value: t, label: t })),
    []
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!chatterId) {
      setError("Missing chatter assignment on this whale.");
      return;
    }
    if (!validMins) {
      setError("Session length (minutes) must be a whole number ≥ 0.");
      return;
    }
    setPending(true);
    try {
      await createWhaleTransaction({
        whale_record_id: whale.id,
        whale_username: whale.username,
        chatter_record_id: chatterId,
        chatter_name: chatterName,
        model_record_id: whale.assigned_model_id || undefined,
        model_name: modelName === "—" ? "" : modelName,
        date: dateStr,
        time: timeStr,
        session_length_minutes: sessionMinutesNum,
        amount: parseFloat(amount) || 0,
        currency,
        type,
        note,
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-3">
      <p className="text-xs text-white/50">Log session for <span className="font-medium text-white/90">{whale.username}</span></p>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <div>
        <Label>Session length (minutes)</Label>
        <Input value={sessionMinutes} onChange={(e) => setSessionMinutes(e.target.value)} className="mt-1" inputMode="numeric" />
      </div>
      <div>
        <Label>Amount (USD)</Label>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" inputMode="decimal" placeholder="0" />
      </div>
      <div>
        <Label>Currency</Label>
        <CustomSelect
          value={currency}
          onChange={(v) => setCurrency(v as TransactionCurrency)}
          options={currencyOptions}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Type</Label>
        <CustomSelect value={type} onChange={(v) => setType(v as TransactionType)} options={typeOptions} className="mt-1" />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1" placeholder="Optional" />
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-pink-400/45 bg-gradient-to-r from-pink-500/35 to-fuchsia-600/30 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_20px_-8px_hsl(330_80%_55%/0.35)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
        >
          <Receipt className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          {pending ? "Saving…" : "Log transaction"}
        </button>
        <ButtonSecondary type="button" onClick={onClose}>
          Cancel
        </ButtonSecondary>
      </div>
    </form>
  );
}

function WhaleChatterCard({
  whale,
  modelNames,
  rowIndex,
  onSave,
}: {
  whale: Whale;
  modelNames: Record<string, string>;
  rowIndex: number;
  onSave: (whaleId: string, payload: Record<string, string | string[] | null>) => Promise<void>;
}) {
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const logAnchorRef = React.useRef<HTMLButtonElement>(null);

  const canToggle = whale.status === "Active" || whale.status === "Inactive";
  const nextStatus = whale.status === "Active" ? "Inactive" : "Active";

  const actionGhost =
    "border-white/15 bg-black/25 text-white/90 hover:border-pink-400/30 hover:bg-pink-500/10 hover:text-white";
  const actionPrimary =
    "border-pink-400/40 bg-gradient-to-r from-pink-500/30 to-fuchsia-600/25 text-pink-50 shadow-[0_0_20px_-8px_hsl(330_80%_55%/0.35)] hover:brightness-110";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rowIndex, 12) * 0.03, ease: "easeOut" }}
      className="min-w-0"
    >
      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-white/[0.12] p-5 transition-all duration-300",
          "bg-gradient-to-br from-pink-500/[0.12] via-violet-950/20 to-black/85",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_-20px_rgba(236,72,153,0.2)]",
          "hover:border-pink-400/25 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_48px_-16px_hsl(330_80%_55%/0.22)]"
        )}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-fuchsia-500/10 opacity-80 blur-3xl transition-opacity group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <WhaleAvatarPlaceholder username={whale.username} whaleId={whale.whale_id} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold text-white md:text-lg">{whale.username || "—"}</h3>
              <p className="truncate font-mono text-xs text-white/45">{whale.whale_id || "—"}</p>
            </div>
          </div>
          <div className="shrink-0 pt-0.5">
            <WhaleStatusIndicator status={whale.status} />
          </div>
        </div>

        <div className="relative mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Model</p>
            <p className="mt-1 text-sm font-medium text-white">{displayModelName(whale, modelNames)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Relationship</p>
            <div className="mt-1.5">
              <SelectCell
                value={whale.relationship_status}
                options={[...RELATIONSHIP_STATUS_OPTIONS]}
                whaleId={whale.id}
                field="relationship_status"
                onSave={onSave}
                badgeVariant="slate"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Status</p>
            <div className="mt-1.5">
              <SelectCell
                value={whale.status}
                options={[...WHALE_STATUS_OPTIONS]}
                whaleId={whale.id}
                field="status"
                onSave={onSave}
                badgeVariant={whaleStatusBadgeVariant(whale.status)}
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">Hours active</p>
          <div className="mt-1.5">
            <HoursActiveCell value={whale.hours_active ?? []} whaleId={whale.id} onSave={onSave} />
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">Notes</p>
          <div className="mt-1.5">
            <NotesCell value={whale.notes ?? ""} whaleId={whale.id} onSave={onSave} />
          </div>
        </div>

        <div className="relative grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <motion.button
            ref={logAnchorRef}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => setLogOpen(true)}
            className={cn(
              "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all sm:min-w-0",
              actionPrimary
            )}
          >
            <Receipt className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            Log session
          </motion.button>
          <FloatingPopover open={logOpen} onClose={() => setLogOpen(false)} anchorRef={logAnchorRef} className="w-[min(100vw-2rem,22rem)]">
            <LogTransactionQuickForm whale={whale} modelNames={modelNames} onClose={() => setLogOpen(false)} />
          </FloatingPopover>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => setHistoryOpen(true)}
            className={cn(
              "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
              actionGhost
            )}
          >
            <History className="h-3.5 w-3.5 shrink-0 text-white/60" aria-hidden />
            History
          </motion.button>
          <Link
            href={ROUTES.chatter.myWhaleEdit(whale.id)}
            className={cn(
              "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
              actionGhost
            )}
          >
            <PenSquare className="h-3.5 w-3.5 shrink-0 text-white/60" aria-hidden />
            Edit
          </Link>
          {canToggle ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => void onSave(whale.id, { status: nextStatus })}
              className={cn(
                "col-span-2 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all sm:col-span-1",
                "border-amber-400/30 bg-amber-500/10 text-amber-50 hover:border-amber-300/45 hover:bg-amber-500/18"
              )}
            >
              Mark {nextStatus}
            </motion.button>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {historyOpen ? (
          <ChatterWhaleHistorySheet key={whale.id} whale={whale} onClose={() => setHistoryOpen(false)} />
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export function MyWhalesTable({
  whales,
  modelNames = {},
  emptyState = null,
  onClearFilters,
}: {
  whales: Whale[];
  modelNames?: Record<string, string>;
  emptyState?: "none" | "filters" | null;
  onClearFilters?: () => void;
}) {
  const router = useRouter();

  const handleSave = React.useCallback(
    async (whaleId: string, payload: Record<string, string | string[] | null>) => {
      const toSend: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (k === "hours_active") {
          toSend[k] = Array.isArray(v) ? v : [];
          continue;
        }
        if (v != null && v !== "") toSend[k] = v as string;
        else if ((v === null || v === "") && k === "next_followup") toSend[k] = "";
      }
      if (Object.keys(toSend).length === 0) return;
      await updateWhale(whaleId, toSend);
      router.refresh();
    },
    [router]
  );

  if (emptyState === "filters") {
    return <MyWhalesEmptyState type="filters" onClearFilters={onClearFilters} />;
  }
  if (emptyState === "none") {
    return <MyWhalesEmptyState type="none" />;
  }
  if (whales.length === 0) {
    return <MyWhalesEmptyState type="none" />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {whales.map((w, index) => (
        <WhaleChatterCard key={w.id} whale={w} modelNames={modelNames} rowIndex={index} onSave={handleSave} />
      ))}
    </div>
  );
}
