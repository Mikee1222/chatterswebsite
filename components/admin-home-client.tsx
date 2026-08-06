"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  DollarSign,
  FileText,
  Medal,
  Radio,
  StickyNote,
  TrendingDown,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";
import { Checkbox, Select, ButtonSecondary, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { adminHomeUrl, ROUTES } from "@/lib/routes";
import { upsertMonthlyTargetAction } from "@/app/actions/monthly-targets";
import type {
  AdminDayAmount,
  AdminMonthlyTargetProgress,
  AdminRecentActivityItem,
  AdminSparklineWow,
} from "@/lib/admin-home-dashboard";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  CountUp,
  LuxuryStatCard,
  money,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";

type ChatterOption = { id: string; full_name: string };

type Props = {
  chatters: ChatterOption[];
  yearMonth: string;
  todaySalesUsd: number;
  todayYmd: string;
  totalRevenue: number;
  transactionCount: number;
  avgPerTransaction: number;
  topModelName: string;
  topModelRevenue: number;
  topChatterName: string;
  topChatterRevenue: number;
  byModel: [string, number][];
  byChatter: [string, number][];
  daily14: AdminDayAmount[];
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
  monthlyTarget: AdminMonthlyTargetProgress;
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

const PINK = "#FF1493";
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[parseInt(m ?? "1", 10) - 1] ?? m;
  return `${month} ${y}`;
}

function formatHeaderDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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
    <div className="group flex items-center gap-3 py-2">
      <span className="w-28 shrink-0 truncate text-sm text-white/70 sm:w-36" title={label}>
        {label}
      </span>
      <div className="relative min-w-0 flex-1">
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#FF1493] to-[#DB2777]"
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
      <span className="w-[5.5rem] shrink-0 text-right text-sm font-medium tabular-nums text-white/90">
        {money(value, 0)}
      </span>
    </div>
  );
}

const sectionTitleClass =
  "text-sm font-semibold uppercase tracking-[0.14em] text-white/55";

const listStagger = {
  hidden: { opacity: 0 },
  show: (reduced: boolean) => ({
    opacity: 1,
    transition: {
      staggerChildren: reduced ? 0 : 0.05,
      delayChildren: reduced ? 0 : 0.02,
    },
  }),
};

const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: (reduced: boolean) => ({
    opacity: 1,
    y: 0,
    transition: { duration: reduced ? 0 : 0.22, ease: "easeOut" as const },
  }),
};

function activityHref(item: AdminRecentActivityItem): string {
  if (item.href) return item.href;
  if (item.kind === "custom_request") return ROUTES.admin.customs;
  if (item.kind === "model_live") return ROUTES.admin.modelLiveStreams;
  if (item.kind === "large_transaction") return ROUTES.admin.earnings;
  return ROUTES.admin.whales;
}

function ActivityIcon({ kind }: { kind: AdminRecentActivityItem["kind"] }) {
  if (kind === "large_transaction") return <Zap className="h-4 w-4" />;
  if (kind === "model_live") return <Radio className="h-4 w-4" />;
  if (kind === "custom_request") return <FileText className="h-4 w-4" />;
  return <DollarSign className="h-4 w-4" />;
}

