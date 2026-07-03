"use client";

import * as React from "react";
import { Check, ExternalLink, Loader2, Upload, X } from "lucide-react";
import { CustomSelect, type CustomSelectOption, type CustomSelectProps } from "@/components/ui/custom-select";
import {
  SPOT_CHECK_STATUS_STYLES,
  SPOT_CHECK_TYPE_STYLES,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/lib/marketing-reviews-helpers";
import {
  VIDEO_TRANSCRIPT_STATUS_STYLES,
  type VideoTranscriptStatus,
} from "@/lib/video-transcripts-helpers";
import {
  WINNER_VIDEO_STATUS_STYLES,
  type WinnerVideoStatus,
} from "@/lib/winner-videos-helpers";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CHAMPAGNE_DIVIDER,
  VA_FILTER_INPUT,
  VA_MODEL_TAG,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

/* ── Design tokens ─────────────────────────────────────────────── */

export const MR_SELECT_TRIGGER = cn(
  VA_FILTER_INPUT,
  "h-10 min-h-0 rounded-lg text-left transition-[border-color,box-shadow] duration-200",
  "hover:border-[#D4AF8C]/25",
  "focus:border-[#FF1493]/50 focus:shadow-[0_0_16px_-4px_rgba(255,20,147,0.25)]",
);

export const MR_TEXTAREA = cn(
  VA_FILTER_INPUT,
  "min-h-[80px] w-full resize-y py-2.5",
  "shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]",
  "placeholder:text-[#B8B4B8]/35",
  "focus:border-[#FF1493]/55 focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,20,147,0.2),0_0_20px_-6px_rgba(255,20,147,0.3)]",
);

export const MR_FINDING_CARD = cn(
  VA_CARD,
  "mr-finding-card p-4 md:p-5",
  "transition-[transform,box-shadow] duration-200 motion-reduce:transition-none",
  "hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65),0_0_32px_-8px_rgba(255,20,147,0.12)]",
);

export const MR_FILTER_BAR = cn(VA_CARD, "mr-filter-bar space-y-4 p-4 md:p-5");

export const MR_DASH_CLASS = "text-[#B8B4B8]/28 not-italic";

/* ── Dash placeholder ────────────────────────────────────────── */

export function DashPlaceholder({ className }: { className?: string }) {
  return <span className={cn(MR_DASH_CLASS, className)}>—</span>;
}

export function displayOrDash(value: string | null | undefined, className?: string): React.ReactNode {
  const trimmed = value?.trim();
  return trimmed ? trimmed : <DashPlaceholder className={className} />;
}

/* ── Page chrome ─────────────────────────────────────────────── */

export function ReviewPageEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF1493]/70">{children}</p>
  );
}

export function ReviewSectionHeader({
  children,
  className,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <h2 className="mr-section-header text-sm font-semibold tracking-wide text-[#D4AF8C]">{children}</h2>
      {action}
    </div>
  );
}

export function ReviewFieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-[#B8B4B8]/60", className)}>{children}</span>;
}

/* ── Select / textarea / file drop ───────────────────────────── */

export function ManagerReviewSelect(props: CustomSelectProps) {
  return (
    <CustomSelect
      portaled
      {...props}
      className={cn(
        "[&_button[aria-expanded=true]]:border-[#FF1493]/50",
        "[&_button[aria-expanded=true]]:shadow-[0_0_16px_-4px_rgba(255,20,147,0.25)]",
        props.className,
      )}
      triggerClassName={cn(MR_SELECT_TRIGGER, props.triggerClassName)}
    />
  );
}

export type ManagerReviewTextareaProps = React.ComponentProps<"textarea">;

export const ManagerReviewTextarea = React.forwardRef<HTMLTextAreaElement, ManagerReviewTextareaProps>(
  function ManagerReviewTextarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(MR_TEXTAREA, className)} {...props} />;
  },
);
ManagerReviewTextarea.displayName = "ManagerReviewTextarea";

type FileDropzoneProps = {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
};

