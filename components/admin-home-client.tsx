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
  Clock,
  DollarSign,
  FileText,
  Medal,
  StickyNote,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
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

const PINK = "#ec4899";
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
          <div
            className="h-full rounded-full bg-gradient-to-r from-pink-600 to-pink-400 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="w-[5.5rem] shrink-0 text-right text-sm font-medium tabular-nums text-white/90">
        ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}

const cardClass = cn(
  "rounded-xl border border-white/[0.08] bg-zinc-950/80",
  "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
);

const sectionTitleClass = "text-base font-medium text-white/90";

const listStagger = {
  hidden: { opacity: 0 },
  show: (reduced: boolean) => ({
    opacity: 1,
    transition: {
      staggerChildren: reduced ? 0 : 0.06,
      delayChildren: reduced ? 0 : 0.03,
    },
  }),
};

const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: (reduced: boolean) => ({
    opacity: 1,
    y: 0,
    transition: { duration: reduced ? 0 : 0.2, ease: "easeOut" as const },
  }),
};

function activityHref(item: AdminRecentActivityItem): string {
  if (item.kind === "custom_request") return ROUTES.admin.customs;
  return ROUTES.chatter.logTransaction;
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

  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const headerDate = formatHeaderDate(now);

  const totalRevenueDisplay =
    typeof props.totalRevenue !== "number" || Number.isNaN(props.totalRevenue) || (props.sessionCount === 0 && props.totalRevenue === 0)
      ? "—"
      : `$${props.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const recentItems = props.recentActivity.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[1.75rem]">{greeting}</h1>
          <p className="mt-1 text-sm text-white/50">{headerDate}</p>
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
            className="rounded-xl border border-pink-500/35 bg-pink-500/10 px-4 py-2.5 text-sm font-medium text-pink-200 transition-colors hover:border-pink-400/50 hover:bg-pink-500/20"
          >
            Set monthly target
          </button>
        </div>
      </header>

      {targetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="monthly-target-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={() => !targetSaving && setTargetModalOpen(false)} />
          <div
            className="relative w-full max-w-md rounded-xl border border-white/10 bg-zinc-950 shadow-2xl"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 24px 48px -12px rgba(0,0,0,0.7)" }}
          >
            <div className="border-b border-white/[0.08] px-6 py-4">
              <h2 id="monthly-target-title" className="text-lg font-semibold text-white">
                Set monthly target
              </h2>
              <p className="mt-0.5 text-sm text-white/50">Target amount in USD for a chatter this month</p>
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

      {/* 2. Hero stats */}
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
            border: "border-l-emerald-500/80",
          },
          {
            key: "shifts",
            label: "Active shifts",
            value: activeShiftsTotal,
            sub: `${props.activeChatterShifts} chatter · ${props.activeVaShifts} VA`,
            Icon: Clock,
            border: "border-l-sky-500/80",
          },
          {
            key: "today",
            label: "Today's earnings",
            sub: "Infloww · gross",
            Icon: DollarSign,
            border: "border-l-pink-500",
            embeddedEarnings: true as const,
          },
          {
            key: "pending",
            label: "Pending requests",
            value: props.pendingCustomsCount,
            sub: "Customs queue",
            Icon: AlertCircle,
            border: "border-l-amber-500/80",
          },
        ].map((s, i) => (
          <motion.li key={s.key} variants={listItem} custom={reduced} transition={{ delay: reduced ? 0 : i * 0.03 }}>
            <motion.div
              className={cn(cardClass, "h-full border-l-[3px] p-5", s.border)}
              whileHover={reduced ? undefined : { y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-pink-300">
                  <s.Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/50">{s.label}</p>
                  {"embeddedEarnings" in s && s.embeddedEarnings ? (
                    <TodayEarningsCard embedded />
                  ) : (
                    <>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{"value" in s ? s.value : ""}</p>
                      <p className="mt-0.5 text-xs text-white/40">{s.sub}</p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.li>
        ))}
      </motion.ul>

      {/* 3. Revenue overview 60/40 */}
      <section className="grid gap-6 lg:grid-cols-5">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className={cn(cardClass, "p-5 lg:col-span-3")}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={sectionTitleClass}>Revenue trend</h2>
              <p className="mt-0.5 text-sm text-white/45">Last 7 days · logged sessions</p>
            </div>
          </div>
          <div className="mt-4 h-28 w-full">
            <ResponsiveContainer width="100%" height={112}>
              <LineChart data={sparklineWow.sparkline7} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <Tooltip
                  contentStyle={{
                    background: "rgba(9,9,11,0.96)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(v) => [
                    `$${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    "Revenue",
                  ]}
                  labelFormatter={(l) => `Day ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="usd"
                  stroke={PINK}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: PINK, stroke: "#fce7f3", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: reduced ? 0 : 0.05 }}
          className={cn(cardClass, "flex flex-col p-5 lg:col-span-2")}
        >
          <h2 className={sectionTitleClass}>Week over week</h2>
          <p className="mt-0.5 text-sm text-white/45">Trailing 7 days vs prior 7 days</p>
          <div className="mt-5 flex flex-1 flex-col justify-center gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/40">This week</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">
                  ${sparklineWow.thisWeekUsd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40">Prior week</p>
                <p className="mt-0.5 text-lg font-medium tabular-nums text-white/65">
                  ${sparklineWow.prevWeekUsd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
            <div>
              {showWowPct ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums",
                    wowPositive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                  )}
                >
                  {wowPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {wowPositive ? "+" : ""}
                  {wow!.toFixed(1)}%
                </span>
              ) : noPriorWeek && sparklineWow.thisWeekUsd > 0 ? (
                <span className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white/55">No prior-week baseline</span>
              ) : (
                <span className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white/45">—</span>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: reduced ? 0 : 0.08 }}
          className={cn(cardClass, "p-5 lg:col-span-5")}
        >
          <h2 className={sectionTitleClass}>Monthly summary · {formatMonth(month)}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                k: "rev",
                label: "Total revenue",
                body: totalRevenueDisplay,
                hint: "Whale transactions",
                highlight: true,
              },
              {
                k: "sess",
                label: "Sessions",
                body: typeof props.sessionCount !== "number" ? "—" : String(props.sessionCount),
                hint: "Whale sessions",
              },
              {
                k: "avg",
                label: "Avg per session",
                body:
                  props.sessionCount === 0
                    ? "—"
                    : `$${props.avgRevenuePerSession.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                hint: "Revenue average",
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
            ].map((c) => (
              <div
                key={c.k}
                className={cn(
                  "rounded-lg border border-white/[0.06] p-4",
                  c.highlight ? "bg-pink-500/[0.08] ring-1 ring-pink-500/20" : "bg-white/[0.02]"
                )}
              >
                <p className="text-xs text-white/45">{c.label}</p>
                <p className={cn("mt-1.5 font-semibold text-white/95", c.highlight ? "text-xl text-pink-200" : "text-lg")}>{c.body}</p>
                <p className="mt-1 truncate text-xs text-white/35" title={c.hint}>
                  {c.hint}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 4. Operations */}
      <section className="space-y-4">
        <h2 className={sectionTitleClass}>Operations</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              {
                label: "Chatter hours",
                value: props.chatterHoursThisMonth.toFixed(1),
                hint: formatMonth(month),
                accent: "text-white/95",
              },
              {
                label: "VA hours",
                value: props.vaHoursThisMonth.toFixed(1),
                hint: formatMonth(month),
                accent: "text-white/95",
              },
              {
                label: "Free models",
                value: String(props.freeModelsCount),
                hint: "Currently available",
                accent: "text-emerald-300",
              },
              {
                label: "Taken models",
                value: String(props.takenModelsCount),
                hint: "Currently assigned",
                accent: "text-amber-300",
              },
            ] as const
          ).map((op) => (
            <motion.div
              key={op.label}
              className={cn(cardClass, "p-5")}
              whileHover={reduced ? undefined : { y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <p className="text-sm text-white/45">{op.label}</p>
              <p className={cn("mt-2 text-2xl font-semibold tabular-nums", op.accent)}>{op.value}</p>
              <p className="mt-1 text-xs text-white/35">{op.hint}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. Revenue breakdown */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className={cn(cardClass, "p-5 lg:col-span-3")}>
          <h3 className={sectionTitleClass}>Revenue by model</h3>
          <div className="mt-3 max-h-72 space-y-0 overflow-y-auto overscroll-contain pr-1">
            {props.byModel.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/45">No data for this month</p>
            ) : (
              props.byModel.slice(0, 12).map(([name, value]) => <BarRow key={name} label={name} value={value} max={maxModel} />)
            )}
          </div>
        </div>
        <div className={cn(cardClass, "p-5 lg:col-span-2")}>
          <h3 className={sectionTitleClass}>Revenue by chatter</h3>
          <div className="mt-3 max-h-72 space-y-0 overflow-y-auto overscroll-contain pr-1">
            {props.byChatter.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/45">No data for this month</p>
            ) : (
              props.byChatter.slice(0, 10).map(([name, value]) => <BarRow key={name} label={name} value={value} max={maxChatter} />)
            )}
          </div>
        </div>
      </section>

      {/* 6. Daily trend */}
      <section className={cn(cardClass, "p-5")}>
        <h3 className={sectionTitleClass}>Daily revenue · {formatMonth(month)}</h3>
        <p className="mt-0.5 text-sm text-white/45">Last 14 days with logged revenue</p>
        <div className="mt-5 flex items-end gap-2 overflow-x-auto pb-1 sm:gap-3">
          {props.byDay.length === 0 ? (
            <p className="py-4 text-sm text-white/45">No daily data</p>
          ) : (
            props.byDay.slice(-14).map(([day, value]) => (
              <div key={day} className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-2">
                <span className="text-[10px] tabular-nums text-white/40 sm:text-xs">
                  {day.slice(8)}/{day.slice(5, 7)}
                </span>
                <div className="flex h-20 w-full items-end justify-center">
                  <div
                    className="w-full max-w-[2.5rem] rounded-t-md bg-gradient-to-t from-pink-600 to-pink-400 transition-all"
                    style={{ height: `${Math.max(4, maxDay > 0 ? (value / maxDay) * 80 : 0)}px` }}
                    title={`${day}: $${value.toFixed(2)}`}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 7. Leaderboards */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className={cn(cardClass, "p-5")}>
          <h3 className={sectionTitleClass}>Top chatters</h3>
          <p className="mt-0.5 text-sm text-white/45">By revenue · {formatMonth(month)}</p>
          <ul className="mt-4 space-y-2">
            {props.byChatter.length === 0 ? (
              <li className="py-6 text-center text-sm text-white/45">No data for this month</li>
            ) : (
              props.byChatter.slice(0, 5).map(([name, value], i) => (
                <li
                  key={name}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-pink-500/25 hover:bg-pink-500/[0.04] sm:px-4"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <LeaderboardMedal rank={i} />
                    <span className="truncate font-medium text-white/85" title={name}>
                      {name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-pink-300">
                    ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className={cn(cardClass, "p-5")}>
          <h3 className={sectionTitleClass}>Top models</h3>
          <p className="mt-0.5 text-sm text-white/45">By revenue · {formatMonth(month)}</p>
          <ul className="mt-4 space-y-2">
            {props.byModel.length === 0 ? (
              <li className="py-6 text-center text-sm text-white/45">No data for this month</li>
            ) : (
              props.byModel.slice(0, 5).map(([name, value], i) => (
                <li
                  key={name}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-pink-500/25 hover:bg-pink-500/[0.04] sm:px-4"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <LeaderboardMedal rank={i} />
                    <span className="truncate font-medium text-white/85" title={name}>
                      {name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-pink-300">
                    ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* 8. Recent activity */}
      <section className="space-y-4">
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
            <li className="col-span-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
              No recent sessions or customs yet.
            </li>
          ) : (
            recentItems.map((item) => {
              const Icon = item.kind === "whale_session" ? DollarSign : item.pending ? AlertCircle : FileText;
              return (
                <motion.li key={item.id} variants={listItem} custom={reduced}>
                  <Link
                    href={activityHref(item)}
                    className={cn(
                      "group flex gap-4 rounded-xl border border-white/[0.08] bg-zinc-950/60 p-4",
                      "transition-all hover:border-pink-500/30 hover:bg-pink-500/[0.04]"
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-pink-300 transition-colors group-hover:bg-pink-500/20">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white/90">{item.title}</p>
                      <p className="mt-0.5 truncate text-sm text-white/45">{item.subtitle}</p>
                      <p className="mt-2 text-xs text-pink-300/70">{formatRelativeTime(item.atIso)}</p>
                    </div>
                  </Link>
                </motion.li>
              );
            })
          )}
        </motion.ul>
      </section>
    </div>
  );
}
