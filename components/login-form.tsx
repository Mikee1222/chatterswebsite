"use client";

import * as React from "react";
import { flushSync, useFormStatus } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Lock, Mail } from "lucide-react";
import { login } from "@/app/actions/auth";
import { LoginPasswordField } from "@/components/login-password-field";
import { Checkbox } from "@/components/ui/form";
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
        <div
          className={cn(
            "space-y-2 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none",
            "md:rounded-xl md:border md:border-white/10 md:bg-[#0D0B0D]/80 md:px-4 md:py-3.5",
            "md:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          )}
        >
          <Checkbox
            id="remember_me"
            name="remember_me"
            value="on"
            label="Remember me for 30 days"
            className="items-center gap-3"
            disabled={fieldsLocked}
          />
          <p className="text-xs leading-relaxed text-[#B8B4B8]/55 max-md:pl-0 max-md:pt-0.5 md:pl-8">
            If unchecked, you stay signed in until you close the browser or after 24 hours of use.
            Checked keeps you signed in for up to 30 days.
          </p>
        </div>
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
