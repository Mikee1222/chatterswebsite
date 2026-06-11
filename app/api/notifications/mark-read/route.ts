import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getNotificationUserId } from "@/lib/notification-user";
import { broadcastUserUnreadCount } from "@/lib/realtime-broadcast";
import { getUnreadCount, markAsRead } from "@/services/notifications";

export async function POST(request: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getNotificationUserId(user);
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { notification_id?: string };
  try {
    body = (await request.json()) as { notification_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const notificationId = body.notification_id?.trim();
  if (!notificationId) {
    return NextResponse.json({ error: "notification_id required" }, { status: 400 });
  }

  try {
    await markAsRead(notificationId, userId);
    const unreadCount = await getUnreadCount(userId);
    await broadcastUserUnreadCount(userId, unreadCount).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
