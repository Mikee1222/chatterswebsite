"use client";

import { transactionTypeLabel } from "@/lib/airtable-options";
import { formatDateEuropean, formatTimeEuropean, displayName } from "@/lib/format";
import type { WhaleTransaction } from "@/types";

function notePreview(note: string | undefined, maxLen = 40): string {
  if (!note?.trim()) return "—";
  const t = note.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

export function WhaleSessionHistory({ transactions }: { transactions: WhaleTransaction[] }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-base font-semibold text-white">Previous sessions</h2>
        <p className="mt-0.5 text-xs text-white/50">Your recent whale sessions</p>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-white/50">No sessions yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-black/60 text-left text-xs font-medium uppercase tracking-wider text-white/50">
              <tr>
                <th className="p-3">Whale</th>
                <th className="p-3">Model</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Type</th>
                <th className="p-3">Min</th>
                <th className="p-3">Date</th>
                <th className="p-3">Time</th>
                <th className="max-w-[140px] p-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/[0.03]">
                  <td className="p-3 font-medium text-white/90">{displayName(tx.whale_username)}</td>
                  <td className="p-3 text-white/80">{displayName(tx.model_name)}</td>
                  <td className="p-3 text-white/90">
                    {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {tx.currency.toUpperCase()}
                  </td>
                  <td className="p-3 text-white/75">{transactionTypeLabel(tx.type)}</td>
                  <td className="p-3 text-white/70">{tx.session_length_minutes ?? "—"}</td>
                  <td className="p-3 text-white/70">{formatDateEuropean(tx.date)}</td>
                  <td className="p-3 text-white/70">{formatTimeEuropean(tx.time)}</td>
                  <td className="max-w-[140px] truncate p-3 text-white/60" title={tx.note || undefined}>
                    {notePreview(tx.note)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
