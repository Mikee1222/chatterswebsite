"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Clock,
  DollarSign,
  FileText,
  StickyNote,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";
import { Checkbox, Select, ButtonSecondary, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { adminHomeUrl, ROUTES } from "@/lib/routes";
import { upsertMonthlyTargetAction } from "@/app/actions/monthly-targets";
import { TodayEarningsCard } from "@/components/today-earnings-card";
import type { AdminRecentActivityItem, AdminSparklineWow } from "@/lib/admin-home-dashboard";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type ChatterOption = { id: string; full_name: string };

type Props = {
  chatters: ChatterOption[];
  yearMonth: string;
  totalRevenue: number;
  sessionCount: number;
  avgRevenuePerSession: number;
  topModelName: string;
  topModelRevenue: number;
  topChatterName: string;
  topChatterRevenue: number;
  byModel: [string, number][];
  byChatter: [string, number][];
  byDay: [string, number][];
  activeChatterShifts: number;
  activeVaShifts: number;
  chatterHoursThisMonth: number;
  vaHoursThisMonth: number;
  freeModelsCount: number;
  takenModelsCount: number;
  pendingCustomsCount: number;
  totalModelsCount: number;
  recentActivity: AdminRecentActivityItem[];
  sparklineWow: AdminSparklineWow;
};

const MONTH_OPTIONS = (() => {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
})();

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[parseInt(m ?? "1", 10) - 1] ?? m;
  return `${month} ${y}`;
}

function formatRelativeTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 36) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(new Date(ms).toISOString());
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-32 shrink-0 truncate text-sm text-white/80" title={label}>
        {label}
      </span>
      <div className="min-w-0 flex-1 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-pink-500/80 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-sm font-medium text-white/90">
        ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}

const statCardClass = cn(
  "relative overflow-hidden rounded-2xl border border-white/10 p-5",
  "bg-gradient-to-br from-zinc-900/95 via-zinc-900/80 to-pink-950/25",
  "shadow-[0_8px_32px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]"
);

const listStagger = {
  hidden: { opacity: 0 },
  show: (reduced: boolean) => ({
    opacity: 1,
    transition: {
      staggerChildren: reduced ? 0 : 0.07,
      delayChildren: reduced ? 0 : 0.04,
    },
  }),
};

const listItem = {
  hidden: { opacity: 0, y: 10 },
  show: (reduced: boolean) => ({
    opacity: 1,
    y: 0,
    transition: { duration: reduced ? 0 : 0.22, ease: "easeOut" as const },
  }),
};

function activityHref(item: AdminRecentActivityItem): string {
  if (item.kind === "custom_request") return ROUTES.admin.customs;
  return ROUTES.chatter.logTransaction;
}

