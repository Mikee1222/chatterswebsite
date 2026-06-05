import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { ClientRedirect } from "@/components/client-redirect";
import { Providers } from "@/components/providers";
import { ClientPortalNav } from "@/components/client-portal-nav";

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
      <div className="flex h-screen overflow-hidden bg-[#0a0612] text-white">
        <ClientPortalNav />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#120a1f]/70 px-4 pl-16 backdrop-blur-xl md:px-6 md:pl-6">
            <span className="text-sm font-semibold text-white">Gunzo Agency — Client Portal</span>
            <span className="hidden text-sm text-white/50 sm:inline">
              {user.fullName || user.email}
            </span>
          </header>
          <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
