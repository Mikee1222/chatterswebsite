import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { formatDateEuropean } from "@/lib/format";
import type { Whale } from "@/types";

export function WhalesTable({
  whales,
  total,
  page,
  pageSize,
}: {
  whales: Whale[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const totalPages = Math.ceil(total / pageSize) || 1;
  const start = (page - 1) * pageSize;
  const basePath = ROUTES.whales;

  return (
    <div>
      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {whales.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">No whales found</li>
        ) : (
          whales.map((w) => (
            <li key={w.id}>
              <Link
                href={ROUTES.whaleDetail(w.id)}
                className="block rounded-xl border border-white/10 bg-white/[0.06] p-4 transition-colors hover:bg-white/[0.09]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-[hsl(330,90%,65%)]">{w.username || "—"}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">{w.status}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-white/70">
                  <dt className="text-white/50">Platform</dt>
                  <dd>{w.platform}</dd>
                  <dt className="text-white/50">Chatter</dt>
                  <dd>{w.assigned_chatter_name || "—"}</dd>
                  <dt className="text-white/50">Spent</dt>
                  <dd>${w.total_spent.toLocaleString()}</dd>
                  <dt className="text-white/50">Next followup</dt>
                  <dd>{w.next_followup ? formatDateEuropean(w.next_followup) : "—"}</dd>
                </dl>
              </Link>
            </li>
          ))
        )}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/60">
              <th className="p-3 font-medium">Username</th>
              <th className="p-3 font-medium">Platform</th>
              <th className="p-3 font-medium">Assigned chatter</th>
              <th className="p-3 font-medium">Relationship</th>
              <th className="p-3 font-medium">Spend level</th>
              <th className="p-3 font-medium">Total spent</th>
              <th className="p-3 font-medium">Next followup</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {whales.map((w) => (
              <tr
                key={w.id}
                className="border-b border-white/5 transition-colors hover:bg-white/5"
              >
                <td className="p-3">
                  <Link href={ROUTES.whaleDetail(w.id)} className="font-medium text-[hsl(330,90%,65%)] hover:underline">
                    {w.username || "—"}
                  </Link>
                </td>
                <td className="p-3 text-white/80">{w.platform}</td>
                <td className="p-3 text-white/80">{w.assigned_chatter_name || "—"}</td>
                <td className="p-3 text-white/80">{w.relationship_status}</td>
                <td className="p-3 text-white/80">{w.spend_level}</td>
                <td className="p-3 text-white/80">${w.total_spent.toLocaleString()}</td>
                <td className="p-3 text-white/80">{w.next_followup ? formatDateEuropean(w.next_followup) : "—"}</td>
                <td className="p-3">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">
                    {w.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 p-3">
          <p className="text-sm text-white/50">
            {start + 1}–{Math.min(start + pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`${basePath}?page=${page - 1}`}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`${basePath}?page=${page + 1}`}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

