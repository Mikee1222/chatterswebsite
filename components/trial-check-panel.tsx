"use client";

/**
 * Trial Check — Content Flow v1.1.
 * Instagram exposes no API for trial reels, so the Account Supervisor types the
 * views from the Instagram app here, per account, every ~3 days. The app computes
 * the average of the latest N trials and flags outliers into the Winners Hub + queue.
 * (Grid posts are checked automatically by the ClarioSuite auto-detect.)
 */

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { VA_BTN_PRIMARY, VA_CARD, VA_FILTER_INPUT, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { TrialCheckAccount } from "@/services/trial-check";

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

export function TrialCheckPanel({ modelFilter, onChanged }: { modelFilter: string; onChanged?: () => void }) {
  const { addToast } = useToast();
  const [accounts, setAccounts] = React.useState<TrialCheckAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = modelFilter ? `?model_id=${encodeURIComponent(modelFilter)}` : "";
      const res = await fetch(`/api/winner-sourcing/trial-check${qs}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { accounts?: TrialCheckAccount[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setAccounts(data.accounts ?? []);
    } catch (e) {
      addToast(winnerVideoLocalToast(`tc-err-${Date.now()}`, "Could not load trials", e instanceof Error ? e.message : "Error", "high"));
    } finally {
      setLoading(false);
    }
  }, [modelFilter, addToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async (acct: TrialCheckAccount) => {
    const key = `${acct.model_id}::${acct.account_handle}`;
    const entries = acct.posts
      .map((p) => ({ post_id: p.post_id, raw: drafts[p.post_id] }))
      .filter((e) => e.raw != null && e.raw.trim() !== "")
      .map((e) => ({ post_id: e.post_id, views: Number(e.raw.replace(/[^\d]/g, "")) }))
      .filter((e) => Number.isFinite(e.views));
    if (!entries.length) return;
    setBusyKey(key);
    try {
      const res = await fetch("/api/winner-sourcing/trial-check", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        saved?: number;
        newOutliers?: Array<{ status: string; multiple: number | null }>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed");
      const n = data.newOutliers?.length ?? 0;
      addToast(
        winnerVideoLocalToast(
          `tc-ok-${Date.now()}`,
          `Saved ${data.saved ?? entries.length} trial${(data.saved ?? entries.length) === 1 ? "" : "s"}`,
          n
            ? `${n} new outlier${n === 1 ? "" : "s"} → Winners + Recreation Queue${data.newOutliers?.some((o) => o.status === "hot") ? " (🔥 hot → urgent lane)" : ""}`
            : "No new outliers",
          n ? "high" : "normal",
        ),
      );
      setDrafts((d) => {
        const next = { ...d };
        for (const e of entries) delete next[e.post_id];
        return next;
      });
      await load();
      onChanged?.();
    } catch (e) {
      addToast(winnerVideoLocalToast(`tc-err-${Date.now()}`, "Save failed", e instanceof Error ? e.message : "Error", "high"));
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && !accounts.length) {
    return <div className={cn(VA_CARD, "px-6 py-16 text-center text-sm text-[#B8B4B8]/50")}>Loading trials…</div>;
  }
  if (!accounts.length) {
    return (
      <div className={cn(VA_CARD, "space-y-2 px-6 py-16 text-center text-sm text-[#B8B4B8]/50")}>
        <p>No trial posts in the window.</p>
        <p className="text-xs text-[#B8B4B8]/35">
          Trials come from posting briefs (posts marked <span className="text-white/60">Trial</span> and posted).
          Grid posts are checked automatically from Instagram.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#B8B4B8]/50">
        Instagram has no API for trial reels, so type the views from the Instagram app (Profile → Trial reels).
        Grid posts are scanned automatically every night.
      </p>
      {accounts.map((acct) => {
        const key = `${acct.model_id}::${acct.account_handle}`;
        const ago = daysAgo(acct.last_checked_at);
        const due = ago == null || ago >= 3;
        const dirty = acct.posts.some((p) => (drafts[p.post_id] ?? "").trim() !== "");
        return (
          <section key={key} className={cn(VA_CARD, "p-4 md:p-5", due && acct.pending > 0 && "border-amber-400/25")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-white">{acct.model_name}</span>
                <span className="text-sm text-[#B8B4B8]/60">@{acct.account_handle || "—"}</span>
                {acct.pending > 0 ? (
                  <span className={cn(VA_STATUS_BADGE, due ? "border-amber-400/35 bg-amber-400/12 text-amber-200" : "border-white/15 bg-white/[0.04] text-white/60")}>
                    {acct.pending} unchecked
                  </span>
                ) : (
                  <span className={cn(VA_STATUS_BADGE, "border-emerald-400/30 bg-emerald-400/10 text-emerald-200")}>All checked</span>
                )}
              </div>
              <div className="text-xs text-[#B8B4B8]/55">
                Avg of last {acct.baseline_posts}:{" "}
                <span className="font-semibold text-white/85">
                  {acct.baseline_avg != null ? Math.round(acct.baseline_avg).toLocaleString() : "—"}
                </span>
                {acct.baseline_count < 3 ? <span className="ml-1 text-amber-200/80">(need ≥3 checked)</span> : null}
                {" · "}outlier ≥{acct.outlier_multiple}× · hot ≥{acct.hot_multiple}× · last check {formatDate(acct.last_checked_at)}
              </div>
            </div>

            <ul className="divide-y divide-white/[0.06]">
              {acct.posts.map((p) => {
                const badge =
                  p.outlier_status === "hot"
                    ? <span className={cn(VA_STATUS_BADGE, "border-rose-400/40 bg-rose-400/15 text-rose-200")}>🔥 HOT ×{p.outlier_multiple}</span>
                    : p.outlier_status === "outlier"
                      ? <span className={cn(VA_STATUS_BADGE, "border-amber-400/40 bg-amber-400/15 text-amber-200")}>OUTLIER ×{p.outlier_multiple}</span>
                      : p.outlier_status === "normal"
                        ? <span className={cn(VA_STATUS_BADGE, "border-white/10 bg-white/[0.03] text-white/40")}>×{p.outlier_multiple ?? "—"}</span>
                        : null;
                return (
                  <li key={p.post_id} className="flex flex-wrap items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/85">
                        {p.video_name || `Post ${p.position + 1}`}
                        <span className="ml-2 text-xs text-[#B8B4B8]/45">{formatDate(p.posted_at)}</span>
                        {p.content_source ? <span className="ml-2 text-[10px] uppercase tracking-wider text-white/35">{p.content_source}</span> : null}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-[#B8B4B8]/45">
                        <Link href={`${ROUTES.postingBriefs}/${encodeURIComponent(p.brief_id)}`} className="hover:underline">
                          {p.brief_title}
                        </Link>
                        {p.posted_url ? (
                          <a href={p.posted_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#FF1493]/80 hover:underline">
                            <ExternalLink className="h-3 w-3" /> open
                          </a>
                        ) : null}
                      </p>
                    </div>
                    {badge}
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={p.views_24h != null ? p.views_24h.toLocaleString() : "views"}
                      value={drafts[p.post_id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.post_id]: e.target.value }))}
                      className={cn(VA_FILTER_INPUT, "w-28 text-right tabular-nums")}
                      aria-label={`Views for ${p.video_name || `post ${p.position + 1}`}`}
                    />
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!dirty || busyKey === key}
                onClick={() => void save(acct)}
                className={cn(VA_BTN_PRIMARY, "min-h-10 px-4 text-xs")}
              >
                {busyKey === key ? "Checking…" : "Save & check"}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
