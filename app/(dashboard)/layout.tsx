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
import { getModelDashboardLanguage } from "@/lib/model-context-server";
import { countPendingVAContentAssignments } from "@/services/va-content-assignments";
import { countWhalesWithoutChatter } from "@/services/whales";
import type { ModelLang } from "@/lib/model-i18n";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";

/** Dashboard layout: desktop = left sidebar + topbar; mobile = app shell (header + bottom nav + FAB + live mini bar). */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionFromCookies();
  if (!user) return <ClientRedirect to={ROUTES.login} />;

  if (user.role === "client") {
    return <>{children}</>;
  }

  let activeShift: Awaited<ReturnType<typeof getActiveShiftByChatter>> = null;
  let activeShiftModelsCount: number | null = null;
  const staffMode = getEffectiveStaffRole(user);
  if (staffMode === "chatter") {
    activeShift = await getActiveShiftByChatter(user.airtableUserId ?? user.id).catch(() => null);
    if (activeShift) {
      const models = await getActiveShiftModels(activeShift.id).catch(() => []);
      activeShiftModelsCount = models.length;
    }
  } else if (staffMode === "virtual_assistant") {
    activeShift = await getActiveShiftByStaff(user.airtableUserId ?? user.id, "virtual_assistant").catch(() => null);
    if (activeShift) {
      const models = await getActiveShiftModels(activeShift.id).catch(() => []);
      activeShiftModelsCount = models.length;
    }
  }

  const hiddenNavRaw = await getSystemSetting("hidden_nav_items").catch(() => null);
  const hiddenNavByProfile = parseHiddenNavSettingJson(hiddenNavRaw);
  const navBadgeCounts: Record<string, number> = {};
  if (user.role === "admin" || user.role === "manager") {
    navBadgeCounts[ROUTES.admin.vaContentAssignments] = await countPendingVAContentAssignments().catch(() => 0);
    navBadgeCounts[ROUTES.admin.whales] = await countWhalesWithoutChatter().catch(() => 0);
  }

  let modelUiLanguage: ModelLang | undefined;
  if (user.role === "model") {
    modelUiLanguage = await getModelDashboardLanguage(user);
  }

  return (
    <Providers>
      <div className="relative min-h-screen dashboard-bg">
        <AnimatedBackground />
        <div className="dashboard-glow-tl" aria-hidden />
        <div className="dashboard-glow-br" aria-hidden />
        <Sidebar
          user={user}
          hiddenNavByProfile={hiddenNavByProfile}
          navBadgeCounts={navBadgeCounts}
          modelUiLanguage={modelUiLanguage}
        />
        <div className="dashboard-content pl-0 md:pl-64">
          <Topbar user={user} />
          <MobileAppShell
            user={user}
            activeShift={activeShift}
            activeShiftModelsCount={activeShiftModelsCount}
            hiddenNavByProfile={hiddenNavByProfile}
            navBadgeCounts={navBadgeCounts}
            modelUiLanguage={modelUiLanguage}
          >
            <main
              data-main-content
              className="mobile-app-main relative z-20 min-h-[100dvh] overflow-x-hidden bg-transparent p-4 pb-[calc(var(--mobile-bottom-nav-height)+3.75rem+env(safe-area-inset-bottom,0px))] max-md:px-4 max-md:py-5 md:overflow-x-visible md:p-6 md:pb-6 md:min-h-0"
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
