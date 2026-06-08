"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, GraduationCap, Users } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SopEmptyState } from "@/components/sop/sop-empty-state";
import { SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { useSopMotion } from "@/components/sop/sop-motion";
import { cn } from "@/lib/utils";
import type { SopAcademyOverview } from "@/types";

const PIE_COLORS = ["#ec4899", "#34d399"];

function formatRelativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function AdminSopOverviewPanel() {
  const motionCfg = useSopMotion();
  const [data, setData] = React.useState<SopAcademyOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/sops/overview")
      .then((r) => r.json())
      .then((d: SopAcademyOverview & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => {
        setData(null);
        setError(e instanceof Error ? e.message : "Could not load overview");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8 border-white/20 border-t-pink-400" />
      </div>
    );
  }

  if (error) {
    return (
      <SopEmptyState
        icon={AlertTriangle}
        title="Overview unavailable"
        description={error}
      />
    );
  }

  if (!data || data.roles.length === 0) {
    return (
      <SopEmptyState
        icon={GraduationCap}
        title="No academy roles yet"
        description="Enable Academy mode on a role to track cross-role training progress here."
      />
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={motionCfg.stagger}
    >
      <motion.div
        variants={motionCfg.reveal}
        className="grid gap-3 sm:grid-cols-3"
      >
        {[
          {
            label: "Total members",
            value: data.total_members,
            icon: Users,
            accent: "text-white/80",
          },
          {
            label: "In training",
            value: data.total_in_training,
            icon: GraduationCap,
            accent: "text-pink-200",
          },
          {
            label: "Signed off",
            value: data.total_signed_off,
            icon: GraduationCap,
            accent: "text-emerald-200",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="sop-glass-panel rounded-2xl p-4 md:p-5"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
              <stat.icon className="h-4 w-4" />
              {stat.label}
            </div>
            <p className={cn("mt-2 text-3xl font-bold", stat.accent)}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        variants={motionCfg.reveal}
        className="grid gap-4 lg:grid-cols-2"
      >
        <div className="sop-glass-panel rounded-2xl p-4 md:p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Completion rate by role</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart_by_role} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,10,14,0.92)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                  formatter={(value) => [`${value}%`, "Completion rate"]}
                />
                <Bar dataKey="completion_rate" fill="#ec4899" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sop-glass-panel rounded-2xl p-4 md:p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Training status</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.chart_totals}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                >
                  {data.chart_totals.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,10,14,0.92)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                />
                <Legend wrapperStyle={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      <motion.div variants={motionCfg.reveal} className="sop-glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-4 py-3 md:px-5">
          <h3 className="text-sm font-bold text-white">Per-role breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/40">
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Completion rate</th>
                <th className="px-4 py-3">In training</th>
                <th className="px-4 py-3">Signed off</th>
              </tr>
            </thead>
            <tbody>
              {data.roles.map((role) => {
                const cfg = SOP_COLOR_STYLES[role.role_color];
                return (
                  <tr
                    key={role.role_id}
                    className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className={cn("px-4 py-3 font-medium", cfg.text)}>{role.role_name}</td>
                    <td className="px-4 py-3 text-white/70">{role.member_count}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-semibold text-pink-200">
                        {role.completion_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/65">{role.in_training_count}</td>
                    <td className="px-4 py-3 text-emerald-200/90">{role.signed_off_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div variants={motionCfg.reveal} className="sop-glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-4 py-3 md:px-5">
          <h3 className="text-sm font-bold text-white">Members behind</h3>
          <p className="text-xs text-white/40">Incomplete training, sorted by days since last activity</p>
        </div>
        {data.behind.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-white/40 md:px-5">
            Everyone is caught up — no members behind on training.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/40">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Inactive</th>
                  <th className="px-4 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {data.behind.map((row) => (
                  <tr
                    key={`${row.user_id}:${row.role_id}`}
                    className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-medium text-white/85">{row.user_name}</td>
                    <td className="px-4 py-3 text-white/65">{row.role_name}</td>
                    <td className="px-4 py-3 text-white/65">
                      {row.completed_count}/{row.total_functions} ({row.percent}%)
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          row.days_behind >= 7
                            ? "bg-rose-500/15 text-rose-200"
                            : row.days_behind >= 3
                              ? "bg-amber-500/15 text-amber-200"
                              : "bg-white/10 text-white/70"
                        )}
                      >
                        {formatRelativeDays(row.days_behind)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/45">
                      {row.last_activity_at
                        ? new Date(row.last_activity_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