export function ManagerReviewFileDropzone({
  files,
  onChange,
  accept = "image/*,.pdf",
  multiple = true,
  className,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  function addFiles(incoming: FileList | File[]) {
    const next = Array.from(incoming);
    if (!next.length) return;
    onChange(multiple ? [...files, ...next] : [next[0]!]);
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files ?? []);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-[108px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition duration-200 motion-reduce:transition-none",
          dragOver
            ? "border-[#FF1493]/50 bg-[#FF1493]/[0.06] shadow-[0_0_24px_-8px_rgba(255,20,147,0.35)]"
            : "border-[#D4AF8C]/25 bg-[#0D0B0D]/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] hover:border-[#FF1493]/35 hover:bg-[#FF1493]/[0.03]",
        )}
      >
        <Upload className="h-6 w-6 text-[#D4AF8C]/45" aria-hidden />
        <p className="text-sm text-[#B8B4B8]/55">Click or drag files</p>
        <p className="text-xs text-[#B8B4B8]/35">Images or PDF</p>
      </div>
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.06] px-2.5 py-1 text-xs text-[#D4AF8C]"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="shrink-0 rounded-full p-0.5 text-[#D4AF8C]/70 hover:bg-[#D4AF8C]/15 hover:text-[#D4AF8C]"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ── Toggle pill (KPI / compliance) ──────────────────────────── */

export type TogglePillVariant = "kpi" | "compliance";

type TogglePillProps = {
  label: string;
  selected: boolean;
  variant: TogglePillVariant;
  onClick?: () => void;
  readOnly?: boolean;
  className?: string;
};

const TOGGLE_SELECTED: Record<TogglePillVariant, string> = {
  kpi: "border-[#FF1493]/45 bg-[#FF1493]/15 text-[#FFB3D9] shadow-[0_0_14px_rgba(255,20,147,0.22)]",
  compliance:
    "border-emerald-500/40 bg-emerald-500/12 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.22)]",
};

const TOGGLE_UNSELECTED =
  "border-white/[0.08] bg-[#0D0B0D]/70 text-[#B8B4B8]/60 shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 hover:border-[#D4AF8C]/30 motion-reduce:hover:translate-y-0";

export function TogglePill({ label, selected, variant, onClick, readOnly, className }: TogglePillProps) {
  const base = cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-xs transition duration-200 motion-reduce:transition-none",
    selected ? TOGGLE_SELECTED[variant] : TOGGLE_UNSELECTED,
    className,
  );

  if (readOnly) {
    if (!selected) return null;
    return (
      <span className={base}>
        <Check className="mr-toggle-check h-3 w-3 shrink-0" aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <button type="button" onClick={onClick} className={base}>
      {selected ? <Check className="mr-toggle-check h-3 w-3 shrink-0" aria-hidden /> : null}
      {label}
    </button>
  );
}

/* ── Status & type badges ────────────────────────────────────── */

export function SpotCheckStatusBadge({ status }: { status: SpotCheckStatus }) {
  const style = SPOT_CHECK_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        VA_STATUS_BADGE,
        "relative",
        style.className,
        style.glowClassName,
        "before:pointer-events-none before:absolute before:-inset-1 before:-z-10 before:rounded-md before:opacity-60 before:blur-md",
        status === "Pending" && "before:bg-amber-500/25",
        status === "Fixed" && "before:bg-emerald-500/25",
        status === "Escalated" && "before:bg-red-500/30",
      )}
    >
      {style.label}
    </span>
  );
}

export function SpotCheckTypeBadge({ type }: { type: SpotCheckType }) {
  const style = SPOT_CHECK_TYPE_STYLES[type];
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium backdrop-blur-sm",
        style.className,
      )}
    >
      {type}
    </span>
  );
}

export function WinnerVideoStatusBadge({ status }: { status: WinnerVideoStatus }) {
  const style = WINNER_VIDEO_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        VA_STATUS_BADGE,
        "relative",
        style.className,
        style.glowClassName,
        "before:pointer-events-none before:absolute before:-inset-1 before:-z-10 before:rounded-md before:opacity-60 before:blur-md",
        status === "Pending" && "before:bg-amber-500/25",
        status === "Approved" && "before:bg-emerald-500/25",
        status === "Rejected" && "before:bg-red-500/30",
        status === "Recreated" && "before:bg-sky-500/25",
        status === "Published" && "before:bg-[#D4AF8C]/25",
      )}
    >
      {style.label}
    </span>
  );
}

export function VideoTranscriptStatusBadge({ status }: { status: VideoTranscriptStatus }) {
  const style = VIDEO_TRANSCRIPT_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        VA_STATUS_BADGE,
        "relative",
        style.className,
        style.glowClassName,
        "before:pointer-events-none before:absolute before:-inset-1 before:-z-10 before:rounded-md before:opacity-60 before:blur-md",
        status === "Processing" && "animate-pulse before:bg-amber-500/25",
        status === "Done" && "before:bg-emerald-500/25",
        status === "Failed" && "before:bg-red-500/30",
      )}
    >
      {style.label}
    </span>
  );
}

