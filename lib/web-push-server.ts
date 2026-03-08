/**
 * Server-only: send web push via VAPID. Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env.
 */

import webPush from "web-push";
import type { PushSubscriptionRecord } from "@/types";

let vapidConfigured = false;

function getVapidKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

function ensureVapid() {
  if (vapidConfigured) return true;
  const keys = getVapidKeys();
  if (!keys) return false;
  webPush.setVapidDetails(
    "mailto:support@example.com",
    keys.publicKey,
    keys.privateKey
  );
  vapidConfigured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

export async function sendWebPush(
  subscription: Pick<PushSubscriptionRecord, "endpoint" | "p256dh" | "auth">,
  payload: PushPayload
): Promise<boolean> {
  if (!ensureVapid()) return false;
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag ?? "chatter",
  });
  try {
    await webPush.sendNotification(pushSubscription, payloadStr, {
      TTL: 60 * 60 * 24,
      contentEncoding: "aes128gcm",
    });
    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or invalid – caller may deactivate
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn("[web-push] send failed", statusCode, err);
    }
    return false;
  }
}
