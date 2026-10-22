"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import {
  formatCountdown,
  formatDeadlineMultiZone,
  greeceLocalToUtc,
  utcToGreeceLocalInput,
} from "@/lib/brief-deadlines";
import { cn } from "@/lib/utils";
import { VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";

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

export function BriefCopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={async () => {
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
      )}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function BriefFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
      {children}
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

export function BriefSection({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#D4AF8C]/80" aria-hidden />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
            {title}
          </h3>
        </div>
        {actions}
      </div>
      {children}
    </section>
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

/** Viewer countdown in local TZ + Greece wall time. */
export function BriefDeadlineBanner({
  deadlineAt,
}: {
  deadlineAt: string | null | undefined;
}) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (!deadlineAt) return null;
  const multi = formatDeadlineMultiZone(deadlineAt);
  const cd = formatCountdown(deadlineAt, now);
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        cd.overdue
          ? "border-rose-400/40 bg-rose-500/10"
          : "border-[#D4AF8C]/30 bg-[#D4AF8C]/08",
      )}
    >
      <p className="text-sm font-semibold text-white/90">
        {cd.label}
        <span className="ml-2 font-normal text-white/50">(your time)</span>
      </p>
      <p className="mt-1 text-xs text-white/55">Greece · {multi.greece}</p>
      <p className="text-xs text-white/40">
        NY · {multi.newYork} · LA · {multi.losAngeles}
      </p>
    </div>
  );
}

export function deadlineInputFromUtc(utc: string | null | undefined): string {
  return utcToGreeceLocalInput(utc);
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
    <div className="space-y-2">
      <p className="text-xs text-white/45">{note}</p>
      <ul className="space-y-2">
        {links.map((href) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm font-medium text-[#E8D5B5] underline-offset-2 hover:underline"
            >
              {href}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
