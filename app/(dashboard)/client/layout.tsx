import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { ClientRedirect } from "@/components/client-redirect";
import { Providers } from "@/components/providers";
import { AnimatedBackground } from "@/components/animated-background";
import { ClientPortalNav } from "@/components/client-portal-nav";
import { ClientPortalHeader } from "@/components/client-portal-header";
import { ClientMobileBottomNav } from "@/components/client-mobile-bottom-nav";
import { ClientMobileMenuProvider } from "@/contexts/client-mobile-menu-context";
import { getDataBackend } from "@/lib/data-backend";

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
    <Providers dataBackend={getDataBackend()}>
      <ClientMobileMenuProvider>
        <div className="dashboard-bg relative flex h-[100dvh] overflow-hidden text-white [--bg-base:#0a0612] md:h-screen">
          <AnimatedBackground />
          <div className="dashboard-glow-tl" aria-hidden />
          <div className="dashboard-glow-br" aria-hidden />
          <ClientPortalNav userEmail={user.email} />
          <div className="dashboard-content relative flex min-w-0 flex-1 flex-col overflow-hidden pl-0 md:pl-64">
            <ClientPortalHeader />
            <main className="relative z-20 flex-1 overflow-y-auto bg-transparent p-4 pb-[calc(var(--mobile-bottom-nav-height,76px)+1.5rem+env(safe-area-inset-bottom,0px))] pt-2 md:p-8 md:pb-8 md:pt-0">
              {children}
            </main>
            <ClientMobileBottomNav />
          </div>
        </div>
      </ClientMobileMenuProvider>
    </Providers>
  );
}
