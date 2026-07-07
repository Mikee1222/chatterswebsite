"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
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
    <span
      className="inline-block h-[1.125rem] w-[1.125rem] shrink-0 rounded-full border-2 border-white/15 border-t-[#e91e8c] border-r-[#D4AF8C] motion-safe:animate-spin motion-reduce:animate-none"
      role="status"
      aria-hidden
    />
  );
}

function LoginSubmitButton() {
  const { pending } = useFormStatus();
  const [label, setLabel] = React.useState("Sign in");

  React.useEffect(() => {
    if (!pending) {
      setLabel("Sign in");
      return;
    }
    setLabel("Signing you in...");
    const timer = window.setTimeout(() => setLabel("Almost there..."), 3500);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <motion.button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "relative w-full min-h-[52px] overflow-hidden",
        formGradientButtonClass,
        pending && "auth-submit-loading auth-submit-loading-pulse cursor-wait"
      )}
      whileHover={pending ? undefined : { y: -2 }}
      whileTap={pending ? undefined : { scale: 0.98 }}
      transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {pending ? (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] motion-reduce:hidden" aria-hidden>
          <span className="absolute inset-y-0 w-1/2 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent motion-reduce:animate-none" />
        </span>
      ) : null}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={pending ? label : "idle"}
          className="relative inline-flex items-center justify-center gap-2.5"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {pending ? <LuxuryAuthSpinner /> : null}
          <span>{pending ? label : "Sign in"}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function LoginFormBody({ error }: { error?: string }) {
  const { pending } = useFormStatus();

  return (
    <motion.div
      className="space-y-4"
      animate={
        pending
          ? { opacity: 0.94, scale: 0.998 }
          : { opacity: 1, scale: 1 }
      }
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {error ? (
        <div>
          <FormError>{error}</FormError>
        </div>
      ) : null}

      <fieldset disabled={pending} className="space-y-4 border-0 p-0 m-0 min-w-0">
        <FormField label="Email" icon={<Mail />} htmlFor="email" required>
          <FormInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            disabled={pending}
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
            disabled={pending}
          />
        </FormField>
        <div className="space-y-2 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none md:rounded-xl md:border md:border-white/10 md:bg-[#1a1a1a] md:px-4 md:py-3 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Checkbox
            id="remember_me"
            name="remember_me"
            value="on"
            label="Remember me for 30 days"
            className="items-center gap-3"
            disabled={pending}
          />
          <p className="text-xs leading-relaxed text-white/45 max-md:pl-0 max-md:pt-0.5 md:pl-8">
            If unchecked, you stay signed in until you close the browser or after 24 hours of use. Checked keeps you
            signed in for up to 30 days.
          </p>
        </div>
      </fieldset>

      <LoginSubmitButton />
    </motion.div>
  );
}

type LoginFormProps = {
  error?: string;
};

export function LoginForm({ error }: LoginFormProps) {
  return (
    <form action={login} className="space-y-4">
      <LoginFormBody error={error} />
    </form>
  );
}
