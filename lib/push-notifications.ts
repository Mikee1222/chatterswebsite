import { getActiveSubscriptionsForUser } from "@/services/push-subscriptions";
import { sendWebPush } from "@/lib/web-push-server";
import { devLog } from "@/lib/dev-log";

export async function sendPushNotification(
  userId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  devLog("[push] sending notification", { userId, notification });

  const subscriptions = await getActiveSubscriptionsForUser(userId);
  devLog("[push] found subscriptions", { userId, count: subscriptions.length });

  const payloadBody =
    notification.data && Object.keys(notification.data).length > 0
      ? `${notification.body}\n\n${JSON.stringify(notification.data)}`
      : notification.body;

  for (const sub of subscriptions) {
    try {
      const ok = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title: notification.title,
          body: payloadBody,
          url: "/notifications",
          tag: String(notification.data?.type ?? "system"),
        }
      );
      if (ok.ok) {
        devLog("[push] sent successfully", {
          userId,
          endpoint: sub.endpoint.slice(0, 64),
        });
      } else {
        console.error("[push] failed", {
          userId,
          endpoint: sub.endpoint.slice(0, 64),
          error: ok.error ?? "sendWebPush returned false",
          status: ok.status,
          stale: ok.stale,
        });
      }
    } catch (err) {
      console.error("[push] failed", { userId, error: err });
    }
  }
}
