import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getNotificationUserId } from "@/lib/notification-user";

const AUTH_DEBUG = "[auth-debug]";
import {
  createPushSubscription,
  findSubscriptionByUserAndEndpoint,
  updatePushSubscription,
} from "@/services/push-subscriptions";
import type { UserRole } from "@/types";

type SubscribeBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  role?: UserRole;
};

export async function POST(request: Request) {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = getNotificationUserId(user);
  const session = user;
  console.log("[push-subscribe-debug]", {
    session_user_id: (session as { userId?: string }).userId ?? session.id,
    airtable_user_id: session.airtableUserId,
    notification_user_id: getNotificationUserId(session),
  });
  console.log(AUTH_DEBUG, "push-subscribe", JSON.stringify({
    resolved_session_user_id: user.id,
    resolved_airtable_user_id: user.airtableUserId ?? null,
    user_id_used_when_saving_push_subscriptions: userId ?? null,
    route: "api/push/subscribe",
  }));
  if (userId == null) {
    return NextResponse.json({ error: "No valid user id for push subscriptions" }, { status: 401 });
  }

  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { endpoint, keys, role } = body;
  if (!endpoint || typeof endpoint !== "string" || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "Missing endpoint or keys.p256dh or keys.auth" },
      { status: 400 }
    );
  }

  try {
    const existing = await findSubscriptionByUserAndEndpoint(userId, endpoint);
    if (existing) {
      await updatePushSubscription(existing.id, {
        p256dh: keys.p256dh,
        auth: keys.auth,
        role: role ?? undefined,
      });
      console.log("[push/subscribe] Airtable save success (updated existing)", existing.id);
      return NextResponse.json({ success: true });
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    await createPushSubscription({
      subscription_id: subscriptionId,
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      role: role ?? undefined,
    });
    console.log("[push/subscribe] Airtable save success (created new)");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[push/subscribe] Airtable save failure", err);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}
