import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { ClientRedirect } from "@/components/client-redirect";
import { AnimatedBackground } from "@/components/animated-background";
import { Providers } from "@/components/providers";
import { logout } from "@/app/actions/auth";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") {
    return <ClientRedirect to={ROUTES.login} />;
  }

  return (
    <Providers>
      <div className="relative min-h-screen dashboard-bg">
        <AnimatedBackground />
        <div className="dashboard-glow-tl" aria-hidden />
        <div className="dashboard-glow-br" aria-hidden />
        <div className="min-h-screen">
          <header className="sticky top-0 z-30 h-14 flex items-center justify-between border-b border-white/10 bg-black/40 px-6 backdrop-blur-xl">
            <span className="text-sm font-semibold text-white">
              Gunzo Agency — Client Portal
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Log out
              </button>
            </form>
          </header>
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
