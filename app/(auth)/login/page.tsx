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
    <div className="relative min-h-[100dvh] bg-[#0A0A0A]">
      <AnimatedBackground />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-10 safe-area-inset-top pb-safe sm:px-6">
        <div className="mx-auto w-full max-w-[400px] md:max-w-[440px]">
          {/* Brand signal above the card — first impression */}
          <div className="mb-7 flex flex-col items-center text-center md:mb-8">
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-5 rounded-full bg-[#FF1493]/20 blur-2xl motion-safe:animate-pulse motion-reduce:animate-none"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -inset-2 rounded-full bg-[#D4AF8C]/10 blur-xl"
                aria-hidden
              />
              <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br from-[#FF1493] via-[#E91E8C] to-[#DB2777] p-[2px] shadow-[0_0_40px_-8px_rgba(255,20,147,0.65),0_8px_24px_-10px_rgba(0,0,0,0.6)] md:h-20 md:w-20">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0D0B0D] p-2">
                  <Image
                    src="/apple-touch-icon-v2.png"
                    alt="Gunzo"
                    width={56}
                    height={56}
                    className="h-12 w-12 rounded-full object-cover md:h-14 md:w-14"
                    priority
                  />
                </div>
              </div>
            </div>
            <h1 className="mt-5 text-[1.75rem] font-semibold tracking-[-0.02em] text-white md:text-[2rem]">
              Gunzo
            </h1>
            <p className="mt-1.5 text-sm text-[#B8B4B8]/80">Partner portal</p>
          </div>

          <div className="va-card relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#151315] via-[#151315] to-[#0D0B0D] p-6 shadow-[0_28px_72px_-28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] md:p-8">
            {/* Ambient card glows */}
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#FF1493]/18 blur-3xl motion-safe:animate-pulse motion-reduce:animate-none"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[#D4AF8C]/12 blur-3xl"
              aria-hidden
            />

            {/* Top champagne → pink hairline */}
            <div
              className="absolute left-[12%] right-[12%] top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF8C]/55 to-transparent"
              aria-hidden
            />
            <div
              className="absolute left-1/3 right-1/3 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF1493]/50 to-transparent blur-[1px]"
              aria-hidden
            />

            <div className="relative">
              <div className="flex items-center justify-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF1493] opacity-75 motion-safe:animate-ping motion-reduce:hidden" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FF1493] shadow-[0_0_10px_rgba(255,20,147,0.9)]" />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D4AF8C]/90">
                  Sign in
                </p>
              </div>

              <p className="mt-3 text-center text-[15px] leading-relaxed text-[#B8B4B8]">
                Welcome back. Enter your credentials to continue.
              </p>

              <div
                className="va-champagne-divider mx-auto mt-6 h-px w-full max-w-[12rem]"
                aria-hidden
              />

              <div className="mt-6">
                <LoginForm error={error} />
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] tracking-wide text-white/25">
            Gunzo Team · Secure access
          </p>
        </div>
      </div>
    </div>
  );
}
