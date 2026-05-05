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

export default async function SettingsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const prefs = await getMyNotificationPreferences();

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
    <div className="space-y-8">
      <section className="relative z-[25] max-md:mt-14 max-md:max-h-[calc(100vh-56px)] max-md:overflow-y-auto max-md:p-4 max-md:pb-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Notifications</h2>
        {prefs ? (
          <>
            <p className="mb-4 text-sm text-white/60 md:mb-6">
              Choose which notifications you receive and when.
            </p>
            <div className="md:contents">
              <NotificationSettingsForm prefs={prefs} />
            </div>
          </>
        ) : (
          <div className="glass-card p-6">
            <p className="text-sm leading-relaxed text-white/75">
              Notification preferences are tied to your Airtable user record. This session cannot load or create
              preferences (for example, a demo login in production, or a missing Airtable link). Sign in with a full
              staff account, or ask an admin to ensure your user row exists and is linked so preferences can be
              created.
            </p>
          </div>
        )}
      </section>

      <SettingsPwaActions role={user.role} />

      {user.role === "admin" && (
        <>
          <NavVisibilitySettings />
          <AdminNotificationsSettings admins={adminNotifAdmins} pickableUsers={adminNotifPickable} />
          <section className="border-t border-white/10 pt-8">
            <h2 className="mb-4 text-lg font-semibold text-white">System settings</h2>
            <div className="glass-card p-6">
              <p className="text-sm text-white/60">
                System settings are stored in the <strong>system_settings</strong> Airtable table (setting_key, setting_value, description).
                Configure keys and values in Airtable. This page can be extended to read and edit settings via the Airtable API.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