export function AdminHomeClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const reduced = Boolean(reduceMotion);

  const [month, setMonth] = React.useState(props.yearMonth);
  const [targetModalOpen, setTargetModalOpen] = React.useState(false);
  const [targetTeamMember, setTargetTeamMember] = React.useState("");
  const [targetMonthKey, setTargetMonthKey] = React.useState(props.yearMonth);
  const [targetAmountUsd, setTargetAmountUsd] = React.useState("");
  const [targetNotes, setTargetNotes] = React.useState("");
  const [targetActive, setTargetActive] = React.useState(true);
  const [targetError, setTargetError] = React.useState<string | null>(null);
  const [targetSaving, setTargetSaving] = React.useState(false);

  React.useEffect(() => {
    setMonth(props.yearMonth);
  }, [props.yearMonth]);

  React.useEffect(() => {
    setTargetMonthKey(props.yearMonth);
  }, [props.yearMonth]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setMonth(v);
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", v);
    router.push(adminHomeUrl(Object.fromEntries(params.entries())));
  };

  const handleOpenTargetModal = () => {
    setTargetError(null);
    setTargetTeamMember("");
    setTargetMonthKey(props.yearMonth);
    setTargetAmountUsd("");
    setTargetNotes("");
    setTargetActive(true);
    setTargetModalOpen(true);
  };

  const handleSubmitMonthlyTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setTargetError(null);
    const teamMember = targetTeamMember.trim();
    const chatter = props.chatters.find((c) => c.id === teamMember);
    if (!teamMember || !chatter) {
      setTargetError("Please select a team member");
      return;
    }
    const amount = parseFloat(targetAmountUsd);
    if (Number.isNaN(amount) || amount < 0) {
      setTargetError("Enter a valid target amount (USD)");
      return;
    }
    setTargetSaving(true);
    const res = await upsertMonthlyTargetAction(
      teamMember,
      chatter.full_name,
      targetMonthKey,
      amount,
      { notes: targetNotes.trim() || undefined, is_active: targetActive }
    );
    setTargetSaving(false);
    if (res.success) {
      setTargetModalOpen(false);
      router.refresh();
    } else {
      setTargetError(res.error ?? "Failed to save");
    }
  };

  const maxModel = Math.max(1, ...props.byModel.map(([, v]) => v));
  const maxChatter = Math.max(1, ...props.byChatter.map(([, v]) => v));
  const maxDay = Math.max(1, ...props.byDay.map(([, v]) => v));

  const activeShiftsTotal = props.activeChatterShifts + props.activeVaShifts;
  const { sparklineWow } = props;
  const wow = sparklineWow.wowPercent;
  const wowPositive = wow !== null && wow >= 0;
  const showWowPct = wow !== null && Number.isFinite(wow);
  const noPriorWeek = sparklineWow.prevWeekUsd === 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Admin control center</h1>
          <p className="mt-1 text-sm text-white/55">Whale earnings and operations overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleOpenTargetModal}
            className="rounded-2xl border border-pink-500/40 bg-pink-500/15 px-4 py-2.5 text-sm font-medium text-pink-200 shadow-[0_0_20px_-6px_rgba(236,72,153,0.25)] transition-all hover:border-pink-400/60 hover:bg-pink-500/25 hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.35)]"
          >
            Set monthly target
          </button>
          <span className="text-sm text-white/55">Month</span>
          <Select value={month} onChange={handleMonthChange} className="min-w-[160px]">
            {MONTH_OPTIONS.map((ym) => (
              <option key={ym} value={ym} className={selectOptionClass}>
                {formatMonth(ym)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {targetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="monthly-target-title">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden onClick={() => !targetSaving && setTargetModalOpen(false)} />
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur-xl"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -12px rgba(0,0,0,0.6)" }}
          >
            <div className="border-b border-white/10 px-6 py-4">
              <h2 id="monthly-target-title" className="text-lg font-semibold text-white">
                Set monthly target
              </h2>
              <p className="mt-0.5 text-sm text-white/55">Target amount in USD for a chatter this month</p>
            </div>
            <form onSubmit={handleSubmitMonthlyTarget} className={cn("p-6", formSpace)}>
              {targetError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200/95">{targetError}</div>
              )}
              <FormField
                label="Team member"
                icon={<UserRound className="h-4 w-4" aria-hidden />}
                htmlFor="monthly-target-member"
                required
                staggerIndex={0}
              >
                <Select
                  id="monthly-target-member"
                  value={targetTeamMember}
                  onChange={(e) => setTargetTeamMember(e.target.value)}
                  required
                  className="w-full"
                >
                  <option value="" className={selectOptionClass}>
                    Select chatter…
                  </option>
                  {props.chatters.map((c) => (
                    <option key={c.id} value={c.id} className={selectOptionClass}>
                      {c.full_name || c.id}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Month" icon={<CalendarDays className="h-4 w-4" aria-hidden />} htmlFor="monthly-target-month" staggerIndex={1}>
                <Select id="monthly-target-month" value={targetMonthKey} onChange={(e) => setTargetMonthKey(e.target.value)} className="w-full">
                  {MONTH_OPTIONS.map((ym) => (
                    <option key={ym} value={ym} className={selectOptionClass}>
                      {formatMonth(ym)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Target amount (USD)"
                icon={<DollarSign className="h-4 w-4" aria-hidden />}
                htmlFor="monthly-target-amount"
                required
                staggerIndex={2}
              >
                <FormInput
                  id="monthly-target-amount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={targetAmountUsd}
                  onChange={(e) => setTargetAmountUsd(e.target.value)}
                  placeholder="5000"
                  required
                />
              </FormField>
              <FormField
                label="Notes (optional)"
                icon={<StickyNote className="h-4 w-4" aria-hidden />}
                htmlFor="monthly-target-notes"
                staggerIndex={3}
              >
                <FormTextarea
                  id="monthly-target-notes"
                  value={targetNotes}
                  onChange={(e) => setTargetNotes(e.target.value)}
                  placeholder="Optional notes…"
                  rows={2}
                />
              </FormField>
              <FormField
                label="Active"
                icon={<BadgeCheck className="h-4 w-4" aria-hidden />}
                description="When off, the target is stored but not used in active reporting."
                staggerIndex={4}
              >
                <Checkbox
                  id="target-active"
                  checked={targetActive}
                  onChange={(e) => setTargetActive(e.target.checked)}
                  label={<span className="text-white/75">Include as an active monthly target</span>}
                />
              </FormField>
              <div className="flex gap-3 pt-2">
                <FormSubmitButton type="submit" loading={targetSaving} className="flex-1">
                  Save
                </FormSubmitButton>
                <ButtonSecondary type="button" onClick={() => !targetSaving && setTargetModalOpen(false)}>
                  Cancel
                </ButtonSecondary>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hero stats */}
      <motion.ul
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
        variants={listStagger}
        initial="hidden"
        animate="show"
        custom={reduced}
      >
        {[
          {
            key: "models",
            label: "Total models",
            value: props.totalModelsCount,
            sub: `${props.freeModelsCount} free · ${props.takenModelsCount} taken`,
            Icon: Users,
            accent: "from-emerald-500/15 to-transparent",
          },
          {
            key: "shifts",
            label: "Active shifts",
            value: activeShiftsTotal,
            sub: `${props.activeChatterShifts} chatter · ${props.activeVaShifts} VA`,
            Icon: Clock,
            accent: "from-sky-500/15 to-transparent",
          },
          {
            key: "today",
            label: "Today's earnings",
            sub: "Infloww · gross",
            Icon: DollarSign,
            accent: "from-pink-500/25 to-transparent",
            embeddedEarnings: true as const,
          },
          {
            key: "pending",
            label: "Pending requests",
            value: props.pendingCustomsCount,
            sub: "Customs queue",
            Icon: AlertCircle,
            accent: "from-amber-500/15 to-transparent",
          },
        ].map((s, i) => (
          <motion.li key={s.key} variants={listItem} custom={reduced} transition={{ delay: reduced ? 0 : i * 0.03 }}>
            <motion.div
              className={cn(statCardClass, "h-full")}
              whileHover={reduced ? undefined : { scale: 1.02, y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              style={{
                boxShadow:
                  "0 12px 40px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(236,72,153,0.08)",
              }}
            >
              <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90", s.accent)} />
              <div className="relative flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300">
                  <s.Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{s.label}</p>
                  {"embeddedEarnings" in s && s.embeddedEarnings ? (
                    <TodayEarningsCard embedded />
                  ) : (
                    <>
                      <p className="mt-1 text-3xl font-bold tabular-nums text-white">{"value" in s ? s.value : ""}</p>
                      <p className="mt-0.5 text-xs text-white/45">{s.sub}</p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.li>
        ))}
      </motion.ul>

      {/* Quick stats: sparkline + WoW */}
      <section className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: reduced ? 0 : 0.12 }}
          className={cn(statCardClass, "p-6")}
        >
          <div className="relative z-[1] flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Whale revenue trend</h2>
              <p className="mt-1 text-sm text-white/60">Last 7 days (logged sessions · USD)</p>
            </div>
          </div>
          <div className="relative z-[1] mt-4 h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineWow.sparkline7} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,10,12,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v) => [
                    `$${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    "Revenue",
                  ]}
                  labelFormatter={(l) => `Day ${l}`}
                />
                <Line type="monotone" dataKey="usd" stroke="#f472b6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#fbcfe8" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: reduced ? 0 : 0.16 }}
          className={cn(statCardClass, "flex flex-col justify-center p-6")}
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Week over week</h2>
          <p className="mt-2 text-sm text-white/55">Trailing 7 days vs previous 7 days (same whale transaction dates)</p>
          <div className="mt-6 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs text-white/45">This week</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">
                ${sparklineWow.thisWeekUsd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/45">Prior week</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-white/70">
                ${sparklineWow.prevWeekUsd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              {showWowPct ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
                    wowPositive ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                  )}
                >
                  {wowPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {wowPositive ? "+" : ""}
                  {wow!.toFixed(1)}%
                </span>
              ) : noPriorWeek && sparklineWow.thisWeekUsd > 0 ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/60">No prior-week baseline</span>
              ) : (
                <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/50">—</span>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Recent activity */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Recent activity</h2>
        <motion.ul
          className="grid gap-3 sm:grid-cols-2"
          variants={listStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          custom={reduced}
        >
          {props.recentActivity.length === 0 ? (
            <li className="col-span-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
              No recent sessions or customs yet.
            </li>
          ) : (
            props.recentActivity.map((item) => {
              const Icon = item.kind === "whale_session" ? DollarSign : item.pending ? AlertCircle : FileText;
              return (
                <motion.li key={item.id} variants={listItem} custom={reduced}>
                  <Link
                    href={activityHref(item)}
                    className={cn(
                      "group flex gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-black/40 p-4",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all",
                      "hover:border-pink-500/30 hover:shadow-[0_8px_28px_-12px_rgba(236,72,153,0.25)]"
                    )}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300 transition-colors group-hover:bg-pink-500/25">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white/95">{item.title}</p>
                      <p className="mt-0.5 truncate text-sm text-white/50">{item.subtitle}</p>
                      <p className="mt-2 text-xs text-pink-300/80">{formatRelativeTime(item.atIso)}</p>
                    </div>
                  </Link>
                </motion.li>
              );
            })
          )}
        </motion.ul>
      </section>

      {/* Month earnings */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Earnings (whale_transactions)</h2>
        <motion.div
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          variants={listStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-24px" }}
          custom={reduced}
        >
          {[
            {
              k: "rev",
              label: "Total whale revenue",
              body:
                typeof props.totalRevenue !== "number" || Number.isNaN(props.totalRevenue) || (props.sessionCount === 0 && props.totalRevenue === 0)
                  ? "—"
                  : `$${props.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              hint: formatMonth(month),
              highlight: true,
            },
            {
              k: "sess",
              label: "Whale sessions",
              body: typeof props.sessionCount !== "number" ? "—" : String(props.sessionCount),
              hint: formatMonth(month),
            },
            {
              k: "avg",
              label: "Avg revenue / session",
              body:
                props.sessionCount === 0
                  ? "—"
                  : `$${props.avgRevenuePerSession.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              hint: formatMonth(month),
            },
            {
              k: "tm",
              label: "Top model",
              body: props.sessionCount === 0 ? "—" : props.topModelName,
              hint:
                props.sessionCount === 0
                  ? "—"
                  : `$${(props.topModelRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
            {
              k: "tc",
              label: "Top chatter",
              body: props.sessionCount === 0 ? "—" : props.topChatterName,
              hint:
                props.sessionCount === 0
                  ? "—"
                  : `$${(props.topChatterRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
          ].map((c, i) => (
            <motion.div key={c.k} variants={listItem} custom={reduced} transition={{ delay: reduced ? 0 : i * 0.02 }}>
              <motion.div
                className={cn(
                  "h-full rounded-2xl border border-white/10 p-5",
                  c.highlight
                    ? "bg-gradient-to-br from-pink-950/40 via-zinc-900/90 to-zinc-950 ring-1 ring-pink-500/20"
                    : "bg-gradient-to-br from-zinc-900/95 to-black/50"
                )}
                whileHover={reduced ? undefined : { scale: 1.02 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{c.label}</p>
                <p className={cn("mt-2 font-semibold text-white/95", c.highlight ? "text-2xl text-pink-200" : "text-xl")}>{c.body}</p>
                <p className="mt-1 text-xs text-white/45">{c.hint}</p>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/40 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/55">Revenue by model</h3>
          <div className="mt-4 max-h-64 space-y-0 overflow-y-auto overscroll-contain pr-2">
            {props.byModel.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/50">No data for this month</p>
            ) : (
              props.byModel.slice(0, 12).map(([name, value]) => <BarRow key={name} label={name} value={value} max={maxModel} />)
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/40 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/55">Revenue by chatter</h3>
          <div className="mt-4 max-h-64 space-y-0 overflow-y-auto overscroll-contain pr-2">
            {props.byChatter.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/50">No data for this month</p>
            ) : (
              props.byChatter.slice(0, 10).map(([name, value]) => <BarRow key={name} label={name} value={value} max={maxChatter} />)
            )}
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-pink-950/20 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/55">Revenue trend ({formatMonth(month)})</h3>
        <div className="mt-4 flex flex-wrap gap-4">
          {props.byDay.length === 0 ? (
            <p className="py-4 text-sm text-white/50">No daily data</p>
          ) : (
            props.byDay.slice(-14).map(([day, value]) => (
              <div key={day} className="flex flex-col items-center gap-1">
                <span className="text-xs text-white/50">
                  {day.slice(8)}/{day.slice(5, 7)}
                </span>
                <div
                  className="flex w-8 min-w-[2rem] items-end justify-center rounded-t bg-pink-500/75 transition-all"
                  style={{ height: `${Math.max(4, maxDay > 0 ? (value / maxDay) * 64 : 0)}px` }}
                  title={`${day}: $${value.toFixed(2)}`}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Operations</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              {
                label: "Chatter hours",
                value: props.chatterHoursThisMonth.toFixed(1),
                hint: formatMonth(month),
                valueClass: "text-white/95",
                boxClass: "bg-white/10",
              },
              {
                label: "VA hours",
                value: props.vaHoursThisMonth.toFixed(1),
                hint: formatMonth(month),
                valueClass: "text-white/95",
                boxClass: "bg-white/10",
              },
              {
                label: "Free models",
                value: String(props.freeModelsCount),
                hint: "Now",
                valueClass: "text-emerald-300",
                boxClass: "bg-emerald-500/20",
              },
              {
                label: "Taken models",
                value: String(props.takenModelsCount),
                hint: "Now",
                valueClass: "text-amber-300",
                boxClass: "bg-amber-500/20",
              },
            ] as const
          ).map((op) => (
            <motion.div
              key={op.label}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5"
              whileHover={reduced ? undefined : { scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <div className={cn("rounded-xl p-3", op.boxClass)}>
                <span className={cn("block text-2xl font-bold tabular-nums", op.valueClass)}>{op.value}</span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{op.label}</p>
                <p className="mt-0.5 text-sm text-white/80">{op.hint}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/40 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/55">Top 5 chatters by revenue</h3>
          <ul className="mt-4 space-y-2">
            {props.byChatter.length === 0 ? (
              <li className="py-4 text-center text-sm text-white/50">No data for this month</li>
            ) : (
              props.byChatter.slice(0, 5).map(([name, value], i) => (
                <li
                  key={name}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.04] px-3 py-2.5 transition-colors hover:border-pink-500/20 hover:bg-pink-500/[0.06] sm:px-4"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-full bg-pink-500/25 text-xs font-bold text-pink-200">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-white/90" title={name}>
                      {name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-pink-200">
                    ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/40 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/55">Top 5 models by revenue</h3>
          <ul className="mt-4 space-y-2">
            {props.byModel.length === 0 ? (
              <li className="py-4 text-center text-sm text-white/50">No data for this month</li>
            ) : (
              props.byModel.slice(0, 5).map(([name, value], i) => (
                <li
                  key={name}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.04] px-3 py-2.5 transition-colors hover:border-pink-500/20 hover:bg-pink-500/[0.06] sm:px-4"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-full bg-pink-500/25 text-xs font-bold text-pink-200">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-white/90" title={name}>
                      {name}
                    </span>
                  </span>
                  <span className="ml-2 shrink-0 text-sm font-semibold tabular-nums text-pink-200">
                    ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
