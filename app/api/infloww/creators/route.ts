import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getInflowwModels } from "@/lib/infloww-api";

export async function GET(req: Request) {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await getInflowwModels();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Infloww creators fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
