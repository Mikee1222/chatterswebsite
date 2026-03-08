"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateWhale } from "@/services/whales";
import { Input, Textarea } from "@/components/ui/form";
import type { Whale, RelationshipStatus, WhaleStatus } from "@/types";
import { RELATIONSHIP_STATUS_OPTIONS, WHALE_STATUS_OPTIONS, HOURS_ACTIVE_OPTIONS, whaleStatusBadgeVariant } from "@/lib/airtable-options";

function notesSummary(notes: string | undefined, maxLen = 50): string {
  if (!notes?.trim()) return "—";
  const t = notes.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

/** Display label for select values. New whale options use display-ready text (e.g. "In Love"); legacy values may have underscores. */
function label(value: string): string {
  return value.replace(/_/g, " ");
}

/** Returns true if value looks like an Airtable record id (rec...) - never show in UI as a "name". */
function looksLikeRecordId(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return /^rec[A-Za-z0-9]{14}$/.test(value.trim()) || value.trim().startsWith("rec");
}

/** Human-readable model name: prefer snapshot; if missing or id, resolve from modelNames; never show record id. */
function displayModelName(whale: Whale, modelNames: Record<string, string>): string {
  const snapshot = whale.assigned_model_name?.trim();
  if (snapshot && !looksLikeRecordId(snapshot)) return snapshot;
  const resolved = whale.assigned_model_id && modelNames[whale.assigned_model_id]?.trim();
  if (resolved) return resolved;
  return "no model";
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

/** Portal-rendered floating popover so it is not clipped by table overflow. */
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
    const estimatedHeight = 220;
    const estimatedWidth = 260;
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
      className={`fixed z-[9999] rounded-xl border border-white/10 bg-black/95 shadow-xl backdrop-blur-xl ${className}`}
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

function SelectCell<T extends string>({
  value,
  options,
  whaleId,
  field,
  onSave,
  badgeVariant = "default",
}: {
  value: T;
  options: T[];
  whaleId: string;
  field: string;
  onSave: (id: string, payload: Record<string, string>) => Promise<void>;
  badgeVariant?: "default" | "emerald" | "amber" | "pink" | "slate";
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

  async function handleSelect(option: T) {
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
        <Badge variant={badgeVariant}>{label(value)}</Badge>
        {saving ? (
          <span className="text-[10px] text-white/40">Saving…</span>
        ) : (
          <span className="text-white/30">▾</span>
        )}
      </button>
      <FloatingPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} className="min-w-[140px] py-1">
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-white/60">
            <th className="p-3 font-medium">Username</th>
            <th className="p-3 font-medium">Model</th>
            <th className="p-3 font-medium">Relationship</th>
            <th className="p-3 font-medium">Hours active</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {whales.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-white/50">
                No whales assigned yet.
              </td>
            </tr>
          ) : (
            whales.map((w) => (
              <tr key={w.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="p-3 font-medium text-white/90">{w.username || "—"}</td>
                <td className="p-3 text-white/80">{displayModelName(w, modelNames)}</td>
                <td className="p-3">
                  <SelectCell
                    value={w.relationship_status}
                    options={[...RELATIONSHIP_STATUS_OPTIONS]}
                    whaleId={w.id}
                    field="relationship_status"
                    onSave={handleSave}
                    badgeVariant="slate"
                  />
                </td>
                <td className="p-3">
                  <HoursActiveCell value={w.hours_active ?? []} whaleId={w.id} onSave={handleSave} />
                </td>
                <td className="p-3">
                  <SelectCell
                    value={w.status}
                    options={[...WHALE_STATUS_OPTIONS]}
                    whaleId={w.id}
                    field="status"
                    onSave={handleSave}
                    badgeVariant={whaleStatusBadgeVariant(w.status)}
                  />
                </td>
                <td className="max-w-[200px] p-3">
                  <NotesCell value={w.notes ?? ""} whaleId={w.id} onSave={handleSave} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
