import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { AnimatedBackground } from "@/components/animated-background";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { MobileAppShell } from "@/components/mobile-app-shell";
import { DashboardPwaPrompts } from "@/components/dashboard-pwa-prompts";
import { Providers } from "@/components/providers";
import { ClientRedirect } from "@/components/client-redirect";
import { getActiveShiftByChatter, getActiveShiftByStaff, getActiveShiftModels } from "@/services/shifts";
import { getSystemSetting } from "@/services/system-settings";
import { parseHiddenNavSettingJson } from "@/lib/nav-config";

/** Dashboard layout: desktop = left sidebar + topbar; mobile = app shell (header + bottom nav + FAB + live mini bar). */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionFromCookies();
  if (!user) return <ClientRedirect to={ROUTES.login} />;

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

  const hiddenNavRaw = await getSystemSetting("hidden_nav_items").catch(() => null);
  const hiddenNavByProfile = parseHiddenNavSettingJson(hiddenNavRaw);

  return (
    <Providers>
      <div className="relative min-h-screen dashboard-bg">
        <AnimatedBackground />
        <div className="dashboard-glow-tl" aria-hidden />
        <div className="dashboard-glow-br" aria-hidden />
        <Sidebar user={user} hiddenNavByProfile={hiddenNavByProfile} />
        <div className="dashboard-content pl-0 md:pl-64">
          <Topbar user={user} />
          <MobileAppShell
            user={user}
            activeShift={activeShift}
            activeShiftModelsCount={activeShiftModelsCount}
            hiddenNavByProfile={hiddenNavByProfile}
          >
            <main
              data-main-content
              className="mobile-app-main min-h-[100dvh] p-4 max-md:px-4 max-md:py-5 md:p-6 md:min-h-0"
              style={{ paddingBottom: "90px" }}
            >
              {children}
            </main>
            <DashboardPwaPrompts user={user} />
          </MobileAppShell>
        </div>
      </div>
    </Providers>
  );
}
