import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getActiveSubscriptionsForUser } from "@/services/push-subscriptions";
import { sendWebPush } from "@/lib/web-push-server";
import { devLog } from "@/lib/dev-log";

/** POST: send a test push to the current user's subscriptions (for verifying push works). */
export async function POST() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "settings:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = user.airtableUserId ?? user.id;
  const subscriptions = await getActiveSubscriptionsForUser(userId);
  if (subscriptions.length === 0) {
    return NextResponse.json(
      { error: "No push subscriptions. Enable notifications first." },
      { status: 400 }
    );
  }

  const payload = {
    title: "Test notification",
    body: "Push notifications are working.",
    url: "/home",
    tag: "test",
  };

  let sent = 0;
  for (const sub of subscriptions) {
    const result = await sendWebPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      payload
    );
    if (result.ok) sent++;
    if (result.stale && sub.id) {
      const { deletePushSubscription } = await import("@/services/push-subscriptions");
      await deletePushSubscription(sub.id).catch(() => {});
    }
  }

  if (process.env.NODE_ENV !== "production") {
    devLog("[push/test] sent to", sent, "of", subscriptions.length, "subscriptions");
  }

  return NextResponse.json({
    success: true,
    sent,
    total: subscriptions.length,
  });
}
