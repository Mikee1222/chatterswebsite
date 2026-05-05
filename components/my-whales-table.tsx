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
          className="rounded-lg border border-[hsl(330,80%,55%)]/50 bg-[hsl(330,80%,55%)]/25 px-3 py-2 text-xs font-semibold text-[hsl(330,90%,80%)] hover:bg-[hsl(330,80%,55%)]/35 disabled:opacity-50"
        >
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

  const avatarLetter = (whale.username?.trim()?.[0] ?? whale.whale_id?.trim()?.[0] ?? "?").toUpperCase();
  const statusChipClass =
    whale.status === "Active"
      ? "bg-green-500/20 text-green-400"
      : whale.status === "Inactive"
        ? "bg-amber-500/20 text-amber-300"
        : whale.status === "Dead"
          ? "bg-white/10 text-white/70"
          : "bg-red-500/20 text-red-300";

  const canToggle = whale.status === "Active" || whale.status === "Inactive";
  const nextStatus = whale.status === "Active" ? "Inactive" : "Active";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rowIndex, 12) * 0.03, ease: "easeOut" }}
      className="min-w-0"
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-all hover:border-white/20 hover:bg-white/[0.08]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-lg font-bold text-pink-400">
              {avatarLetter}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-white">{whale.username || "—"}</h3>
              <p className="truncate font-mono text-xs text-white/40">{whale.whale_id || "—"}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${statusChipClass}`}>{whale.status}</span>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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

        <div className="flex flex-wrap gap-2">
          <button
            ref={logAnchorRef}
            type="button"
            onClick={() => setLogOpen(true)}
            className="rounded-lg border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-3 py-1.5 text-xs font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/25"
          >
            Log transaction
          </button>
          <FloatingPopover open={logOpen} onClose={() => setLogOpen(false)} anchorRef={logAnchorRef} className="w-[min(100vw-2rem,22rem)]">
            <LogTransactionQuickForm whale={whale} modelNames={modelNames} onClose={() => setLogOpen(false)} />
          </FloatingPopover>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10"
          >
            View history
          </button>
          <Link
            href={`/my-whales/${whale.id}/edit`}
            className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10"
          >
            Full edit
          </Link>
          {canToggle ? (
            <button
              type="button"
              onClick={() => void onSave(whale.id, { status: nextStatus })}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10"
            >
              Mark {nextStatus}
            </button>
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

export function MyWhalesTable({ whales, modelNames = {} }: { whales: Whale[]; modelNames?: Record<string, string> }) {
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

  if (whales.length === 0) {
    return <p className="py-12 text-center text-sm text-white/50">No whales assigned yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {whales.map((w, index) => (
        <WhaleChatterCard key={w.id} whale={w} modelNames={modelNames} rowIndex={index} onSave={handleSave} />
      ))}
    </div>
  );
}
