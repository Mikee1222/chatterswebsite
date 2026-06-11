import { getSessionFromCookies } from "@/lib/auth";
import { getNotificationUserId } from "@/lib/notification-user";
import { ROUTES } from "@/lib/routes";
import { AnimatedBackground } from "@/components/animated-background";
import { Sidebar, type SidebarQuickStats } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { MobileAppShell } from "@/components/mobile-app-shell";
import { DashboardPwaPrompts } from "@/components/dashboard-pwa-prompts";
import { Providers } from "@/components/providers";
import { ClientRedirect } from "@/components/client-redirect";
import { DashboardContentOffset } from "@/components/dashboard-content-offset";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { getActiveShiftByChatter, getActiveShiftByStaff, getActiveShiftModels, getActiveShifts } from "@/services/shifts";
import { getSystemSetting } from "@/services/system-settings";
import { parseHiddenNavSettingJson } from "@/lib/nav-config";
import { getModelDashboardLanguage } from "@/lib/model-context-server";
import { countPendingVAContentAssignments } from "@/services/va-content-assignments";
import { countWhalesWithoutChatter } from "@/services/whales";
import { countAdminPendingCustomRequests } from "@/services/custom-requests";
import { countPendingReviewFinesBonuses } from "@/services/fines-bonuses";
import { countPendingMistakes } from "@/services/chatter-mistakes";
import { listAllModelss } from "@/services/modelss";
import { getRoles } from "@/services/roles";
import type { ModelLang } from "@/lib/model-i18n";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getUserPermissions, hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getUnreadCount } from "@/services/notifications";

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
  const hiddenNavConfig = parseHiddenNavSettingJson(hiddenNavRaw);
  const userPermissions = await getUserPermissions(user).catch(() => [] as Awaited<ReturnType<typeof getUserPermissions>>);
  const navBadgeCounts: Record<string, number> = {};
  if (await hasPermission(user, PERMISSIONS.WHALES_ASSIGN)) {
    navBadgeCounts[ROUTES.admin.vaContentAssignments] = await countPendingVAContentAssignments().catch(() => 0);
    navBadgeCounts[ROUTES.admin.whales] = await countWhalesWithoutChatter().catch(() => 0);
  }
  if (await hasPermission(user, PERMISSIONS.CUSTOM_REQUESTS_VIEW)) {
    navBadgeCounts[ROUTES.admin.customRequests] = await countAdminPendingCustomRequests().catch(() => 0);
  }
  if (await hasPermission(user, PERMISSIONS.FINES_VIEW)) {
    navBadgeCounts[ROUTES.admin.finesBonuses] = await countPendingReviewFinesBonuses().catch(() => 0);
  }
  if (await hasPermission(user, PERMISSIONS.MISTAKES_VIEW)) {
    navBadgeCounts[ROUTES.admin.mistakes] = await countPendingMistakes().catch(() => 0);
  }

  let quickStats: SidebarQuickStats | undefined;
  if (user.role === "admin" || user.role === "manager") {
    const [chatterShifts, vaShifts, modelss] = await Promise.all([
      getActiveShifts("chatter").catch(() => []),
      getActiveShifts("virtual_assistant").catch(() => []),
      listAllModelss().catch(() => []),
    ]);
    quickStats = {
      activeShiftsCount: chatterShifts.length + vaShifts.length,
      freeModelsCount: modelss.filter((m) => m.current_status === "free").length,
    };
  }

  const roles = await getRoles().catch(() => []);
  const matchedRole = roles.find((r) => r.role_id === user.role.toLowerCase());
  const roleLabel = matchedRole?.label;
  const roleColor = matchedRole?.color;

  let modelUiLanguage: ModelLang | undefined;
  if (user.role === "model") {
    modelUiLanguage = await getModelDashboardLanguage(user);
  }

  const notificationUserId = getNotificationUserId(user);
  const initialUnreadCount = notificationUserId
    ? await getUnreadCount(notificationUserId).catch(() => 0)
    : 0;

  return (
    <Providers initialUnreadCount={initialUnreadCount}>
      <SidebarProvider>
        <div className="relative min-h-screen dashboard-bg">
          <AnimatedBackground />
          <div className="dashboard-glow-tl" aria-hidden />
          <div className="dashboard-glow-br" aria-hidden />
          <Sidebar
            user={user}
            hiddenNavConfig={hiddenNavConfig}
            navBadgeCounts={navBadgeCounts}
            modelUiLanguage={modelUiLanguage}
            userPermissions={userPermissions}
            quickStats={quickStats}
            roleLabel={roleLabel}
            roleColor={roleColor}
          />
          <DashboardContentOffset>
            <Topbar user={user} />
            <MobileAppShell
              user={user}
              activeShift={activeShift}
              activeShiftModelsCount={activeShiftModelsCount}
              hiddenNavConfig={hiddenNavConfig}
              navBadgeCounts={navBadgeCounts}
              modelUiLanguage={modelUiLanguage}
              userPermissions={userPermissions}
            >
              <main
                data-main-content
                className="mobile-app-main relative z-20 min-h-[100dvh] overflow-x-hidden bg-transparent p-4 pb-[calc(var(--mobile-bottom-nav-height)+3.75rem+env(safe-area-inset-bottom,0px))] max-md:px-4 max-md:py-5 md:overflow-x-visible md:p-6 md:pb-6 md:min-h-0"
              >
                {children}
              </main>
              <DashboardPwaPrompts user={user} />
            </MobileAppShell>
          </DashboardContentOffset>
        </div>
      </SidebarProvider>
    </Providers>
  );
}
