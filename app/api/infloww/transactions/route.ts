import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getInflowwTransactions } from "@/lib/infloww-api";

export async function GET(req: Request) {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const creatorIdsRaw = searchParams.get("creatorIds");
    const creatorIds = creatorIdsRaw ? creatorIdsRaw.split(",").map((v) => v.trim()).filter(Boolean) : [];
    const from = searchParams.get("from") || searchParams.get("startDate") || undefined;
    const to = searchParams.get("to") || searchParams.get("endDate") || undefined;
    const modelId = searchParams.get("modelId") || creatorIds[0] || undefined;
    if (!from || !to) {
      return NextResponse.json({ error: "Missing required date range: from/to" }, { status: 400 });
    }
    const data = await getInflowwTransactions({
      from,
      to,
      modelId,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Infloww transactions fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
