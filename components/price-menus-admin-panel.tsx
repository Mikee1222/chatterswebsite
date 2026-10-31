"use client";

import * as React from "react";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  Link2,
  Plus,
  Save,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rowNegLabel, rowNormalLabel, spenderLabel, SPENDER_ORDER } from "@/lib/price-display";
import type {
  LinkSuggestion,
  PriceMarket,
  PriceMenu,
  PriceMenuChange,
  PriceMenuRow,
  PriceMenuSpecial,
  PriceMenusBundle,
  UnlinkedModel,
} from "@/services/price-menus";
import type { SpenderTier } from "@/services/pricing";

type MarketFilter = "all" | PriceMarket;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data;
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      title={name}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-amber-500/30 to-rose-500/20 text-[10px] font-semibold text-white/90"
    >
      {initials || "?"}
    </span>
  );
}

function MarketBadge({ market }: { market: PriceMarket }) {
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        market === "greece"
          ? "border-sky-500/30 bg-sky-500/15 text-sky-200"
          : "border-violet-500/30 bg-violet-500/15 text-violet-200"
      )}
    >
      {market === "greece" ? "GR" : "USA"}
    </span>
  );
}

function overlapWarn(rows: PriceMenuRow[]): string | null {
  const sorted = [...rows].sort((a, b) => a.level - b.level);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a.price_max != null && b.price_min != null && a.price_max > b.price_min) {
      return `Levels ${a.level}–${b.level}: overlapping ranges (warn only)`;
    }
  }
  return null;
}

