"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, UserRound, Fish, FileText, Users } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

type SearchHit = { id: string; label: string; sublabel?: string };

type SearchResponse = {
  models: SearchHit[];
  whales: SearchHit[];
  customs: SearchHit[];
  users: SearchHit[];
};

function emptyResponse(): SearchResponse {
  return { models: [], whales: [], customs: [], users: [] };
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [data, setData] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

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
        if (!cancelled) setData(json);
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

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    setDebounced("");
    setData(null);
    setError(null);
  }, []);

  const navigate = React.useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [router, close]
  );

  const total =
    (data?.models.length ?? 0) +
    (data?.whales.length ?? 0) +
    (data?.customs.length ?? 0) +
    (data?.users.length ?? 0);
  const showEmpty = open && debounced.length > 0 && !loading && !error && total === 0;

  const overlay =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 px-4 py-[min(12vh,5rem)] backdrop-blur-sm"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div
          className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#1a1a2e] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-white/45" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              autoComplete="off"
              placeholder="Search models, whales, customs, users…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-white placeholder:text-white/35 outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="hidden shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/45 sm:inline">
              Esc
            </kbd>
          </div>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto px-2 py-3">
            {error ? (
              <p className="px-2 py-6 text-center text-sm text-rose-300">{error}</p>
            ) : loading ? (
              <p className="px-2 py-6 text-center text-sm text-white/50">Searching…</p>
            ) : debounced.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-white/45">Type to search</p>
            ) : showEmpty ? (
              <p className="px-2 py-8 text-center text-sm text-white/50">No results</p>
            ) : (
              <div className="space-y-4">
                {data && data.models.length > 0 ? (
                  <section>
                    <h3 className="flex items-center gap-2 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                      <UserRound className="h-4 w-4" aria-hidden /> Models
                    </h3>
                    <ul className="space-y-1">
                      {data.models.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => navigate(ROUTES.admin.modelDetail(r.id))}
                            className={cn(
                              "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
                              "hover:bg-white/8 focus:bg-white/8 focus:outline-none"
                            )}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium text-white">
                              <UserRound className="h-4 w-4 text-sky-300/90" aria-hidden />
                              {r.label}
                            </span>
                            {r.sublabel ? (
                              <span className="mt-0.5 pl-6 text-xs text-white/45">{r.sublabel}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {data && data.whales.length > 0 ? (
                  <section>
                    <h3 className="flex items-center gap-2 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                      <Fish className="h-4 w-4" aria-hidden /> Whales
                    </h3>
                    <ul className="space-y-1">
                      {data.whales.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => navigate(ROUTES.admin.whaleDetail(r.id))}
                            className={cn(
                              "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
                              "hover:bg-white/8 focus:bg-white/8 focus:outline-none"
                            )}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium text-white">
                              <Fish className="h-4 w-4 text-cyan-300/90" aria-hidden />
                              {r.label}
                            </span>
                            {r.sublabel ? (
                              <span className="mt-0.5 pl-6 text-xs text-white/45">{r.sublabel}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {data && data.customs.length > 0 ? (
                  <section>
                    <h3 className="flex items-center gap-2 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                      <FileText className="h-4 w-4" aria-hidden /> Custom requests
                    </h3>
                    <ul className="space-y-1">
                      {data.customs.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`${ROUTES.admin.customRequests}?id=${encodeURIComponent(r.id)}`)
                            }
                            className={cn(
                              "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
                              "hover:bg-white/8 focus:bg-white/8 focus:outline-none"
                            )}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium text-white">
                              <FileText className="h-4 w-4 text-amber-200/90" aria-hidden />
                              {r.label}
                            </span>
                            {r.sublabel ? (
                              <span className="mt-0.5 pl-6 text-xs text-white/45">{r.sublabel}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {data && data.users.length > 0 ? (
                  <section>
                    <h3 className="flex items-center gap-2 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                      <Users className="h-4 w-4" aria-hidden /> Users
                    </h3>
                    <ul className="space-y-1">
                      {data.users.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => navigate(ROUTES.admin.accountDetail(r.id))}
                            className={cn(
                              "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
                              "hover:bg-white/8 focus:bg-white/8 focus:outline-none"
                            )}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium text-white">
                              <Users className="h-4 w-4 text-pink-300/90" aria-hidden />
                              {r.label}
                            </span>
                            {r.sublabel ? (
                              <span className="mt-0.5 pl-6 text-xs text-white/45">{r.sublabel}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white/70 transition-colors hover:border-white/15 hover:bg-white/10 hover:text-white md:px-3"
        aria-label="Open search"
        title="Search (⌘K)"
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
