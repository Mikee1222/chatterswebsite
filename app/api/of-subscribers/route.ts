import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { categorizeSubscriber, getSubscribersForModel } from "@/services/of-subscribers";

export async function GET(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "chatter") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const ofUserId = searchParams.get("of_user_id")?.trim();
  if (!ofUserId) {
    return NextResponse.json({ error: "Missing of_user_id query parameter." }, { status: 400 });
  }

  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const { subscribers, has_more } = await getSubscribersForModel(ofUserId, limit, offset);

  const withCategory = subscribers.map((sub) => ({
    ...sub,
    category: categorizeSubscriber(sub),
  }));

  return NextResponse.json({ subscribers: withCategory, has_more });
}
