"use client";

/**
 * Shared flagship UI for Recording / Editing / Posting Briefs.
 * Visual chrome only — callers own permissions, status transitions, and API calls.
 */

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  formatCountdown,
  formatDeadlineMultiZone,
  greeceLocalToUtc,
  utcToGreeceLocalInput,
} from "@/lib/brief-deadlines";
import { CountUp, LuxuryStatCard } from "@/components/infloww-performance-ui";
import { FilterBar, FilterChip } from "@/components/manager-review-ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
  VA_MODEL_TAG,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

/* ── Copy helpers ─────────────────────────────────────────────── */

export async function copyExact(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function BriefCopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyExact(text);
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
      className={cn(
        "inline-flex min-h-11 min-w-[5.5rem] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        "border border-[#D4AF8C]/35 bg-[#D4AF8C]/12 text-[#E8D5B5] active:scale-[0.98]",
        "hover:border-[#D4AF8C]/55 hover:bg-[#D4AF8C]/18",
        className,
      )}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function CopyField({
  label,
  text,
  className,
}: {
  label: string;
  text: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
          {label}
        </p>
        <BriefCopyButton text={text} label={label} />
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
        <BriefPreText value={text} />
      </div>
    </div>
  );
}

export function BriefFieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
      {children}
      {required ? <span className="ml-1 text-[#FF1493]">*</span> : null}
    </label>
  );
}

export function BriefTextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        VA_FILTER_INPUT,
        "min-h-[88px] w-full resize-y whitespace-pre-wrap font-sans leading-relaxed",
        props.className,
      )}
    />
  );
}

export function BriefPreText({ value }: { value: string }) {
  if (!value) return <p className="text-sm text-white/35">—</p>;
  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-white/85">
      {value}
    </pre>
  );
}

/* ── Priority / status / deadline ─────────────────────────────── */

export function PriorityPill({ priority }: { priority: "urgent" | "normal" | string }) {
  const urgent = priority === "urgent";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
        urgent
          ? "border border-rose-400/45 bg-rose-500/20 text-rose-100 shadow-[0_0_18px_-4px_rgba(255,20,147,0.55)]"
          : "border border-white/10 bg-white/[0.04] text-white/45",
      )}
    >
      {urgent ? "Urgent" : "Normal"}
    </span>
  );
}

