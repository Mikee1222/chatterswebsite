"use client";

import * as React from "react";
import { flushSync, useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { Lock, Mail } from "lucide-react";
import { login } from "@/app/actions/auth";
import { LoginPasswordField } from "@/components/login-password-field";
import { Checkbox, FormError } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { formGradientButtonClass } from "@/components/ui/form-submit-button";
import { cn } from "@/lib/utils";

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
        "relative w-full min-h-[52px] overflow-hidden",
        formGradientButtonClass,
        // Keep full pink gradient while busy — default disabled:opacity-50 reads as "stuck", not working
        busy &&
          "auth-submit-loading auth-submit-loading-pulse cursor-wait disabled:cursor-wait disabled:opacity-100 disabled:shadow-[0_0_28px_-6px_rgba(233,30,140,0.45)] focus:ring-pink-400/35"
      )}
      whileHover={busy ? undefined : { y: -2 }}
      whileTap={busy ? undefined : { scale: 0.98 }}
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

  return (
    <motion.div
      className="space-y-4"
      animate={
        buttonBusy
          ? { opacity: 0.96, scale: 0.998 }
          : { opacity: 1, scale: 1 }
      }
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {error ? (
        <div role="alert">
          <FormError>{error}</FormError>
        </div>
      ) : null}

      <fieldset disabled={fieldsLocked} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <FormField label="Email" icon={<Mail />} htmlFor="email" required>
          <FormInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            disabled={fieldsLocked}
          />
        </FormField>
        <FormField label="Password" icon={<Lock />} htmlFor="password" required>
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
        <div className="space-y-2 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none md:rounded-xl md:border md:border-white/10 md:bg-[#1a1a1a] md:px-4 md:py-3 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Checkbox
            id="remember_me"
            name="remember_me"
            value="on"
            label="Remember me for 30 days"
            className="items-center gap-3"
            disabled={fieldsLocked}
          />
          <p className="text-xs leading-relaxed text-white/45 max-md:pl-0 max-md:pt-0.5 md:pl-8">
            If unchecked, you stay signed in until you close the browser or after 24 hours of use. Checked keeps you
            signed in for up to 30 days.
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
