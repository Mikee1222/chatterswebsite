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
  const count = await getUnreadCount(userId);
  return NextResponse.json({ count });
}
