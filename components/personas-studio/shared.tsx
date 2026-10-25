"use client";

/**
 * Shared flagship UI for Model Personas + AI Creative Studio.
 * Visual chrome only — callers own permissions, API calls, and AI guardrails.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Copy,
  Filter,
  Lock,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { CountUp, LuxuryStatCard } from "@/components/infloww-performance-ui";
import { FilterBar, FilterChip } from "@/components/manager-review-ui";
import {
  BriefCopyButton,
  BriefEmptyState,
  BriefFieldLabel,
  CopyField,
  ModelChip,
  copyExact,
} from "@/components/briefs/shared";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
  VA_TASKS,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export {
  BriefCopyButton,
  BriefEmptyState,
  BriefFieldLabel,
  CopyField,
  ModelChip,
  copyExact,
  CountUp,
  LuxuryStatCard,
  FilterBar,
  FilterChip,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
  VA_TASKS,
  cn,
};

/* ── Page chrome ──────────────────────────────────────────────── */

export function PsPageHeader({
  eyebrow,
  title,
  description,
  action,
  icon: Icon = Sparkles,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <header className="mb-6 md:mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[#D4AF8C]">
            <Icon className="h-5 w-5" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
              {eyebrow}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p
              className="mt-2 max-w-xl text-sm leading-relaxed"
              style={{ color: VA_TASKS.bodyText }}
            >
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
    </header>
  );
}

export type PsStat = {
  label: string;
  value: number;
  accent?: "pink" | "champagne" | "emerald" | "white" | "amber";
  tooltip?: string;
};

export function PsStatsRow({ stats }: { stats: PsStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <LuxuryStatCard
          key={s.label}
          label={s.label}
          value={<CountUp value={s.value} />}
          accent={s.accent ?? "champagne"}
          tooltip={s.tooltip}
          className="!p-3.5 md:!p-4"
        />
      ))}
    </div>
  );
}

export function PsEmptyState({
  title,
  description,
  action,
  icon: Icon = UserRound,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={cn(VA_CARD, "px-6 py-16 text-center")}>
      <Icon className="mx-auto h-10 w-10 text-white/20" aria-hidden />
      <p className="mt-4 text-sm font-medium text-white/60">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-white/35">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PsCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

export function PsFieldLabel({
  children,
  hint,
  required,
}: {
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {children}
        {required ? <span className="ml-1 text-[#FF1493]">*</span> : null}
      </label>
      {hint ? (
        <span
          title={hint}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white/30"
          aria-label={hint}
        >
          <Sparkles className="h-3 w-3" aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

export function PsInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(VA_FILTER_INPUT, "min-h-11 w-full", props.className)}
    />
  );
}

export function PsTextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        VA_FILTER_INPUT,
        "min-h-[88px] w-full resize-y whitespace-pre-wrap leading-relaxed",
        props.className,
      )}
    />
  );
}

export function PsToggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#B8B4B8]",
        disabled && "opacity-40",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-[#FF1493]" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
      {label}
    </label>
  );
}

export function CompletenessRing({
  value,
  size = 36,
  stroke = 3,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const color =
    pct >= 72 ? "#34d399" : pct >= 40 ? "#D4AF8C" : "rgba(255,20,147,0.85)";
  return (
    <svg
      width={size}
      height={size}
      className={cn("shrink-0 -rotate-90", className)}
      aria-label={`${pct}% complete`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        strokeLinecap="round"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90 fill-white/70 text-[9px] font-semibold"
        style={{ transformOrigin: "center", transform: "rotate(90deg)" }}
        fontSize={size < 32 ? 8 : 10}
      >
        {pct}
      </text>
    </svg>
  );
}

export function ModelAvatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-[#D4AF8C]/35 bg-gradient-to-br from-[#FF1493]/25 to-[#D4AF8C]/15 font-semibold text-[#E8D5B5]",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.32) }}
      aria-hidden
    >
      {initials || <UserRound className="h-4 w-4" />}
    </div>
  );
}

export function LockedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90",
        className,
      )}
    >
      <Lock className="h-3 w-3" aria-hidden />
      Locked
    </span>
  );
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-100",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
      Live
    </span>
  );
}

