import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect, notFound } from "next/navigation";
import { AdminTestNotificationsClient } from "@/components/admin-test-notifications-client";

/**
 * Internal notification lab — **admin only**. Disabled in production unless
 * `ENABLE_NOTIFICATION_TESTING=true`.
 */
export default async function AdminTestNotificationsPage() {
  await requireAdminRoute(await getSessionFromCookies(), {
    permission: PERMISSIONS.NOTIFICATIONS_DIAGNOSTIC,
    adminOnly: true,
  });
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_NOTIFICATION_TESTING !== "true") {
    notFound();
  }

  return <AdminTestNotificationsClient />;
}
