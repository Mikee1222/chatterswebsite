"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  FilterBar,
  FilterChip,
  ManagerReviewSelect,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_FILTER_INPUT,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import {
  applyDailyReviewPreset,
  DAILY_REVIEW_PRESETS,
  emptyDailyReviewFilters,
  hasActiveDailyReviewFilters,
  type DailyReviewFilterFacets,
  type DailyReviewFilters,
  type DailyReviewPreset,
  type DailyReviewSort,
} from "@/lib/daily-review-filters";
import { TASK_STEP_TYPES } from "@/lib/task-step-types";
import { cn } from "@/lib/utils";

const PRESET_LABELS: Record<DailyReviewPreset, string> = {
  needs_review: "Needs my review",
  flagged: "Flagged",
  incomplete: "Incomplete",
  missing_screenshots: "Missing screenshots",
  not_informed: "Not informed yet",
};

const SORT_OPTIONS: CustomSelectOption[] = [
  { value: "person", label: "Sort: Person" },
  { value: "completion", label: "Sort: Completion %" },
  { value: "flagged", label: "Sort: Flagged count" },
  { value: "model", label: "Sort: Model" },
];

function MultiCheckDropdown({
  label,
  options,
  selected,
  onChange,
  searchable,
}: {
  label: string;
  options: Array<{ value: string; label: string; count?: number }>;
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const count = selected.length;

  return (
    <div ref={rootRef} className="relative min-w-[9.5rem]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          VA_FILTER_INPUT,
          "inline-flex h-10 w-full min-w-[9.5rem] items-center justify-between gap-2 px-3 text-left text-sm",
          count > 0 && "border-[#FF1493]/40 bg-[#FF1493]/[0.08]",
        )}
        aria-expanded={open}
      >
        <span className="truncate text-[#B8B4B8]/80">
          {label}
          {count > 0 ? ` (${count})` : ""}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#B8B4B8]/45" aria-hidden />
      </button>
      {open ? (
        <div className="absolute left-0 z-40 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-white/12 bg-[#121012] p-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.75)]">
          {searchable ? (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className={cn(VA_FILTER_INPUT, "h-9 w-full pl-8 text-xs")}
              />
            </div>
          ) : null}
          <div className="max-h-52 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-white/40">No options for this day</p>
            ) : (
              filtered.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5",
                      checked && "bg-[#FF1493]/10",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        checked
                          ? "border-[#FF1493]/55 bg-[#FF1493]/25 text-white"
                          : "border-white/20 text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => {
                        const set = new Set(selected);
                        if (set.has(opt.value)) set.delete(opt.value);
                        else set.add(opt.value);
                        onChange([...set]);
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-white/85">{opt.label}</span>
                    {typeof opt.count === "number" ? (
                      <span className="text-[10px] text-white/35">{opt.count}</span>
                    ) : null}
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FiltersSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0D0B0D] p-5 pb-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Filters</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        <button
          type="button"
          className={cn(VA_BTN_PRIMARY, "mt-6 w-full min-h-12")}
          onClick={onClose}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

type Props = {
  filters: DailyReviewFilters;
  facets: DailyReviewFilterFacets;
  onChange: (next: DailyReviewFilters) => void;
  className?: string;
};

export function DailyReviewFiltersBar({ filters, facets, onChange, className }: Props) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [searchDraft, setSearchDraft] = React.useState(filters.q);
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  function patch(partial: Partial<DailyReviewFilters>) {
    const next = { ...filters, ...partial };
    // Choosing concrete filters clears preset unless preset itself is being set.
    if (!("preset" in partial) && next.preset) next.preset = "";
    onChange(next);
  }

  function setPreset(preset: DailyReviewPreset | "") {
    if (!preset) {
      onChange(emptyDailyReviewFilters());
      return;
    }
    onChange(applyDailyReviewPreset({ ...emptyDailyReviewFilters(), preset }));
  }

  function onSearchInput(value: string) {
    setSearchDraft(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      patch({ q: value });
    }, 300);
  }

  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.preset) {
    chips.push({
      key: "preset",
      label: PRESET_LABELS[filters.preset],
      clear: () => setPreset(""),
    });
  }
  for (const role of filters.roles) {
    const label = facets.roles.find((r) => r.value === role)?.label ?? role;
    chips.push({
      key: `role-${role}`,
      label: `Role: ${label}`,
      clear: () => patch({ roles: filters.roles.filter((r) => r !== role) }),
    });
  }
  for (const id of filters.people) {
    const label = facets.people.find((p) => p.value === id)?.label ?? id;
    chips.push({
      key: `person-${id}`,
      label: `Person: ${label}`,
      clear: () => patch({ people: filters.people.filter((p) => p !== id) }),
    });
  }
  for (const id of filters.models) {
    const label = facets.models.find((m) => m.value === id)?.label ?? id;
    chips.push({
      key: `model-${id}`,
      label: `Model: ${label}`,
      clear: () => patch({ models: filters.models.filter((m) => m !== id) }),
    });
  }
  for (const s of filters.review_status) {
    chips.push({
      key: `review-${s}`,
      label: `Review: ${s}`,
      clear: () =>
        patch({ review_status: filters.review_status.filter((x) => x !== s) }),
    });
  }
  for (const s of filters.task_state) {
    chips.push({
      key: `task-${s}`,
      label: `Task: ${s.replace(/_/g, " ")}`,
      clear: () => patch({ task_state: filters.task_state.filter((x) => x !== s) }),
    });
  }
  for (const p of filters.phases) {
    chips.push({
      key: `phase-${p}`,
      label: `Phase: ${p}`,
      clear: () => patch({ phases: filters.phases.filter((x) => x !== p) }),
    });
  }
  for (const p of filters.platforms) {
    chips.push({
      key: `plat-${p}`,
      label: `Platform: ${p}`,
      clear: () => patch({ platforms: filters.platforms.filter((x) => x !== p) }),
    });
  }
  for (const t of filters.item_types) {
    chips.push({
      key: `type-${t}`,
      label: `Type: ${t}`,
      clear: () => patch({ item_types: filters.item_types.filter((x) => x !== t) }),
    });
  }
  if (filters.evidence) {
    chips.push({
      key: "evidence",
      label: filters.evidence === "has" ? "Has screenshot" : "Missing screenshot",
      clear: () => patch({ evidence: "" }),
    });
  }
  if (filters.informed) {
    chips.push({
      key: "informed",
      label: filters.informed === "not_informed" ? "Not informed yet" : "Informed",
      clear: () => patch({ informed: "" }),
    });
  }
  if (filters.q.trim()) {
    chips.push({
      key: "q",
      label: `Search: ${filters.q.trim()}`,
      clear: () => patch({ q: "" }),
    });
  }
  if (filters.sort !== "person") {
    chips.push({
      key: "sort",
      label: SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort,
      clear: () => patch({ sort: "person" }),
    });
  }

  const filterControls = (
    <>
      <MultiCheckDropdown
        label="Role"
        options={facets.roles}
        selected={filters.roles}
        onChange={(roles) => patch({ roles })}
      />
      <MultiCheckDropdown
        label="Person"
        options={facets.people}
        selected={filters.people}
        onChange={(people) => patch({ people })}
        searchable
      />
      <MultiCheckDropdown
        label="Model"
        options={facets.models}
        selected={filters.models}
        onChange={(models) => patch({ models })}
        searchable
      />
      <MultiCheckDropdown
        label="Review status"
        options={[
          { value: "pending", label: "Pending" },
          { value: "verified", label: "Verified" },
          { value: "flagged", label: "Flagged / Not done" },
        ]}
        selected={filters.review_status}
        onChange={(review_status) =>
          patch({ review_status: review_status as DailyReviewFilters["review_status"] })
        }
      />
      <MultiCheckDropdown
        label="Task state"
        options={[
          { value: "completed", label: "Completed" },
          { value: "in_progress", label: "In progress" },
          { value: "not_started", label: "Not started" },
        ]}
        selected={filters.task_state}
        onChange={(task_state) =>
          patch({ task_state: task_state as DailyReviewFilters["task_state"] })
        }
      />
      <MultiCheckDropdown
        label="Phase"
        options={facets.phases}
        selected={filters.phases}
        onChange={(phases) => patch({ phases })}
      />
      <MultiCheckDropdown
        label="Platform"
        options={
          facets.platforms.length
            ? facets.platforms
            : [
                { value: "Instagram", label: "Instagram" },
                { value: "TikTok", label: "TikTok" },
                { value: "Facebook", label: "Facebook" },
                { value: "Snapchat", label: "Snapchat" },
              ]
        }
        selected={filters.platforms}
        onChange={(platforms) =>
          patch({ platforms: platforms as DailyReviewFilters["platforms"] })
        }
      />
      <MultiCheckDropdown
        label="Item type"
        options={
          facets.item_types.length
            ? facets.item_types
            : TASK_STEP_TYPES.map((t) => ({ value: t, label: t }))
        }
        selected={filters.item_types}
        onChange={(item_types) =>
          patch({ item_types: item_types as DailyReviewFilters["item_types"] })
        }
      />
      <MultiCheckDropdown
        label="Evidence"
        options={[
          { value: "has", label: "Has screenshot" },
          { value: "missing", label: "Missing screenshot" },
        ]}
        selected={filters.evidence ? [filters.evidence] : []}
        onChange={(vals) => {
          const last = vals[vals.length - 1] as DailyReviewFilters["evidence"] | undefined;
          patch({ evidence: last === "has" || last === "missing" ? last : "" });
        }}
      />
      <MultiCheckDropdown
        label="Informed"
        options={[
          { value: "not_informed", label: "Not informed yet" },
          { value: "informed", label: "Informed" },
        ]}
        selected={filters.informed ? [filters.informed] : []}
        onChange={(vals) => {
          const last = vals[vals.length - 1] as DailyReviewFilters["informed"] | undefined;
          patch({
            informed: last === "not_informed" || last === "informed" ? last : "",
          });
        }}
      />
      <div className="min-w-[10rem]">
        <ManagerReviewSelect
          value={filters.sort}
          onChange={(v) => patch({ sort: (v || "person") as DailyReviewSort })}
          options={SORT_OPTIONS}
        />
      </div>
    </>
  );

  return (
    <FilterBar className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={searchDraft}
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder="Search task or item titles…"
            className={cn(VA_FILTER_INPUT, "w-full min-h-11 pl-9")}
          />
        </div>
        <button
          type="button"
          className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-2 px-4 md:hidden")}
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveDailyReviewFilters(filters) ? (
            <span className="rounded-md bg-[#FF1493]/20 px-1.5 text-[10px] font-semibold text-[#FF1493]">
              On
            </span>
          ) : null}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {DAILY_REVIEW_PRESETS.map((preset) => {
          const active = filters.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setPreset(active ? "" : preset)}
              className={cn(
                VA_BTN_SECONDARY,
                "min-h-9 px-3 py-1.5 text-xs",
                active && "border-[#FF1493]/45 bg-[#FF1493]/12 text-white",
              )}
            >
              {PRESET_LABELS[preset]}
            </button>
          );
        })}
      </div>

      <div className="hidden flex-wrap items-end gap-2 md:flex">
        <Filter className="mb-2.5 h-4 w-4 text-white/35" aria-hidden />
        {filterControls}
      </div>

      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <FilterChip key={c.key} label={c.label} onRemove={c.clear} />
          ))}
          <button
            type="button"
            onClick={() => onChange(emptyDailyReviewFilters())}
            className="min-h-9 rounded-lg px-2 text-xs font-medium text-white/45 underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <FiltersSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="flex flex-col gap-3">{filterControls}</div>
      </FiltersSheet>
    </FilterBar>
  );
}
