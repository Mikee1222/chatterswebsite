"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon } from "lucide-react";
import { VA_FILTER_INPUT, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export type TypeCount = { type: string; count: number };

const TX_TYPE_LABELS: Record<string, string> = {
  Subscription: "Subscriptions",
  RecurringSubscription: "Recurring",
  Tips: "Tips",
  Messages: "PPVs / Messages",
  Streams: "Streams",
  unknown: "Unknown",
};

const LINK_TYPE_LABELS: Record<string, string> = {
  CAMPAIGN: "Campaign",
  TRIAL: "Trial",
  TRACKING: "Tracking",
};

export function formatTxTypeLabel(type: string): string {
  return TX_TYPE_LABELS[type] ?? type;
}

export function formatLinkTypeLabel(type: string): string {
  return LINK_TYPE_LABELS[type] ?? type;
}

/** Multi-select type chips. Empty `selected` = All. */
export function TypeFilterChips({
  types,
  selected,
  onChange,
  totalCount,
  labelFn,
}: {
  types: TypeCount[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  totalCount: number;
  labelFn?: (type: string) => string;
}) {
  const allActive = selected.size === 0;
  const label = labelFn ?? ((t: string) => t);

  function toggle(type: string) {
    const next = new Set(selected);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(new Set())}
        className={cn(
          "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
          allActive
            ? "border-[#D4AF8C]/50 bg-[#D4AF8C]/15 text-[#D4AF8C]"
            : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/75"
        )}
      >
        All
        <span className="ml-1.5 tabular-nums text-white/40">{totalCount}</span>
      </button>
      {types.map((t) => {
        const active = selected.has(t.type);
        return (
          <button
            key={t.type}
            type="button"
            onClick={() => toggle(t.type)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
              active
                ? "border-[#FF1493]/45 bg-[#FF1493]/15 text-pink-100"
                : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/75"
            )}
          >
            {label(t.type)}
            <span className={cn("ml-1.5 tabular-nums", active ? "text-pink-200/70" : "text-white/40")}>
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ModelFilterSelect({
  models,
  value,
  onChange,
  className,
}: {
  models: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(VA_FILTER_INPUT, "min-w-[160px]", className)}
    >
      <option value="">All models</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

export function ListPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= 0) return null;
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-white/35">
        Showing {from}–{to} of {total}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          <span className="min-w-[6.5rem] text-center text-xs tabular-nums text-white/50">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CollapsibleGroupHeader({
  open,
  onToggle,
  title,
  meta,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  meta: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 border-b border-white/8 bg-white/[0.02] px-4 py-3 text-left transition hover:bg-white/[0.04]"
    >
      {open ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-[#D4AF8C]" />
      ) : (
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-white/35" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs text-white/40">{meta}</p>
      </div>
    </button>
  );
}

export function TxStatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "done") {
    return (
      <span className={cn(VA_STATUS_BADGE, "border-emerald-500/30 bg-emerald-500/10 text-emerald-300")}>
        Done
      </span>
    );
  }
  if (s === "loading") {
    return (
      <span
        className={cn(
          VA_STATUS_BADGE,
          "border-amber-400/35 bg-amber-400/10 text-amber-200 animate-pulse"
        )}
      >
        Loading
      </span>
    );
  }
  if (s === "undo") {
    return (
      <span className={cn(VA_STATUS_BADGE, "border-white/15 bg-white/5 text-white/45")}>Undo</span>
    );
  }
  if (s === "pending_return") {
    return (
      <span className={cn(VA_STATUS_BADGE, "border-orange-400/30 bg-orange-400/10 text-orange-200")}>
        Pending
      </span>
    );
  }
  return (
    <span className={cn(VA_STATUS_BADGE, "border-white/10 bg-white/5 text-white/40")}>
      {status || "—"}
    </span>
  );
}

export function FinishedFlagBadge({ finished }: { finished: boolean }) {
  return finished ? (
    <span className={cn(VA_STATUS_BADGE, "border-white/15 bg-white/5 text-white/45")}>Finished</span>
  ) : (
    <span className={cn(VA_STATUS_BADGE, "border-emerald-500/30 bg-emerald-500/10 text-emerald-300")}>
      Active
    </span>
  );
}

export function TypeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-md border border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#D4AF8C]">
      {label}
    </span>
  );
}

export function groupItemsByKey<T>(
  items: T[],
  keyFn: (item: T) => string
): Array<{ key: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()].map(([key, groupItems]) => ({ key, items: groupItems }));
}

export function useClientPagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = React.useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const reset = React.useCallback(() => setPage(1), []);

  return { page: safePage, setPage, totalPages, pageItems, reset, total: items.length };
}

/** Empty set = all; otherwise item type must be in selected. */
export function matchesTypeFilter(type: string | null | undefined, selected: Set<string>): boolean {
  if (selected.size === 0) return true;
  const t = (type ?? "unknown").trim() || "unknown";
  return selected.has(t);
}

export function countByType<T>(
  items: T[],
  typeFn: (item: T) => string | null | undefined
): TypeCount[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const t = (typeFn(item) ?? "unknown").trim() || "unknown";
    map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
