import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect, notFound } from "next/navigation";
import { AdminNotificationDiagnosticClient } from "@/components/admin-notification-diagnostic-client";

/**
 * Admin-only notification pipeline diagnostic. Gated in production the same way as
 * `/admin/test-notifications` (`ENABLE_NOTIFICATION_TESTING=true`).
 */
export default async function AdminNotificationDiagnosticPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") {
    redirect(ROUTES.dashboard);
  }
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_NOTIFICATION_TESTING !== "true") {
    notFound();
  }

  return <AdminNotificationDiagnosticClient />;
}