export function PriceMenusAdminPanel({
  initial,
  canManage,
}: {
  initial: PriceMenusBundle;
  canManage: boolean;
}) {
  const [bundle, setBundle] = React.useState(initial);
  const [market, setMarket] = React.useState<MarketFilter>("all");
  const [search, setSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initial.menus[0]?.id ?? null
  );
  const [spender, setSpender] = React.useState<SpenderTier>("high");
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [history, setHistory] = React.useState<PriceMenuChange[]>([]);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [showInactiveModels, setShowInactiveModels] = React.useState(false);
  const [selectedModelIds, setSelectedModelIds] = React.useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkPreview, setBulkPreview] = React.useState<
    { row_id: string; field: string; before: string; after: string }[] | null
  >(null);
  const [adjustAmount, setAdjustAmount] = React.useState("10");
  const [adjustMode, setAdjustMode] = React.useState<"percent" | "add" | "subtract">("percent");
  const [adjustTarget, setAdjustTarget] = React.useState<"normal" | "neg" | "both">("normal");
  const [adjustRound, setAdjustRound] = React.useState<1 | 5 | 10 | null>(1);
  const [editingCell, setEditingCell] = React.useState<{
    rowId: string;
    field: string;
  } | null>(null);
  const [draft, setDraft] = React.useState("");

  const refresh = React.useCallback(async () => {
    const data = await api<PriceMenusBundle & { canManage?: boolean }>("/api/price-menus?all=1");
    setBundle(data);
    setDirty(false);
  }, []);

  const menus = React.useMemo(() => {
    return bundle.menus
      .filter((m) => (market === "all" ? true : m.market === market))
      .filter((m) => {
        if (!search.trim() && !modelFilter.trim()) return true;
        const q = search.trim().toLowerCase();
        const mf = modelFilter.trim().toLowerCase();
        const nameOk = !q || m.name.toLowerCase().includes(q);
        const modelOk =
          !mf ||
          m.models.some((x) => x.model_name.toLowerCase().includes(mf));
        return nameOk && modelOk;
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [bundle.menus, market, search, modelFilter]);

  const selected: PriceMenu | null =
    menus.find((m) => m.id === selectedId) ?? menus[0] ?? null;

  React.useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const rows = React.useMemo(() => {
    if (!selected) return [];
    return (bundle.rowsByMenuId[selected.id] ?? [])
      .filter((r) => r.spender_tier === spender)
      .sort((a, b) => a.sort_order - b.sort_order || a.level - b.level);
  }, [bundle.rowsByMenuId, selected, spender]);

  const availableSpenders = React.useMemo(() => {
    if (!selected) return SPENDER_ORDER;
    const present = new Set(
      (bundle.rowsByMenuId[selected.id] ?? []).map((r) => r.spender_tier)
    );
    const list = SPENDER_ORDER.filter((s) => present.has(s));
    return list.length ? list : SPENDER_ORDER;
  }, [bundle.rowsByMenuId, selected]);

  React.useEffect(() => {
    if (!availableSpenders.includes(spender)) {
      setSpender(availableSpenders[0] as SpenderTier);
    }
  }, [availableSpenders, spender]);

  const warn = overlapWarn(rows);

  const bestSuggestions = React.useMemo(() => {
    const byLegacy = new Map<string, LinkSuggestion>();
    for (const s of bundle.suggestions) {
      const cur = byLegacy.get(s.legacy_name);
      if (!cur || (s.score ?? 0) > (cur.score ?? 0)) byLegacy.set(s.legacy_name, s);
    }
    return [...byLegacy.values()];
  }, [bundle.suggestions]);

  const saveRowPatch = async (row: PriceMenuRow, patch: Partial<PriceMenuRow>) => {
    if (!canManage || !selected) return;
    setSaving(true);
    try {
      await api(`/api/price-menus/${selected.id}/rows`, {
        method: "POST",
        body: JSON.stringify({
          id: row.id,
          spender_tier: row.spender_tier,
          level: patch.level ?? row.level,
          ...patch,
        }),
      });
      await refresh();
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  const startEdit = (row: PriceMenuRow, field: string, initialValue: string) => {
    if (!canManage) return;
    setEditingCell({ rowId: row.id, field });
    setDraft(initialValue);
    setDirty(true);
  };

  const commitEdit = async (row: PriceMenuRow) => {
    if (!editingCell) return;
    const field = editingCell.field;
    const patch: Partial<PriceMenuRow> = {};
    if (field === "price_min" || field === "price_max" || field === "neg_min" || field === "neg_max") {
      const n = draft.trim() === "" ? null : Number(draft);
      if (draft.trim() !== "" && !Number.isFinite(n)) {
        toast.error("Invalid number");
        return;
      }
      (patch as Record<string, unknown>)[field] = n;
    } else if (field === "description" || field === "notes" || field === "neg_text") {
      (patch as Record<string, unknown>)[field] = draft;
    } else if (field === "level") {
      patch.level = Number(draft) || row.level;
    }
    await saveRowPatch(row, patch);
  };

  const addLevel = async () => {
    if (!selected || !canManage) return;
    const nextLevel = (rows[rows.length - 1]?.level ?? 0) + 1;
    setSaving(true);
    try {
      await api(`/api/price-menus/${selected.id}/rows`, {
        method: "POST",
        body: JSON.stringify({
          spender_tier: spender,
          level: nextLevel,
          price_min: null,
          price_max: null,
          price_plus: false,
          description: "",
          notes: "",
        }),
      });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setSaving(false);
    }
  };

  const moveRow = async (row: PriceMenuRow, dir: -1 | 1) => {
    if (!selected || !canManage) return;
    const idx = rows.findIndex((r) => r.id === row.id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= rows.length) return;
    const ordered = rows.map((r) => r.id);
    const tmp = ordered[idx];
    ordered[idx] = ordered[j];
    ordered[j] = tmp;
    try {
      await api(`/api/price-menus/${selected.id}/rows`, {
        method: "POST",
        body: JSON.stringify({ action: "reorder", ordered_ids: ordered }),
      });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reorder failed");
    }
  };

  const openHistory = async () => {
    if (!selected) return;
    setHistoryOpen(true);
    try {
      const data = await api<{ changes: PriceMenuChange[] }>(
        `/api/price-menus/history?menu_id=${encodeURIComponent(selected.id)}`
      );
      setHistory(data.changes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "History failed");
    }
  };

  const undo = async () => {
    if (!selected || !canManage) return;
    try {
      const r = await api<{ undone: boolean }>("/api/price-menus/history", {
        method: "POST",
        body: JSON.stringify({ action: "undo", menu_id: selected.id }),
      });
      if (!r.undone) toast.message("Nothing to undo");
      else {
        toast.success("Undone");
        await refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Undo failed");
    }
  };

  const previewAdjust = async () => {
    if (!selected) return;
    try {
      const r = await api<{
        preview: { row_id: string; field: string; before: string; after: string }[];
      }>(`/api/price-menus/${selected.id}/bulk`, {
        method: "POST",
        body: JSON.stringify({
          action: "adjust",
          preview: true,
          mode: adjustMode,
          amount: Number(adjustAmount) || 0,
          target: adjustTarget,
          round_to: adjustRound,
        }),
      });
      setBulkPreview(r.preview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  };

  const applyAdjust = async () => {
    if (!selected) return;
    try {
      await api(`/api/price-menus/${selected.id}/bulk`, {
        method: "POST",
        body: JSON.stringify({
          action: "adjust",
          preview: false,
          mode: adjustMode,
          amount: Number(adjustAmount) || 0,
          target: adjustTarget,
          round_to: adjustRound,
        }),
      });
      toast.success("Prices adjusted");
      setBulkPreview(null);
      setBulkOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apply failed");
    }
  };

  const duplicateToOtherMarket = async () => {
    if (!selected || !canManage) return;
    const target = selected.market === "greece" ? "usa" : "greece";
    try {
      await api(`/api/price-menus/${selected.id}/bulk`, {
        method: "POST",
        body: JSON.stringify({
          action: "duplicate",
          target_market: target,
          translate_en: target === "usa",
          multiplier: 1,
          round_to: 1,
        }),
      });
      toast.success(`Duplicated to ${target.toUpperCase()}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    }
  };

  const linkModels = async (force = false) => {
    if (!selected || !selectedModelIds.length) return;
    try {
      const r = await api<{
        linked: string[];
        conflicts?: { model_name: string; other_menu_name: string }[];
        needs_confirm?: boolean;
      }>(`/api/price-menus/${selected.id}/link`, {
        method: "POST",
        body: JSON.stringify({ model_ids: selectedModelIds, force_move: force }),
      });
      if (r.needs_confirm && r.conflicts?.length) {
        const ok = window.confirm(
          `${r.conflicts.length} model(s) already on another menu. Move them?\n` +
            r.conflicts.map((c) => `${c.model_name} → ${c.other_menu_name}`).join("\n")
        );
        if (ok) await linkModels(true);
        return;
      }
      toast.success(`Linked ${r.linked.length} model(s)`);
      setLinkOpen(false);
      setSelectedModelIds([]);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Link failed");
    }
  };

  const acceptSuggestion = async (s: LinkSuggestion) => {
    try {
      await api("/api/price-menus/suggestions", {
        method: "POST",
        body: JSON.stringify({ id: s.id, action: "accept" }),
      });
      toast.success(`Linked ${s.legacy_name} → ${s.suggested_model_name}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Accept failed");
    }
  };

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
      active
        ? "border-amber-400/50 bg-amber-500/20 text-amber-50"
        : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/85"
    );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-4 backdrop-blur-xl md:flex-row md:flex-wrap md:items-center">
        <div className="flex flex-wrap gap-2">
          {(["all", "greece", "usa"] as const).map((k) => (
            <button key={k} type="button" className={chip(market === k)} onClick={() => setMarket(k)}>
              {k === "all" ? "All" : k === "greece" ? "Greece" : "USA"}
            </button>
          ))}
        </div>
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menus"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="relative min-w-[160px] flex-1">
          <input
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            placeholder="Filter by model"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-500/40"
          />
        </div>
        {dirty ? (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            Unsaved edits
          </span>
        ) : null}
      </div>

      {/* Unlinked banner */}
      {canManage && bundle.unlinkedActiveModels.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4">
          <p className="text-sm font-semibold text-amber-100">
            {bundle.unlinkedActiveModels.length} active models have no price menu
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {bundle.unlinkedActiveModels.slice(0, 12).map((m) => (
              <span
                key={m.id}
                className="rounded-full border border-amber-500/25 bg-black/20 px-2.5 py-1 text-xs text-amber-50/90"
              >
                {m.model_name}
              </span>
            ))}
          </div>
          {bestSuggestions.length > 0 ? (
            <div className="mt-3 space-y-2 border-t border-amber-500/20 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200/70">
                Suggested matches (approve)
              </p>
              {bestSuggestions.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
                >
                  <p className="text-sm text-white/80">
                    <span className="font-medium text-white">{s.legacy_name}</span>
                    <span className="text-white/40"> → </span>
                    {s.suggested_model_name}
                    <span className="ml-2 text-[10px] text-white/40">d={s.distance}</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => acceptSuggestion(s)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-100"
                    >
                      <Check className="h-3 w-3" /> Assign
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await api("/api/price-menus/suggestions", {
                          method: "POST",
                          body: JSON.stringify({ id: s.id, action: "dismiss" }),
                        });
                        await refresh();
                      }}
                      className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Menu list */}
        <aside className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-xl">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
            Menus
          </p>
          <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {menus.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                    selected?.id === m.id
                      ? "border-amber-400/40 bg-amber-500/10"
                      : "border-transparent bg-white/[0.03] hover:border-white/10"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <MarketBadge market={m.market} />
                      <span className="truncate text-sm font-semibold text-white">{m.name}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      {m.models.slice(0, 4).map((x) => (
                        <Avatar key={x.model_id} name={x.model_name} />
                      ))}
                      <span className="ml-1 text-[11px] text-white/45">{m.model_count}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Detail */}
        <section className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-4 backdrop-blur-xl md:p-5">
          {!selected ? (
            <p className="py-16 text-center text-sm text-white/40">Select a price menu</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight text-white">
                      {selected.name}
                    </h2>
                    <MarketBadge market={selected.market} />
                    {!selected.is_active ? (
                      <span className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] uppercase text-white/45">
                        Archived
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.models.map((m) => (
                      <span
                        key={m.model_id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 py-0.5 pl-0.5 pr-2 text-[11px] text-white/80"
                      >
                        <Avatar name={m.model_name} />
                        {m.model_name}
                        {canManage ? (
                          <button
                            type="button"
                            className="text-white/35 hover:text-rose-300"
                            onClick={async () => {
                              await api(`/api/price-menus/${selected.id}/link`, {
                                method: "POST",
                                body: JSON.stringify({
                                  action: "unlink",
                                  model_id: m.model_id,
                                }),
                              });
                              await refresh();
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLinkOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85"
                    >
                      <Link2 className="h-3.5 w-3.5" /> Link models
                    </button>
                    <button
                      type="button"
                      onClick={duplicateToOtherMarket}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85"
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
                    >
                      Bulk tools
                    </button>
                    <button
                      type="button"
                      onClick={undo}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85"
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Undo
                    </button>
                    <button
                      type="button"
                      onClick={openHistory}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85"
                    >
                      <History className="h-3.5 w-3.5" /> History
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Archive “${selected.name}”?`)) return;
                        await api(`/api/price-menus/${selected.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ archive: true }),
                        });
                        await refresh();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100"
                    >
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Spender tabs */}
              <div className="flex flex-wrap gap-2">
                {availableSpenders.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={chip(spender === s)}
                    onClick={() => setSpender(s as SpenderTier)}
                  >
                    {spenderLabel(s)}
                  </button>
                ))}
              </div>

              {warn ? (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                  {warn}
                </p>
              ) : null}

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04] text-[11px] font-bold uppercase tracking-wider text-white/45">
                      <th className="px-3 py-2.5">Lvl</th>
                      <th className="px-3 py-2.5">Normal</th>
                      <th className="px-3 py-2.5">+</th>
                      <th className="px-3 py-2.5">Negotiation</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5">Notes</th>
                      {canManage ? <th className="px-3 py-2.5" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-white/40">
                          No levels for this spender tier.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                          <td className="px-3 py-2 font-mono text-white/70">
                            {editingCell?.rowId === row.id && editingCell.field === "level" ? (
                              <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => commitEdit(row)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void commitEdit(row);
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                                className="w-14 rounded border border-amber-500/40 bg-black/40 px-1 py-0.5"
                              />
                            ) : (
                              <button
                                type="button"
                                className="text-left"
                                onClick={() => startEdit(row, "level", String(row.level))}
                              >
                                {row.level}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-white/90">
                            {editingCell?.rowId === row.id &&
                            (editingCell.field === "price_min" || editingCell.field === "price_max") ? (
                              <div className="flex items-center gap-1">
                                <input
                                  autoFocus={editingCell.field === "price_min"}
                                  value={editingCell.field === "price_min" ? draft : String(row.price_min ?? "")}
                                  onChange={(e) => {
                                    if (editingCell.field === "price_min") setDraft(e.target.value);
                                  }}
                                  onFocus={() => startEdit(row, "price_min", String(row.price_min ?? ""))}
                                  onBlur={() => {
                                    if (editingCell.field === "price_min") void commitEdit(row);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void commitEdit(row);
                                    if (e.key === "Tab") {
                                      e.preventDefault();
                                      void commitEdit(row).then(() =>
                                        startEdit(row, "price_max", String(row.price_max ?? ""))
                                      );
                                    }
                                    if (e.key === "Escape") setEditingCell(null);
                                  }}
                                  className="w-14 rounded border border-amber-500/40 bg-black/40 px-1 py-0.5"
                                  placeholder="min"
                                />
                                <span className="text-white/30">–</span>
                                <input
                                  value={
                                    editingCell.field === "price_max"
                                      ? draft
                                      : String(row.price_max ?? "")
                                  }
                                  onChange={(e) => {
                                    if (editingCell.field === "price_max") setDraft(e.target.value);
                                  }}
                                  onFocus={() => startEdit(row, "price_max", String(row.price_max ?? ""))}
                                  onBlur={() => {
                                    if (editingCell.field === "price_max") void commitEdit(row);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void commitEdit(row);
                                    if (e.key === "Escape") setEditingCell(null);
                                  }}
                                  className="w-14 rounded border border-amber-500/40 bg-black/40 px-1 py-0.5"
                                  placeholder="max"
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="text-left font-medium"
                                onClick={() =>
                                  startEdit(row, "price_min", String(row.price_min ?? ""))
                                }
                              >
                                {rowNormalLabel(row)}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => saveRowPatch(row, { price_plus: !row.price_plus })}
                                className={cn(
                                  "rounded-md border px-1.5 py-0.5 text-[11px] font-bold",
                                  row.price_plus
                                    ? "border-amber-400/40 bg-amber-500/20 text-amber-100"
                                    : "border-white/10 text-white/35"
                                )}
                              >
                                +
                              </button>
                            ) : row.price_plus ? (
                              <span className="text-amber-200">+</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.neg_text && row.neg_min == null ? (
                              <button
                                type="button"
                                onClick={() => startEdit(row, "neg_text", row.neg_text ?? "")}
                                className="rounded-md border border-white/15 bg-white/8 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-white/55"
                              >
                                {editingCell?.rowId === row.id && editingCell.field === "neg_text" ? (
                                  <input
                                    autoFocus
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onBlur={() => commitEdit(row)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") void commitEdit(row);
                                      if (e.key === "Escape") setEditingCell(null);
                                    }}
                                    className="w-20 bg-transparent outline-none"
                                  />
                                ) : (
                                  row.neg_text
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-left text-white/80"
                                onClick={() =>
                                  startEdit(row, "neg_min", String(row.neg_min ?? ""))
                                }
                              >
                                {rowNegLabel(row)}
                              </button>
                            )}
                          </td>
                          <td className="max-w-[220px] px-3 py-2 text-white/65">
                            {editingCell?.rowId === row.id && editingCell.field === "description" ? (
                              <textarea
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => commitEdit(row)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                                className="w-full rounded border border-amber-500/40 bg-black/40 px-2 py-1 text-sm"
                                rows={2}
                              />
                            ) : (
                              <button
                                type="button"
                                className="text-left"
                                onClick={() => startEdit(row, "description", row.description)}
                              >
                                {row.description || "—"}
                              </button>
                            )}
                          </td>
                          <td className="max-w-[180px] px-3 py-2 text-white/50">
                            {editingCell?.rowId === row.id && editingCell.field === "notes" ? (
                              <textarea
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => commitEdit(row)}
                                className="w-full rounded border border-amber-500/40 bg-black/40 px-2 py-1 text-sm"
                                rows={2}
                              />
                            ) : (
                              <button
                                type="button"
                                className="text-left"
                                onClick={() => startEdit(row, "notes", row.notes)}
                                title={row.notes}
                              >
                                {row.notes ? "ⓘ" : "—"}
                              </button>
                            )}
                          </td>
                          {canManage ? (
                            <td className="px-2 py-2">
                              <div className="flex flex-col gap-0.5">
                                <button type="button" onClick={() => moveRow(row, -1)} className="text-white/40 hover:text-white">
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={() => moveRow(row, 1)} className="text-white/40 hover:text-white">
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="text-rose-300/70 hover:text-rose-200"
                                  onClick={async () => {
                                    if (!window.confirm("Delete level?")) return;
                                    await api(`/api/price-menus/${selected.id}/rows`, {
                                      method: "POST",
                                      body: JSON.stringify({ action: "delete", row_id: row.id }),
                                    });
                                    await refresh();
                                  }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {canManage ? (
                <button
                  type="button"
                  onClick={addLevel}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85"
                >
                  <Plus className="h-3.5 w-3.5" /> Add level
                </button>
              ) : null}

              {/* Specials */}
              <div className="pt-2">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/45">
                  Specials
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {bundle.specials
                    .filter(
                      (s) =>
                        s.market === "all" ||
                        s.market === selected.market ||
                        (selected.market === "greece" && s.market === "greece")
                    )
                    .map((s: PriceMenuSpecial) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-4"
                      >
                        <p className="font-bold text-white">{s.label}</p>
                        <p className="mt-1 text-sm text-white/70">
                          {rowNormalLabel({
                            ...rows[0],
                            price_min: s.price_min,
                            price_max: s.price_max,
                            price_plus: s.price_plus,
                            raw_price_normal: s.raw_price_normal,
                            neg_min: null,
                            neg_max: null,
                            neg_text: null,
                            raw_price_negotiation: "",
                          } as PriceMenuRow)}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-white/55">{s.description}</p>
                        <span className="mt-3 inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                          {s.applies_to_all ? "ALL" : s.model_names.join(", ") || "—"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Link models modal */}
      {linkOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-[#121218] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="font-semibold text-white">Link models to {selected.name}</h3>
              <button type="button" onClick={() => setLinkOpen(false)}>
                <X className="h-4 w-4 text-white/50" />
              </button>
            </div>
            <div className="border-b border-white/10 px-4 py-2">
              <label className="flex items-center gap-2 text-xs text-white/55">
                <input
                  type="checkbox"
                  checked={showInactiveModels}
                  onChange={(e) => setShowInactiveModels(e.target.checked)}
                />
                Show inactive
              </label>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {(bundle.allModels as UnlinkedModel[])
                .filter((m) => showInactiveModels || m.status === "active")
                .sort((a, b) => {
                  if (a.status === "active" && b.status !== "active") return -1;
                  if (b.status === "active" && a.status !== "active") return 1;
                  return a.model_name.localeCompare(b.model_name);
                })
                .map((m) => (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={selectedModelIds.includes(m.id)}
                        onChange={(e) => {
                          setSelectedModelIds((prev) =>
                            e.target.checked
                              ? [...prev, m.id]
                              : prev.filter((x) => x !== m.id)
                          );
                        }}
                      />
                      <Avatar name={m.model_name} />
                      <span className="text-sm text-white">{m.model_name}</span>
                      {m.status !== "active" ? (
                        <span className="text-[10px] uppercase text-white/35">inactive</span>
                      ) : null}
                    </label>
                  </li>
                ))}
            </ul>
            <div className="flex justify-end gap-2 border-t border-white/10 p-3">
              <button
                type="button"
                onClick={() => setLinkOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => linkModels(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-50"
              >
                <Save className="h-3.5 w-3.5" /> Link selected
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bulk modal */}
      {bulkOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border border-white/15 bg-[#121218] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">Bulk adjust — {selected.name}</h3>
              <button type="button" onClick={() => setBulkOpen(false)}>
                <X className="h-4 w-4 text-white/50" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1 text-white/60">
                Mode
                <select
                  value={adjustMode}
                  onChange={(e) => setAdjustMode(e.target.value as typeof adjustMode)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-white"
                >
                  <option value="percent">Percent</option>
                  <option value="add">Add</option>
                  <option value="subtract">Subtract</option>
                </select>
              </label>
              <label className="space-y-1 text-white/60">
                Amount
                <input
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-white"
                />
              </label>
              <label className="space-y-1 text-white/60">
                Target
                <select
                  value={adjustTarget}
                  onChange={(e) => setAdjustTarget(e.target.value as typeof adjustTarget)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="neg">Negotiation</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label className="space-y-1 text-white/60">
                Round
                <select
                  value={adjustRound ?? ""}
                  onChange={(e) =>
                    setAdjustRound(
                      e.target.value === "" ? null : (Number(e.target.value) as 1 | 5 | 10)
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-white"
                >
                  <option value="1">1</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={previewAdjust}
                className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={applyAdjust}
                disabled={!bulkPreview?.length}
                className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-50 disabled:opacity-40"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={async () => {
                  const r = await api<{
                    preview: { row_id: string; before: string; after: string }[];
                  }>(`/api/price-menus/${selected.id}/bulk`, {
                    method: "POST",
                    body: JSON.stringify({
                      action: "fill_neg",
                      percent: 85,
                      preview: true,
                    }),
                  });
                  setBulkPreview(
                    r.preview.map((p) => ({
                      row_id: p.row_id,
                      field: "price_negotiation",
                      before: p.before,
                      after: p.after,
                    }))
                  );
                }}
                className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80"
              >
                Fill neg from normal (85%)
              </button>
            </div>
            {bulkPreview ? (
              <div className="mt-4 max-h-48 overflow-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/45">
                      <th className="px-2 py-1">Field</th>
                      <th className="px-2 py-1">Before</th>
                      <th className="px-2 py-1">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.slice(0, 40).map((p, i) => (
                      <tr key={`${p.row_id}-${p.field}-${i}`} className="border-b border-white/5">
                        <td className="px-2 py-1 text-white/50">{p.field}</td>
                        <td className="px-2 py-1 text-white/70">{p.before}</td>
                        <td className="px-2 py-1 text-emerald-200">{p.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* History drawer */}
      {historyOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0e0e14] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">History</h3>
              <button type="button" onClick={() => setHistoryOpen(false)}>
                <X className="h-4 w-4 text-white/50" />
              </button>
            </div>
            <ul className="space-y-2">
              {history.length === 0 ? (
                <li className="text-sm text-white/40">No changes yet.</li>
              ) : (
                history.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
                  >
                    <p className="font-semibold text-white/85">
                      {c.actor_name || c.actor_id} · {c.field}
                    </p>
                    <p className="mt-1 text-white/45">
                      {c.before_value ?? "∅"} → {c.after_value ?? "∅"}
                    </p>
                    <p className="mt-1 text-white/30">{c.created_at}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
