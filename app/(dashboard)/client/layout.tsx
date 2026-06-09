import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { ClientRedirect } from "@/components/client-redirect";
import { Providers } from "@/components/providers";
import { ClientPortalNav } from "@/components/client-portal-nav";
import { AnimatedBackground } from "@/components/animated-background";

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
      <div className="relative flex h-screen overflow-hidden dashboard-bg text-white">
        <AnimatedBackground />
        <div className="dashboard-glow-tl" aria-hidden />
        <div className="dashboard-glow-br" aria-hidden />
        <ClientPortalNav />
        <div className="relative z-20 flex min-w-0 flex-1 flex-col overflow-hidden pl-0 md:pl-64">
          <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
