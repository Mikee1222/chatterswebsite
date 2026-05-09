"use client";

/**
 * Luxury form design system — dark glass + pink accent.
 * Tokens: :root variables in app/globals.css; dashboard ambience: components/ui/luxury-forms.css
 */

import * as React from "react";
import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";

const formInputClass =
  "w-full min-h-[var(--luxury-form-min-height)] rounded-[var(--luxury-form-radius)] border border-[var(--luxury-form-border)] bg-[var(--luxury-form-control-bg)] px-[var(--luxury-form-padding-x)] py-[var(--luxury-form-padding-y)] text-[15px] text-[var(--luxury-form-text)] placeholder:text-[color:var(--luxury-form-placeholder)] [color-scheme:dark] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:bg-[var(--luxury-form-control-bg-hover)] focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:bg-[var(--luxury-form-control-bg-hover)]";

const formInputErrorClass =
  "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-500/[0.07]";

const formSelectClass =
  "w-full min-h-[var(--luxury-form-min-height)] cursor-pointer rounded-[var(--luxury-form-radius)] border border-[var(--luxury-form-border)] bg-[var(--luxury-form-select-bg)] pl-[var(--luxury-form-padding-x)] pr-10 py-[var(--luxury-form-padding-y)] text-[15px] text-[var(--luxury-form-text)] [color-scheme:dark] appearance-none bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:bg-white/10 hover:border-white/15 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20";

const formSelectStyle = {
  backgroundImage: `var(--luxury-select-chevron)`,
} as const;

const formTextareaClass =
  "w-full min-h-[120px] resize-y rounded-[var(--luxury-form-radius)] border border-[var(--luxury-form-border)] bg-[var(--luxury-form-control-bg)] px-[var(--luxury-form-padding-x)] py-[var(--luxury-form-padding-y)] text-[15px] text-[var(--luxury-form-text)] placeholder:text-[color:var(--luxury-form-placeholder)] [color-scheme:dark] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:bg-[var(--luxury-form-control-bg-hover)] focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:bg-[var(--luxury-form-control-bg-hover)]";

const labelClass =
  "mb-2 block text-[13px] font-medium uppercase tracking-[var(--luxury-label-tracking)] text-[color:var(--luxury-label-color)]";
const helperClass = "mt-1.5 text-xs text-white/55 md:text-white/45";
const errorClass = "mt-1.5 text-xs text-rose-300/95";

