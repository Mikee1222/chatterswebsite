import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { ClientRedirect } from "@/components/client-redirect";
import { AnimatedBackground } from "@/components/animated-background";
import { Providers } from "@/components/providers";
import { ClientPortalNav } from "@/components/client-portal-nav";
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
        <div className="flex min-h-screen">
          <ClientPortalNav />

          <div className="flex min-h-screen flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-black/40 px-4 backdrop-blur-xl md:px-6">
              <span className="text-sm font-semibold text-white">
                Gunzo Agency — Client Portal
              </span>
              <div className="flex items-center gap-4">
                <span className="hidden text-sm text-white/50 sm:inline">
                  {user.fullName || user.email}
                </span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Log out
                  </button>
                </form>
              </div>
            </header>
            <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
          </div>
        </div>
      </div>
    </Providers>
  );
}
