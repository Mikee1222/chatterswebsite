"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  BarChart3,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  DollarSign,
  Loader2,
  MessageSquare,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Send,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
  Unlock,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Label, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/contexts/toast-context";
import {
  createChallengeAction,
  deleteChallengeAction,
  updateChallengeAction,
  type ChallengeData,
} from "@/app/actions/challenges";
import type { AppNotification } from "@/types";
import type { ChallengeRow } from "@/services/challenges";
import {
  CHALLENGE_METRICS,
  CHALLENGE_METRIC_LABELS,
  type ChallengeMetric,
  type ChallengeStatus,
  formatChallengeValue,
  getChallengeStatus,
  daysRemainingYmd,
  isInflowwChallengeMetric,
  challengeMetricKind,
} from "@/lib/challenges";
import { cn } from "@/lib/utils";

type FilterTab = "all" | ChallengeStatus;

const cardClass = cn(
  "rounded-xl border border-white/[0.08] bg-zinc-950/80",
  "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
);

const pinkButtonClass =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

const METRIC_LABELS = CHALLENGE_METRIC_LABELS;

const METRIC_ICONS: Record<ChallengeMetric, React.ComponentType<{ className?: string }>> = {
  transactions: TrendingUp,
  whales_added: Star,
  shift_hours: Clock,
  customs_completed: CheckSquare,
  whale_status_upgrades: ArrowUp,
  rebills_verified: RefreshCw,
  infloww_sales: DollarSign,
  infloww_ppv_sales: DollarSign,
  infloww_tips: DollarSign,
  infloww_messages: MessageSquare,
  infloww_ppvs_sent: Send,
  infloww_ppvs_unlocked: Unlock,
  infloww_unlock_rate: Percent,
  infloww_golden_ratio: BarChart3,
  infloww_fans_chatted: Users,
  infloww_rev_per_hour: Zap,
  infloww_rev_per_fan: TrendingUp,
};

function emptyForm(): ChallengeData {
  return {
    title: "",
    description: "",
    target_metric: "transactions",
    target_value: 1,
    reward_points: 0,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    active: true,
    assigned_user_ids: [],
  };
}

function rowToForm(c: ChallengeRow): ChallengeData {
  return {
    title: c.title,
    description: c.description,
    target_metric: c.target_metric,
    target_value: c.target_value,
    reward_points: c.reward_points,
    start_date: c.start_date,
    end_date: c.end_date,
    active: c.active,
    assigned_user_ids: parseChallengeAssignedUserIds(c.assigned_users),
  };
}

function parseChallengeAssignedUserIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function formatChallengeDateShort(ymd: string, includeYear = true): string {
  const s = ymd.trim().slice(0, 10);
  const d = new Date(`${s}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

function formatChallengeDateRange(start: string, end: string): string {
  const startY = start.trim().slice(0, 4);
  const endY = end.trim().slice(0, 4);
  const sameYear = startY === endY;
  return `${formatChallengeDateShort(start, !sameYear)} – ${formatChallengeDateShort(end, true)}`;
}

function daysUntilYmd(startYmd: string, todayYmd: string): number {
  const s = new Date(`${startYmd.trim().slice(0, 10)}T12:00:00.000Z`).getTime();
  const t = new Date(`${todayYmd.trim().slice(0, 10)}T12:00:00.000Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(t)) return 0;
  return Math.max(0, Math.ceil((s - t) / 86400000));
}

function daysSinceYmd(endYmd: string, todayYmd: string): number {
  const e = new Date(`${endYmd.trim().slice(0, 10)}T12:00:00.000Z`).getTime();
  const t = new Date(`${todayYmd.trim().slice(0, 10)}T12:00:00.000Z`).getTime();
  if (Number.isNaN(e) || Number.isNaN(t)) return 0;
  return Math.max(0, Math.ceil((t - e) / 86400000));
}

