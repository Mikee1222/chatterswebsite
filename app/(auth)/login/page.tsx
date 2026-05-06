import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { login } from "@/app/actions/auth";
import { AnimatedBackground } from "@/components/animated-background";
import { FormError, Checkbox } from "@/components/ui/form";
import { LoginPasswordField } from "@/components/login-password-field";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Lock, Mail } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string; error?: string };
}) {
  const user = await getSessionFromCookies();
  if (user) redirect(ROUTES.dashboard);

  const { error } = searchParams;

  return (
    <div className="relative min-h-screen bg-[#0a0a0a]">
      <AnimatedBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <div className="absolute left-1/4 right-1/4 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/50 to-transparent" />

            <div className="relative flex justify-center pb-8 pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-pink-600 shadow-lg shadow-pink-500/30">
                <Image
                  src="/apple-touch-icon.svg"
                  alt="Gunzo"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full"
                  priority
                />
              </div>
            </div>

            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Sign in</p>
            <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight text-white">Partner</h1>
            <p className="mt-1 text-center text-sm text-white/40">Welcome to Gunzo Team</p>
            <p className="mt-1 text-center text-white/60">Sign in to your account</p>
            <div className="mx-auto mt-6 h-px w-12 rounded-full bg-pink-500/50" />

            <div className="mt-6 space-y-5">
              {error ? (
                <div>
                  <FormError>{error}</FormError>
                </div>
              ) : null}
              <form action={login} className="space-y-4">
                <FormField label="Email" icon={<Mail />} htmlFor="email" required>
                  <FormInput
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
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
                  />
                </FormField>
                <div className="space-y-2 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <Checkbox
                    id="remember_me"
                    name="remember_me"
                    value="on"
                    label="Remember me for 30 days"
                  />
                  <p className="pl-8 text-xs leading-relaxed text-white/45">
                    If unchecked, you stay signed in until you close the browser or after 24 hours of use. Checked keeps
                    you signed in for up to 30 days.
                  </p>
                </div>
                <FormSubmitButton className="w-full">Sign in</FormSubmitButton>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
