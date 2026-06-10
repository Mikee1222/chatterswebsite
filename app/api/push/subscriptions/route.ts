import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getActiveSubscriptionsForUser } from "@/services/push-subscriptions";

/** GET: check if the current user has any stored push subscriptions (for confirming storage). */
export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "settings:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = user.airtableUserId ?? user.id;
  let subscriptions: Awaited<ReturnType<typeof getActiveSubscriptionsForUser>> = [];
  try {
    subscriptions = await getActiveSubscriptionsForUser(userId);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[api/push/subscriptions] getActiveSubscriptionsForUser failed", err);
    }
  }

  return NextResponse.json({
    hasSubscription: subscriptions.length > 0,
    count: subscriptions.length,
  });
}
