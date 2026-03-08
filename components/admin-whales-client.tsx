"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  assignWhaleToChatter,
  assignWhaleToModel,
  clearWhaleChatter,
  clearWhaleModel,
  updateWhaleFields,
} from "@/app/actions/whales";
import { Input, Select, Textarea, selectOptionClass } from "@/components/ui/form";
import type { Whale } from "@/types";
import {
  RELATIONSHIP_STATUS_OPTIONS,
  WHALE_STATUS_OPTIONS,
  HOURS_ACTIVE_OPTIONS,
  whaleStatusBadgeVariant,
} from "@/lib/airtable-options";

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
      className={`absolute left-0 top-full z-[9999] mt-1 max-h-[min(280px,70vh)] min-w-full overflow-y-auto rounded-xl border border-white/10 bg-black/95 shadow-xl backdrop-blur-xl transition-opacity duration-150 ${className}`}
      style={{
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px -8px rgba(0,0,0,0.6)",
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
}: {
  whale: Whale;
  modelOptions: ModelOption[];
  onSave: (id: string, modelId: string, modelName: string) => Promise<{ success: boolean; error?: string }>;
  onClear: (id: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modelOptions.slice(0, 30);
    return modelOptions.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 30);
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
        <span className="truncate">{hasModel ? displayName : "unassigned"}</span>
        {saving ? <span className="text-[10px] text-white/40">Saving…</span> : <span className="text-white/40">▾</span>}
      </button>
      <InlinePopover open={open} onClose={() => setOpen(false)} wrapperRef={wrapperRef} className="w-64 p-2">
        <Input
          type="text"
          placeholder="Search models…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 text-sm"
        />
        <div className="max-h-52 overflow-y-auto">
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
}: {
  whale: Whale;
  chatters: Chatter[];
  onSave: (id: string, chatterId: string, chatterName: string) => Promise<{ success: boolean; error?: string }>;
  onClear: (id: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chatters.slice(0, 50);
    return chatters.filter((c) => (c.full_name || c.id).toLowerCase().includes(q)).slice(0, 50);
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
          <span className="truncate">+ assign chatter</span>
          {saving ? <span className="text-[10px] text-white/40">Saving…</span> : <span className="text-white/40">▾</span>}
        </button>
      )}
      <InlinePopover open={open} onClose={() => setOpen(false)} wrapperRef={wrapperRef} className="min-w-[200px] p-2">
        <Input
          type="text"
          placeholder="Search chatters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 text-sm"
        />
        <div className="max-h-52 overflow-y-auto">
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
        <Textarea
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
  chatters: Chatter[];
  modelOptions: ModelOption[];
  onAssignChatter: (id: string, chatterId: string, chatterName: string) => Promise<{ success: boolean; error?: string }>;
  onAssignModel: (id: string, modelId: string, modelName: string) => Promise<{ success: boolean; error?: string }>;
  onClearChatter: (id: string) => Promise<{ success: boolean; error?: string }>;
  onClearModel: (id: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateFields: (id: string, payload: Record<string, string | string[]>) => Promise<{ success: boolean; error?: string }>;
};

const WhaleRow = React.memo(function WhaleRow({
  whale,
  chatters,
  modelOptions,
  onAssignChatter,
  onAssignModel,
  onClearChatter,
  onClearModel,
  onUpdateFields,
}: WhaleRowProps) {
  return (
    <tr className="hover:bg-white/[0.03]">
      <td className="p-3 font-medium text-white/90">{whale.username || "—"}</td>
      <td className="p-3">
        <ModelCell whale={whale} modelOptions={modelOptions} onSave={onAssignModel} onClear={onClearModel} />
      </td>
      <td className="p-3">
        <ChatterCell whale={whale} chatters={chatters} onSave={onAssignChatter} onClear={onClearChatter} />
      </td>
      <td className="p-3">
        <SelectBadgeCell
          value={whale.relationship_status ?? ""}
          options={RELATIONSHIP_STATUS_OPTIONS}
          whaleId={whale.id}
          field="relationship_status"
          onSave={onUpdateFields}
          badgeVariant="slate"
          allowEmpty
        />
      </td>
      <td className="p-3">
        <SelectBadgeCell
          value={whale.status}
          options={WHALE_STATUS_OPTIONS}
          whaleId={whale.id}
          field="status"
          onSave={onUpdateFields}
          badgeVariant={whaleStatusBadgeVariant(whale.status) as keyof typeof badgeVariants}
        />
      </td>
      <td className="p-3">
        <HoursActiveCell value={whale.hours_active ?? []} whaleId={whale.id} onSave={onUpdateFields} />
      </td>
      <td className="max-w-[180px] p-3">
        <NotesCell value={whale.notes ?? ""} whaleId={whale.id} onSave={onUpdateFields} />
      </td>
    </tr>
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

  React.useEffect(() => {
    setLocalWhales(initialWhales);
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
  const pageIndex = currentOffset ? 2 : 1;
  const rangeStart = (pageIndex - 1) * pageSize + 1;
  const rangeEnd = (pageIndex - 1) * pageSize + localWhales.length;

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

  const updateWhaleInList = React.useCallback((whaleId: string, patch: Partial<Whale>) => {
    setLocalWhales((prev) =>
      prev.map((w) => (w.id === whaleId ? { ...w, ...patch } : w))
    );
  }, []);

  const handleAssignChatter = React.useCallback(
    async (whaleId: string, chatterId: string, chatterName: string) => {
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
    [router, localWhales, updateWhaleInList]
  );

  const handleAssignModel = React.useCallback(
    async (whaleId: string, modelId: string, modelName: string) => {
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
    [router, localWhales, updateWhaleInList]
  );

  const handleClearModel = React.useCallback(
    async (whaleId: string) => {
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
    [router, localWhales, updateWhaleInList]
  );

  const handleClearChatter = React.useCallback(
    async (whaleId: string) => {
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
    [router, localWhales, updateWhaleInList]
  );

  const handleUpdateFields = React.useCallback(
    async (whaleId: string, payload: Record<string, string | string[]>) => {
      setError(null);
      const prev = localWhales.find((w) => w.id === whaleId);
      if (prev) {
        const patch: Partial<Whale> = {};
        if ("relationship_status" in payload) patch.relationship_status = payload.relationship_status as Whale["relationship_status"];
        if ("status" in payload) patch.status = payload.status as Whale["status"];
        if ("hours_active" in payload) patch.hours_active = Array.isArray(payload.hours_active) ? payload.hours_active : [];
        if ("notes" in payload) patch.notes = String(payload.notes);
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
    [router, localWhales, updateWhaleInList]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Whales</h1>
        <p className="mt-1 text-sm text-white/60">All whales. Edit inline. Revenue from whale_transactions.</p>
      </div>

      {/* Summary stats (global totals across all whales, not filtered table) */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total</p>
          <p className="mt-0.5 text-xl font-semibold text-white">{statusCounts.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-300/80">Active</p>
          <p className="mt-0.5 text-xl font-semibold text-emerald-300">{statusCounts.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-300/80">Inactive</p>
          <p className="mt-0.5 text-xl font-semibold text-amber-300">{statusCounts.inactive}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Dead</p>
          <p className="mt-0.5 text-xl font-semibold text-white/90">{statusCounts.dead}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Deleted account</p>
          <p className="mt-0.5 text-xl font-semibold text-white/90">{statusCounts.deleted}</p>
        </div>
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

      {/* Filters + search (debounced) */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          placeholder="Search username…"
          value={filterSearch}
          onChange={(e) => onFilterChange({ q: e.target.value })}
          className="min-w-[180px]"
        />
        <Select
          value={filterChatter}
          onChange={(e) => onFilterChange({ chatter: e.target.value })}
          className="min-w-[160px]"
        >
          <option value="" className={selectOptionClass}>Chatter</option>
          {chatters.map((c) => (
            <option key={c.id} value={c.id} className={selectOptionClass}>{c.full_name || c.id}</option>
          ))}
        </Select>
        <Select
          value={filterModel}
          onChange={(e) => onFilterChange({ model: e.target.value })}
          className="min-w-[160px]"
        >
          <option value="" className={selectOptionClass}>Model</option>
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id} className={selectOptionClass}>{m.name || m.id}</option>
          ))}
        </Select>
        <Select
          value={filterRelationship}
          onChange={(e) => onFilterChange({ relationship: e.target.value })}
          className="min-w-[140px]"
        >
          <option value="" className={selectOptionClass}>Relationship</option>
          {RELATIONSHIP_STATUS_OPTIONS.map((o) => (
            <option key={o} value={o} className={selectOptionClass}>{o}</option>
          ))}
        </Select>
        <Select
          value={filterStatus}
          onChange={(e) => onFilterChange({ status: e.target.value })}
          className="min-w-[140px]"
        >
          <option value="" className={selectOptionClass}>Status</option>
          {WHALE_STATUS_OPTIONS.map((o) => (
            <option key={o} value={o} className={selectOptionClass}>{o}</option>
          ))}
        </Select>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-white/10 bg-black/40 text-left text-xs font-medium uppercase tracking-wider text-white/50">
            <tr>
              <th className="p-3 font-medium">Username</th>
              <th className="p-3 font-medium">Model</th>
              <th className="p-3 font-medium">Chatter</th>
              <th className="p-3 font-medium">Relationship</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Hours active</th>
              <th className="p-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {localWhales.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/50">No whales on this page</td>
              </tr>
            ) : (
              localWhales.map((w) => (
                <WhaleRow
                  key={w.id}
                  whale={w}
                  chatters={chatters}
                  modelOptions={modelOptions}
                  onAssignChatter={handleAssignChatter}
                  onAssignModel={handleAssignModel}
                  onClearChatter={handleClearChatter}
                  onClearModel={handleClearModel}
                  onUpdateFields={handleUpdateFields}
                />
              ))
            )}
          </tbody>
        </table>
        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <p className="text-sm text-white/60">
            Showing {localWhales.length === 0 ? 0 : rangeStart}–{rangeEnd}
            {hasNext ? "+" : ""}
          </p>
          <div className="flex items-center gap-2">
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
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
