"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink, Link2, Smartphone } from "lucide-react";
import type { FunnelLink, SocialAccount } from "@/services/marketing";
import { VAShadowbanReportModal } from "@/components/va-shadowban-report-modal";
import { getSocialColor } from "@/lib/social-platform-config";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
  shadowbanned: "border-amber-500/35 bg-amber-500/15 text-amber-300",
  banned: "border-red-500/35 bg-red-500/15 text-red-300",
};

function groupByModel(accounts: SocialAccount[]): Map<string, { modelName: string; accounts: SocialAccount[] }> {
  const map = new Map<string, { modelName: string; accounts: SocialAccount[] }>();
  for (const acc of accounts) {
    const key = acc.model_id?.trim() || "unknown";
    const existing = map.get(key);
    if (existing) {
      existing.accounts.push(acc);
    } else {
      map.set(key, {
        modelName: acc.model_name?.trim() || "Creator",
        accounts: [acc],
      });
    }
  }
  return map;
}

export function VaMarketingClient() {
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([]);
  const [funnels, setFunnels] = React.useState<FunnelLink[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [shadowbanOpen, setShadowbanOpen] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/va/marketing/accounts", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { accounts?: SocialAccount[]; error?: string };
      if (!res.ok) {
        setErr(data.error?.trim() || "Could not load accounts");
        setAccounts([]);
        return;
      }
      setAccounts(data.accounts ?? []);
    } catch {
      setErr("Network error");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadFunnels = React.useCallback(async () => {
    try {
      const res = await fetch("/api/va/marketing/funnels", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { funnels?: FunnelLink[] };
      if (res.ok) setFunnels(data.funnels ?? []);
    } catch {
      // read-only extra; ignore load failure
    }
  }, []);

  React.useEffect(() => {
    void reload();
    void reloadFunnels();
  }, [reload, reloadFunnels]);

  const grouped = React.useMemo(() => groupByModel(accounts), [accounts]);
  const activeCount = accounts.filter((a) => (a.account_status ?? "active") === "active").length;
  const issueCount = accounts.length - activeCount;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 pt-6 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[32px] font-extrabold tracking-tight text-white">Marketing accounts</h1>
            <p className="mt-2 text-sm text-white/45">Social handles assigned to you across your creators</p>
          </div>
          <button
            type="button"
            onClick={() => setShadowbanOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/25"
          >
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Report issue
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-sm text-white/70">
            Total
            <strong className="font-bold tabular-nums text-white">{accounts.length}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
            Active
            <strong className="font-bold tabular-nums text-emerald-200">{activeCount}</strong>
          </span>
          {issueCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
              Issues
              <strong className="font-bold tabular-nums text-amber-200">{issueCount}</strong>
            </span>
          ) : null}
        </div>

        {err ? (
          <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] px-6 py-16 text-center text-sm text-white/40">
            Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/35">
              <Smartphone className="h-7 w-7" aria-hidden />
            </div>
            <p className="mt-5 text-base font-semibold text-white/90">No accounts assigned</p>
            <p className="mt-2 max-w-sm text-sm text-white/50">
              When an admin assigns social accounts to you, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {[...grouped.entries()].map(([modelId, group]) => (
              <section
                key={modelId}
                className="overflow-hidden rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d]"
              >
                <div className="border-b border-[#1f1f1f] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-pink-400">Creator</p>
                  <h2 className="mt-1 text-lg font-bold text-white">{group.modelName}</h2>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  {group.accounts.map((acc) => {
                    const plat = acc.platform?.trim() || "Other";
                    const color = getSocialColor(plat);
                    const href = acc.account_link?.trim() || "#";
                    const st = acc.account_status ?? "active";
                    return (
                      <div
                        key={acc.id}
                        className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition hover:border-pink-500/30"
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">@{acc.username}</p>
                            <p className="text-xs text-white/40">{plat}</p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize",
                              STATUS_STYLES[st] ?? STATUS_STYLES.active,
                            )}
                          >
                            {st}
                          </span>
                        </div>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!acc.account_link?.trim()) e.preventDefault();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-white transition hover:scale-[1.02]"
                          style={{ backgroundColor: `${color}12`, borderColor: `${color}35` }}
                        >
                          Open profile
                          <ExternalLink className="h-3 w-3 text-white/40" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {funnels.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d]">
            <div className="flex items-center gap-2 border-b border-[#1f1f1f] px-5 py-4">
              <Link2 className="h-4 w-4 text-pink-400" aria-hidden />
              <div>
                <h2 className="text-base font-bold text-white">Funnel links</h2>
                <p className="text-xs text-white/40">Read-only — shared promo links for your creators</p>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {funnels.map((f) => {
                const color = getSocialColor(f.platform);
                return (
                  <a
                    key={f.id}
                    href={f.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!f.url?.trim()) e.preventDefault();
                    }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition hover:border-pink-500/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{f.label}</p>
                      <p className="truncate text-xs text-white/40">
                        {[f.model_name, f.platform, f.region].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-white"
                      style={{ backgroundColor: `${color}12`, borderColor: `${color}35` }}
                    >
                      Open
                      <ExternalLink className="h-3 w-3 text-white/40" />
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <VAShadowbanReportModal
        open={shadowbanOpen}
        onClose={() => {
          setShadowbanOpen(false);
          void reload();
        }}
        vaAccounts={accounts}
      />
    </div>
  );
}
