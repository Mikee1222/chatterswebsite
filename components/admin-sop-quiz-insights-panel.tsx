"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SopEmptyState } from "@/components/sop/sop-empty-state";
import { useSopMotion } from "@/components/sop/sop-motion";
import { cn } from "@/lib/utils";
import type { SopQuizFunctionInsight } from "@/types";

export function AdminSopQuizInsightsPanel({ roleId }: { roleId: string }) {
  const motionCfg = useSopMotion();
  const [insights, setInsights] = React.useState<SopQuizFunctionInsight[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!roleId) {
      setInsights([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    fetch(`/api/admin/sops/quiz-insights?role_id=${encodeURIComponent(roleId)}`)
      .then((r) => r.json())
      .then((d: { insights?: SopQuizFunctionInsight[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setInsights(Array.isArray(d.insights) ? d.insights : []);
      })
      .catch((e) => {
        setInsights([]);
        setError(e instanceof Error ? e.message : "Could not load quiz insights");
      })
      .finally(() => setLoading(false));
  }, [roleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="h-6 w-6 border-white/20 border-t-pink-400" />
      </div>
    );
  }

  if (error) {
    return (
      <SopEmptyState
        icon={AlertTriangle}
        title="Quiz insights unavailable"
        description={error}
      />
    );
  }

  const withAttempts = insights.filter((i) => i.total_attempts > 0);
  const difficult = withAttempts.filter((i) => i.is_difficult);

  return (
    <motion.div
      className="space-y-4"
      initial="hidden"
      animate="show"
      variants={motionCfg.stagger}
    >
      <motion.div variants={motionCfg.reveal} className="flex flex-wrap items-center gap-2">
        <BarChart3 className="h-4 w-4 text-pink-300/70" aria-hidden />
        <h3 className="text-sm font-bold text-white">Quiz insights</h3>
        <span className="text-xs text-white/40">Per function — attempts, scores, pass rate</span>
      </motion.div>

      {withAttempts.length === 0 ? (
        <motion.p
          variants={motionCfg.reveal}
          className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45"
        >
          No quiz attempts recorded yet for this role.
        </motion.p>
      ) : (
        <>
          {difficult.length > 0 ? (
            <motion.div
              variants={motionCfg.reveal}
              className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-100/90"
            >
              <span className="font-semibold">{difficult.length} function{difficult.length !== 1 ? "s" : ""}</span>
              {" "}may be difficult or confusing — low pass rate or members needing multiple attempts.
            </motion.div>
          ) : null}

          <motion.div
            variants={motionCfg.reveal}
            className="sop-glass-panel overflow-hidden rounded-2xl"
          >
            <div className="sop-table-scroll overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/40">
                    <th className="px-4 py-3 md:px-5">Function</th>
                    <th className="px-4 py-3 md:px-5">Attempts</th>
                    <th className="px-4 py-3 md:px-5">Avg score</th>
                    <th className="px-4 py-3 md:px-5">Pass rate</th>
                    <th className="px-4 py-3 md:px-5">&gt;1 attempt</th>
                  </tr>
                </thead>
                <tbody>
                  {withAttempts.map((row) => (
                    <tr
                      key={row.function_id}
                      className={cn(
                        "border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04]",
                        row.is_difficult && "bg-rose-500/[0.04]"
                      )}
                    >
                      <td className="px-4 py-3 font-medium md:px-5">
                        <span className={row.is_difficult ? "text-rose-100/95" : "text-white/85"}>
                          {row.function_name}
                        </span>
                        {row.is_difficult ? (
                          <span className="ml-2 inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                            Review
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-white/70 md:px-5">
                        {row.total_attempts}
                      </td>
                      <td className="px-4 py-3 md:px-5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                            row.avg_score >= 80
                              ? "bg-emerald-500/15 text-emerald-200"
                              : row.avg_score >= 60
                                ? "bg-white/10 text-white/70"
                                : "bg-amber-500/15 text-amber-200"
                          )}
                        >
                          {row.avg_score}%
                        </span>
                      </td>
                      <td className="px-4 py-3 md:px-5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                            row.pass_rate >= 80
                              ? "bg-emerald-500/15 text-emerald-200"
                              : row.pass_rate >= 70
                                ? "bg-white/10 text-white/70"
                                : "bg-rose-500/15 text-rose-200"
                          )}
                        >
                          {row.pass_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums md:px-5">
                        <span
                          className={cn(
                            "text-sm",
                            row.members_multi_attempt > 0
                              ? "font-semibold text-amber-200"
                              : "text-white/45"
                          )}
                        >
                          {row.members_multi_attempt}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