/* ── Filter bar helpers ──────────────────────────────────────── */

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF8C]/30 bg-[#D4AF8C]/8 px-2.5 py-1 text-xs text-[#D4AF8C] shadow-[0_0_12px_-6px_rgba(212,175,140,0.35)]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-[#D4AF8C]/15"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(MR_FILTER_BAR, className)}>{children}</div>;
}

/* ── Quick action buttons ────────────────────────────────────── */

export function QuickActionMarkFixed({
  onClick,
  disabled,
  className,
  children = "Mark Fixed",
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-gradient-to-br hover:from-emerald-500/20 hover:to-emerald-600/10 hover:shadow-[0_0_16px_-4px_rgba(16,185,129,0.35)] disabled:opacity-50",
        className,
      )}
    >
      <Check className="h-3.5 w-3.5" aria-hidden />
      {children}
    </button>
  );
}

export function QuickActionEscalate({
  onClick,
  disabled,
  className,
  children = "Escalate",
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-500/45 hover:bg-gradient-to-br hover:from-red-500/20 hover:to-amber-600/10 hover:shadow-[0_0_16px_-4px_rgba(239,68,68,0.35)] disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function QuickActionDelete({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-transparent px-2.5 py-1.5 text-xs text-red-400/55 transition hover:border-red-500/30 hover:bg-red-500/8 hover:text-red-300 disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function QuickActionAdd({
  onClick,
  children,
  disabled,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-[#FF1493]/35 bg-[#FF1493]/10 px-2.5 py-1.5 text-xs font-medium text-[#FFB3D9] transition hover:border-[#FF1493]/55 hover:bg-[#FF1493]/18 hover:shadow-[0_0_14px_-4px_rgba(255,20,147,0.35)] disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── Cards & empty states ────────────────────────────────────── */

type Attachment = { url: string; filename?: string | null };

export function AttachmentLinks({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF8C]/20 bg-[#D4AF8C]/[0.04] px-2 py-1 text-xs text-[#D4AF8C] transition hover:border-[#D4AF8C]/35 hover:bg-[#D4AF8C]/10"
        >
          <ExternalLink className="h-3 w-3" aria-hidden />
          {a.filename ?? `Attachment ${i + 1}`}
        </a>
      ))}
    </div>
  );
}

export function FindingCard({
  children,
  className,
  pending,
}: {
  children: React.ReactNode;
  className?: string;
  pending?: boolean;
}) {
  return (
    <article className={cn(MR_FINDING_CARD, "overflow-hidden", pending && "opacity-80", className)}>
      {children}
    </article>
  );
}

export function ReviewHistoryCard({
  children,
  className,
  active,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <div
      className={cn(
        MR_FINDING_CARD,
        "flex w-full items-center justify-between gap-3",
        active && "ring-1 ring-[#FF1493]/35",
        className,
      )}
    >
      {children}
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

export function ReviewEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(VA_CARD, "px-6 py-14 text-center", className)}>
      <Icon className="mx-auto mb-3 h-10 w-10 text-[#D4AF8C]/35" aria-hidden />
      <p className="font-medium text-[#B8B4B8]/75">{title}</p>
      {description ? <p className="mt-2 text-sm text-[#B8B4B8]/45">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ReviewLoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className={cn(VA_CARD, "flex items-center justify-center gap-2 py-16 text-[#B8B4B8]/50")}>
      <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ReviewFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(VA_CARD, "p-4 md:p-5", className)}>
      <ReviewSectionHeader>{title}</ReviewSectionHeader>
      {description ? <p className="mt-2 text-sm text-[#B8B4B8]/45">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ReviewModalShell({
  title,
  children,
  onClose,
  saving,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  saving?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => !saving && onClose()}
      />
      <div
        className={cn(
          VA_CARD,
          "relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-5",
          "shadow-[0_24px_64px_-16px_rgba(0,0,0,0.75),0_0_48px_-12px_rgba(255,20,147,0.15)]",
        )}
      >
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className={cn(VA_CHAMPAGNE_DIVIDER, "my-3")} />
        {children}
      </div>
    </div>
  );
}

export { VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_CARD, VA_CHAMPAGNE_DIVIDER, VA_FILTER_INPUT, VA_MODEL_TAG, type CustomSelectOption };
