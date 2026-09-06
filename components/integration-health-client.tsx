"use client";

import * as React from "react";
import { Activity, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";
import type {
  IntegrationHealthCard,
  IntegrationHealthSnapshot,
  IntegrationId,
} from "@/services/integration-health";
import { formatBytes } from "@/services/supabase-usage";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  IntegrationHealthCard["status"],
  { dot: string; label: string; ring: string }
> = {
  green: { dot: "bg-emerald-400", label: "Healthy", ring: "ring-emerald-400/30" },
  amber: { dot: "bg-amber-400", label: "Attention", ring: "ring-amber-400/30" },
  red: { dot: "bg-rose-400", label: "Critical", ring: "ring-rose-400/30" },
};

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function IntegrationHealthClient({
  initial,
  canManage,
}: {
  initial: IntegrationHealthSnapshot;
  canManage: boolean;
}) {
  const [snap, setSnap] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  async function refresh() {
    setBusy("refresh");
    setToast(null);
    try {
      const res = await fetch("/api/admin/integrations", { credentials: "include" });
      const data = (await res.json()) as IntegrationHealthSnapshot & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to refresh");
      setSnap(data);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(null);
    }
  }

  async function action(id: IntegrationId, kind: "test" | "sync") {
    if (!canManage) return;
    setBusy(`${kind}:${id}`);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/integrations/${id}/${kind}`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || data.message || "Action failed");
      setToast(data.message || (data.ok ? "OK" : "Done"));
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const usage = snap.supabaseUsage;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/40">
          Snapshot {formatWhen(snap.generatedAt)}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy === "refresh"}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
        >
          {busy === "refresh" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      {toast ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
          {toast}
        </p>
      ) : null}

      {usage ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Supabase usage</h2>
              <p className="mt-0.5 text-xs text-white/45">
                Soft alerts vs Pro included quotas (100 GB files / 8 GB DB). Check egress in the
                Supabase dashboard.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
              {STATUS_STYLES[usage.status].label}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40">Database</dt>
              <dd className="mt-0.5 text-white/85">{formatBytes(usage.dbBytes)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40">File storage</dt>
              <dd className="mt-0.5 text-white/85">{formatBytes(usage.storageBytes)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40">Top bucket</dt>
              <dd className="mt-0.5 text-white/85">
                {usage.buckets[0]
                  ? `${usage.buckets[0].name} (${formatBytes(usage.buckets[0].bytes)})`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40">Largest table</dt>
              <dd className="mt-0.5 text-white/85">
                {usage.tables[0]
                  ? `${usage.tables[0].name} (${formatBytes(usage.tables[0].total_bytes)})`
                  : "—"}
              </dd>
            </div>
          </dl>

          {usage.buckets.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-xs text-white/55">
              {usage.buckets.slice(0, 5).map((b) => (
                <li key={b.name} className="flex justify-between gap-3 border-b border-white/5 pb-1">
                  <span>{b.name}</span>
                  <span className="text-white/70">
                    {formatBytes(b.bytes)} · {b.objects.toLocaleString()} files
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {snap.cards.map((card) => {
          const st = STATUS_STYLES[card.status];
          return (
            <article
              key={card.id}
              className={cn(
                "rounded-2xl border border-white/10 bg-white/[0.05] p-5 ring-1",
                st.ring,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", st.dot)} aria-hidden />
                  <div>
                    <h2 className="text-base font-semibold text-white">{card.name}</h2>
                    <p className="text-xs text-white/45">{card.description}</p>
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                  {st.label}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/40">Last sync</dt>
                  <dd className="mt-0.5 text-white/80">{formatWhen(card.lastSyncedAt)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/40">Rows</dt>
                  <dd className="mt-0.5 text-white/80">
                    {card.rowCount == null ? "—" : card.rowCount.toLocaleString()}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-sm text-white/55">{card.message}</p>

              {card.alerts.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {card.alerts.map((a) => (
                    <li
                      key={a}
                      className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-100/90"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              ) : null}

              {canManage ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.canTest ? (
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => void action(card.id, "test")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
                    >
                      {busy === `test:${card.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      Test connection
                    </button>
                  ) : null}
                  {card.canSync ? (
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => void action(card.id, "sync")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#e91e8c]/30 bg-[#e91e8c]/15 px-3 py-2 text-xs text-pink-100 hover:bg-[#e91e8c]/25 disabled:opacity-50"
                    >
                      {busy === `sync:${card.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      Trigger sync
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 flex items-center gap-1.5 text-[11px] text-white/35">
                  <Activity className="h-3 w-3" />
                  View only — ask an admin for integrations:manage to test or sync
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
