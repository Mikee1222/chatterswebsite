import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { getMyNotificationPreferences } from "@/app/actions/notification-preferences";
import { ClientSettingsForm } from "@/components/client-settings-form";
import { getClientById } from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientSettingsPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const clientId = getClientAirtableId(user);
  const [client, prefs] = await Promise.all([
    getClientById(clientId).catch(() => null),
    getMyNotificationPreferences(),
  ]);

  if (!prefs) {
    return (
      <div className="glass-card p-6">
        <p className="text-sm text-white/60">Could not load notification preferences.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-white/50">Manage your profile, notifications, and app preferences.</p>
      </div>
      <ClientSettingsForm
        prefs={prefs}
        profile={{
          fullName: client?.display_name || user.fullName || "—",
          email: client?.email || user.email || "—",
          companyName: client?.company_name || "—",
        }}
      />
    </div>
  );
}
