"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { markSpinClaimedAction } from "@/app/actions/spin-wheel";
import type { AdminSpinRow } from "@/services/spin-wheel";
import { cn } from "@/lib/utils";
import { formatDateTimeEuropean } from "@/lib/format";

function isCashLike(row: AdminSpinRow): boolean {
  const t = row.prize_type.toLowerCase();
  return t === "cash" || t === "extra_break";
}

function needsManualClaim(row: AdminSpinRow): boolean {
  return isCashLike(row) && !row.claimed;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function AdminSpinResultsClient({
  rows,
  stats,
}: {
  rows: AdminSpinRow[];
  stats: {
    totalSpins: number;
    mostCommonPrize: string | null;
    totalCashAwarded: number;
    pendingCashPayout: number;
  };
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function markPaid(spinId: string) {
    setError(null);
    setPendingId(spinId);
    try {
      const res = await markSpinClaimedAction(spinId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/80">Total pending cash payout</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-amber-100">
          {formatMoney(stats.pendingCashPayout)}
        </p>
        <p className="mt-1 text-xs text-amber-200/60">Unclaimed cash spin prizes only. Extra break rewards use the same flow.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Total spins</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">{stats.totalSpins}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Most common prize</p>
          <p className="mt-2 text-lg font-semibold leading-snug text-white">
            {stats.mostCommonPrize ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Cash awarded (claimed)</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-300">
            {formatMoney(stats.totalCashAwarded)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-black/40 text-xs uppercase tracking-wider text-white/50">
                <th className="px-4 py-3 font-semibold">Chatter</th>
                <th className="px-4 py-3 font-semibold">Prize</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Note</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-white/45">
                    No spin records yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const cashLike = isCashLike(row);
                  const amt = Math.max(0, Number.parseFloat(row.prize_value) || 0);
                  const showMarkPaid = needsManualClaim(row);
                  const busy = pendingId === row.id;
                  const statusLabel = !cashLike
                    ? "—"
                    : row.claimed
                      ? "Paid"
                      : "Pending";
                  return (
                    <tr key={row.id} className="text-white/85">
                      <td className="px-4 py-3 font-medium">{row.chatter_name}</td>
                      <td className="max-w-[200px] truncate px-4 py-3">{row.prize_label}</td>
                      <td className="px-4 py-3 text-white/60">{row.prize_type}</td>
                      <td className="px-4 py-3 tabular-nums text-white/80">
                        {row.prize_type.toLowerCase() === "cash"
                          ? formatMoney(amt)
                          : row.prize_type.toLowerCase() === "extra_break"
                            ? row.prize_value.trim() || "—"
                            : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-white/55">
                        {formatDateTimeEuropean(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold",
                            !cashLike
                              ? "bg-white/10 text-white/50"
                              : row.claimed
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-amber-500/15 text-amber-200"
                          )}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-xs text-white/45" title={row.claim_note || ""}>
                        {row.claim_note || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {showMarkPaid ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => markPaid(row.id)}
                            className="inline-flex flex-col items-start gap-0.5 rounded-lg bg-white/10 px-3 py-2 text-left text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
                          >
                            <span className="inline-flex items-center gap-2">
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                              Mark as paid
                            </span>
                            {row.prize_type.toLowerCase() === "cash" ? (
                              <span className="font-normal text-white/60">{formatMoney(amt)}</span>
                            ) : null}
                          </button>
                        ) : (
                          <span className="text-white/35">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