export function SectionDots({
  scores,
  labels,
}: {
  scores: number[];
  labels?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1" aria-label="Section completeness">
      {scores.map((s, i) => (
        <span
          key={i}
          title={labels?.[i] ?? undefined}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            s >= 0.72
              ? "bg-emerald-400"
              : s > 0
                ? "bg-[#D4AF8C]"
                : "bg-white/15",
          )}
        />
      ))}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T | "";
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 rounded-xl border px-3.5 text-xs font-medium transition active:scale-[0.98]",
            value === o.value
              ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-white"
              : "border-white/10 text-white/55",
            disabled && "opacity-40",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PsTagInput({
  values,
  onChange,
  placeholder,
  disabled,
  suggestions,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  suggestions?: string[];
}) {
  const [draft, setDraft] = React.useState("");
  function add(raw?: string) {
    const t = (raw ?? draft).trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setDraft("");
  }
  const unused = (suggestions ?? []).filter((s) => !values.includes(s));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#D4AF8C]/35 bg-[#D4AF8C]/[0.06] px-2.5 py-1 text-xs text-[#D4AF8C]"
          >
            {v}
            {!disabled && (
              <button
                type="button"
                className="min-h-6 min-w-6 text-[#D4AF8C]/70"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <>
          <div className="flex gap-2">
            <PsInput
              value={draft}
              placeholder={placeholder ?? "Add…"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "min-h-11 px-3 py-0")}
              onClick={() => add()}
            >
              Add
            </button>
          </div>
          {unused.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unused.slice(0, 8).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => add(s)}
                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/45 active:border-[#D4AF8C]/40 active:text-[#D4AF8C]"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const EMOJI_PICKER = [
  "❤️",
  "🔥",
  "✨",
  "🥰",
  "😘",
  "💋",
  "😊",
  "😉",
  "💕",
  "🌹",
  "😈",
  "🥵",
  "😏",
  "🫶",
  "💖",
  "😜",
];

export function EmojiPickerRow({
  values,
  onChange,
  disabled,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <PsTagInput values={values} onChange={onChange} disabled={disabled} placeholder="Add emoji…" />
      {!disabled && (
        <div className="flex flex-wrap gap-1">
          {EMOJI_PICKER.map((e) => (
            <button
              key={e}
              type="button"
              disabled={values.includes(e)}
              onClick={() => {
                if (!values.includes(e)) onChange([...values, e]);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-lg disabled:opacity-30"
              aria-label={`Add ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PsCopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return <BriefCopyButton text={text} label="output" className={className} />;
}

export function SaveStatusPill({
  status,
}: {
  status: "saved" | "saving" | "unsaved" | "error" | null;
}) {
  if (!status) return null;
  const map = {
    saved: { label: "Saved", cls: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100" },
    saving: { label: "Saving…", cls: "border-white/15 bg-white/[0.06] text-white/55" },
    unsaved: { label: "Unsaved", cls: "border-amber-400/35 bg-amber-500/15 text-amber-100" },
    error: { label: "Error", cls: "border-rose-400/35 bg-rose-500/15 text-rose-100" },
  } as const;
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-lg border px-2.5 text-[11px] font-semibold",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

export function FiltersSheet({
  open,
  onClose,
  title = "Filters",
  children,
  /** When true, show on all breakpoints (drawer). Default: mobile-only bottom sheet. */
  allBreakpoints = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  allBreakpoints?: boolean;
}) {
  const reduce = useReducedMotion();
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className={cn(
              "fixed inset-0 z-40 bg-black/60",
              !allBreakpoints && "md:hidden",
            )}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className={cn(
              "fixed z-50 overflow-y-auto border border-white/10 bg-[#121014] p-5",
              allBreakpoints
                ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:max-w-md md:rounded-none md:border-l md:pb-5"
                : "inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))] md:hidden",
            )}
            initial={
              reduce
                ? false
                : allBreakpoints
                  ? { x: 40, y: 0, opacity: 0 }
                  : { y: "100%" }
            }
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={
              reduce
                ? undefined
                : allBreakpoints
                  ? { x: 40, opacity: 0 }
                  : { y: "100%" }
            }
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{title}</p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function SearchFilterRow({
  search,
  onSearch,
  onOpenFilters,
  filterCount,
  trailing,
}: {
  search: string;
  onSearch: (v: string) => void;
  onOpenFilters?: () => void;
  filterCount?: number;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search…"
          className={cn(VA_FILTER_INPUT, "min-h-11 w-full pl-9")}
        />
      </div>
      {onOpenFilters ? (
        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            VA_BTN_SECONDARY,
            "inline-flex min-h-11 items-center gap-2 px-3.5 md:hidden",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {filterCount ? (
            <span className="rounded-md bg-[#FF1493]/25 px-1.5 text-[10px] font-bold text-white">
              {filterCount}
            </span>
          ) : null}
        </button>
      ) : null}
      {trailing}
    </div>
  );
}

export function PlatformChip({
  label,
  selected,
  onClick,
  icon: Icon,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-xs font-medium transition active:scale-[0.98]",
        selected
          ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-white"
          : "border-white/10 text-white/55",
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : <Filter className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

export function ResultCard({
  index,
  text,
  actions,
}: {
  index: number;
  text: string;
  actions: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        VA_CARD,
        "border border-white/[0.08] bg-black/25 p-4",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
          Variation {index + 1}
        </span>
      </div>
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-white/90">
        {text}
      </pre>
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </li>
  );
}

export function StreamingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-busy aria-label="Generating">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.04]"
        />
      ))}
    </ul>
  );
}

export function CharGuidance({
  value,
  max,
  soft,
}: {
  value: string;
  max?: number;
  soft?: number;
}) {
  const n = value.length;
  const over = max != null && n > max;
  const warn = soft != null && n > soft && !over;
  return (
    <p
      className={cn(
        "mt-1 text-right text-[10px]",
        over ? "text-rose-300" : warn ? "text-amber-200/80" : "text-white/30",
      )}
    >
      {n}
      {max != null ? ` / ${max}` : ""}
    </p>
  );
}
