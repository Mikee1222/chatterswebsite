"use client";

import * as React from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FeatureRow = {
  feature_key: string;
  week_count: number;
  month_count: number;
};

type Summary = {
  week_total: number;
  month_total: number;
  by_feature: FeatureRow[];
  generated_at: string;
};

function labelFeature(key: string): string {
  return key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Approximate Anthropic call counts from ai_usage_logs — Integrations page widget. */
export function AiUsageVisibilityWidget() {
  const [data, setData] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/ai/usage", { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as Summary & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load AI usage");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-start gap-2">
        <BarChart3 className="mt-0.5 h-4 w-4 text-[#D4AF8C]" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-white">AI usage (approx.)</h2>
          <p className="mt-0.5 text-xs text-white/45">
            Anthropic call counts from app logs — enough to spot expensive features without the
            Anthropic console.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : !data || data.month_total === 0 ? (
        <p className="text-sm text-white/55">
          No AI calls logged yet this month. Counts appear after the next Anthropic request.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/40">Last 7 days</p>
              <p className="text-2xl font-semibold text-white">{data.week_total}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/40">Last 30 days</p>
              <p className="text-2xl font-semibold text-white">{data.month_total}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/40">
                  <th className="pb-2 pr-3 font-medium">Feature</th>
                  <th className="pb-2 pr-3 font-medium">Week</th>
                  <th className="pb-2 font-medium">Month</th>
                </tr>
              </thead>
              <tbody>
                {data.by_feature.slice(0, 20).map((row) => (
                  <tr key={row.feature_key} className="border-b border-white/[0.06]">
                    <td className="py-2 pr-3 text-white/80">{labelFeature(row.feature_key)}</td>
                    <td className="py-2 pr-3 tabular-nums text-white/70">{row.week_count}</td>
                    <td
                      className={cn(
                        "py-2 tabular-nums",
                        row.month_count >= 50 ? "font-medium text-amber-200" : "text-white/70",
                      )}
                    >
                      {row.month_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-white/35">
            Updated {new Date(data.generated_at).toLocaleString()} · successful API calls only
          </p>
        </div>
      )}
    </section>
  );
}
