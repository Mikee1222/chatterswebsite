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
          <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
