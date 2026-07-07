import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { AnimatedBackground } from "@/components/animated-background";
import { LoginForm } from "@/components/login-form";

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
        <div className="mx-auto w-full max-w-sm px-2 md:max-w-md md:px-0">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-xl backdrop-blur-xl md:rounded-3xl md:bg-white/5 md:p-8 md:shadow-2xl">
            <div className="absolute left-1/4 right-1/4 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/50 to-transparent" />

            <div className="relative flex justify-center pb-8 pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-pink-600 shadow-lg shadow-pink-500/30">
                <Image
                  src="/apple-touch-icon-v2.png"
                  alt="Gunzo"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
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
              <LoginForm error={error} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
