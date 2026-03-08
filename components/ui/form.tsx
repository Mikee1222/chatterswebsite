/**
 * Premium form design system — iOS-inspired black/pink glass.
 * Use these primitives across all forms for a consistent luxury feel.
 */

import * as React from "react";

const formInputClass =
  "w-full min-h-[48px] md:min-h-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base md:text-[15px] text-white placeholder:text-white/40 transition-colors focus:border-[hsl(330,80%,55%)]/60 focus:outline-none focus:ring-2 focus:ring-[hsl(330,80%,55%)]/20 focus:bg-white/[0.08] hover:border-white/15";
const formInputErrorClass =
  "border-rose-500/40 focus:border-rose-500/60 focus:ring-rose-500/20 bg-rose-500/5";

const formSelectClass =
  "w-full min-h-[48px] md:min-h-0 rounded-2xl border border-white/10 bg-white/[0.06] pl-4 pr-10 py-3 text-base md:text-[15px] text-white transition-colors focus:border-[hsl(330,80%,55%)]/60 focus:outline-none focus:ring-2 focus:ring-[hsl(330,80%,55%)]/20 focus:bg-white/[0.08] hover:border-white/15 appearance-none cursor-pointer bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat";
const formSelectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.5)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
};

const formTextareaClass =
  "w-full min-h-[120px] resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/40 transition-colors focus:border-[hsl(330,80%,55%)]/60 focus:outline-none focus:ring-2 focus:ring-[hsl(330,80%,55%)]/20 focus:bg-white/[0.08] hover:border-white/15";

const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55";
const helperClass = "mt-1.5 text-xs text-white/45";
const errorClass = "mt-1.5 text-xs text-rose-300/95";

const formCardShadow = "0 0 0 1px rgba(255,255,255,0.05), 0 0 48px -12px hsl(330 80% 55% / 0.08)";

export function FormCard({
  children,
  className = "",
  title,
  subtitle,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl ${className}`}
      style={{ boxShadow: formCardShadow }}
    >
      {(title || subtitle) && (
        <div className="border-b border-white/10 bg-white/[0.02] px-6 pt-6 pb-4">
          {title && (
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-white/55">
              {subtitle}
            </p>
          )}
          <div className="mt-3 h-px w-12 rounded-full bg-[hsl(330,80%,55%)]/50" />
        </div>
      )}
      <div className={title || subtitle ? "p-6" : "p-6"}>{children}</div>
    </div>
  );
}

export function FormSection({
  children,
  title,
  helper,
}: {
  children: React.ReactNode;
  title?: string;
  helper?: string;
}) {
  return (
    <div className="space-y-3">
      {title && (
        <div>
          <h3 className="text-sm font-medium text-white/80">{title}</h3>
          {helper && <p className={helperClass}>{helper}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Label({
  htmlFor,
  children,
  className = "",
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`${labelClass} ${className}`}>
      {children}
    </label>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input"> & { error?: boolean }
>(function Input({ className = "", error, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`${formInputClass} ${error ? formInputErrorClass : ""} ${className}`}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea"> & { error?: boolean }
>(function Textarea({ className = "", error, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${formTextareaClass} ${error ? formInputErrorClass : ""} ${className}`}
      {...props}
    />
  );
});

export function Select({
  className = "",
  error,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"select"> & { error?: boolean }) {
  return (
    <select
      className={`${formSelectClass} ${error ? formInputErrorClass : ""} ${className}`}
      style={formSelectStyle}
      {...props}
    >
      {children}
    </select>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200/95">
      {children}
    </div>
  );
}

export function HelperText({ children }: { children: React.ReactNode }) {
  return <p className={helperClass}>{children}</p>;
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return <p className={errorClass}>{children}</p>;
}

export function SuccessBlock({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-6 py-6 text-center"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05)" }}
    >
      <p className="font-medium text-[hsl(330,90%,75%)]">{title}</p>
      {children && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

const btnPrimaryClass =
  "min-h-[48px] md:min-h-0 rounded-2xl bg-[hsl(330,80%,55%)] px-5 py-3 text-base md:text-[15px] font-medium text-white shadow-[0_0_24px_-6px_rgba(236,72,153,0.4)] transition-all hover:bg-[hsl(330,80%,50%)] hover:shadow-[0_0_28px_-4px_rgba(236,72,153,0.5)] focus:outline-none focus:ring-2 focus:ring-[hsl(330,80%,55%)]/50 focus:ring-offset-2 focus:ring-offset-[hsl(0,0%,6%)] disabled:opacity-50 disabled:shadow-none inline-flex items-center justify-center";
export const btnSecondaryClass =
  "min-h-[48px] md:min-h-0 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-base md:text-[15px] font-medium text-white/90 transition-all hover:bg-white/[0.1] hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[hsl(0,0%,6%)] disabled:opacity-50 inline-flex items-center justify-center";

export function ButtonPrimary({
  children,
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button type="button" className={`${btnPrimaryClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ButtonSecondary({
  children,
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button type="button" className={`${btnSecondaryClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function SubmitButton({
  children,
  disabled,
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<"button"> & { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`${btnPrimaryClass} w-full ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Form layout: consistent vertical spacing between fields */
export const formSpace = "space-y-5";
/** Tighter group for inline-ish rows (e.g. date + time). Stacks on mobile, 2 cols on sm+. */
export const formRowClass = "grid grid-cols-1 gap-4 sm:grid-cols-2";
/** Button row at bottom of form */
export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 pt-2">{children}</div>;
}

/** Option styling for native select — use with Select, option elements get dark bg from browser */
export const selectOptionClass = "bg-[hsl(0,0%,8%)] text-white";

/** Premium checkbox — iOS-style with pink accent */
export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input"> & { error?: boolean; label?: React.ReactNode }
>(function Checkbox({ className = "", error, label, ...props }, ref) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 rounded-md border-2 border-white/20 bg-white/5 text-[hsl(330,80%,55%)] transition-colors focus:ring-2 focus:ring-[hsl(330,80%,55%)]/40 focus:ring-offset-0 focus:ring-offset-transparent checked:border-[hsl(330,80%,55%)] checked:bg-[hsl(330,80%,55%)]/20"
        {...props}
      />
      {label != null && <span className="text-sm text-white/90">{label}</span>}
    </label>
  );
});

/** Glass modal overlay + panel. Mobile: full-screen sheet; desktop: centered panel. */
export function GlassModal({
  children,
  onClose,
  title,
  subtitle,
  className = "",
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" aria-hidden onClick={onClose} />
      <div
        className={`relative flex max-h-[95dvh] w-full flex-col rounded-t-2xl border border-white/10 border-b-0 bg-black/95 shadow-2xl shadow-black/50 backdrop-blur-xl md:max-h-[calc(100vh-2rem)] md:max-w-md md:rounded-2xl md:border ${className}`}
        style={{
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7), 0 0 80px -24px hsl(330 80% 55% / 0.08)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {(title != null || subtitle != null) && (
          <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-5">
            {title != null && <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>}
            {subtitle != null && <p className="mt-1 text-sm text-white/55">{subtitle}</p>}
            <div className="mt-2 h-px w-12 rounded-full bg-[hsl(330,80%,55%)]/40" />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** Compact form field group spacing */
export const fieldGroupClass = "space-y-1.5";
