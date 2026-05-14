"use client";

import * as React from "react";
import { motion } from "framer-motion";

type OFSubscriberCategory = "whale" | "vip" | "high_spender" | "medium" | "freeloader" | "new";

type SubscriberRow = {
  of_user_id: number;
  username: string;
  display_name: string;
  subscribed_at: string;
  expires_at: string;
  total_spent: number;
  category: OFSubscriberCategory;
};

type ApiResponse = {
  subscribers: SubscriberRow[];
  has_more: boolean;
};

const PAGE_LIMIT = 100;
const MAX_PAGES = 500;

function stripUntrusted(label: string): string {
  return label.replace(/<\/?UNTRUSTED>/gi, "").trim();
}

function formatSubscribedAt(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(t);
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function categoryBadgeClass(cat: OFSubscriberCategory): string {
  switch (cat) {
    case "whale":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "vip":
      return "border-purple-500/40 bg-purple-500/15 text-purple-200";
    case "high_spender":
      return "border-pink-500/40 bg-pink-500/15 text-pink-200";
    case "medium":
      return "border-sky-500/40 bg-sky-500/15 text-sky-200";
    case "freeloader":
      return "border-white/15 bg-white/[0.06] text-white/55";
    case "new":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    default:
      return "border-white/15 bg-white/[0.06] text-white/55";
  }
}

function countWhales(rows: SubscriberRow[]): number {
  return rows.filter((r) => r.total_spent >= 1000).length;
}
function countVip(rows: SubscriberRow[]): number {
  return rows.filter((r) => r.total_spent >= 200 && r.total_spent < 1000).length;
}
function countHigh(rows: SubscriberRow[]): number {
  return rows.filter((r) => r.total_spent >= 100 && r.total_spent < 200).length;
}
function countFreeloaders(rows: SubscriberRow[]): number {
  return rows.filter((r) => r.total_spent < 30).length;
}

const listContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.045 },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export function ModelOFSubscribers({ ofUserId, modelName }: { ofUserId: string; modelName: string }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [subscribers, setSubscribers] = React.useState<SubscriberRow[]>([]);

  React.useEffect(() => {
    if (!ofUserId.trim()) {
      setSubscribers([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();

    async function loadAllPages() {
      setLoading(true);
      setError(null);
      setSubscribers([]);

      const acc: SubscriberRow[] = [];
      let offset = 0;

      try {
        for (let page = 0; page < MAX_PAGES; page += 1) {
          if (cancelled) return;

          const qs = new URLSearchParams({
            of_user_id: ofUserId.trim(),
            limit: String(PAGE_LIMIT),
            offset: String(offset),
          });
          const res = await fetch(`/api/of-subscribers?${qs.toString()}`, {
            credentials: "include",
            signal: ac.signal,
          });
          const json = (await res.json()) as ApiResponse & { error?: string };
          if (!res.ok) {
            throw new Error(json.error ?? `Request failed (${res.status})`);
          }

          const batch = json.subscribers ?? [];
          acc.push(...batch);
          if (!cancelled) setSubscribers([...acc]);

          const hasMore = Boolean(json.has_more);
          if (!hasMore) break;
          if (batch.length === 0) break;

          offset += PAGE_LIMIT;
        }
      } catch (e) {
        if (cancelled || (e instanceof Error && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Failed to load subscribers.");
        if (!cancelled) setSubscribers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAllPages();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [ofUserId]);

  if (!ofUserId.trim()) {
    return <p className="text-sm text-white/45">No OF account linked for {modelName}.</p>;
  }

  const sorted = [...subscribers].sort((a, b) => b.total_spent - a.total_spent);
  const whales = countWhales(subscribers);
  const vip = countVip(subscribers);
  const high = countHigh(subscribers);
  const freeloaders = countFreeloaders(subscribers);
  const showPartialProgress = loading && subscribers.length > 0;

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
      aria-label={`OnlyFans subscribers for ${modelName}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          <span aria-hidden>👥 </span>Subscribers
        </h2>
        {loading && subscribers.length === 0 ? (
          <span className="h-7 w-16 animate-pulse rounded-full bg-white/10" />
        ) : (
          <span className="rounded-full border border-pink-500/35 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-100">
            {subscribers.length} total
          </span>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-red-400/90">{error}</p> : null}

      {showPartialProgress ? (
        <p className="mt-3 text-sm text-white/55" aria-live="polite">
          Loading... ({subscribers.length} subscribers so far)
        </p>
      ) : null}

      {loading && subscribers.length === 0 ? (
        <div className="mt-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
            ))}
          </div>
          <div className="space-y-2 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.05]" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard emoji="🐋" label="Whales" value={whales} hint="≥ $1,000" />
            <StatCard emoji="💎" label="VIP" value={vip} hint="≥ $200" />
            <StatCard emoji="💸" label="High" value={high} hint="≥ $100" />
            <StatCard emoji="😐" label="Freeloaders" value={freeloaders} hint="< $30" />
          </div>

          <motion.ul
            className="mt-6 divide-y divide-white/[0.08]"
            variants={listContainer}
            initial="hidden"
            animate="show"
          >
            {sorted.map((sub, idx) => (
              <motion.li
                key={`${sub.of_user_id}-${sub.username}-${idx}`}
                variants={listItem}
                className="flex flex-wrap items-center gap-3 py-3 text-sm"
              >
                <span className="min-w-0 flex-1 font-medium text-white/90">
                  {stripUntrusted(sub.display_name) || stripUntrusted(sub.username) || "—"}
                </span>
                <span className="shrink-0 text-white/50 tabular-nums">{formatSubscribedAt(sub.subscribed_at)}</span>
                <span className="shrink-0 font-semibold tabular-nums text-pink-200/95">{formatUsd(sub.total_spent)}</span>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryBadgeClass(sub.category)}`}
                >
                  {sub.category.replaceAll("_", " ")}
                </span>
              </motion.li>
            ))}
          </motion.ul>

          {sorted.length === 0 && !loading && !error ? (
            <p className="mt-4 text-sm text-white/45">No subscribers returned.</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function StatCard({ emoji, label, value, hint }: { emoji: string; label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-white/55">
        <span aria-hidden>{emoji}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[11px] text-white/40">{hint}</p>
    </div>
  );
}
