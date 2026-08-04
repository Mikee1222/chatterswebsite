/**
 * Server-only: send web push via VAPID. Works in Cloudflare Workers (uses fetch, no Node https).
 * Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env.
 *
 * Outbound push `fetch` calls are serialized across the isolate (FIFO queue) so overlapping
 * notification work does not issue multiple push fetches at once (Cloudflare subrequest limits).
 */

import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { PushSubscriptionRecord } from "@/types";
import { devLog } from "@/lib/dev-log";

const PUSH_DEBUG = "[push-debug]";

/** FIFO queue: one push `fetch` at a time per Worker isolate. */
let pushSendQueue: Promise<unknown> = Promise.resolve();

function getVapidKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  notification_id?: string;
};

export type WebPushSendResult = {
  ok: boolean;
  /** HTTP status from the push service, or null if not reached. */
  status: number | null;
  /** True when the endpoint is gone (410/404) and the subscription should be removed. */
  stale: boolean;
  error?: string;
};

/**
 * Workers-compatible send path: uses Web Crypto + fetch instead of Node https.request.
 */
export async function sendWebPush(
  subscription: Pick<PushSubscriptionRecord, "endpoint" | "p256dh" | "auth">,
  payload: PushPayload
): Promise<WebPushSendResult> {
  const keys = getVapidKeys();
  if (!keys) {
    const msg = "VAPID not configured (missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY)";
    console.error(PUSH_DEBUG, msg);
    devLog(PUSH_DEBUG, "push skipped", JSON.stringify({ reason: "VAPID not configured" }));
    return { ok: false, status: null, stale: false, error: msg };
  }

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag ?? "chatter",
    ...(payload.notification_id ? { notification_id: payload.notification_id } : {}),
  });

  const run = pushSendQueue.then(async (): Promise<WebPushSendResult> => {
    devLog(PUSH_DEBUG, "using workers-compatible send path");
    const vapid = {
      subject: "mailto:support@gunzoteam.com",
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    };
    const pushSubscription = {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };
    const message = {
      data: payloadStr,
      options: { ttl: 60 * 60 * 24 },
    };
    const fetchPayload = await buildPushPayload(message, pushSubscription, vapid);
    const res = await fetch(subscription.endpoint, {
      ...fetchPayload,
      body: fetchPayload.body instanceof Uint8Array
        ? (fetchPayload.body.buffer as ArrayBuffer)
        : fetchPayload.body
    });
    if (res.ok || res.status === 201) {
      devLog(PUSH_DEBUG, "push success", JSON.stringify({ endpoint_preview: subscription.endpoint?.slice(0, 60) }));
      return { ok: true, status: res.status, stale: false };
    }
    const text = await res.text();
    const stale = res.status === 410 || res.status === 404;
    const detail = {
      status: res.status,
      statusText: res.statusText,
      body_preview: text?.slice(0, 200) ?? null,
      endpoint_preview: subscription.endpoint?.slice(0, 60) ?? null,
      stale,
    };
    console.error(PUSH_DEBUG, "push failure", JSON.stringify(detail));
    devLog(PUSH_DEBUG, "push failure", JSON.stringify(detail));
    return {
      ok: false,
      status: res.status,
      stale,
      error: `push service ${res.status} ${res.statusText}`.trim(),
    };
  }).catch((err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(PUSH_DEBUG, "push failure", JSON.stringify({
      error_message: errorMessage,
      endpoint_preview: subscription.endpoint?.slice(0, 60) ?? null,
    }));
    devLog(PUSH_DEBUG, "push failure", JSON.stringify({
      error_message: errorMessage,
      endpoint_preview: subscription.endpoint?.slice(0, 60) ?? null,
    }));
    return { ok: false, status: null, stale: false, error: errorMessage };
  });

  pushSendQueue = run.then(
    () => undefined,
    () => undefined
  );
  return (await run) as WebPushSendResult;
}
