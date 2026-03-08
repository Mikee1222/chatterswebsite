import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getMyNotificationPreferences } from "@/app/actions/notification-preferences";
import { NotificationSettingsForm } from "@/components/notification-settings-form";
import { SettingsPwaActions } from "@/components/settings-pwa-actions";

export default async function SettingsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const prefs = await getMyNotificationPreferences();
  if (!prefs) redirect(ROUTES.dashboard);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Notifications</h2>
        <p className="mb-6 text-sm text-white/60">
          Choose which notifications you receive and when.
        </p>
        <NotificationSettingsForm prefs={prefs} />
      </section>

      <SettingsPwaActions role={user.role} />

      {user.role === "admin" && (
        <section className="border-t border-white/10 pt-8">
          <h2 className="mb-4 text-lg font-semibold text-white">System settings</h2>
          <div className="glass-card p-6">
            <p className="text-sm text-white/60">
              System settings are stored in the <strong>system_settings</strong> Airtable table (setting_key, setting_value, description).
              Configure keys and values in Airtable. This page can be extended to read and edit settings via the Airtable API.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
