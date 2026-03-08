import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getUnreadCount } from "@/services/notifications";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.airtableUserId ?? user.id;
  const count = await getUnreadCount(userId);
  return NextResponse.json({ count });
}
