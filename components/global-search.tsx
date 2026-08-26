"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  UserRound,
  Fish,
  FileText,
  Users,
  Layout,
  BookOpen,
  KeyRound,
  UserCheck,
  Trophy,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 280;

type SearchHit = { id: string; label: string; sublabel?: string; href: string };

type SearchResponse = {
  models: SearchHit[];
  people: SearchHit[];
  pages: SearchHit[];
  sops: SearchHit[];
  credentials: SearchHit[];
  candidates: SearchHit[];
  winners: SearchHit[];
  templates: SearchHit[];
  whales: SearchHit[];
  customs: SearchHit[];
};

type FlatResult = SearchHit & { group: string; icon: LucideIcon; accent: string };

const GROUPS: Array<{
  key: keyof SearchResponse;
  label: string;
  icon: LucideIcon;
  accent: string;
}> = [
  { key: "pages", label: "Pages", icon: Layout, accent: "text-violet-300/90" },
  { key: "models", label: "Models", icon: UserRound, accent: "text-sky-300/90" },
  { key: "people", label: "People", icon: Users, accent: "text-pink-300/90" },
  { key: "sops", label: "SOP functions", icon: BookOpen, accent: "text-emerald-300/90" },
  { key: "credentials", label: "Password Library", icon: KeyRound, accent: "text-amber-300/90" },
  { key: "candidates", label: "Candidates", icon: UserCheck, accent: "text-teal-300/90" },
  { key: "winners", label: "Winner Videos", icon: Trophy, accent: "text-yellow-300/90" },
  { key: "templates", label: "Task Templates", icon: ListTodo, accent: "text-indigo-300/90" },
  { key: "whales", label: "Whales", icon: Fish, accent: "text-cyan-300/90" },
  { key: "customs", label: "Custom requests", icon: FileText, accent: "text-orange-200/90" },
];

function emptyResponse(): SearchResponse {
  return {
    models: [],
    people: [],
    pages: [],
    sops: [],
    credentials: [],
    candidates: [],
    winners: [],
    templates: [],
    whales: [],
    customs: [],
  };
}

function flatten(data: SearchResponse | null): FlatResult[] {
  if (!data) return [];
  const out: FlatResult[] = [];
  for (const g of GROUPS) {
    for (const hit of data[g.key] ?? []) {
      out.push({ ...hit, group: g.label, icon: g.icon, accent: g.accent });
    }
  }
  return out;
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [data, setData] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (debounced.length === 0) {
      setData(emptyResponse());
      setLoading(false);
      setError(null);
      setActiveIndex(0);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || res.statusText);
        }
        return res.json() as Promise<SearchResponse>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setActiveIndex(0);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Search failed");
          setData(emptyResponse());
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  React.useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flat = React.useMemo(() => flatten(data), [data]);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmdk-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    setDebounced("");
    setData(null);
    setError(null);
    setActiveIndex(0);
  }, []);

  const navigate = React.useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [router, close],
  );

  const onKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[activeIndex];
      if (hit) navigate(hit.href);
    }
  };

  const total = flat.length;
  const showEmpty = open && debounced.length > 0 && !loading && !error && total === 0;

  let runningIndex = -1;

  const overlay =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-start justify-center bg-black/65 px-4 py-[min(10vh,4.5rem)] backdrop-blur-md"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div
          className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-[#1e1a28] to-[#14121c] shadow-[0_32px_100px_rgba(0,0,0,0.65),0_0_0_1px_rgba(233,30,140,0.12)]"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
            <Search className="h-5 w-5 shrink-0 text-[#e91e8c]/80" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              autoComplete="off"
              placeholder="Search models, people, pages, SOPs, credentials…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-white placeholder:text-white/35 outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDownInput}
              aria-autocomplete="list"
              aria-controls="command-palette-results"
            />
            <kbd className="hidden shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/45 sm:inline">
              Esc
            </kbd>
          </div>
          <div
            id="command-palette-results"
            ref={listRef}
            className="max-h-[min(62vh,480px)] overflow-y-auto px-2 py-3"
            role="listbox"
          >
            {error ? (
              <p className="px-2 py-6 text-center text-sm text-rose-300">{error}</p>
            ) : loading ? (
              <p className="px-2 py-6 text-center text-sm text-white/50">Searching…</p>
            ) : debounced.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm text-white/50">Type to search across the admin app</p>
                <p className="mt-2 text-xs text-white/30">
                  Models · People · Pages · SOPs · Password Library · Candidates · Winners · Templates
                </p>
              </div>
            ) : showEmpty ? (
              <p className="px-2 py-8 text-center text-sm text-white/50">No results</p>
            ) : (
              <div className="space-y-4">
                {GROUPS.map((g) => {
                  const items = data?.[g.key] ?? [];
                  if (items.length === 0) return null;
                  const Icon = g.icon;
                  return (
                    <section key={g.key}>
                      <h3 className="flex items-center gap-2 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {g.label}
                      </h3>
                      <ul className="space-y-0.5">
                        {items.map((r) => {
                          runningIndex += 1;
                          const idx = runningIndex;
                          const active = idx === activeIndex;
                          return (
                            <li key={`${g.key}-${r.id}`}>
                              <button
                                type="button"
                                data-cmdk-index={idx}
                                role="option"
                                aria-selected={active}
                                onMouseEnter={() => setActiveIndex(idx)}
                                onClick={() => navigate(r.href)}
                                className={cn(
                                  "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
                                  active
                                    ? "bg-[#e91e8c]/18 ring-1 ring-[#e91e8c]/35"
                                    : "hover:bg-white/8",
                                )}
                              >
                                <span className="flex items-center gap-2 text-sm font-medium text-white">
                                  <Icon className={cn("h-4 w-4", g.accent)} aria-hidden />
                                  {r.label}
                                </span>
                                {r.sublabel ? (
                                  <span className="mt-0.5 pl-6 text-xs text-white/45">{r.sublabel}</span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-2 text-[10px] text-white/35">
            <span>
              <kbd className="rounded border border-white/10 px-1">↑↓</kbd> navigate
              <span className="mx-2">·</span>
              <kbd className="rounded border border-white/10 px-1">↵</kbd> open
            </span>
            <span>{total > 0 ? `${total} result${total === 1 ? "" : "s"}` : "⌘K"}</span>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white/70 transition-colors hover:border-white/15 hover:bg-white/10 hover:text-white md:px-3"
        aria-label="Open command palette"
        title="Command palette (⌘K)"
      >
        <Search className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        <span className="hidden lg:inline text-white/50">Search</span>
        <kbd className="hidden rounded border border-white/15 bg-black/30 px-1.5 py-0.5 text-[10px] text-white/40 sm:inline">
          ⌘K
        </kbd>
      </button>
      {overlay}
    </>
  );
}
