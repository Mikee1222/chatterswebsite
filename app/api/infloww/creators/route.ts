import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getInflowwModels } from "@/lib/infloww-api";

export async function GET(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "earnings:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const data = await getInflowwModels();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Infloww creators fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
