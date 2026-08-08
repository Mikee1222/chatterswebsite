"use client";

import * as React from "react";
import { flushSync, useFormStatus } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, Lock, Mail } from "lucide-react";
import { login } from "@/app/actions/auth";
import { LoginPasswordField } from "@/components/login-password-field";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { cn } from "@/lib/utils";

const loginSubmitClass = cn(
  "relative w-full min-h-[52px] overflow-hidden rounded-xl border border-transparent",
  "bg-gradient-to-br from-[#FF1493] via-[#E91E8C] to-[#DB2777]",
  "px-5 py-4 text-[15px] font-semibold text-white",
  "shadow-[0_8px_32px_-8px_rgba(255,20,147,0.55),0_2px_8px_-2px_rgba(0,0,0,0.4)]",
  "transition-[box-shadow,filter,transform] duration-200 ease-out",
  "hover:brightness-110",
  "focus:outline-none focus:ring-2 focus:ring-[#FF1493]/45 focus:ring-offset-2 focus:ring-offset-[#0A0A0A]",
  "disabled:cursor-not-allowed inline-flex items-center justify-center",
  "active:scale-[0.99]"
);

const loginFieldFocus =
  "focus:border-[#FF1493]/55 focus:outline-none focus:ring-0 md:focus:border-[#FF1493] md:focus:ring-2 md:focus:ring-[#FF1493]/25 md:hover:border-[#FF1493]/35";

