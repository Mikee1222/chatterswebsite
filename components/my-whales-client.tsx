"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { RELATIONSHIP_STATUS_OPTIONS, WHALE_STATUS_OPTIONS } from "@/lib/airtable-options";
import { MyWhalesTable } from "@/components/my-whales-table";
import type { Whale } from "@/types";

function displayModelName(whale: Whale, modelNames: Record<string, string>): string {
  const snapshot = whale.assigned_model_name?.trim();
  if (snapshot && !/^rec[A-Za-z0-9]{14}$/.test(snapshot)) return snapshot;
  const resolved = whale.assigned_model_id && modelNames[whale.assigned_model_id]?.trim();
  if (resolved) return resolved;
  return "—";
}

type Props = {
  whales: Whale[];
  modelNames: Record<string, string>;
};

const CLIENT_PAGE_SIZE = 24;

export function MyWhalesClient({ whales, modelNames }: Props) {
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterRelationship, setFilterRelationship] = React.useState("");
  const [filterModel, setFilterModel] = React.useState("");
  const [filterSearch, setFilterSearch] = React.useState("");
  const [cardPage, setCardPage] = React.useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = whales;
    if (filterStatus) list = list.filter((w) => w.status === filterStatus);
    if (filterRelationship) list = list.filter((w) => w.relationship_status === filterRelationship);
    if (filterModel) list = list.filter((w) => displayModelName(w, modelNames) === filterModel);
    const q = filterSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (w) =>
          (w.username || "").toLowerCase().includes(q) ||
          (w.whale_id || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [whales, filterStatus, filterRelationship, filterModel, filterSearch, modelNames]);

  React.useEffect(() => {
    setCardPage(0);
  }, [filterStatus, filterRelationship, filterModel, filterSearch, whales]);

  const clientPageCount = Math.max(1, Math.ceil(filtered.length / CLIENT_PAGE_SIZE));
  const visibleWhales = filtered.slice(cardPage * CLIENT_PAGE_SIZE, (cardPage + 1) * CLIENT_PAGE_SIZE);
  const cardRangeStart = filtered.length === 0 ? 0 : cardPage * CLIENT_PAGE_SIZE + 1;
  const cardRangeEnd = Math.min((cardPage + 1) * CLIENT_PAGE_SIZE, filtered.length);

  const modelOptions = React.useMemo(() => {
    const names = new Set<string>();
    whales.forEach((w) => {
      const name = displayModelName(w, modelNames);
      if (name && name !== "—") names.add(name);
    });
    return [...names].sort();
  }, [whales, modelNames]);

  const statusFilterOptions = React.useMemo(
    () => [
      { value: "", label: "Status" },
      ...WHALE_STATUS_OPTIONS.map((o) => ({ value: o, label: o })),
    ],
    []
  );
  const relationshipFilterOptions = React.useMemo(
    () => [
      { value: "", label: "Relationship" },
      ...RELATIONSHIP_STATUS_OPTIONS.map((o) => ({ value: o, label: o })),
    ],
    []
  );
  const modelFilterOptions = React.useMemo(
    () => [
      { value: "", label: "Model" },
      ...modelOptions.map((o) => ({ value: o, label: o })),
    ],
    [modelOptions]
  );

  const stats = React.useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((w) => w.status === "Active").length;
    const inactive = filtered.filter((w) => w.status === "Inactive").length;
    const dead = filtered.filter((w) => w.status === "Dead").length;
    const deleted = filtered.filter((w) => w.status === "Deleted Account").length;
    return { total, active, inactive, dead, deleted };
  }, [filtered]);

  const activeFilterCount = React.useMemo(() => {
    let n = 0;
    if (filterStatus) n++;
    if (filterRelationship) n++;
    if (filterModel) n++;
    if (filterSearch.trim()) n++;
    return n;
  }, [filterStatus, filterRelationship, filterModel, filterSearch]);

  const clearAllFilters = () => {
    setFilterStatus("");
    setFilterRelationship("");
    setFilterModel("");
    setFilterSearch("");
    setMobileFiltersOpen(false);
  };

  const selectTriggerClass =
    "border-white/12 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-pink-400/25 hover:bg-white/[0.06]";

  const myFilterFields = (
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
            onChange={(e) => setFilterSearch(e.target.value)}
            className={cn(
              "h-11 w-full rounded-xl border py-0 pl-10 pr-4 text-sm text-white outline-none transition-all",
              "border-white/12 bg-black/35 placeholder:text-white/35",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
              "focus:border-pink-400/45 focus:bg-black/50 focus:ring-2 focus:ring-pink-500/20"
            )}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1 md:min-w-[150px]">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Status</p>
        <CustomSelect
          value={filterStatus}
          onChange={setFilterStatus}
          options={statusFilterOptions}
          triggerClassName={selectTriggerClass}
        />
      </div>
      <div className="min-w-0 flex-1 md:min-w-[150px]">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Relationship</p>
        <CustomSelect
          value={filterRelationship}
          onChange={setFilterRelationship}
          options={relationshipFilterOptions}
          triggerClassName={selectTriggerClass}
        />
      </div>
      <div className="min-w-0 flex-1 md:min-w-[170px]">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Model</p>
        <CustomSelect
          value={filterModel}
          onChange={setFilterModel}
          options={modelFilterOptions}
          triggerClassName={selectTriggerClass}
        />
      </div>
    </div>
  );

  const emptyStateType =
    filtered.length === 0 ? (whales.length === 0 ? "none" : "filters") : null;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total</p>
          <p className="mt-0.5 text-xl font-semibold text-white">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-300/80">Active</p>
          <p className="mt-0.5 text-xl font-semibold text-emerald-300">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-300/80">Inactive</p>
          <p className="mt-0.5 text-xl font-semibold text-amber-300">{stats.inactive}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Dead</p>
          <p className="mt-0.5 text-xl font-semibold text-white/90">{stats.dead}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Deleted account</p>
          <p className="mt-0.5 text-xl font-semibold text-white/90">{stats.deleted}</p>
        </div>
      </div>

      {/* Filters */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/[0.12] p-4 md:p-5",
          "bg-gradient-to-br from-pink-500/[0.09] via-violet-950/25 to-black/80",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-24px_rgba(236,72,153,0.18)]"
        )}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl"
          aria-hidden
        />
        <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
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

        <div className="relative hidden md:block">{myFilterFields}</div>
      </div>

      <AnimatePresence>
        {mobileFiltersOpen ? (
          <motion.div
            key="my-whale-filter-sheet"
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
              aria-labelledby="my-whale-filters-sheet-title"
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
              <p id="my-whale-filters-sheet-title" className="mb-4 text-sm font-semibold text-white">
                Filters
              </p>
              {myFilterFields}
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
        <MyWhalesTable
          whales={visibleWhales}
          modelNames={modelNames}
          emptyState={emptyStateType}
          onClearFilters={clearAllFilters}
        />
        {filtered.length > 0 ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">
              Showing cards {cardRangeStart}–{cardRangeEnd} of {filtered.length}
              {clientPageCount > 1 ? ` · page ${cardPage + 1} / ${clientPageCount}` : ""}
            </p>
            {clientPageCount > 1 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCardPage((p) => Math.max(0, p - 1))}
                  disabled={cardPage <= 0}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-pink-400/30 hover:bg-pink-500/10 disabled:pointer-events-none disabled:opacity-45"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCardPage((p) => Math.min(clientPageCount - 1, p + 1))}
                  disabled={cardPage >= clientPageCount - 1}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-pink-400/30 hover:bg-pink-500/10 disabled:pointer-events-none disabled:opacity-45"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