function LeaderboardMedal({ rank }: { rank: number }) {
  if (rank === 0) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20 ring-1 ring-amber-400/40">
        <Medal className="h-4 w-4 text-amber-300" aria-hidden />
      </span>
    );
  }
  if (rank === 1) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-300/15 ring-1 ring-zinc-300/30">
        <Medal className="h-4 w-4 text-zinc-300" aria-hidden />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-400/15 ring-1 ring-orange-400/30">
        <Medal className="h-4 w-4 text-orange-300" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium tabular-nums text-white/50">
      {rank + 1}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="h-10 w-10 rounded-full border border-dashed border-white/15 bg-white/[0.03]" />
      <p className="max-w-xs text-sm text-white/45">{message}</p>
      <p className="text-[11px] text-white/30">Synced from Infloww · Athens timezone</p>
    </div>
  );
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

  const maxModel = Math.max(1, ...props.byModel.map(([, v]) => v), 0);
  const maxChatter = Math.max(1, ...props.byChatter.map(([, v]) => v), 0);
  const maxDay = Math.max(1, ...props.daily14.map((d) => d.usd), 0);

  const activeShiftsTotal = props.activeChatterShifts + props.activeVaShifts;
  const { sparklineWow, monthlyTarget } = props;
  const wow = sparklineWow.wowPercent;
  const wowPositive = wow !== null && wow >= 0;
  const showWowPct = wow !== null && Number.isFinite(wow);
  const noPriorWeek = sparklineWow.prevWeekUsd === 0;

  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const headerDate = formatHeaderDate(now);
  const recentItems = props.recentActivity.slice(0, 10);
  const hasRevenue = props.totalRevenue > 0 || props.transactionCount > 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF8C]/70">
            Admin · Command center
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-[1.85rem]">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-white/45">{headerDate} · Athens</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={month} onChange={handleMonthChange} className="min-w-[160px]" aria-label="Select month">
            {MONTH_OPTIONS.map((ym) => (
              <option key={ym} value={ym} className={selectOptionClass}>
                {formatMonth(ym)}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={handleOpenTargetModal}
            className="rounded-xl border border-[#FF1493]/35 bg-[#FF1493]/10 px-4 py-2.5 text-sm font-medium text-pink-100 transition-colors hover:border-[#FF1493]/55 hover:bg-[#FF1493]/18"
          >
            Set monthly target
          </button>
        </div>
      </header>

      {targetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="monthly-target-title"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden
            onClick={() => !targetSaving && setTargetModalOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.05), 0 24px 48px -12px rgba(0,0,0,0.7)",
            }}
          >
            <div className="border-b border-white/[0.08] px-6 py-4">
              <h2 id="monthly-target-title" className="text-lg font-semibold text-white">
                Set monthly target
              </h2>
              <p className="mt-0.5 text-sm text-white/50">
                Per-chatter USD goal · progress uses Infloww team sales
              </p>
            </div>
            <form onSubmit={handleSubmitMonthlyTarget} className={cn("p-6", formSpace)}>
              {targetError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200/95">
                  {targetError}
                </div>
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
              <FormField
                label="Month"
                icon={<CalendarDays className="h-4 w-4" aria-hidden />}
                htmlFor="monthly-target-month"
                staggerIndex={1}
              >
                <Select
                  id="monthly-target-month"
                  value={targetMonthKey}
                  onChange={(e) => setTargetMonthKey(e.target.value)}
                  className="w-full"
                >
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
                description="When off, the target is stored but excluded from agency progress."
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

      {/* Monthly target progress */}
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className={cn(VA_CARD, VA_CARD_GLOW, "border border-white/10 bg-white/5 p-5 md:p-6")}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={sectionTitleClass}>
              Monthly target
              <span className="ml-1.5 inline-flex align-middle">
                <StatInfoTooltip text="Sum of active chatter targets for this month vs team sales from Infloww employee daily stats (Athens)." />
              </span>
            </h2>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white md:text-3xl">
              <CountUp value={monthlyTarget.achievedUsd} format={(n) => money(n, 0)} />
              <span className="text-lg font-medium text-white/40 md:text-xl">
                {" "}
                of {monthlyTarget.targetUsd > 0 ? money(monthlyTarget.targetUsd, 0) : "—"}
              </span>
            </p>
            <p className="mt-1 text-xs text-white/40">
              {monthlyTarget.targetCount > 0
                ? `${monthlyTarget.targetCount} active target${monthlyTarget.targetCount === 1 ? "" : "s"} · ${formatMonth(month)}`
                : `No active targets for ${formatMonth(month)} — set one to track progress`}
            </p>
          </div>
          <p className="text-sm font-semibold tabular-nums text-[#FF1493]">
            {monthlyTarget.targetUsd > 0 ? `${monthlyTarget.progressPct.toFixed(0)}%` : "—"}
          </p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#FF1493] to-[#D4AF8C]"
            initial={{ width: 0 }}
            animate={{
              width: `${monthlyTarget.targetUsd > 0 ? monthlyTarget.progressPct : 0}%`,
            }}
            transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </motion.section>

      {/* Hero ops + today */}
      <motion.ul
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        variants={listStagger}
        initial="hidden"
        animate="show"
        custom={reduced}
      >
        <motion.li variants={listItem} custom={reduced}>
          <LuxuryStatCard
            label="Total models"
            value={<CountUp value={props.totalModelsCount} format={(n) => String(Math.round(n))} />}
            hint={`${props.freeModelsCount} free · ${props.takenModelsCount} taken`}
            accent="emerald"
          />
        </motion.li>
        <motion.li variants={listItem} custom={reduced}>
          <LuxuryStatCard
            label="Active shifts"
            value={<CountUp value={activeShiftsTotal} format={(n) => String(Math.round(n))} />}
            hint={`${props.activeChatterShifts} chatter · ${props.activeVaShifts} VA`}
            accent="champagne"
          />
        </motion.li>
        <motion.li variants={listItem} custom={reduced}>
          <LuxuryStatCard
            label="Today's earnings"
            value={<CountUp value={props.todaySalesUsd} format={(n) => money(n)} />}
            hint={`${props.todayYmd} · Infloww daily stats`}
            tooltip="Sum of employee-report sales for today (Athens) from synced infloww_daily_stats."
            accent="pink"
            glow
          />
        </motion.li>
        <motion.li variants={listItem} custom={reduced}>
          <LuxuryStatCard
            label="Pending requests"
            value={
              <CountUp value={props.pendingCustomsCount} format={(n) => String(Math.round(n))} />
            }
            hint="Customs queue"
            accent="amber"
          />
        </motion.li>
      </motion.ul>

      {/* Revenue trend + WoW */}
      <section className="grid gap-4 lg:grid-cols-5">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5 lg:col-span-3")}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={sectionTitleClass}>
                Revenue trend
                <span className="ml-1.5 inline-flex align-middle">
                  <StatInfoTooltip text="Team sales by day from infloww_daily_stats (last 7 Athens days)." />
                </span>
              </h2>
              <p className="mt-1 text-sm text-white/40">Last 7 days · synced sales</p>
            </div>
          </div>
          {sparklineWow.sparkline7.every((d) => d.usd === 0) ? (
            <EmptyState message="No sales in the last 7 days yet." />
          ) : (
            <div className="mt-4 h-28 w-full">
              <ResponsiveContainer width="100%" height={112}>
                <LineChart
                  data={sparklineWow.sparkline7}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <Tooltip
                    contentStyle={{
                      background: "rgba(9,9,11,0.96)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(v) => [money(Number(v ?? 0)), "Sales"]}
                    labelFormatter={(l) => `Day ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="usd"
                    stroke={PINK}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: PINK, stroke: "#fce7f3", strokeWidth: 2 }}
                    isAnimationActive={!reduced}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: reduced ? 0 : 0.05 }}
          className={cn(VA_CARD, "flex flex-col border border-white/10 bg-white/5 p-5 lg:col-span-2")}
        >
          <h2 className={sectionTitleClass}>
            Week over week
            <span className="ml-1.5 inline-flex align-middle">
              <StatInfoTooltip text="Trailing 7 Athens days vs the prior 7, using employee daily sales." />
            </span>
          </h2>
          <p className="mt-1 text-sm text-white/40">Trailing 7 vs prior 7</p>
          <div className="mt-5 flex flex-1 flex-col justify-center gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/40">This week</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">
                  <CountUp value={sparklineWow.thisWeekUsd} format={(n) => money(n, 0)} />
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40">Prior week</p>
                <p className="mt-0.5 text-lg font-medium tabular-nums text-white/65">
                  <CountUp value={sparklineWow.prevWeekUsd} format={(n) => money(n, 0)} />
                </p>
              </div>
            </div>
            <div>
              {showWowPct ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums",
                    wowPositive
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  )}
                >
                  {wowPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {wowPositive ? "+" : ""}
                  {wow!.toFixed(1)}%
                </span>
              ) : noPriorWeek && sparklineWow.thisWeekUsd > 0 ? (
                <span className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white/55">
                  No prior-week baseline
                </span>
              ) : (
                <span className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white/45">—</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Monthly summary */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: reduced ? 0 : 0.08 }}
          className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5 lg:col-span-5")}
        >
          <h2 className={sectionTitleClass}>Monthly summary · {formatMonth(month)}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                k: "rev",
                label: "Total revenue",
                body: hasRevenue ? (
                  <CountUp value={props.totalRevenue} format={(n) => money(n)} />
                ) : (
                  "—"
                ),
                hint: "Employee daily sales",
                tooltip: "Team sales from infloww_daily_stats for the selected Athens month.",
                highlight: true,
              },
              {
                k: "txs",
                label: "Total transactions",
                body: hasRevenue ? (
                  <CountUp
                    value={props.transactionCount}
                    format={(n) => Math.round(n).toLocaleString()}
                  />
                ) : (
                  "—"
                ),
                hint: "infloww_transactions",
                tooltip: "Count of synced Infloww creator transactions in the month.",
              },
              {
                k: "avg",
                label: "Avg per transaction",
                body:
                  props.transactionCount === 0 ? (
                    "—"
                  ) : (
                    <CountUp value={props.avgPerTransaction} format={(n) => money(n)} />
                  ),
                hint: "Gross ÷ count",
                tooltip: "Sum of transaction gross ÷ transaction count (creator earnings).",
              },
              {
                k: "tm",
                label: "Top model",
                body: props.byModel.length === 0 ? "—" : props.topModelName,
                hint:
                  props.byModel.length === 0
                    ? "—"
                    : money(props.topModelRevenue ?? 0),
                tooltip: "Highest gross from infloww_transactions by model.",
              },
              {
                k: "tc",
                label: "Top chatter",
                body: props.byChatter.length === 0 ? "—" : props.topChatterName,
                hint:
                  props.byChatter.length === 0
                    ? "—"
                    : money(props.topChatterRevenue ?? 0),
                tooltip: "Highest sales from infloww_daily_stats (same ranking as Chatter Performance).",
              },
            ].map((c) => (
              <div
                key={c.k}
                className={cn(
                  "rounded-xl border border-white/[0.06] p-4",
                  c.highlight
                    ? "bg-[#FF1493]/[0.08] ring-1 ring-[#FF1493]/20"
                    : "bg-white/[0.02]"
                )}
              >
                <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  {c.label}
                  <StatInfoTooltip text={c.tooltip} />
                </p>
                <p
                  className={cn(
                    "mt-1.5 font-semibold text-white/95",
                    c.highlight ? "text-xl text-pink-200" : "text-lg"
                  )}
                >
                  {c.body}
                </p>
                <p className="mt-1 truncate text-xs text-white/35" title={String(c.hint)}>
                  {c.hint}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Operations */}
      <section className="space-y-3">
        <h2 className={sectionTitleClass}>Operations</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              {
                label: "Chatter hours",
                value: props.chatterHoursThisMonth,
                hint: formatMonth(month),
                accent: "pink" as const,
                digits: 1,
              },
              {
                label: "VA hours",
                value: props.vaHoursThisMonth,
                hint: formatMonth(month),
                accent: "champagne" as const,
                digits: 1,
              },
              {
                label: "Free models",
                value: props.freeModelsCount,
                hint: "Currently available",
                accent: "emerald" as const,
                digits: 0,
              },
              {
                label: "Taken models",
                value: props.takenModelsCount,
                hint: "Currently assigned",
                accent: "amber" as const,
                digits: 0,
              },
            ] as const
          ).map((op) => (
            <LuxuryStatCard
              key={op.label}
              label={op.label}
              value={
                <CountUp
                  value={op.value}
                  format={(n) =>
                    op.digits === 1 ? n.toFixed(1) : String(Math.round(n))
                  }
                />
              }
              hint={op.hint}
              accent={op.accent}
            />
          ))}
        </div>
      </section>

      {/* Revenue by model / chatter */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5 lg:col-span-3")}>
          <h3 className={sectionTitleClass}>
            Revenue by model
            <span className="ml-1.5 inline-flex align-middle">
              <StatInfoTooltip text="Gross from synced infloww_transactions grouped by model (Creator Earnings)." />
            </span>
          </h3>
          <div className="mt-3 max-h-72 space-y-0 overflow-y-auto overscroll-contain pr-1">
            {props.byModel.length === 0 ? (
              <EmptyState message="No model revenue for this month." />
            ) : (
              props.byModel
                .slice(0, 12)
                .map(([name, value]) => (
                  <BarRow key={name} label={name} value={value} max={maxModel} />
                ))
            )}
          </div>
        </div>
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5 lg:col-span-2")}>
          <h3 className={sectionTitleClass}>
            Revenue by chatter
            <span className="ml-1.5 inline-flex align-middle">
              <StatInfoTooltip text="Employee daily sales by chatter — same source as Chatter Performance." />
            </span>
          </h3>
          <div className="mt-3 max-h-72 space-y-0 overflow-y-auto overscroll-contain pr-1">
            {props.byChatter.length === 0 ? (
              <EmptyState message="No chatter sales for this month." />
            ) : (
              props.byChatter
                .slice(0, 10)
                .map(([name, value]) => (
                  <BarRow key={name} label={name} value={value} max={maxChatter} />
                ))
            )}
          </div>
        </div>
      </section>

      {/* Daily 14 */}
      <section className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
        <h3 className={sectionTitleClass}>
          Daily revenue · last 14 days
          <span className="ml-1.5 inline-flex align-middle">
            <StatInfoTooltip text="Team sales per Athens day from infloww_daily_stats." />
          </span>
        </h3>
        <p className="mt-1 text-sm text-white/40">Infloww synced · Athens</p>
        <div className="mt-5 flex items-end gap-2 overflow-x-auto pb-1 sm:gap-3">
          {props.daily14.every((d) => d.usd === 0) ? (
            <EmptyState message="No daily sales in the last 14 days." />
          ) : (
            props.daily14.map((d) => (
              <div
                key={d.ymd}
                className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-2"
                title={`${d.ymd}: ${money(d.usd)}`}
              >
                <span className="text-[10px] tabular-nums text-white/40 sm:text-xs">
                  {d.ymd.slice(8)}/{d.ymd.slice(5, 7)}
                </span>
                <div className="flex h-20 w-full items-end justify-center">
                  <motion.div
                    className="w-full max-w-[2.5rem] rounded-t-md bg-gradient-to-t from-[#FF1493] to-[#D4AF8C]"
                    initial={{ height: 4 }}
                    whileInView={{
                      height: Math.max(4, maxDay > 0 ? (d.usd / maxDay) * 80 : 0),
                    }}
                    viewport={{ once: true }}
                    transition={{ duration: reduced ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Leaderboards */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
          <h3 className={sectionTitleClass}>Top chatters</h3>
          <p className="mt-1 text-sm text-white/40">By sales · {formatMonth(month)}</p>
          <ul className="mt-4 space-y-2">
            {props.byChatter.length === 0 ? (
              <li>
                <EmptyState message="No chatter rankings for this month." />
              </li>
            ) : (
              props.byChatter.slice(0, 5).map(([name, value], i) => (
                <li
                  key={name}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-[#FF1493]/25 hover:bg-[#FF1493]/[0.04] sm:px-4"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <LeaderboardMedal rank={i} />
                    <span className="truncate font-medium text-white/85" title={name}>
                      {name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-[#FF1493]">
                    {money(value)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
          <h3 className={sectionTitleClass}>Top models</h3>
          <p className="mt-1 text-sm text-white/40">By gross · {formatMonth(month)}</p>
          <ul className="mt-4 space-y-2">
            {props.byModel.length === 0 ? (
              <li>
                <EmptyState message="No model rankings for this month." />
              </li>
            ) : (
              props.byModel.slice(0, 5).map(([name, value], i) => (
                <li
                  key={name}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-[#FF1493]/25 hover:bg-[#FF1493]/[0.04] sm:px-4"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <LeaderboardMedal rank={i} />
                    <span className="truncate font-medium text-white/85" title={name}>
                      {name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-[#FF1493]">
                    {money(value)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* Recent activity */}
      <section className="space-y-3">
        <h2 className={sectionTitleClass}>Recent activity</h2>
        <motion.ul
          className="grid gap-3 sm:grid-cols-2"
          variants={listStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          custom={reduced}
        >
          {recentItems.length === 0 ? (
            <li className="col-span-full">
              <EmptyState message="No recent sales, lives, or customs yet." />
            </li>
          ) : (
            recentItems.map((item) => (
              <motion.li key={item.id} variants={listItem} custom={reduced}>
                <Link
                  href={activityHref(item)}
                  className={cn(
                    "group flex gap-4 rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-4",
                    "transition-all hover:border-[#FF1493]/30 hover:bg-[#FF1493]/[0.04]"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF1493]/10 text-pink-300 transition-colors group-hover:bg-[#FF1493]/20">
                    {item.kind === "custom_request" && item.pending ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <ActivityIcon kind={item.kind} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white/90">{item.title}</p>
                    <p className="mt-0.5 truncate text-sm text-white/45">{item.subtitle}</p>
                    <p className="mt-2 text-xs text-[#FF1493]/70">
                      {formatRelativeTime(item.atIso)}
                    </p>
                  </div>
                </Link>
              </motion.li>
            ))
          )}
        </motion.ul>
      </section>
    </div>
  );
}