const formCardShadow =
  "0 0 0 1px rgba(255,255,255,0.06), 0 0 48px -12px hsl(330 80% 55% / 0.1)";

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
      className={`overflow-hidden rounded-[var(--luxury-form-card-radius)] border border-[var(--luxury-form-card-border)] bg-[var(--luxury-form-card-bg)] backdrop-blur-xl ${className}`}
      style={{ boxShadow: formCardShadow }}
    >
      {(title || subtitle) && (
        <div className="border-b border-[var(--luxury-form-card-border)] bg-white/[0.03] px-6 pb-4 pt-6">
          {title && (
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-1 text-[15px] leading-relaxed text-white/65 md:text-sm md:text-white/55">
              {subtitle}
            </p>
          )}
          <div className="mt-3 h-px w-12 rounded-full bg-pink-500/55" />
        </div>
      )}
      <div className="p-6">{children}</div>
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
    <section className="luxury-form-card space-y-4 md:space-y-3">
      {title && (
        <div>
          <h3 className="text-[15px] font-medium leading-snug text-white/90 md:text-sm">
            {title}
          </h3>
          {helper && <p className={helperClass}>{helper}</p>}
        </div>
      )}
      {children}
    </section>
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
  style,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"select"> & { error?: boolean }) {
  return (
    <select
      className={`${formSelectClass} ${error ? formInputErrorClass : ""} ${className}`}
      style={{ ...formSelectStyle, ...style }}
      {...props}
    >
      {children}
    </select>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200/95">
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
      className="rounded-[var(--luxury-form-card-radius)] border border-pink-500/30 bg-pink-500/10 px-6 py-6 text-center"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05)" }}
    >
      <p className="font-medium text-pink-200/95">{title}</p>
      {children && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

const btnPrimaryClass =
  "min-h-[var(--luxury-form-min-height)] rounded-[var(--luxury-form-radius)] border border-transparent bg-gradient-to-r from-[#e91e8c] via-[#ec4899] to-[#d946ef] px-5 py-3 text-[15px] font-semibold text-white shadow-[0_0_28px_-6px_rgba(233,30,140,0.45)] transition-all duration-150 hover:brightness-110 hover:shadow-[0_0_32px_-4px_rgba(233,30,140,0.52)] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-pink-500/45 focus:ring-offset-2 focus:ring-offset-[#050505] disabled:opacity-50 disabled:shadow-none inline-flex items-center justify-center";

export const btnSecondaryClass =
  "min-h-[var(--luxury-form-min-height)] rounded-[var(--luxury-form-radius)] border border-white/20 bg-transparent px-5 py-3 text-[15px] font-medium text-white transition-all duration-150 ease-out hover:bg-white/10 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-pink-500/25 focus:ring-offset-2 focus:ring-offset-[#050505] disabled:opacity-50 inline-flex items-center justify-center";

export function ButtonPrimary({
  children,
  className = "",
  ...props
}: HTMLMotionProps<"button">) {
  return (
    <motion.button
      type="button"
      className={`${btnPrimaryClass} ${className}`}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.button>
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
}: HTMLMotionProps<"button"> & { children: React.ReactNode }) {
  return (
    <motion.button
      type="submit"
      disabled={disabled}
      className={`${btnPrimaryClass} w-full ${className}`}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/** Form layout: consistent vertical spacing between fields */
export const formSpace = "space-y-6 md:space-y-5";
/** Tighter group for inline-ish rows (e.g. date + time). Stacks on mobile, 2 cols on sm+. */
export const formRowClass = "grid grid-cols-1 gap-4 sm:grid-cols-2";
/** Button row at bottom of form */
export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4 pt-3 md:gap-3 md:pt-2">{children}</div>;
}

/** Option styling for native select */
export const selectOptionClass = "bg-[#1a1a1a] text-white";

const checkboxInputClass =
  "mt-0.5 h-[var(--luxury-checkbox-size)] w-[var(--luxury-checkbox-size)] shrink-0 cursor-pointer rounded-md border-2 border-white/25 bg-white/5 text-[var(--luxury-checkbox-accent)] accent-[var(--luxury-checkbox-accent)] transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500/35 focus:ring-offset-0 checked:border-[var(--luxury-checkbox-accent)] checked:bg-pink-500/25 md:border-white/20 md:bg-[var(--luxury-form-control-bg)]";

/** Premium checkbox — pink accent, 20×20 */
export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input"> & { error?: boolean; label?: React.ReactNode }
>(function Checkbox({ className = "", error, label, ...props }, ref) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className={`${checkboxInputClass} ${error ? "border-rose-400/60" : ""}`}
        {...props}
      />
      {label != null && (
        <span className="text-sm leading-snug text-white/70 md:text-[15px] md:text-white/92">{label}</span>
      )}
    </label>
  );
});

/** Radio — matches checkbox scale, pink accent */
export const Radio = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input"> & { error?: boolean; label?: React.ReactNode }
>(function Radio({ className = "", error, label, ...props }, ref) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <input
        ref={ref}
        type="radio"
        className={`mt-0.5 h-[var(--luxury-checkbox-size)] w-[var(--luxury-checkbox-size)] shrink-0 cursor-pointer border-2 border-white/20 bg-[var(--luxury-form-control-bg)] accent-[var(--luxury-checkbox-accent)] transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500/35 focus:ring-offset-0 ${error ? "border-rose-400/60" : ""}`}
        {...props}
      />
      {label != null && (
        <span className="text-[15px] leading-snug text-white/92 md:text-sm">{label}</span>
      )}
    </label>
  );
});

export { GlassModal } from "./glass-modal";

/** Compact form field group spacing */
export const fieldGroupClass = "space-y-2 md:space-y-1.5";
