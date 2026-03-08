import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { MobileAppShell } from "@/components/mobile-app-shell";
import { DashboardPwaPrompts } from "@/components/dashboard-pwa-prompts";
import { Providers } from "@/components/providers";
import { getActiveShiftByChatter, getActiveShiftByStaff, getActiveShiftModels } from "@/services/shifts";

/** Dashboard layout: desktop = left sidebar + topbar; mobile = app shell (header + bottom nav + FAB + live mini bar). */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  let activeShift: Awaited<ReturnType<typeof getActiveShiftByChatter>> = null;
  let activeShiftModelsCount: number | null = null;
  if (user.role === "chatter") {
    activeShift = await getActiveShiftByChatter(user.airtableUserId ?? user.id).catch(() => null);
    if (activeShift) {
      const models = await getActiveShiftModels(activeShift.id).catch(() => []);
      activeShiftModelsCount = models.length;
    }
  } else if (user.role === "virtual_assistant") {
    activeShift = await getActiveShiftByStaff(user.airtableUserId ?? user.id, "virtual_assistant").catch(() => null);
    if (activeShift) {
      const models = await getActiveShiftModels(activeShift.id).catch(() => []);
      activeShiftModelsCount = models.length;
    }
  }

  return (
    <Providers>
      <div className="dashboard-bg">
        <div className="dashboard-glow-tl" aria-hidden />
        <div className="dashboard-glow-br" aria-hidden />
        <Sidebar user={user} />
        <div className="dashboard-content pl-0 md:pl-64">
          <Topbar user={user} />
          <MobileAppShell user={user} activeShift={activeShift} activeShiftModelsCount={activeShiftModelsCount}>
            <main className="mobile-app-main min-h-[100dvh] p-4 md:p-6 md:min-h-0">{children}</main>
            <DashboardPwaPrompts user={user} />
          </MobileAppShell>
        </div>
      </div>
    </Providers>
  );
}
