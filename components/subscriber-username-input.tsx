"use client";

import * as React from "react";
import { Clock, CornerDownLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared, design-system-styled subscriber username field used by the Rebill and Tip
 * modals. Replaces the browser/password-manager native autofill dropdown (jarring
 * bright-blue selected state) with an on-brand pink/champagne dark card that matches
 * the grouped member picker (`staff-assignee-picker.tsx`).
 *
 * Suggestions are the chatter's own recently used subscriber usernames, persisted in
 * localStorage so the experience mirrors the native "remembered names" list without a
 * backend dependency. Call `rememberSubscriberUsername` after a successful submit.
 */

const STORAGE_KEY = "chatter:recent-sub-usernames";
const MAX_RECENTS = 12;

export function readRecentSubscriberUsernames(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

export function rememberSubscriberUsername(name: string): void {
  if (typeof window === "undefined") return;
  const clean = name.trim();
  if (!clean) return;
  try {
    const existing = readRecentSubscriberUsernames();
    const next = [clean, ...existing.filter((v) => v.toLowerCase() !== clean.toLowerCase())].slice(
      0,
      MAX_RECENTS,
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / serialization errors */
  }
}

type SubscriberUsernameInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
};

export function SubscriberUsernameInput({
  value,
  onChange,
  required,
  placeholder = "username",
  id,
}: SubscriberUsernameInputProps) {
  const [recents, setRecents] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setRecents(readRecentSubscriberUsernames());
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAll(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const query = value.trim().toLowerCase();
  const matches = React.useMemo(() => {
    if (!query) return recents;
    return recents.filter((r) => r.toLowerCase().includes(query) && r.toLowerCase() !== query);
  }, [recents, query]);

  const hasExtraBeyondMatches = recents.length > matches.length;
  const visible = showAll ? recents : matches;
  const canOpen = recents.length > 0;

  function commit(name: string) {
    onChange(name);
    setOpen(false);
    setShowAll(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || visible.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % visible.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? visible.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      commit(visible[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setShowAll(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative mt-1.5">
      <span className="pointer-events-none absolute left-3 top-[1.15rem] z-[1] -translate-y-1/2 text-white/35">
        @
      </span>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowAll(false);
          setActiveIndex(-1);
          if (canOpen) setOpen(true);
        }}
        onFocus={() => {
          if (canOpen) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-7 pr-4 text-white placeholder:text-white/35 focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/20"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        required={required}
      />

      {open && visible.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[240] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0D0B0D]/95 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.7)] backdrop-blur-sm">
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
              {showAll ? "All saved usernames" : "Recent usernames"}
            </p>
            <div className="va-champagne-divider h-px flex-1" />
          </div>
          <ul className="max-h-52 overflow-y-auto p-1.5">
            {visible.map((name, i) => {
              const active = i === activeIndex;
              return (
                <li key={name}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(name)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition",
                      active ? "bg-pink-500/15 text-white" : "text-white/80 hover:bg-white/5",
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-[10px] font-semibold text-pink-300">
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {active ? (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-pink-300/70" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {!showAll && hasExtraBeyondMatches ? (
            <button
              type="button"
              onClick={() => {
                setShowAll(true);
                setActiveIndex(-1);
              }}
              className="flex w-full items-center gap-2 border-t border-[rgba(212,175,140,0.18)] px-3 py-2.5 text-left text-xs font-medium text-[#D4AF8C]/85 transition hover:bg-[#D4AF8C]/[0.06] hover:text-[#D4AF8C]"
            >
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Other usernames…
            </button>
          ) : null}
        </div>
      ) : null}

      {value ? (
        <button
          type="button"
          aria-label="Clear username"
          onClick={() => {
            onChange("");
            setShowAll(false);
            setActiveIndex(-1);
          }}
          className="absolute right-2.5 top-[1.15rem] z-[1] -translate-y-1/2 rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white/80"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
