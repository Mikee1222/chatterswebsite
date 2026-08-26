"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Shield } from "lucide-react";
import type { ModelChurnRisk } from "@/services/model-churn-risk";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const LEVEL_STYLES: Record<
  ModelChurnRisk["level"],
  { badge: string; bar: string }
> = {
  low: { badge: "bg-emerald-500/15 text-emerald-200", bar: "bg-emerald-400" },
  medium: { badge: "bg-amber-500/15 text-amber-200", bar: "bg-amber-400" },
  high: { badge: "bg-rose-500/15 text-rose-200", bar: "bg-rose-400" },
  insufficient: { badge: "bg-white/10 text-white/50", bar: "bg-white/20" },
};

export function ModelChurnRiskBadge({ risk }: { risk: ModelChurnRisk }) {
  const st = LEVEL_STYLES[risk.level];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
            Churn risk
          </h2>
          <p className="mt-1 text-xs text-white/40">
            Trailing revenue, IG reach/engagement, disconnects, posting cadence
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", st.badge)}>
          {risk.label}
        </span>
      </div>
      {risk.score != null ? (
        <div className="mt-4">
          <div className="flex items-end justify-between text-sm">
            <span className="text-3xl font-semibold text-white">{risk.score}</span>
            <span className="text-white/40">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full rounded-full transition-all", st.bar)}
              style={{ width: `${risk.score}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm text-white/50">
          <Shield className="h-4 w-4" />
          Not enough data yet
        </p>
      )}
      {risk.reasons.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {risk.reasons.slice(0, 4).map((r) => (
            <li key={r} className="text-xs text-white/55">
              · {r}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AtRiskModelsWidget({ items }: { items: ModelChurnRisk[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-300/90" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
          At risk models
        </h2>
      </div>
      <p className="mt-1 text-xs text-white/40">
        Medium / high churn risk from real trailing signals
      </p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-white/45">No medium/high risk models right now.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((r) => {
            const st = LEVEL_STYLES[r.level];
            return (
              <li key={r.modelId}>
                <Link
                  href={ROUTES.admin.modelDetail(r.modelId)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 transition hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{r.modelName}</p>
                    <p className="truncate text-xs text-white/40">
                      {r.reasons[0] ?? r.label}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", st.badge)}>
                    {r.score != null ? `${r.score}` : "—"} · {r.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