export function ModelChip({ name }: { name: string }) {
  if (!name) return null;
  return <span className={VA_MODEL_TAG}>{name}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        VA_STATUS_BADGE,
        "border-white/15 bg-white/[0.06] text-white/65",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export type StepperStep = {
  id: string;
  label: string;
};

export function StatusStepper({
  steps,
  current,
  className,
}: {
  steps: StepperStep[];
  current: string;
  className?: string;
}) {
  const idx = Math.max(
    0,
    steps.findIndex((s) => s.id === current),
  );
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-1.5 sm:gap-2",
        className,
      )}
      aria-label="Status"
    >
      {steps.map((step, i) => {
        const done = i < idx;
        const active = step.id === current;
        return (
          <li key={step.id} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20" aria-hidden />
            ) : null}
            <span
              className={cn(
                "inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition",
                active &&
                  "border border-[#FF1493]/45 bg-[#FF1493]/15 text-[#FFB6DE] shadow-[0_0_16px_-6px_rgba(255,20,147,0.5)]",
                done && !active && "border border-emerald-500/25 bg-emerald-500/10 text-emerald-200/80",
                !done && !active && "border border-white/10 bg-white/[0.03] text-white/35",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export const RECORDING_STATUS_STEPS: StepperStep[] = [
  { id: "draft", label: "Draft" },
  { id: "published", label: "Published" },
  { id: "uploaded", label: "Uploaded" },
  { id: "archived", label: "Archived" },
];

export const EDITING_STATUS_STEPS: StepperStep[] = [
  { id: "draft", label: "Draft" },
  { id: "published", label: "Published" },
  { id: "delivered", label: "Delivered" },
  { id: "changes_needed", label: "Changes needed" },
  { id: "approved", label: "Approved" },
  { id: "archived", label: "Archived" },
];

export const POSTING_STATUS_STEPS: StepperStep[] = [
  { id: "draft", label: "Draft" },
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
];

export function DeadlineBadge({
  deadlineAt,
  className,
}: {
  deadlineAt: string | null | undefined;
  className?: string;
}) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (!deadlineAt) return null;
  const multi = formatDeadlineMultiZone(deadlineAt);
  const cd = formatCountdown(deadlineAt, now);
  const soon = !cd.overdue && cd.msRemaining < 6 * 3600_000;
  const tip = `Greece · ${multi.greece}\nNY · ${multi.newYork}\nLA · ${multi.losAngeles}`;

  return (
    <div
      title={tip}
      className={cn(
        "inline-flex flex-col rounded-xl border px-3 py-2",
        cd.overdue
          ? "border-rose-400/45 bg-rose-500/15 text-rose-100"
          : soon
            ? "border-amber-400/40 bg-amber-500/12 text-amber-100"
            : "border-[#D4AF8C]/30 bg-[#D4AF8C]/08 text-[#E8D5B5]",
        className,
      )}
    >
      <span className="text-xs font-semibold">{cd.label}</span>
      <span className="text-[10px] text-white/45">your time · Greece {multi.greece}</span>
    </div>
  );
}

/** Live Greece entry + NY/LA read-only mirrors. */
export function BriefDeadlineFields({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (greeceLocal: string) => void;
  disabled?: boolean;
}) {
  const preview = React.useMemo(() => {
    if (!value.trim()) return null;
    try {
      return formatDeadlineMultiZone(greeceLocalToUtc(value));
    } catch {
      return null;
    }
  }, [value]);

  return (
    <div className="space-y-3">
      <div>
        <BriefFieldLabel>Deadline (Greece)</BriefFieldLabel>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
        />
      </div>
      {preview ? (
        <div className="grid gap-2 text-sm text-white/60 sm:grid-cols-2">
          <p>
            <span className="text-white/35">New York · </span>
            {preview.newYork}
          </p>
          <p>
            <span className="text-white/35">Los Angeles · </span>
            {preview.losAngeles}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function BriefDeadlineBanner({
  deadlineAt,
}: {
  deadlineAt: string | null | undefined;
}) {
  if (!deadlineAt) return null;
  return <DeadlineBadge deadlineAt={deadlineAt} className="w-full sm:w-auto" />;
}

export function deadlineInputFromUtc(utc: string | null | undefined): string {
  return utcToGreeceLocalInput(utc);
}

/* ── Section / path / links ───────────────────────────────────── */

export function SectionCard({
  id,
  icon: Icon,
  title,
  children,
  actions,
  defaultOpen = true,
  collapsible = true,
}: {
  id?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const sectionId = React.useId();

  return (
    <section
      id={id}
      data-brief-section={id}
      className={cn(
        VA_CARD,
        "scroll-mt-28 overflow-hidden border border-white/[0.1] bg-white/[0.03] p-0",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3 md:px-5">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={sectionId}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left md:min-h-0 md:pointer-events-none"
          >
            <Icon className="h-4 w-4 shrink-0 text-[#D4AF8C]/80" aria-hidden />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
              {title}
            </h3>
            <ChevronDown
              className={cn(
                "ml-auto h-4 w-4 shrink-0 text-white/35 transition md:hidden",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-[#D4AF8C]/80" aria-hidden />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
              {title}
            </h3>
          </div>
        )}
        {actions}
      </div>
      <div
        id={sectionId}
        className={cn(
          "px-4 py-4 md:block md:px-5 md:py-5",
          collapsible && !open ? "hidden md:block" : "block",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Alias used by older brief views */
export function BriefSection(
  props: React.ComponentProps<typeof SectionCard>,
) {
  return <SectionCard {...props} />;
}

export function PathBreadcrumb({ path }: { path: string }) {
  if (!path?.trim()) return <p className="text-sm text-white/35">—</p>;
  const parts = path.split(/[/\\]/).filter(Boolean);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 text-sm text-white/70">
        <FolderOpen className="mr-1 h-4 w-4 shrink-0 text-[#D4AF8C]/70" aria-hidden />
        {parts.map((part, i) => (
          <React.Fragment key={`${part}-${i}`}>
            {i > 0 ? <span className="text-white/25">/</span> : null}
            <span className={cn(i === parts.length - 1 && "font-medium text-white/90")}>
              {part}
            </span>
          </React.Fragment>
        ))}
      </div>
      <BriefCopyButton text={path} label="full path" />
    </div>
  );
}

export function BriefReferenceLinks({
  links,
  note,
}: {
  links: string[];
  note: string;
}) {
  if (!links.length) return <p className="text-sm text-white/35">—</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">{note}</p>
      <ul className="space-y-2">
        {links.map((href) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                VA_CARD,
                "flex min-h-12 items-center gap-3 px-4 py-3 text-sm font-medium text-[#E8D5B5] transition hover:border-[#D4AF8C]/35",
              )}
            >
              <ExternalLink className="h-4 w-4 shrink-0 text-[#D4AF8C]/80" aria-hidden />
              <span className="min-w-0 flex-1 break-all">{href}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DoNotAddBlock({ text }: { text: string }) {
  if (!text?.trim()) return <p className="text-sm text-white/35">—</p>;
  return (
    <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-4">
      <div className="mb-2 flex items-center gap-2 text-rose-200">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Do NOT add</p>
      </div>
      <BriefPreText value={text} />
    </div>
  );
}

/* ── Local checklist (never writes DB) ────────────────────────── */

export function useLocalChecklist(storageKey: string, items: string[]) {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return { checked, toggle, items };
}

export function LocalChecklist({
  storageKey,
  lines,
}: {
  storageKey: string;
  lines: string[];
}) {
  const items = lines.map((l) => l.trim()).filter(Boolean);
  const { checked, toggle } = useLocalChecklist(storageKey, items);
  if (!items.length) return <p className="text-sm text-white/35">—</p>;
  return (
    <ul className="space-y-2">
      {items.map((line, i) => {
        const key = `${i}:${line.slice(0, 40)}`;
        const on = !!checked[key];
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => toggle(key)}
              className={cn(
                "flex w-full min-h-11 items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                on
                  ? "border-emerald-500/30 bg-emerald-500/10 text-white/55 line-through"
                  : "border-white/[0.08] bg-white/[0.02] text-white/80",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                  on
                    ? "border-emerald-400/50 bg-emerald-500/30 text-emerald-100"
                    : "border-white/20",
                )}
              >
                {on ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              </span>
              <span className="whitespace-pre-wrap break-words">{line}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Section nav ──────────────────────────────────────────────── */

export function BriefSectionNav({
  sections,
}: {
  sections: { id: string; label: string }[];
}) {
  const [active, setActive] = React.useState(sections[0]?.id ?? "");

  React.useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.4, 0.7] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <>
      <nav
        className="sticky top-0 z-20 -mx-1 mb-4 overflow-x-auto px-1 py-2 md:hidden"
        aria-label="Sections"
      >
        <div className="flex w-max gap-2">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold transition",
                active === s.id
                  ? "border-[#FF1493]/45 bg-[#FF1493]/15 text-[#FFB6DE]"
                  : "border-white/10 bg-white/[0.03] text-white/50",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>
      <nav
        className="sticky top-24 hidden w-44 shrink-0 self-start md:block"
        aria-label="Sections"
      >
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => jump(s.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left text-xs font-medium transition",
                  active === s.id
                    ? "bg-[#FF1493]/12 text-[#FFB6DE]"
                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/70",
                )}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/* ── Flow strip ───────────────────────────────────────────────── */

export function BriefFlowStrip({
  recordingHref,
  editingHref,
  postingHref,
  current,
}: {
  recordingHref?: string | null;
  editingHref?: string | null;
  postingHref?: string | null;
  current: "recording" | "editing" | "posting";
}) {
  const items: {
    id: "recording" | "editing" | "posting";
    label: string;
    href?: string | null;
  }[] = [
    { id: "recording", label: "Recording", href: recordingHref },
    { id: "editing", label: "Editing", href: editingHref },
    { id: "posting", label: "Posting", href: postingHref },
  ];
  return (
    <div
      className={cn(
        VA_CARD,
        "flex flex-wrap items-center gap-2 p-3",
      )}
    >
      <p className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
        Flow
      </p>
      {items.map((item, i) => {
        const active = item.id === current;
        const inner = (
          <span
            className={cn(
              "inline-flex min-h-10 items-center rounded-xl border px-3 text-xs font-semibold",
              active
                ? "border-[#FF1493]/45 bg-[#FF1493]/15 text-[#FFB6DE]"
                : item.href
                  ? "border-white/12 bg-white/[0.03] text-white/70"
                  : "border-white/8 bg-transparent text-white/30",
            )}
          >
            {item.label}
          </span>
        );
        return (
          <React.Fragment key={item.id}>
            {i > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 text-white/20" aria-hidden />
            ) : null}
            {item.href && !active ? (
              <Link href={item.href} className="min-h-10">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── List chrome ──────────────────────────────────────────────── */

export function BriefPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        VA_CARD,
        VA_CARD_GLOW,
        "relative overflow-hidden border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-5 py-7 md:px-7",
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#FF1493]/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/50">{description}</p>
        </div>
        {action}
      </div>
    </header>
  );
}

export type BriefStat = {
  label: string;
  value: number;
  accent?: "pink" | "champagne" | "emerald" | "white" | "amber";
  tooltip?: string;
};

export function BriefStatsRow({ stats }: { stats: BriefStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {stats.map((s) => (
        <LuxuryStatCard
          key={s.label}
          label={s.label}
          value={<CountUp value={s.value} />}
          accent={s.accent ?? "champagne"}
          tooltip={s.tooltip}
        />
      ))}
    </div>
  );
}

export function BriefEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn(VA_CARD, "px-6 py-16 text-center")}>
      <FileText className="mx-auto h-10 w-10 text-white/20" aria-hidden />
      <p className="mt-4 text-sm font-medium text-white/60">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-white/35">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function BriefCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

export type BriefCardProps = {
  href?: string;
  selected?: boolean;
  onClick?: () => void;
  title: string;
  modelName?: string;
  priority: string;
  status: string;
  deadlineAt?: string | null;
  progressHint?: string;
};

export function BriefCard({
  href,
  selected,
  onClick,
  title,
  modelName,
  priority,
  status,
  deadlineAt,
  progressHint,
}: BriefCardProps) {
  const reduce = useReducedMotion();
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-medium text-white/90">{title || "Untitled"}</p>
        <PriorityPill priority={priority} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {modelName ? <ModelChip name={modelName} /> : null}
        <StatusBadge status={status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {deadlineAt ? <DeadlineBadge deadlineAt={deadlineAt} /> : null}
        {progressHint ? (
          <p className="text-xs text-white/40">{progressHint}</p>
        ) : null}
      </div>
    </>
  );

  const className = cn(
    "block w-full rounded-2xl border px-4 py-3.5 text-left transition",
    "min-h-[44px] active:scale-[0.995]",
    selected
      ? "border-[#D4AF8C]/45 bg-[#D4AF8C]/10 shadow-[0_0_24px_-10px_rgba(212,175,140,0.35)]"
      : "border-white/[0.08] bg-white/[0.03] hover:border-white/20",
  );

  if (href) {
    return (
      <motion.div
        layout={!reduce}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link href={href} className={className}>
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={className}
    >
      {content}
    </motion.button>
  );
}

export function BriefFiltersSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0D0B0D] p-5 pb-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Filters</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function BriefFilterToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search title…",
  chips,
  onClearAll,
  viewMode,
  onViewModeChange,
  showBoard,
  filterControls,
  sortControl,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  chips: { key: string; label: string; clear: () => void }[];
  onClearAll: () => void;
  viewMode?: "list" | "board";
  onViewModeChange?: (m: "list" | "board") => void;
  showBoard?: boolean;
  filterControls: React.ReactNode;
  sortControl?: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <FilterBar className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11 pl-9")}
          />
        </div>
        <button
          type="button"
          className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-2 px-4 md:hidden")}
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
        {showBoard && onViewModeChange ? (
          <div className="inline-flex rounded-xl border border-white/10 p-1">
            <button
              type="button"
              aria-label="List view"
              onClick={() => onViewModeChange("list")}
              className={cn(
                "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg",
                viewMode === "list" ? "bg-white/10 text-white" : "text-white/40",
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Board view"
              onClick={() => onViewModeChange("board")}
              className={cn(
                "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg",
                viewMode === "board" ? "bg-white/10 text-white" : "text-white/40",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {sortControl}
      </div>

      <div className="hidden flex-wrap items-end gap-3 md:flex">
        <Filter className="mb-2.5 h-4 w-4 text-white/35" aria-hidden />
        {filterControls}
      </div>

      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <FilterChip key={c.key} label={c.label} onRemove={c.clear} />
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="min-h-9 rounded-lg px-2 text-xs font-medium text-white/45 underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <BriefFiltersSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="space-y-4">{filterControls}</div>
        <button
          type="button"
          className={cn(VA_BTN_PRIMARY, "mt-6 w-full min-h-12")}
          onClick={() => setSheetOpen(false)}
        >
          Apply
        </button>
      </BriefFiltersSheet>
    </FilterBar>
  );
}

export function BriefBoardColumn({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[16rem] max-w-[20rem] flex-1 flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
          {title}
        </p>
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/50">
          {count}
        </span>
      </div>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">{children}</div>
    </div>
  );
}

/* ── Sticky detail action bar ─────────────────────────────────── */

export function BriefStickyActionBar({
  children,
  disabledReason,
}: {
  children: React.ReactNode;
  disabledReason?: string | null;
}) {
  return (
    <>
      <div className="hidden flex-wrap items-center gap-2 md:flex">{children}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0A0A0A]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {disabledReason ? (
            <p className="text-center text-[11px] text-white/45">{disabledReason}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">{children}</div>
        </div>
      </div>
      <div className="h-24 md:hidden" aria-hidden />
    </>
  );
}

export function BriefConfirmAction({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      loading={loading}
    />
  );
}

export function BriefStickyDetailHeader({
  title,
  priority,
  stepper,
  deadlineAt,
  actions,
}: {
  title: string;
  priority: string;
  stepper: React.ReactNode;
  deadlineAt?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-4 mb-4 border-b border-white/[0.08] bg-[#0A0A0A]/92 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={priority} />
            {deadlineAt ? <DeadlineBadge deadlineAt={deadlineAt} /> : null}
          </div>
          <h1 className="truncate text-xl font-semibold tracking-tight text-white md:text-2xl">
            {title || "Untitled"}
          </h1>
          {stepper}
        </div>
        {actions ? <div className="hidden md:block">{actions}</div> : null}
      </div>
    </div>
  );
}

export function computeBriefListStats<
  T extends {
    priority: string;
    status: string;
    deadline_at?: string | null;
  },
>(
  briefs: T[],
  opts?: {
    isActive?: (b: T) => boolean;
    awaitingUpload?: (b: T) => boolean;
    awaitingDelivery?: (b: T) => boolean;
    awaitingReview?: (b: T) => boolean;
  },
) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const isActive = opts?.isActive ?? ((b: T) => b.status !== "archived" && b.status !== "draft");
  let active = 0;
  let urgent = 0;
  let dueToday = 0;
  let overdue = 0;
  let awaitingUpload = 0;
  let awaitingDelivery = 0;
  let awaitingReview = 0;

  for (const b of briefs) {
    if (isActive(b)) active += 1;
    if (b.priority === "urgent" && isActive(b)) urgent += 1;
    if (b.deadline_at) {
      const d = new Date(b.deadline_at);
      if (!Number.isNaN(d.getTime())) {
        if (d < now && isActive(b)) overdue += 1;
        if (d >= startOfDay && d <= endOfDay && isActive(b)) dueToday += 1;
      }
    }
    if (opts?.awaitingUpload?.(b)) awaitingUpload += 1;
    if (opts?.awaitingDelivery?.(b)) awaitingDelivery += 1;
    if (opts?.awaitingReview?.(b)) awaitingReview += 1;
  }

  return {
    active,
    urgent,
    dueToday,
    overdue,
    awaitingUpload,
    awaitingDelivery,
    awaitingReview,
  };
}

export function sortBriefsByUrgencyThenDeadline<
  T extends { priority: string; deadline_at?: string | null },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ua = a.priority === "urgent" ? 0 : 1;
    const ub = b.priority === "urgent" ? 0 : 1;
    if (ua !== ub) return ua - ub;
    const da = a.deadline_at ? new Date(a.deadline_at).getTime() : Number.POSITIVE_INFINITY;
    const db = b.deadline_at ? new Date(b.deadline_at).getTime() : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

export function filterByDeadlineWindow<
  T extends { deadline_at?: string | null },
>(items: T[], window: "" | "today" | "week" | "overdue"): T[] {
  if (!window) return items;
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  return items.filter((b) => {
    if (!b.deadline_at) return false;
    const d = new Date(b.deadline_at);
    if (Number.isNaN(d.getTime())) return false;
    if (window === "overdue") return d < now;
    if (window === "today") return d >= startOfDay && d <= endOfDay;
    if (window === "week") return d >= startOfDay && d <= endOfWeek;
    return true;
  });
}

export { VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_CARD, VA_FILTER_INPUT, AnimatePresence };
