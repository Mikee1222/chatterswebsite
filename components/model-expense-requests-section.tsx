"use client";

import useSWR from "swr";
import type { ModelExpenseRequest } from "@/types";

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { records?: ModelExpenseRequest[] };
  return data.records ?? [];
};

function statusUi(status: ModelExpenseRequest["status"]) {
  if (status === "pending") return { label: "Pending review", cls: "border-amber-500/30 bg-amber-500/15 text-amber-300" };
  if (status === "approved") return { label: "Approved", cls: "border-green-500/30 bg-green-500/15 text-green-300" };
  return { label: "Declined", cls: "border-red-500/30 bg-red-500/15 text-red-300" };
}

export function ModelExpenseRequestsSection() {
  const { data } = useSWR<ModelExpenseRequest[]>("/api/model/expense-requests", fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });
  const rows = data ?? [];

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-black/35 p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">Airbnb requests</h2>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/50">No requests yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const ui = statusUi(r.status);
            return (
              <article key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold text-white">{r.assignment_title || "Assignment"}</p>
                <a href={r.airbnb_link} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-pink-300 underline-offset-2 hover:underline">
                  {r.airbnb_link}
                </a>
                <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${ui.cls}`}>{ui.label}</span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