function scheduleDurationDays(start: string, end: string): number {
  const s = new Date(`${start.trim().slice(0, 10)}T12:00:00.000Z`).getTime();
  const e = new Date(`${end.trim().slice(0, 10)}T12:00:00.000Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(1, Math.ceil((e - s) / 86400000) + 1);
}

function formatTargetValue(metric: ChallengeMetric, value: number): string {
  return formatChallengeValue(metric, value);
}

function targetInputHint(metric: ChallengeMetric): string {
  const kind = challengeMetricKind(metric);
  if (kind === "money") return "Target in dollars (e.g. 5000)";
  if (kind === "rate_pct") return "Target as percent (e.g. 40 for 40%)";
  if (kind === "hours") return "Target in hours";
  return "Target count";
}

function chatterInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function statusBadgeVariant(
  status: ChallengeStatus,
  active: boolean
): { label: string; variant: "emerald" | "blue" | "gray" | "amber" } {
  if (!active) return { label: "Paused", variant: "amber" };
  if (status === "active") return { label: "Active", variant: "emerald" };
  if (status === "upcoming") return { label: "Upcoming", variant: "blue" };
  return { label: "Expired", variant: "gray" };
}

const badgeVariants = {
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  gray: "bg-gray-500/15 text-gray-300 border-gray-500/25",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
} as const;

function StatusBadge({ status, active }: { status: ChallengeStatus; active: boolean }) {
  const { label, variant } = statusBadgeVariant(status, active);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", badgeVariants[variant])}>
      {label}
    </span>
  );
}

function trophyColor(status: ChallengeStatus, active: boolean): string {
  if (!active || status === "expired") return "text-white/35 bg-white/5";
  if (status === "active") return "text-emerald-300 bg-emerald-500/15";
  return "text-blue-300 bg-blue-500/15";
}

function cardBorderClass(status: ChallengeStatus, active: boolean): string {
  if (!active || status === "expired") return "border-l-white/10";
  if (status === "active") return "border-l-emerald-500";
  return "border-l-blue-500";
}

function cardOpacityClass(status: ChallengeStatus, active: boolean): string {
  if (!active || status === "expired") return "opacity-60";
  return "";
}

function daysBadge(
  status: ChallengeStatus,
  c: ChallengeRow,
  todayYmd: string
): { text: string; className: string } {
  if (status === "active") {
    const days = daysRemainingYmd(c.end_date, todayYmd);
    const text =
      days === 0 ? "Ends today" : `${days} day${days === 1 ? "" : "s"} left`;
    return { text, className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" };
  }
  if (status === "upcoming") {
    const days = daysUntilYmd(c.start_date, todayYmd);
    const text =
      days === 0 ? "Starts today" : `Starts in ${days} day${days === 1 ? "" : "s"}`;
    return { text, className: "bg-blue-500/15 text-blue-300 border-blue-500/25" };
  }
  const days = daysSinceYmd(c.end_date, todayYmd);
  const text =
    days === 0 ? "Ended today" : `Ended ${days} day${days === 1 ? "" : "s"} ago`;
  return { text, className: "bg-white/5 text-white/50 border-white/10" };
}

function ActiveToggle({
  checked,
  onChange,
  subtitle,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  subtitle: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div>
        <p className="text-sm font-medium text-white">Active</p>
        <p className="mt-1 text-xs text-white/50">{subtitle}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Toggle challenge active"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full border-2 transition-all duration-200",
          checked
            ? "border-pink-300/55 bg-gradient-to-r from-pink-500 to-fuchsia-600 shadow-[0_0_12px_-2px_hsl(330_80%_55%/0.55)]"
            : "border-white/22 bg-[#262626] hover:border-white/35"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-md transition-transform duration-200",
            checked ? "translate-x-[26px]" : "translate-x-[3px]"
          )}
        />
      </button>
    </div>
  );
}

function MetricSelect({
  value,
  onChange,
}: {
  value: ChallengeMetric;
  onChange: (next: ChallengeMetric) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const SelectedIcon = METRIC_ICONS[value];

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white transition hover:border-white/20 hover:bg-white/8"
      >
        <span className="flex min-w-0 items-center gap-2">
          <SelectedIcon className="h-4 w-4 shrink-0 text-pink-300/80" aria-hidden />
          <span className="truncate">{METRIC_LABELS[value]}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/45 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
          {(
            [
              ["Team activity", CHALLENGE_METRICS.filter((m) => !isInflowwChallengeMetric(m))],
              ["Infloww performance", CHALLENGE_METRICS.filter((m) => isInflowwChallengeMetric(m))],
            ] as const
          ).map(([label, metrics]) => (
            <div key={label}>
              <div className="sticky top-0 bg-[#1a1a1a] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {label}
              </div>
              {metrics.map((m) => {
                const Icon = METRIC_ICONS[m];
                const selected = m === value;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onChange(m);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-white/5",
                      selected ? "bg-pink-500/10 text-pink-100" : "text-white/80"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-white/55" aria-hidden />
                    <span className="flex-1 truncate">{METRIC_LABELS[m]}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0 text-pink-300" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatterMultiSelect({
  chatters,
  selectedIds,
  onChange,
}: {
  chatters: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chatters;
    return chatters.filter((c) => c.name.toLowerCase().includes(q));
  }, [chatters, query]);

  const selected = chatters.filter((c) => selectedIds.includes(c.id));

  return (
    <div className="space-y-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2 text-xs text-white/85"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500/20 text-[10px] font-semibold text-pink-200">
                {chatterInitials(c.name)}
              </span>
              <span className="max-w-[120px] truncate">{c.name}</span>
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => onChange(selectedIds.filter((id) => id !== c.id))}
                className="rounded-full p-0.5 text-white/45 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chatters…"
          className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
        />
      </div>
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-white/45">No chatters match your search.</p>
        ) : (
          filtered.map((ch) => {
            const checked = selectedIds.includes(ch.id);
            return (
              <label
                key={ch.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition hover:bg-white/5",
                  checked && "bg-pink-500/10"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const set = new Set(selectedIds);
                    if (set.has(ch.id)) set.delete(ch.id);
                    else set.add(ch.id);
                    onChange([...set]);
                  }}
                  className="h-4 w-4 rounded border-white/25"
                />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70">
                  {chatterInitials(ch.name)}
                </span>
                <span className="truncate text-white/80">{ch.name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  open,
  deleting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#1a1a1a] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
            <Trash2 className="h-6 w-6 text-red-400" aria-hidden />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Delete challenge</h3>
            <p className="text-sm text-white/40">This action cannot be undone</p>
          </div>
        </div>
        <p className="mb-6 text-sm text-white/60">
          Delete this challenge and all progress rows? All chatters will lose their progress.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 font-medium text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChallengePanel({
  open,
  editingId,
  form,
  setForm,
  assignmentScope,
  setAssignmentScope,
  chatters,
  saving,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  onDelete,
}: {
  open: boolean;
  editingId: string | null;
  form: ChallengeData;
  setForm: React.Dispatch<React.SetStateAction<ChallengeData>>;
  assignmentScope: "all" | "specific";
  setAssignmentScope: React.Dispatch<React.SetStateAction<"all" | "specific">>;
  chatters: { id: string; name: string }[];
  saving: boolean;
  onClose: () => void;
  onSubmitCreate: (e: React.FormEvent) => void;
  onSubmitUpdate: (e: React.FormEvent) => void;
  onDelete: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const durationDays = scheduleDurationDays(form.start_date, form.end_date);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close panel"
            className="fixed inset-0 z-50 cursor-default bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="challenge-panel-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-white/10 bg-[#111111] shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 id="challenge-panel-title" className="text-lg font-semibold text-white">
                {editingId ? "Edit challenge" : "New challenge"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-2 text-white/55 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <form
              onSubmit={editingId ? onSubmitUpdate : onSubmitCreate}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                <section className="space-y-4">
                  <h3 className="text-[13px] font-medium text-white/45">Basic info</h3>
                  <div>
                    <Label htmlFor="ch-title">Title</Label>
                    <Input
                      id="ch-title"
                      required
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ch-desc">Description</Label>
                    <Textarea
                      id="ch-desc"
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="mt-1 min-h-[88px]"
                    />
                  </div>
                  <ActiveToggle
                    checked={form.active}
                    onChange={(active) => setForm((f) => ({ ...f, active }))}
                    subtitle="Only active challenges in the date window count for progress"
                  />
                </section>

                <section className="space-y-4">
                  <h3 className="text-[13px] font-medium text-white/45">Target</h3>
                  <div>
                    <Label>Metric</Label>
                    <div className="mt-1">
                      <MetricSelect
                        value={form.target_metric}
                        onChange={(target_metric) => setForm((f) => ({ ...f, target_metric }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ch-target">Target value</Label>
                      <Input
                        id="ch-target"
                        type="number"
                        required
                        min={challengeMetricKind(form.target_metric) === "count" ? 1 : 0.01}
                        step={
                          challengeMetricKind(form.target_metric) === "count"
                            ? 1
                            : challengeMetricKind(form.target_metric) === "rate_pct"
                              ? 0.1
                              : 0.01
                        }
                        value={form.target_value}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, target_value: Number(e.target.value) || 1 }))
                        }
                        className="mt-1"
                      />
                      <p className="mt-1 text-[11px] text-white/40">{targetInputHint(form.target_metric)}</p>
                    </div>
                    <div>
                      <Label htmlFor="ch-reward">Reward points</Label>
                      <Input
                        id="ch-reward"
                        type="number"
                        required
                        min={0}
                        value={form.reward_points}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, reward_points: Number(e.target.value) || 0 }))
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {isInflowwChallengeMetric(form.target_metric) ? (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                      Infloww challenges only appear for chatters with an Infloww Employee ID linked. Progress updates
                      after each stats sync.
                    </p>
                  ) : null}
                </section>

                <section className="space-y-4">
                  <h3 className="text-[13px] font-medium text-white/45">Schedule</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ch-start">Start date</Label>
                      <Input
                        id="ch-start"
                        type="date"
                        required
                        value={form.start_date}
                        onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ch-end">End date</Label>
                      <Input
                        id="ch-end"
                        type="date"
                        required
                        value={form.end_date}
                        onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-white/45">
                    Duration: {durationDays} day{durationDays === 1 ? "" : "s"}
                  </p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[13px] font-medium text-white/45">Assignment</h3>
                  <div className="flex gap-2">
                    {(["all", "specific"] as const).map((scope) => (
                      <label
                        key={scope}
                        className={cn(
                          "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
                          assignmentScope === scope
                            ? "border-pink-500/40 bg-pink-500/10 text-pink-100"
                            : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                        )}
                      >
                        <input
                          type="radio"
                          name="assignment-scope"
                          value={scope}
                          checked={assignmentScope === scope}
                          onChange={() => {
                            setAssignmentScope(scope);
                            if (scope === "all") setForm((f) => ({ ...f, assigned_user_ids: [] }));
                          }}
                          className="sr-only"
                        />
                        {scope === "all" ? "All chatters" : "Specific chatters"}
                      </label>
                    ))}
                  </div>
                  {assignmentScope === "specific" ? (
                    <ChatterMultiSelect
                      chatters={chatters}
                      selectedIds={form.assigned_user_ids}
                      onChange={(assigned_user_ids) => setForm((f) => ({ ...f, assigned_user_ids }))}
                    />
                  ) : null}
                </section>
              </div>

              <div className="shrink-0 space-y-3 border-t border-white/10 px-5 py-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className={cn("flex-1", pinkButtonClass)}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Save
                  </button>
                </div>
                {editingId ? (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete challenge
                  </button>
                ) : null}
              </div>
            </form>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

export function AdminChallengesClient({
  challenges,
  completionByChallenge,
  activeChatterDenominator,
  todayYmd,
  chatters,
}: {
  challenges: ChallengeRow[];
  completionByChallenge: Record<string, number>;
  activeChatterDenominator: number;
  todayYmd: string;
  chatters: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { addToast } = useToast();

  const [form, setForm] = React.useState<ChallengeData>(() => emptyForm());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [challengeToDelete, setChallengeToDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [assignmentScope, setAssignmentScope] = React.useState<"all" | "specific">("all");

  const denom = Math.max(1, activeChatterDenominator);

  const statusCounts = React.useMemo(() => {
    let active = 0;
    let upcoming = 0;
    let expired = 0;
    for (const c of challenges) {
      const status = getChallengeStatus(c, todayYmd);
      if (status === "active") active += 1;
      else if (status === "upcoming") upcoming += 1;
      else expired += 1;
    }
    return { active, upcoming, expired };
  }, [challenges, todayYmd]);

  const filteredChallenges = React.useMemo(() => {
    if (filter === "all") return challenges;
    return challenges.filter((c) => getChallengeStatus(c, todayYmd) === filter);
  }, [challenges, filter, todayYmd]);

  function payloadForSave(base: ChallengeData): ChallengeData {
    return {
      ...base,
      assigned_user_ids: assignmentScope === "all" ? [] : base.assigned_user_ids,
    };
  }

  function openNewPanel() {
    setEditingId(null);
    setForm(emptyForm());
    setAssignmentScope("all");
    setPanelOpen(true);
  }

  function startEdit(c: ChallengeRow) {
    setEditingId(c.id);
    const next = rowToForm(c);
    setForm(next);
    setAssignmentScope(next.assigned_user_ids.length > 0 ? "specific" : "all");
    setPanelOpen(true);
  }

  function closePanel() {
    setEditingId(null);
    setForm(emptyForm());
    setAssignmentScope("all");
    setPanelOpen(false);
  }

  async function onSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) return;
    setSaving(true);
    try {
      const res = await createChallengeAction(payloadForSave(form));
      if (!res.success) {
        addToast(localToast(`ch-c-${Date.now()}`, "Could not create", res.error, "high"));
        return;
      }
      addToast(localToast(`ch-ok-${Date.now()}`, "Challenge created", "", "normal"));
      closePanel();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(localToast(`ch-c-${Date.now()}`, "Could not create", msg, "high"));
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await updateChallengeAction(editingId, payloadForSave(form));
      if (!res.success) {
        addToast(localToast(`ch-u-${Date.now()}`, "Could not save", res.error, "high"));
        return;
      }
      addToast(localToast(`ch-uok-${Date.now()}`, "Challenge updated", "", "normal"));
      closePanel();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(localToast(`ch-u-${Date.now()}`, "Could not save", msg, "high"));
    } finally {
      setSaving(false);
    }
  }

  function openDeleteConfirm(id: string) {
    if (deleting) return;
    setChallengeToDelete(id);
    setDeleteConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    if (!challengeToDelete) return;
    setDeleting(true);
    setDeletingId(challengeToDelete);
    try {
      const res = await deleteChallengeAction(challengeToDelete);
      if (!res.success) {
        addToast(localToast(`ch-d-${Date.now()}`, "Could not delete", res.error, "high"));
        return;
      }
      addToast(localToast(`ch-dok-${Date.now()}`, "Challenge deleted", "", "normal"));
      if (editingId === challengeToDelete) closePanel();
      setDeleteConfirmOpen(false);
      setChallengeToDelete(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(localToast(`ch-d-${Date.now()}`, "Could not delete", msg, "high"));
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  }

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "upcoming", label: "Upcoming" },
    { id: "expired", label: "Expired" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Challenges</h1>
          <p className="mt-1 text-sm text-white/55">
            {statusCounts.active} active · {statusCounts.upcoming} upcoming · {statusCounts.expired} expired
          </p>
        </div>
        <button type="button" onClick={openNewPanel} className={pinkButtonClass}>
          <Plus className="h-4 w-4" aria-hidden />
          New challenge
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              filter === tab.id
                ? "border-pink-500/40 bg-pink-500/15 text-pink-100"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredChallenges.length === 0 ? (
        <div className={cn(cardClass, "flex flex-col items-center px-6 py-16 text-center")}>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
            <Trophy className="h-7 w-7 text-white/35" aria-hidden />
          </div>
          <h2 className="text-base font-medium text-white">No challenges yet</h2>
          <p className="mt-1 max-w-sm text-sm text-white/45">
            {filter === "all"
              ? "Create a challenge to motivate chatters with rewards."
              : `No ${filter} challenges right now.`}
          </p>
          {filter === "all" ? (
            <button type="button" onClick={openNewPanel} className={cn("mt-6", pinkButtonClass)}>
              Create your first challenge
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredChallenges.map((c) => {
            const status = getChallengeStatus(c, todayYmd);
            const completedN = completionByChallenge[c.id] ?? 0;
            const aggregatePct = Math.min(100, Math.round((completedN / denom) * 100));
            const assignedIds = parseChallengeAssignedUserIds(c.assigned_users);
            const assignmentLabel =
              assignedIds.length === 0 ? "All chatters" : `${assignedIds.length} assigned`;
            const MetricIcon = METRIC_ICONS[c.target_metric];
            const days = daysBadge(status, c, todayYmd);

            return (
              <li
                key={c.id}
                className={cn(
                  cardClass,
                  "overflow-hidden border-l-[3px] p-0",
                  cardBorderClass(status, c.active),
                  cardOpacityClass(status, c.active)
                )}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        trophyColor(status, c.active)
                      )}
                    >
                      <Trophy className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{c.title}</h3>
                        <StatusBadge status={status} active={c.active} />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        aria-label={`Edit ${c.title}`}
                        className="rounded-lg p-2 text-white/55 transition hover:bg-white/10 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === c.id || deleting}
                        onClick={() => openDeleteConfirm(c.id)}
                        aria-label={`Delete ${c.title}`}
                        className="rounded-lg p-2 text-white/55 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>

                  {c.description ? (
                    <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-white/50">
                      {c.description}
                    </p>
                  ) : null}

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] text-white/40">
                        <MetricIcon className="h-3.5 w-3.5" aria-hidden />
                        Metric
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-white/85">
                        {METRIC_LABELS[c.target_metric]}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-white/40">Target</p>
                      <p className="mt-1 text-sm font-medium tabular-nums text-white/85">
                        {formatTargetValue(c.target_metric, c.target_value)}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] text-white/40">
                        <Star className="h-3.5 w-3.5 text-amber-300/80" aria-hidden />
                        Reward
                      </p>
                      <p className="mt-1 text-sm font-medium text-white/85">{c.reward_points} pts</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-white/50">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
                      {formatChallengeDateRange(c.start_date, c.end_date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
                      {assignmentLabel}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] px-5 py-4">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-xs text-white/50">
                        {completedN} / {denom} chatters completed
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[hsl(330,80%,55%)] to-[hsl(280,60%,50%)] transition-[width] duration-500"
                            style={{ width: `${aggregatePct}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-medium tabular-nums text-white/55">
                          {aggregatePct}%
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                        days.className
                      )}
                    >
                      {days.text}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ChallengePanel
        open={panelOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        assignmentScope={assignmentScope}
        setAssignmentScope={setAssignmentScope}
        chatters={chatters}
        saving={saving}
        onClose={closePanel}
        onSubmitCreate={onSubmitCreate}
        onSubmitUpdate={onSubmitUpdate}
        onDelete={() => {
          if (editingId) openDeleteConfirm(editingId);
        }}
      />

      <DeleteConfirmModal
        open={deleteConfirmOpen}
        deleting={deleting}
        onCancel={() => {
          if (deleting) return;
          setDeleteConfirmOpen(false);
          setChallengeToDelete(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