function LuxuryAuthSpinner() {
  return (
    <svg
      className="h-[1.125rem] w-[1.125rem] shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9.25"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="2.25"
      />
      <path
        d="M21.25 12a9.25 9.25 0 0 0-9.25-9.25"
        stroke="url(#auth-spinner-grad)"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="auth-spinner-grad" x1="12" y1="2.75" x2="21.25" y2="12">
          <stop stopColor="#fff5f9" />
          <stop offset="0.45" stopColor="#ff8fc8" />
          <stop offset="1" stopColor="#D4AF8C" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function LoginSubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  const { pending } = useFormStatus();
  const busy = isSubmitting || pending;
  const reduceMotion = useReducedMotion();
  const [label, setLabel] = React.useState("Signing you in...");

  React.useEffect(() => {
    if (!busy) {
      setLabel("Signing you in...");
      return;
    }
    setLabel("Signing you in...");
    const timer = window.setTimeout(() => setLabel("Almost there..."), 3500);
    return () => window.clearTimeout(timer);
  }, [busy]);

  return (
    <motion.button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className={cn(
        loginSubmitClass,
        busy &&
          "auth-submit-loading auth-submit-loading-pulse cursor-wait disabled:cursor-wait disabled:opacity-100 disabled:shadow-[0_0_36px_-6px_rgba(255,20,147,0.55)] focus:ring-[#FF1493]/35"
      )}
      whileHover={busy || reduceMotion ? undefined : { y: -2 }}
      whileTap={busy || reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {busy ? (
        <span
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] motion-reduce:hidden"
          aria-hidden
        >
          <span className="absolute inset-y-0 w-1/2 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent motion-reduce:animate-none" />
        </span>
      ) : null}
      <span className="relative inline-flex items-center justify-center gap-2.5">
        {busy ? <LuxuryAuthSpinner /> : null}
        <span>{busy ? label : "Sign in"}</span>
      </span>
    </motion.button>
  );
}

function LoginErrorBanner({ message }: { message: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      role="alert"
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3 rounded-xl border border-rose-500/40 bg-gradient-to-br from-rose-500/15 via-rose-500/[0.08] to-transparent px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/15 text-rose-300">
        <AlertCircle className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-medium text-rose-100">Couldn&apos;t sign you in</p>
        <p className="mt-0.5 text-sm leading-relaxed text-rose-200/85">{message}</p>
      </div>
    </motion.div>
  );
}

/**
 * Champagne-style Remember me — native input kept for form/session logic;
 * custom box because the shared Checkbox chrome is nearly invisible on the
 * dark login redesign (border/bg on native checkbox without appearance-none).
 */
function RememberMeField({ disabled }: { disabled?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0D0B0D]/55 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:px-4 md:py-3">
      <label
        htmlFor="remember_me"
        className={cn(
          "group flex min-h-11 cursor-pointer items-center gap-3 touch-manipulation",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
          <input
            id="remember_me"
            name="remember_me"
            type="checkbox"
            value="on"
            disabled={disabled}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-[5px] border-2",
              "border-[#D4AF8C]/55 bg-[#D4AF8C]/[0.06]",
              "shadow-[inset_0_1px_0_rgba(212,175,140,0.1)]",
              "transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out",
              "group-hover:border-[#D4AF8C]/8 group-hover:bg-[#D4AF8C]/[0.1]",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-[#D4AF8C]/45 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0D0B0D]",
              "peer-checked:border-[#FF1493]/80 peer-checked:bg-gradient-to-br peer-checked:from-[#FF1493] peer-checked:via-[#E91E8C] peer-checked:to-[#D4AF8C]",
              "peer-checked:shadow-[0_0_14px_-3px_rgba(255,20,147,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]",
              "peer-checked:[&_svg]:scale-100 peer-checked:[&_svg]:opacity-100",
              "peer-disabled:opacity-40"
            )}
          >
            <Check
              className="h-3.5 w-3.5 scale-75 text-white opacity-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] transition-[opacity,transform] duration-150"
              strokeWidth={3.25}
            />
          </span>
        </span>
        <span className="min-w-0 flex-1 py-1">
          <span className="block text-[15px] font-medium leading-snug tracking-[-0.01em] text-[#F5F0EB]">
            Remember me for 30 days
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-[#B8B4B8]/75">
            Stay signed in across browser restarts. Unchecked lasts until you close the browser or after 24 hours.
          </span>
        </span>
      </label>
    </div>
  );
}

function LoginFormBody({
  error,
  isSubmitting,
}: {
  error?: string;
  isSubmitting: boolean;
}) {
  const { pending } = useFormStatus();
  // Button may show loading immediately via isSubmitting, but inputs must stay
  // enabled until `pending` — flushSync+disabled strips them from FormData.
  const buttonBusy = isSubmitting || pending;
  const fieldsLocked = pending;
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="space-y-5"
      animate={
        reduceMotion
          ? undefined
          : buttonBusy
            ? { opacity: 0.96, scale: 0.998 }
            : { opacity: 1, scale: 1 }
      }
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {error ? <LoginErrorBanner message={error} /> : null}

      <fieldset disabled={fieldsLocked} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <FormField
          label="Email"
          icon={<Mail />}
          htmlFor="email"
          required
          className="md:focus-within:border-[#FF1493]/40 md:focus-within:ring-[#FF1493]/20"
          staggerIndex={0}
        >
          <FormInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            disabled={fieldsLocked}
            className={cn("min-h-11 text-base md:min-h-[52px] md:text-[15px]", loginFieldFocus)}
          />
        </FormField>
        <FormField
          label="Password"
          icon={<Lock />}
          htmlFor="password"
          required
          className="md:focus-within:border-[#FF1493]/40 md:focus-within:ring-[#FF1493]/20"
          staggerIndex={1}
        >
          <LoginPasswordField
            id="password"
            name="password"
            required
            omitLabel
            placeholder="••••••••"
            className="pr-12"
            disabled={fieldsLocked}
          />
        </FormField>
        <RememberMeField disabled={fieldsLocked} />
      </fieldset>

      <LoginSubmitButton isSubmitting={isSubmitting} />
    </motion.div>
  );
}

type LoginFormProps = {
  error?: string;
};

export function LoginForm({ error }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Error redirect remounts with ?error= — clear any leftover busy state if the tree is reused
  React.useEffect(() => {
    if (error) setIsSubmitting(false);
  }, [error]);

  return (
    <form
      action={login}
      className="space-y-4"
      onSubmit={() => {
        // Paint loading UI before the server action starts. Relying only on
        // useFormStatus left a blank/focus-ring moment (AnimatePresence wait + lag).
        // Do NOT disable named inputs here — flushSync + disabled strips FormData.
        flushSync(() => setIsSubmitting(true));
      }}
    >
      <LoginFormBody error={error} isSubmitting={isSubmitting} />
    </form>
  );
}
