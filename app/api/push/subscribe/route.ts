import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
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

  const userId = user.airtableUserId ?? user.id;
  const userAgent = request.headers.get("user-agent") ?? "";

  try {
    const existing = await findSubscriptionByUserAndEndpoint(userId, endpoint);
    if (existing) {
      await updatePushSubscription(existing.id, {
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent,
        role: role ?? undefined,
      });
      if (process.env.NODE_ENV !== "production") {
        console.log("[push/subscribe] updated existing subscription", existing.id);
      }
      return NextResponse.json({ success: true });
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    await createPushSubscription({
      subscription_id: subscriptionId,
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent,
      role: role ?? undefined,
    });
    if (process.env.NODE_ENV !== "production") {
      console.log("[push/subscribe] created new subscription");
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[push/subscribe]", err);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}
