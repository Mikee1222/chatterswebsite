import * as React from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getMyNotificationPreferences } from "@/app/actions/notification-preferences";
import { NotificationSettingsForm } from "@/components/notification-settings-form";
import { NavVisibilitySettings } from "@/components/nav-visibility-settings";
import { SettingsPwaActions } from "@/components/settings-pwa-actions";
import { AdminNotificationsSettings } from "@/components/admin-notifications-settings";
import { getAdminNotificationIds } from "@/services/admin-notification-settings";
import { getUserByAirtableId, listAllUsers } from "@/services/users";
import { ModelProfileSettingsForm } from "@/components/model-profile-settings-form";
import { LanguageProvider } from "@/lib/language-provider";
import { getModelDashboardLanguage } from "@/lib/model-context-server";
import { getActiveShiftByChatter, getActiveShiftByStaff } from "@/services/shifts";
import {
  getEffectiveStaffRole,
  getOtherStaffPairRole,
  hasDualStaffRole,
} from "@/lib/staff-session-role";
import { RoleSwitcher } from "@/components/role-switcher";
import { Settings } from "lucide-react";

export default async function SettingsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  let modelProfile:
    | { fullName: string; email: string; languagePreference: "en" | "es"; uiLanguage: "en" | "es" }
    | null = null;
  if (user.role === "model") {
    const recordId = (user.airtableUserId ?? user.id)?.trim();
    if (recordId) {
      const row = await getUserByAirtableId(recordId);
      if (row) {
        const uiLanguage = row.language_preference === "es" ? "es" : "en";
        modelProfile = {
          fullName: row.full_name?.trim() || "—",
          email: row.email?.trim() || "",
          languagePreference: uiLanguage,
          uiLanguage,
        };
      }
    }
  }

  const modelUiLanguageForSettings = user.role === "model" ? await getModelDashboardLanguage(user) : "en";

  const prefs = await getMyNotificationPreferences();

  let hasActiveShiftForPair = false;
  if (hasDualStaffRole(user)) {
    const mode = getEffectiveStaffRole(user);
    const uid = user.airtableUserId ?? user.id;
    if (mode === "chatter") {
      hasActiveShiftForPair = !!(await getActiveShiftByChatter(uid).catch(() => null));
    } else if (mode === "virtual_assistant") {
      hasActiveShiftForPair = !!(await getActiveShiftByStaff(uid, "virtual_assistant").catch(() => null));
    }
  }

  let adminNotifAdmins: { id: string; name: string; email: string }[] = [];
  let adminNotifPickable: { id: string; name: string; email: string }[] = [];
  if (user.role === "admin") {
    const ids = await getAdminNotificationIds();
    for (const id of ids) {
      const row = await getUserByAirtableId(id);
      if (row) {
        adminNotifAdmins.push({
          id: row.id,
          name: row.full_name?.trim() || "—",
          email: row.email?.trim() || "",
        });
      }
    }
    const all = await listAllUsers();
    const active = all.filter(
      (u) => (u.status || "").toLowerCase() === "active" && u.can_login !== false
    );
    const idSet = new Set(ids);
    adminNotifPickable = active
      .filter((u) => !idSet.has(u.id))
      .map((u) => ({
        id: u.id,
        name: u.full_name?.trim() || "—",
        email: u.email?.trim() || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="space-y-10 pb-8 md:space-y-12 md:pb-10">
      <header className="max-md:pt-2">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-pink-400/25 bg-pink-500/15 text-pink-200 shadow-[0_0_28px_-8px_hsl(330_80%_55%/0.35)]">
            <Settings className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Settings</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55 md:text-[15px]">
              Notifications, shortcuts, and admin-only options for this workspace.
            </p>
          </div>
        </div>
      </header>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" aria-hidden />

      {user.role === "model" && modelProfile && (
        <LanguageProvider initialLanguage={modelUiLanguageForSettings}>
          <ModelProfileSettingsForm
            fullName={modelProfile.fullName}
            email={modelProfile.email}
            languagePreference={modelProfile.languagePreference}
          />
        </LanguageProvider>
      )}

      {hasDualStaffRole(user) && getEffectiveStaffRole(user) && getOtherStaffPairRole(user) ? (
        <>
          <div className="mb-4">
            <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Role</p>
            <RoleSwitcher
              currentRole={getEffectiveStaffRole(user)!}
              secondaryRole={getOtherStaffPairRole(user)!}
              hasActiveShift={hasActiveShiftForPair}
            />
          </div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" aria-hidden />
        </>
      ) : null}

      <section className="relative z-[25] min-w-0 max-md:px-0">
        <h2 className="mb-2 text-lg font-semibold tracking-tight text-white">Notifications</h2>
        {prefs ? (
          <>
            <p className="mb-6 max-w-2xl text-sm leading-relaxed text-white/55 md:mb-8">
              Choose which notifications you receive, when quiet hours apply, and how delivery behaves.
            </p>
            <div className="md:contents">
              <NotificationSettingsForm prefs={prefs} />
            </div>
          </>
        ) : (
          <div className="glass-card rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-6 md:p-8">
            <p className="text-sm leading-relaxed text-amber-100/90">
              Notification preferences are tied to your Airtable user record. This session cannot load or create
              preferences (for example, a demo login in production, or a missing Airtable link). Sign in with a full
              staff account, or ask an admin to ensure your user row exists and is linked so preferences can be
              created.
            </p>
          </div>
        )}
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" aria-hidden />

      <SettingsPwaActions role={user.role} />

      {user.role === "admin" && (
        <>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" aria-hidden />
          <NavVisibilitySettings />
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" aria-hidden />
          <AdminNotificationsSettings admins={adminNotifAdmins} pickableUsers={adminNotifPickable} />
          <section className="space-y-4 pt-2">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" aria-hidden />
            <h2 className="text-lg font-semibold tracking-tight text-white">System settings</h2>
            <div className="glass-card rounded-2xl border border-white/10 p-6 md:p-8">
              <p className="text-sm leading-relaxed text-white/60">
                System settings are stored in the <strong className="text-white/80">system_settings</strong> Airtable
                table (setting_key, setting_value, description). Configure keys and values in Airtable. This page can be
                extended to read and edit settings via the Airtable API.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
