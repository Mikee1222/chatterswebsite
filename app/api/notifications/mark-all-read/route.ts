import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { markAllAsRead } from "@/services/notifications";

export async function POST() {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.airtableUserId ?? user.id;
  const marked = await markAllAsRead(userId);
  return NextResponse.json({ marked });
}
