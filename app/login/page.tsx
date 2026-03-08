import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { login } from "@/app/actions/auth";
import { Label, Input, FormError, SubmitButton, Checkbox } from "@/components/ui/form";
import { LoginPasswordField } from "@/components/login-password-field";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (user) redirect(ROUTES.dashboard);

  const { error } = await searchParams;
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(0,0%,5%)]">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-[hsl(0,0%,6%)] to-black" />
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-[hsl(330,80%,55%)] opacity-[0.08] blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-pink-500 opacity-[0.06] blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/60 px-8 py-10 backdrop-blur-xl"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 48px -12px hsl(330 80% 55% / 0.12)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Sign in</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Partner</h1>
          <p className="mt-1 text-white/60">Sign in to your account</p>
          <div className="mt-6 h-px w-12 rounded-full bg-[hsl(330,80%,55%)]/50" />
        <div className="mt-6 space-y-5">
          {error && (
            <div className="mb-4">
              <FormError>{error}</FormError>
            </div>
          )}
          <form action={login} className="space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
            <LoginPasswordField name="password" required placeholder="••••••••" />
            <div>
              <Checkbox id="remember_me" name="remember_me" value="on" label="Remember me" />
            </div>
            <SubmitButton>Sign in</SubmitButton>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
