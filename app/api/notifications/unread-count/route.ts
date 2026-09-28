import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getNotificationUserId } from "@/lib/notification-user";
import { getUnreadCount } from "@/services/notifications";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "settings:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = getNotificationUserId(user);
  if (userId == null) {
    return NextResponse.json({ count: 0 });
  }
  try {
    const count = await getUnreadCount(userId);
    return NextResponse.json({ count });
  } catch (err) {
    // Fail soft: never 500 the notification bell — transient Supabase/network
    // errors (empty PostgREST fields under load) must not break the page shell.
    console.error("[api/notifications/unread-count] degraded to 0", err);
    return NextResponse.json({ count: 0, degraded: true });
  }
}
