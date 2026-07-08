"use client";

import * as React from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { AlertTriangle, GraduationCap, Users } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SopEmptyState } from "@/components/sop/sop-empty-state";
import { SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { useSopMotion } from "@/components/sop/sop-motion";
import { cn } from "@/lib/utils";
import type { SopAcademyOverview } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  "In training": "#ec4899",
  "Completed training": "#a78bfa",
  "Signed off": "#34d399",
};

const chartAxisStroke = "rgba(255,255,255,0.45)";
const chartTickStyle = { fill: "rgba(255,255,255,0.55)", fontSize: 11 };

const chartTooltipStyle: React.CSSProperties = {
  backgroundColor: "rgba(0,0,0,0.88)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  color: "rgba(255,255,255,0.92)",
};

const chartTooltipLabelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.7)",
};

const chartTooltipItemStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.92)",
};
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });

function formatRelativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function statusColor(name: string, index: number): string {
  return STATUS_COLORS[name] ?? ["#ec4899", "#a78bfa", "#34d399"][index % 3];
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

  const pieTotal = data.chart_totals.reduce((sum, d) => sum + d.value, 0);
  const pieSegments = data.chart_totals.filter((d) => d.value > 0);
  const allZeroCompletion = data.chart_by_role.every((r) => r.completion_rate === 0);
  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={motionCfg.stagger}
    >
      <motion.div
        variants={motionCfg.reveal}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
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
            label: "Completed training",
            value: data.total_completed,
            icon: GraduationCap,
            accent: "text-violet-200",
          },
          {
            label: "Signed off",
            value: data.total_signed_off,
            icon: GraduationCap,
            accent: "text-emerald-200",
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            whileHover={motionCfg.hoverLift}
            className="sop-glass-panel rounded-2xl p-4 transition-[border-color,box-shadow] duration-300 hover:border-white/14 md:p-5"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
              <stat.icon className="h-4 w-4" />
              {stat.label}
            </div>
            <p className={cn("mt-2 text-3xl font-bold tabular-nums", stat.accent)}>{stat.value}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={motionCfg.reveal}
        className="grid gap-4 lg:grid-cols-2"
      >
        <div className="sop-glass-panel rounded-2xl p-4 md:p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Completion rate by role</h3>
          <div className="relative h-64 w-full">
            {allZeroCompletion ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
                <p className="text-sm font-medium text-white/55">No completions yet</p>
                <p className="max-w-xs text-xs text-white/35">
                  Completion bars will appear once members finish academy steps.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chart_by_role} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={chartAxisStroke}
                    tick={chartTickStyle}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={chartAxisStroke}
                    tick={chartTickStyle}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                    formatter={(value) => [`${value}%`, "Completion rate"]}
                  />
                  <Bar dataKey="completion_rate" radius={[6, 6, 0, 0]} minPointSize={3}>
                    {data.chart_by_role.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.completion_rate > 0
                            ? "#ec4899"
                            : "rgba(236, 72, 153, 0.25)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="sop-glass-panel rounded-2xl p-4 md:p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Training status</h3>
          <div className="relative h-64 w-full">
            {pieTotal === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
                <p className="text-sm font-medium text-white/55">No training activity yet</p>
                <p className="max-w-xs text-xs text-white/35">
                  Status breakdown appears when members start academy training.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSegments}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={pieSegments.length > 1 ? 3 : 0}
                    stroke="rgba(10, 10, 16, 0.9)"
                    strokeWidth={2}
                  >
                    {pieSegments.map((entry, i) => (
                      <Cell key={entry.name} fill={statusColor(entry.name, i)} />
                    ))}
                  </Pie>
                  <text
                    x="50%"
                    y="46%"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.92)"
                    fontSize={22}
                    fontWeight={700}
                  >
                    {pieTotal}
                  </text>
                  <text
                    x="50%"
                    y="46%"
                    dy={18}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.42)"
                    fontSize={11}
                    fontWeight={500}
                  >
                    total
                  </text>
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend
                    verticalAlign="bottom"
                    content={() => (
                      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-2">
                        {data.chart_totals.map((entry, i) => (
                          <li
                            key={entry.name}
                            className="flex items-center gap-1.5 text-xs text-white/65"
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: statusColor(entry.name, i) }}
                              aria-hidden
                            />
                            {entry.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div variants={motionCfg.reveal} className="sop-glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-4 py-3 md:px-5">
          <h3 className="text-sm font-bold text-white">Per-role breakdown</h3>
        </div>
        <div className="sop-table-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/40">
                <th className="px-4 py-3 md:px-5">Role</th>
                <th className="px-4 py-3 md:px-5">Members</th>
                <th className="px-4 py-3 md:px-5">Completion rate</th>
                <th className="px-4 py-3 md:px-5">In training</th>
                <th className="px-4 py-3 md:px-5">Completed training</th>
                <th className="px-4 py-3 md:px-5">Signed off</th>
              </tr>
            </thead>
            <tbody>
              {data.roles.map((role) => {
                const cfg = SOP_COLOR_STYLES[role.role_color];
                return (
                  <tr
                    key={role.role_id}
                    className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className={cn("px-4 py-3 font-medium md:px-5", cfg.text)}>{role.role_name}</td>
                    <td className="px-4 py-3 tabular-nums text-white/70 md:px-5">{role.member_count}</td>
                    <td className="px-4 py-3 md:px-5">
                      <span className="inline-flex rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-semibold text-pink-200">
                        {role.completion_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-pink-200/85 md:px-5">{role.in_training_count}</td>
                    <td className="px-4 py-3 tabular-nums text-violet-200/90 md:px-5">{role.completed_count}</td>
                    <td className="px-4 py-3 tabular-nums text-emerald-200/90 md:px-5">{role.signed_off_count}</td>
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
          <div className="sop-table-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/40">
                  <th className="px-4 py-3 md:px-5">Member</th>
                  <th className="px-4 py-3 md:px-5">Role</th>
                  <th className="px-4 py-3 md:px-5">Progress</th>
                  <th className="px-4 py-3 md:px-5">Inactive</th>
                  <th className="px-4 py-3 md:px-5">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {data.behind.map((row) => (
                  <tr
                    key={`${row.user_id}:${row.role_id}`}
                    className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3 font-medium text-white/85 md:px-5">{row.user_name}</td>
                    <td className="px-4 py-3 text-white/65 md:px-5">{row.role_name}</td>
                    <td className="px-4 py-3 tabular-nums text-white/65 md:px-5">
                      {row.completed_count}/{row.total_functions} ({row.percent}%)
                    </td>
                    <td className="px-4 py-3 md:px-5">
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
                    <td className="px-4 py-3 text-xs text-white/45 md:px-5">
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
